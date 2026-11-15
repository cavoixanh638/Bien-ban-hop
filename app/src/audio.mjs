import {CaptureClockMapper} from '../../poc/02-capture/src/clock-mapper.mjs';
import {resolveMedia,choosePreRoll} from '../../poc/05-player/timeline.js';
import {contextFor,resolvePending} from './clock-bridge.mjs';
import {resolvePlaybackStart} from './playback-start.mjs';

const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
const withTimeout=(p,ms,label)=>Promise.race([p,new Promise((_,reject)=>setTimeout(()=>reject(Error(label+' quá thời hạn')),ms))]);
const stopTracks=s=>{for(const t of s?.getTracks?.()??[])try{t.stop();}catch{}};

export class AudioRPC {
  constructor() {
    this.worker=new Worker(new URL('../../poc/03-opfs/worker.mjs',import.meta.url),{type:'module'});
    this.id=0;this.pending=new Map();this.closed=false;
    this.worker.onmessage=({data})=>{
      const item=this.pending.get(data.id);if(!item)return;
      this.pending.delete(data.id);clearTimeout(item.timer);
      data.ok?item.resolve(data.result):item.reject(Error(data.error?.message??'Lỗi OPFS Worker'));
    };
    this.worker.onerror=event=>{this.failAll(Error(event.message??'Worker ngừng hoạt động'));};
  }
  failAll(error){for(const x of this.pending.values()){clearTimeout(x.timer);x.reject(error);}this.pending.clear();}
  call(action,payload={},transfer=[],timeoutMs=25000){
    if(this.closed)return Promise.reject(Error('OPFS Worker đã đóng'));
    return new Promise((resolve,reject)=>{
      const id=++this.id,timer=setTimeout(()=>{this.pending.delete(id);reject(Error('OPFS '+action+' timeout'));},timeoutMs);
      this.pending.set(id,{resolve,reject,timer});
      try{this.worker.postMessage({id,action,payload},transfer);}catch(e){clearTimeout(timer);this.pending.delete(id);reject(e);}
    });
  }
  async dispose(){
    if(this.closed)return;
    try{await this.call('close',{},[],4000);}catch{}
    this.closed=true;this.failAll(Error('Worker đã đóng'));this.worker.terminate();
  }
}

export class CaptureSession {
  constructor({meetingId,recordingId,onEvent=()=>{},onError=()=>{}}){
    this.meetingId=meetingId;this.recordingId=recordingId;this.onEvent=onEvent;this.onError=onError;
    this.state='idle';this.rate=0;this.generation='g10-'+recordingId;
    this.committedSampleExclusive=0;this.failed=null;this.cancelled=false;this.permissionPendingCleanup=false;
    this.lastAppend=Promise.resolve();this.startedAt=Date.now();
  }
  emit(type,detail){this.onEvent(type,detail??{});}
  async start(){
    if(this.state!=='idle')throw Error('Đã có phiên thu đang hoạt động');
    if(!navigator.mediaDevices?.getUserMedia||!globalThis.AudioWorkletNode)throw Error('Trình duyệt chưa hỗ trợ AudioWorklet/micro');
    this.state='starting';this.cancelled=false;this.emit('starting');
    let abort;const cancelled=new Promise((_,reject)=>{abort=()=>reject(Error('Người dùng hủy cấp quyền'));});
    this.abortPermissionWait=abort;
    const permission=navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false},video:false});
    this.permissionPendingCleanup=true;
    permission.then(stream=>{
      this.permissionPendingCleanup=false;
      if(this.cancelled)stopTracks(stream);
      this.emit('permission-settled',{cancelled:this.cancelled});
    },()=>{this.permissionPendingCleanup=false;this.emit('permission-settled',{cancelled:this.cancelled});});
    try{
      this.stream=await Promise.race([permission,cancelled]);
      if(this.cancelled)throw Error('Đã hủy phiên ghi');
      this.context=new AudioContext({latencyHint:'interactive'});
      await this.context.resume();
      this.rate=this.context.sampleRate;
      this.mapper=new CaptureClockMapper(this.rate,{recordingId:this.recordingId});
      this.rpc=new AudioRPC();
      await this.rpc.call('init',{recordingId:this.recordingId,sampleRate:this.rate,channels:1,segmentSeconds:300});
      await this.context.audioWorklet.addModule(new URL('../../poc/02-capture/src/capture-processor.js',import.meta.url));
      if(this.cancelled)throw Error('Đã hủy phiên ghi');
      this.node=new AudioWorkletNode(this.context,'transfer-capture',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});
      this.port=new MessageChannel();
      this.node.port.onmessage=({data})=>this.workletEvent(data);
      this.port.port2.onmessage=({data})=>this.transportEvent(data);
      this.port.port2.start();
      this.source=this.context.createMediaStreamSource(this.stream);
      this.mute=this.context.createGain();this.mute.gain.value=0;
      this.source.connect(this.node);this.node.connect(this.mute);this.mute.connect(this.context.destination);
      const ready=new Promise(resolve=>{this.ready=resolve;});
      this.node.port.postMessage({type:'attach',port:this.port.port1,recordingId:this.recordingId,
        batchFrames:4096,poolSize:32,channels:1},[this.port.port1]);
      await withTimeout(ready,5000,'Worklet ready');
      if(this.cancelled)throw Error('Đã hủy phiên ghi');
      const started=new Promise(resolve=>{this.started=resolve;});
      this.node.port.postMessage({type:'start'});
      await withTimeout(started,5000,'Worklet started');
      if(this.cancelled)throw Error('Đã hủy phiên ghi');
      this.state='capturing';this.emit('recording',{sampleRate:this.rate});
      this.statsInterval=setInterval(()=>this.node?.port.postMessage({type:'stats'}),1000);
      this.flushInterval=setInterval(()=>this.flush().catch(e=>this.handleFailure(e)),5000);
      return {recordingId:this.recordingId,sampleRate:this.rate};
    }catch(error){
      if(!this.cancelled)this.handleFailure(error);
      await this.cleanup();
      this.state=this.cancelled?'stopped':'failed';
      throw error;
    }
  }
  workletEvent(data){
    if(!data||typeof data.type!=='string')return;
    if(['started','progress','paused','resumed','gap','unavailable','stopped'].includes(data.type)){
      try{this.mapper?.receive(data,this.context?.getOutputTimestamp?.(),performance.now());}catch(error){this.onError(error);}
      this.emit('clock',{type:data.type,sampleIndex:data.sampleIndex,clock:this.mapper?.summary()});
    }
    if(data.type==='ready')this.ready?.();
    if(data.type==='started')this.started?.();
    if(data.type==='error')this.handleFailure(Error('AudioWorklet: '+data.reason));
    if(data.type==='gap')this.emit('gap',data);
  }
  transportEvent(data){
    if(data?.type==='source-ended'){this.sourceEnded?.();return;}
    if(data?.type!=='chunk')return;
    const chunk=data.chunk;
    this.lastAppend=this.lastAppend.then(async()=>{
      if(this.failed)throw this.failed;
      const full=chunk.sampleCount===4096;
      const totalBytes=4096*chunk.channels*4;
      // G03 acknowledgement releases the buffer; it does NOT mean audio durable.
      await this.rpc.call('append',chunk,[chunk.pcm]);
      if(full&&!this.cancelled&&this.state!=='stopped'){
        const fresh=new ArrayBuffer(totalBytes);
        this.port.port2.postMessage({type:'recycle',pcm:fresh},[fresh]);
      }
    }).catch(error=>{this.handleFailure(error);throw error;});
    this.lastAppend.catch(()=>{});
  }
  handleFailure(error){if(!this.failed){this.failed=error;this.emit('error',{message:String(error?.message??error)});this.onError(error);}}
  getEditorContext(monoMs){
    if(!['capturing','starting'].includes(this.state)||!this.mapper)return {source:'unlinked',coverage:'unlinked'};
    return contextFor(this.mapper,{meetingId:this.meetingId,recordingId:this.recordingId,
      generation:this.generation,sampleRate:this.rate},monoMs);
  }
  pendingResolver(entry){
    return resolvePending(this.mapper,entry,{meetingId:this.meetingId,recordingId:this.recordingId,
      generation:this.generation,sampleRate:this.rate,committedSampleExclusive:this.committedSampleExclusive});
  }
  async flush(){
    if(!this.rpc||this.failed)throw this.failed??Error('Chưa có OPFS worker');
    await this.lastAppend;
    const result=await this.rpc.call('flush');
    this.committedSampleExclusive=result.committedThroughSampleExclusive;
    this.emit('committed',result);
    return result;
  }
  async pause(){
    if(this.state!=='capturing')throw Error('Không đang ghi');
    this.node.port.postMessage({type:'pause'});this.state='paused';
    await this.flush();this.emit('paused');
  }
  resume(){
    if(this.state!=='paused')throw Error('Không ở trạng thái tạm dừng');
    this.node.port.postMessage({type:'resume'});this.state='capturing';this.emit('resumed');
  }
  async stop(){
    if(this.stopPromise)return this.stopPromise;
    this.cancelled=true;this.abortPermissionWait?.();
    this.stopPromise=(async()=>{
      if(this.state==='idle'||this.state==='stopped')return {permissionPendingCleanup:this.permissionPendingCleanup};
      this.state='stopping';clearInterval(this.statsInterval);clearInterval(this.flushInterval);
      let error;
      try{
        if(this.node){
          const ended=new Promise(resolve=>{this.sourceEnded=resolve;});
          this.node.port.postMessage({type:'stop'});
          await withTimeout(ended,5000,'AudioWorklet stop');
          await this.lastAppend;
          await this.flush();
        }
      }catch(e){error=e;this.handleFailure(e);}
      finally{await this.cleanup();}
      this.state=error?'failed':'stopped';this.emit(this.state,{permissionPendingCleanup:this.permissionPendingCleanup});
      if(error)throw error;
      return {recordingId:this.recordingId,samples:this.committedSampleExclusive,permissionPendingCleanup:this.permissionPendingCleanup};
    })();
    return this.stopPromise;
  }
  async cleanup(){
    clearInterval(this.statsInterval);clearInterval(this.flushInterval);
    try{this.node?.disconnect();this.source?.disconnect();this.mute?.disconnect();}catch{}
    try{this.port?.port2?.close();}catch{}
    stopTracks(this.stream);
    try{await this.context?.close();}catch{}
    try{await this.rpc?.dispose();}catch{}
  }
}

/** Streaming C2-style scheduler over durable G03 seek; not a gapless/voice-preserving production engine. */
export class AudioPlayer {
  constructor(onEvent=()=>{}){this.onEvent=onEvent;this.playing=false;this.sources=new Set();this.rate=1;}
  async ensure(recordingId){
    if(this.recordingId===recordingId&&this.reader)return;
    await this.closeReader();
    this.reader=new AudioRPC();await this.reader.call('init',{recordingId,reopen:true});
    this.recordingId=recordingId;this.manifest=await this.reader.call('manifest');
    this.safeManifest={...this.manifest,segments:this.manifest.segments.map(s=>({...s,completionState:
      s.completionState==='checkpointed'||s.completionState==='finalized'?'complete':s.completionState}))};
  }
  async start(recordingId,offsetMs,{preRollMs=0,rate=1}={}){
    this.stop();
    await this.ensure(recordingId);
    this.rate=rate;
    const check=resolvePlaybackStart(this.safeManifest,recordingId,offsetMs,preRollMs,resolveMedia,choosePreRoll);
    if(check.status!=='valid'){this.onEvent('unavailable',check);return check;}
    if(check.preRollLimited)this.onEvent('preroll-limited',check);
    if(!this.context)this.context=new AudioContext();
    await this.context.resume();
    this.playing=true;this.nextSample=Math.round(check.startMs*this.manifest.sampleRate/1000);
    this.scheduledUntil=this.context.currentTime+0.06;
    this.startOffsetMs=check.startMs;this.underruns=0;
    this.timer=setInterval(()=>this.fill().catch(e=>this.stopWithError(e)),180);
    await this.fill();
    this.onEvent('playing',{recordingId,offsetMs:check.startMs,rate});
    return {status:'valid'};
  }
  async fill(){
    if(!this.playing||this.filling)return;
    this.filling=true;
    try{
      let scheduled=0;
      while(this.playing && this.scheduledUntil<this.context.currentTime+0.7 && scheduled++<4){
        const ms=Math.round(this.nextSample*1000/this.manifest.sampleRate);
        const resolved=resolveMedia(this.safeManifest,this.recordingId,ms);
        if(resolved.status!=='valid'){this.stop();this.onEvent('unavailable',resolved);return;}
        const n=Math.max(1,Math.min(Math.round(this.manifest.sampleRate*0.4),
          Math.floor((resolved.clipEndMs-ms)*this.manifest.sampleRate/1000)));
        if(!n){this.stop();return;}
        const result=await this.reader.call('seek',{sample:this.nextSample,count:n},[],8000);
        if(result.status!=='valid'){this.stop();this.onEvent('unavailable',result);return;}
        const samples=new Float32Array(result.pcm);
        const buffer=this.context.createBuffer(1,n,this.manifest.sampleRate);
        buffer.getChannelData(0).set(samples);
        const node=this.context.createBufferSource();node.buffer=buffer;node.playbackRate.value=this.rate;
        node.connect(this.context.destination);this.sources.add(node);
        node.onended=()=>this.sources.delete(node);
        const earliest=this.context.currentTime+0.02;
        if(this.scheduledUntil<earliest){this.underruns++;this.scheduledUntil=earliest;this.onEvent('underrun',{count:this.underruns});}
        node.start(this.scheduledUntil);
        this.scheduledUntil+=n/this.manifest.sampleRate/this.rate;this.nextSample+=n;
      }
    }finally{this.filling=false;}
  }
  stopWithError(e){this.stop();this.onEvent('error',{message:String(e?.message??e)});}
  stop(){this.playing=false;clearInterval(this.timer);for(const s of this.sources)try{s.stop();}catch{}this.sources.clear();}
  async closeReader(){this.stop();await this.reader?.dispose();this.reader=null;this.recordingId=null;}
  async dispose(){await this.closeReader();await this.context?.close();}
}
