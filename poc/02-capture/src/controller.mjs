import {MediaRecorderProbe} from './media-recorder.mjs';
import {CaptureClockMapper} from './clock-mapper.mjs';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const timeout = (promise, ms, label) => {
  let handle;
  return Promise.race([Promise.resolve(promise), new Promise((_,reject)=>{
    handle=setTimeout(()=>reject(new Error(`timeout: ${label}`)),ms);
  })]).finally(()=>clearTimeout(handle));
};
const isAbort = error => error?.name === 'AbortError';
function cancelled() {const error = new Error('capture start cancelled before ready'); error.name='AbortError';return error;}
function ensureConfig(config) {
  const {engine,source,batchFrames,poolSize,maxQueue,delayMs,cpuBurnMs,mediaTimesliceMs,maxPrefixSeconds,targetMidSeconds}=config;
  if (!['both','pcm','media'].includes(engine) || !['synthetic','microphone','display-audio'].includes(source) ||
      ![2048,4096].includes(batchFrames) || !Number.isInteger(poolSize) || poolSize<2 || poolSize>64 ||
      !Number.isInteger(maxQueue) || maxQueue<1 || maxQueue>128 ||
      !Number.isFinite(delayMs) || delayMs<0 || delayMs>5000 ||
      !Number.isFinite(cpuBurnMs) || cpuBurnMs<0 || cpuBurnMs>1000 ||
      !Number.isFinite(mediaTimesliceMs) || mediaTimesliceMs<250 || mediaTimesliceMs>5000 ||
      !Number.isFinite(maxPrefixSeconds) || maxPrefixSeconds<0 || maxPrefixSeconds>30 ||
      (targetMidSeconds!==null && (!Number.isFinite(targetMidSeconds) || targetMidSeconds<0 || targetMidSeconds>10800))) {
    throw new RangeError('invalid-configuration');
  }
}

/** A single-use recorder. stop() can race pending permissions and all awaited setup steps. */
export class CaptureComparison {
  constructor(onUpdate = () => {}, {mediaStopTimeoutMs=10000,workerDrainTimeoutMs=25000}={}) {
    this.onUpdate = onUpdate;
    this.mediaStopTimeoutMs=mediaStopTimeoutMs;
    this.workerDrainTimeoutMs=workerDrainTimeoutMs;
    this.state = 'idle';
    this.started = false;
    this.stopping = false;
    this.events = [];
    this.source = null;
    this.workletFinal = null;
    this.workerErrors = [];
    this.trackInfo = null;
    this.resourcesReleased = false;
    this._releasedTracks = new Set();
    this.permissionPendingCleanup = false;
    this.permissionSource = null;
    this.cleanupFinished = false;
    this.cancelStartResolve = null;
  }
  log(type, details = {}) {
    const event = {...details, type, inputMonoMs: performance.now()};
    this.eventCount = (this.eventCount || 0) + 1;
    if (this.events.length >= 1500) this.events.shift();
    this.events.push(event);
    try {this.onUpdate(event);} catch { /* View callbacks must never break audio lifecycle. */ }
  }
  requireStarting() {
    if (this.stopping || this.state !== 'starting') throw cancelled();
  }
  start({engine='both',source='synthetic',batchFrames=2048,poolSize=8,maxQueue=6,
    delayMs=0,cpuBurnMs=0,mediaTimesliceMs=600,maxPrefixSeconds=8,targetMidSeconds=null}={}) {
    if (this.state !== 'idle') throw new Error(`capture is ${this.state}; start is single-use`);
    const config={engine,source,batchFrames,poolSize,maxQueue,delayMs,cpuBurnMs,mediaTimesliceMs,maxPrefixSeconds,targetMidSeconds};
    ensureConfig(config); // before asking for a device, creating context or allocating a buffer
    this.state='starting';
    this.started=true;
    this.engine=engine;
    this.source=source;
    this.recordingId=`capture-poc-${Math.round(performance.timeOrigin)}-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
    this.config=config;
    this.cancelStartSignal = new Promise(resolve=>{this.cancelStartResolve=resolve;});
    this.startPromise=this._begin(config);
    return this.startPromise;
  }
  /** Stop tracks from an asynchronously granted permission even after a cancelled Start. */
  releaseTracks(stream) {
    for (const track of stream?.getTracks?.() || []) {
      if (this._releasedTracks.has(track)) continue;
      try {track.stop();} catch(error) {this.log('cleanup-error',{resource:'late-permission-track',reason:String(error)});}
      this._releasedTracks.add(track);
    }
  }
  /**
   * getUserMedia/getDisplayMedia cannot be aborted by a browser AbortSignal.
   * Race only OUR wait against cancellation; keep the original request watched
   * until it settles, and stop any tracks granted after Stop.
   */
  async awaitPermission(request,source) {
    const permission=Promise.resolve(request);
    this.permissionPendingCleanup=true;
    this.permissionSource=source;
    this.resourcesReleased=false;
    permission.then(stream=>{
      this.permissionPendingCleanup=false;
      if(this.stopping || this.state!=='starting') {
        this.releaseTracks(stream);
        if(this.cleanupFinished)this.resourcesReleased=true;
        this.log('permission-settled',{source,decision:'granted',lateCleanup:true});
      } else {
        this.log('permission-settled',{source,decision:'granted',lateCleanup:false});
      }
    },error=>{
      this.permissionPendingCleanup=false;
      if(this.stopping && this.cleanupFinished)this.resourcesReleased=true;
      this.log('permission-settled',{source,decision:'rejected',lateCleanup:this.stopping,
        reason:String(error)});
    });
    return Promise.race([permission,this.cancelStartSignal.then(()=>{throw cancelled();})]);
  }
  async _begin({engine,source,batchFrames,poolSize,maxQueue,delayMs,cpuBurnMs,mediaTimesliceMs,maxPrefixSeconds,targetMidSeconds}) {
    try {
      let stream=null;
      if (source==='microphone') {
        stream=await this.awaitPermission(navigator.mediaDevices.getUserMedia({
          audio:{echoCancellation:false,noiseSuppression:false},video:false}),'microphone');
        this.inputStream=stream; // Store before checking cancellation so late grants are stopped.
        this.requireStarting();
      } else if (source==='display-audio') {
        this.displayStream=await this.awaitPermission(
          navigator.mediaDevices.getDisplayMedia({audio:true,video:true}),'display-audio');
        this.requireStarting();
        stream=new MediaStream(this.displayStream.getAudioTracks());
        this.inputStream=stream;
        if (!stream.getAudioTracks().length) throw new Error('TC21: screen share returned NO audio track');
      }
      this.context=new AudioContext({latencyHint:'interactive'});
      this.sampleRate=this.context.sampleRate;
      if (stream) {
        this.sourceNode=this.context.createMediaStreamSource(stream);
        this.trackInfo=stream.getAudioTracks().map(track=>({
          kind:track.kind,label:track.kind==='audio'?'audio-track':'other-track',
          readyState:track.readyState,
          settings:(()=>{const s=track.getSettings?.()||{};
            return {sampleRate:s.sampleRate??null,channelCount:s.channelCount??null,
              echoCancellation:s.echoCancellation??null,noiseSuppression:s.noiseSuppression??null};})()
        }));
        for (const track of stream.getAudioTracks()) {
          track.addEventListener('ended',()=>{
            if (!this.stopping && ['starting','capturing'].includes(this.state)) {
              this.log('track-ended',{trackLabel:track.label,gap:'unavailable'});
              this.node?.port.postMessage({type:'unavailable',reason:'track-ended'});
              this.stop().catch(error=>this.log('stop-error',{reason:String(error)}));
            }
          },{once:true});
        }
      } else {
        this.oscillator=this.context.createOscillator();
        const gain=this.context.createGain();
        this.oscillator.type='sine';
        this.oscillator.frequency.setValueAtTime(437,this.context.currentTime);
        // Deterministic minute markers in a 3h synthetic run: 1200Hz for 120ms.
        // The marker is part of the SAME fanout observed by both capture engines.
        const t0=this.context.currentTime;
        for(let minute=0;minute<=180;minute++){
          const t=t0+minute*60;
          this.oscillator.frequency.setValueAtTime(1200,t);
          this.oscillator.frequency.setValueAtTime(437,t+0.12);
        }
        gain.gain.value=.18;
        this.oscillator.connect(gain);
        this.sourceNode=gain;
        this.trackInfo=[{kind:'synthetic',label:'437 Hz sine, same WebAudio fanout'}];
      }
      await this.context.resume();
      this.requireStarting();
      let workletStarted=null;
      if (engine==='both' || engine==='pcm') {
        await this.context.audioWorklet.addModule(new URL('./capture-processor.js',import.meta.url));
        this.requireStarting();
        this.node=new AudioWorkletNode(this.context,'transfer-capture',{
          numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],channelCount:1,channelCountMode:'explicit'});
        this.mute=this.context.createGain();this.mute.gain.value=0;
        this.sourceNode.connect(this.node);
        this.node.connect(this.mute).connect(this.context.destination);
        this.worker=new Worker(new URL('./sink-worker.mjs',import.meta.url),{type:'module'});
        const channel=new MessageChannel();
        this.workerPort=channel.port2;
        let readyResolve,readyReject,nodeReadyResolve,nodeReadyReject,startedResolve,startedReject;
        const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
        const nodeReady=new Promise((resolve,reject)=>{nodeReadyResolve=resolve;nodeReadyReject=reject;});
        workletStarted=new Promise((resolve,reject)=>{startedResolve=resolve;startedReject=reject;});
        workletStarted.catch(()=>{});
        this.final=new Promise((resolve,reject)=>{this.finalResolve=resolve;this.finalReject=reject;});
        this.final.catch(()=>{}); // Worker error before Stop must not become an unhandled rejection.
        this.worker.onmessage=event=>{
          const message=event.data;
          if (message.type==='ready') readyResolve();
          if (message.type==='final') {this.workletFinal=message.metrics;this.finalResolve(message.metrics);}
          if (message.type==='error') {
            this.workerErrors.push(message.reason);
            this.log('worker-error',{reason:message.reason});
            if (this.state==='starting') readyReject(new Error(message.reason));
          }
          if (message.type==='wav') this.wavResolve?.(message);
          if (message.type==='export-error') this.wavReject?.(new Error(message.reason));
          if (message.type==='snapshot') this.snapshotResolve?.(message.metrics);
        };
        this.worker.onerror=event=>{
          const error=new Error(event.message || 'Worker crashed');
          this.log('worker-crash',{reason:error.message});
          readyReject(error);this.finalReject(error);
          if (this.state==='capturing') this.stop().catch(()=>{});
        };
        this.clock=new CaptureClockMapper(this.sampleRate,{recordingId:this.recordingId});
        this.node.port.onmessage=event=>{
          const message=event.data;
          if (message.type==='ready') nodeReadyResolve();
          if (message.type==='started') startedResolve(message);
          if (message.type==='error') {
            this.log('worklet-error',message);
            nodeReadyReject(new Error(message.reason));
            startedReject(new Error(message.reason));
            if (this.state==='capturing') this.stop().catch(()=>{});
          }
          this.clock.receive(message,this.safeAudioTimestamp(),performance.now());
          this.log('worklet-'+message.type,message);
        };
        this.worker.postMessage({type:'attach',port:channel.port2,recordingId:this.recordingId,
          sampleRate:this.sampleRate,delayMs,cpuBurnMs,maxQueue,maxPrefixSeconds,targetMidSeconds},[channel.port2]);
        this.workerPort=null; // Transferred; Worklet owns other end.
        await timeout(ready,5000,'worker ready');
        this.requireStarting();
        this.node.port.postMessage({type:'attach',port:channel.port1,recordingId:this.recordingId,
          batchFrames,channels:1,poolSize},[channel.port1]);
        await timeout(nodeReady,5000,'worklet ready');
        this.requireStarting();
      }
      if (engine==='both' || engine==='media') {
        this.destination=this.context.createMediaStreamDestination();
        this.sourceNode.connect(this.destination);
        this.media=new MediaRecorderProbe(this.destination.stream,{timesliceMs:mediaTimesliceMs});
      }
      this.requireStarting();
      if (this.oscillator) {this.oscillator.start();this.oscillatorStarted=true;}
      // Start ACK/sample index is issued by the worklet, NOT by this page timestamp.
      this.media?.start();
      this.node?.port.postMessage({type:'start'});
      if (this.node) {
        await timeout(workletStarted,3000,'worklet START ACK');
        this.requireStarting();
      }
      this.state='capturing';
      this.startMonoMs=performance.now();
      if (this.node) this.statsTimer=setInterval(()=>{
        if (this.state==='capturing') this.node?.port.postMessage({type:'stats'});
      },700);
      this.log('started',{recordingId:this.recordingId,engine,source,sampleRate:this.sampleRate,
        crossOriginIsolated:globalThis.crossOriginIsolated,messageChannel:!!this.node,
        sharedArrayBufferUsed:false,trackInfo:this.trackInfo});
      return this;
    } catch(error) {
      this.log(isAbort(error)?'start-cancelled':'start-error',{reason:String(error)});
      if (!this.stopping) this.state='failed';
      await this.cleanup(false);
      throw error;
    }
  }
  safeAudioTimestamp() {
    try {return this.context?.getOutputTimestamp?.() || null;} catch {return null;}
  }
  pause() {
    if (this.state!=='capturing') return;
    this.node?.port.postMessage({type:'pause'});
    this.media?.pause();
    this.log('pause-request');
  }
  resume() {
    if (this.state!=='capturing') return;
    this.node?.port.postMessage({type:'resume'});
    this.media?.resume();
    this.log('resume-request');
  }
  simulateTrackEnd() {
    if (this.inputStream) {
      for (const track of this.inputStream.getAudioTracks()) {
        track.stop(); this._releasedTracks.add(track);
      }
      this.log('simulated-input-loss',{source:this.source});
      this.node?.port.postMessage({type:'unavailable',reason:'synthetic-track-stop'});
      this.stop().catch(error=>this.log('stop-error',{reason:String(error)}));
    } else {
      this.log('simulated-input-loss',{source:'synthetic'});
      this.node?.port.postMessage({type:'unavailable',reason:'synthetic-source-lost'});
      this.stop().catch(error=>this.log('stop-error',{reason:String(error)}));
    }
  }
  async stop() {
    if (this.stopPromise) return this.stopPromise;
    this.stopping=true;
    this.cancelStartResolve?.(); // unblocks pending permission without claiming browser prompt closed
    this.cancelStartResolve=null;
    const prior=this.state;
    this.state='stopping';
    clearInterval(this.statsTimer);
    this.stopPromise=(async()=>{
      let error=null,pcmFinal=null,mediaFinal=null;
      try {
        if (prior==='starting') {
          await this.startPromise.catch(e=>{if(!isAbort(e))error=e;});
          this.endedMonoMs=performance.now();
          if(error)throw error;
          this.log('stopped',{reason:'cancelled-during-start',permissionPendingCleanup:this.permissionPendingCleanup});
        } else if (prior==='capturing') {
          this.node?.port.postMessage({type:'stop'});
          // Settle both sides even when one fails. The sink ACK is NOT a durability ACK.
          const outcomes=await Promise.allSettled([
            this.media ? timeout(this.media.stop(),this.mediaStopTimeoutMs,'media stop') : Promise.resolve(null),
            this.worker ? timeout(this.final,this.workerDrainTimeoutMs,'sink drain') : Promise.resolve(null)
          ]);
          if(outcomes[0].status==='fulfilled')mediaFinal=outcomes[0].value;
          else error=outcomes[0].reason;
          if(outcomes[1].status==='fulfilled')pcmFinal=outcomes[1].value;
          else error ??= outcomes[1].reason;
          if(this.workerErrors.length)error ??= new Error('worker errors: '+this.workerErrors.join('; '));
          this.endedMonoMs=performance.now();
          if(error)throw error;
          this.log('stopped',{pcmFrames:pcmFinal?.receivedFrames,mediaBytes:mediaFinal?.totalBytes});
        } else if (prior==='failed') {
          throw new Error('capture already failed');
        }
      } catch(e) {
        error=e;
        this.log('stop-error',{reason:String(e)});
      } finally {
        await this.cleanup(!error && prior==='capturing');
        this.state=error?'failed':'stopped';
        if (this.permissionPendingCleanup) this.log('permission-pending-cleanup',{
          source:this.permissionSource,reason:'browser permission prompt has not settled; Start must remain disabled'});
      }
      if(error)throw error;
      return this.results(); // after cleanup, so state/resourcesReleased are truthful
    })();
    return this.stopPromise;
  }
  async cleanup(keepDiagnosticWorker=false) {
    if (this.cleanupPromise) {
      await this.cleanupPromise;
      if (!keepDiagnosticWorker) this.terminateWorker();
      this.resourcesReleased=!this.permissionPendingCleanup;
      return;
    }
    this.cleanupPromise=(async()=>{
      clearInterval(this.statsTimer);
      // This is the only place that releases tracks/context/resources; never skip on reject.
      const all=[...(this.inputStream?.getTracks?.() || []),...(this.displayStream?.getTracks?.() || [])];
      this.releaseTracks({getTracks:()=>[...new Set(all)]});
      if (this.media?.recorder?.state && this.media.recorder.state!=='inactive') {
        try {await timeout(this.media.stop(),Math.min(this.mediaStopTimeoutMs,2000),'force recorder stop');}
        catch(error) {this.log('cleanup-error',{resource:'MediaRecorder',reason:String(error)});}
      }
      if (this.oscillatorStarted) {
        try {this.oscillator.stop();} catch(error) {this.log('cleanup-error',{resource:'oscillator',reason:String(error)});}
        this.oscillatorStarted=false;
      }
      for (const node of [this.sourceNode,this.node,this.destination,this.mute,this.oscillator]) {
        try {node?.disconnect?.();} catch { /* Optional disconnect. */ }
      }
      try {await timeout(this.context?.close(),4500,'AudioContext.close');}
      catch(error) {this.log('cleanup-error',{resource:'AudioContext',reason:String(error)});}
      this.cleanupFinished=true;
      this.resourcesReleased=!this.permissionPendingCleanup;
    })();
    await this.cleanupPromise;
    if (!keepDiagnosticWorker) this.terminateWorker();
    this.resourcesReleased=!this.permissionPendingCleanup;
  }
  terminateWorker() {
    try {this.worker?.terminate();} catch {}
    this.worker=null;
    try {this.workerPort?.close?.();} catch {}
    this.workerPort=null;
  }
  async exportPcmPrefixWav() {
    if (!this.worker || !this.workletFinal || this.state!=='stopped') throw new Error('no finalized PCM diagnostic prefix');
    const answer=new Promise((resolve,reject)=>{this.wavResolve=resolve;this.wavReject=reject;});
    this.worker.postMessage({type:'export-prefix'});
    return timeout(answer,4000,'export WAV');
  }
  /** A thin adapter for the editor/timeline integration phase. No Mark mutation. */
  resolveInputAnchor(inputMonoMs,anchorId=null) {
    if(!this.clock) return {status:'unlinked',reason:'No PCM clock timeline',
      inputMonoMs,recordingId:this.recordingId};
    return anchorId===null ? this.clock.resolveInput(inputMonoMs)
      : this.clock.queueInput(inputMonoMs,anchorId);
  }
  takeInputResolutions() {return this.clock?.takeInputResolutions() || [];}
  results() {
    this.clock?.applySinkGaps(this.workletFinal?.sourceEvents);
    const mapping=this.clock?.summary();
    return {config:this.config,recordingId:this.recordingId,state:this.state,
      clockMapping:mapping?.mappingPoints || [],clockIntervals:mapping?.intervals || [],
      clockCalibration:mapping || {status:'NOT_RUN',reason:'No PCM engine'},
      actualSampleRate:this.sampleRate,trackInfo:this.trackInfo,
      runtimeMs:Number.isFinite(this.endedMonoMs) && Number.isFinite(this.startMonoMs)?this.endedMonoMs-this.startMonoMs:null,
      isolated:globalThis.crossOriginIsolated,pcm:this.workletFinal,media:this.media?.metrics() || null,
      events:this.events.slice(-400),eventCount:this.eventCount || 0,
      workerErrors:this.workerErrors,browserHeapBytes:performance.memory?.usedJSHeapSize ?? null,
      resourcesReleased:this.resourcesReleased,
      permissionPendingCleanup:this.permissionPendingCleanup,
      permissionSource:this.permissionPendingCleanup?this.permissionSource:null,
      limitations:[this.permissionPendingCleanup?'Browser permission prompt unresolved: no claim of track release':null,
        'Pool recycle ≠ durable storage ACK',
        'Output timestamp calibrates render timeline, NOT physical mic input latency',
        'Never interpolate across paused, gap, unavailable; check independent sink coverage',
        'MediaRecorder timeslice does not prove independently seekable chunks'].filter(Boolean)};
  }
  async dispose() {
    if (!this.stopping && ['starting','capturing'].includes(this.state)) {
      try {await this.stop();} catch {};
    }
    await this.cleanup(false);
    await this.media?.dispose?.();
  }
}

export async function verifyDecodable(blob, {maxWaitMs = 5000,maxDecodeBytes = 16_000_000} = {}) {
  if (!blob?.size) return {decoded:false,error:'empty blob'};
  const result={mimeType:blob.type,bytes:blob.size,decoded:false,durationSeconds:null,
    seekMidpoint:false,seekNearEnd:false,error:null,decodeAttempted:false};
  let ctx,audio,url;
  if (blob.size <= maxDecodeBytes) {
    try {
      ctx=new AudioContext();
      const bytes=await blob.arrayBuffer();
      const decoded=await timeout(ctx.decodeAudioData(bytes.slice(0)),maxWaitMs,'decodeAudioData');
      result.decoded=true;
      result.durationSeconds=decoded.duration;
      result.decodedFrames=decoded.length;
      result.decodedSampleRate=decoded.sampleRate;
      result.decodeAttempted=true;
    } catch(error) {result.error=`decode: ${String(error)}`;result.decodeAttempted=true;}
    finally {await ctx?.close();}
  } else result.decodeSkipReason='full decode would exceed bounded RAM budget';
  try {
    url=URL.createObjectURL(blob);
    audio=document.createElement('audio');
    audio.preload='metadata';audio.src=url;
    await timeout(new Promise((resolve,reject)=>{
      audio.addEventListener('loadedmetadata',resolve,{once:true});
      audio.addEventListener('error',()=>reject(new Error('HTMLAudioElement error')),{once:true});
    }),maxWaitMs,'metadata');
    result.mediaElementDurationSeconds=Number.isFinite(audio.duration)?audio.duration:null;
    result.metadataReadable=true;
    for (const [key,fraction] of [['seekMidpoint',.5],['seekNearEnd',.9]]) {
      if (!(audio.duration>0) || !Number.isFinite(audio.duration)) break;
      const target=Math.max(0,audio.duration*fraction);
      const event=new Promise((resolve,reject)=>{
        audio.addEventListener('seeked',resolve,{once:true});
        audio.addEventListener('error',()=>reject(new Error('seek error')),{once:true});
      });
      audio.currentTime=target;
      await timeout(event,maxWaitMs,key);
      result[key]=Math.abs(audio.currentTime-target)<.5;
    }
  } catch(error) {result.error=(result.error?result.error+'; ':'')+`seek: ${String(error)}`;}
  finally {if(audio){audio.removeAttribute('src');audio.load();}if(url)URL.revokeObjectURL(url);}
  return result;
}

export async function runAutomated(config={}) {
  const durationMs=config.durationMs ?? 2600;
  const run=new CaptureComparison();
  await run.start(config);
  await wait(durationMs*.45);
  if(config.pauseResume!==false){run.pause();await wait(Math.min(230,durationMs*.12));run.resume();}
  await wait(durationMs*.55);
  let result;
  try {
    result=await run.stop();
    if(run.media){
      const mediaFile=await run.media.getCompleteBlob();
      if(mediaFile) result.mediaVerification=await verifyDecodable(mediaFile);
      result.mediaPartVerification=run.media.parts.length>1?await verifyDecodable(run.media.parts[1]):null;
    }
    if(run.worker){
      try {const wav=await run.exportPcmPrefixWav();
        result.pcmPrefixVerification=await verifyDecodable(new Blob([wav.wav],{type:'audio/wav'}));
        result.pcmPrefixVerification.frames=wav.frames;
      }catch(error){result.pcmPrefixVerification={decoded:false,error:String(error)};}
    }
  } finally {await run.dispose();}
  return result;
}
