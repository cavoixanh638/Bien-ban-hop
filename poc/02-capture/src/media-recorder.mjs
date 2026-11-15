import {percentile} from './contract.mjs';
import {BoundedBlobSpool,createOpfsDiagnosticWriter} from './stream-spool.mjs';

export class MediaRecorderProbe {
  constructor(stream,{timesliceMs=1000,maxRetainedBytes=20_000_000,
    spool='auto',spoolFactory=null,maxSpoolQueueBytes=8_000_000}={}) {
    if(typeof MediaRecorder==='undefined') throw new Error('MediaRecorder unsupported');
    const selected=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus']
      .find(mimeType=>MediaRecorder.isTypeSupported(mimeType));
    this.recorder=new MediaRecorder(stream,selected?{mimeType:selected,audioBitsPerSecond:64000}:{});
    this.timesliceMs=timesliceMs;
    this.maxRetainedBytes=maxRetainedBytes;
    this.parts=[];
    this.bytes=0;
    this.retainedBytes=0;
    this.truncated=false;
    this.events=[];
    this.eventCount=0;
    this.cadences=[];
    this.cadenceCount=0;
    this.cadenceTotalMs=0;
    this.cadenceMaxMs=0;
    this.lastBlobAt=null;
    this.startedAt=null;
    this.stopAttemptPromise=null;
    this.endedAt=null;
    this.error=null;
    this.blobCount=0;
    this.sinkStatus=spool==='none'?'DISABLED':'UNINITIALIZED';
    const factory=spoolFactory || (globalThis.navigator?.storage?.getDirectory ?
      ()=>createOpfsDiagnosticWriter(`media-${Math.round(performance.now())}`) : null);
    if (spool!=='none' && factory) {
      this.spool=new BoundedBlobSpool(factory,{maxQueueBytes:maxSpoolQueueBytes});
      this.sinkStatus='WRITING';
    } else if(spool!=='none') this.sinkStatus='UNAVAILABLE';
    this.stopped=new Promise((resolve,reject)=>{this.resolveStop=resolve;this.rejectStop=reject;});
    this.stopped.catch(()=>{});
    this.recorder.addEventListener('dataavailable',event=>{
      const t=performance.now();
      if(this.lastBlobAt!==null) {
        const cadence=t-this.lastBlobAt;
        this.cadenceCount++;
        this.cadenceTotalMs+=cadence;
        this.cadenceMaxMs=Math.max(this.cadenceMaxMs,cadence);
        if(this.cadences.length>=2048)this.cadences.shift();
        this.cadences.push(cadence);
      }
      this.lastBlobAt=t;
      this.bytes+=event.data.size;
      this.blobCount++;
      if(!this.truncated && this.retainedBytes+event.data.size<=this.maxRetainedBytes){
        this.parts.push(event.data);this.retainedBytes+=event.data.size;
      } else this.truncated=true;
      if(this.spool && !this.spool.append(event.data))this.sinkStatus='INCOMPLETE';
      this.pushEvent({type:'dataavailable',atMs:t,size:event.data.size,eventTimecode:event.timecode??null});
    });
    this.recorder.addEventListener('error',event=>{
      this.error=String(event.error?.message||event.message||'MediaRecorder error');
      this.pushEvent({type:'error',atMs:performance.now(),reason:this.error});
      // A browser may still emit 'stop' after this event; do not report a clean stop.
      this.rejectStop(new Error(this.error));
    });
    for(const type of ['pause','resume','start'])this.recorder.addEventListener(type,()=>{
      this.pushEvent({type,atMs:performance.now()});
    });
    this.recorder.addEventListener('stop',()=>{
      this.endedAt=performance.now();
      this.pushEvent({type:'stop',atMs:this.endedAt});
      // IMPORTANT: wait for all dataavailable writes before returning successful stats.
      Promise.resolve().then(async()=>{
        if(this.spool){await this.spool.finalize();this.sinkStatus=this.spool.summary().status;}
        if(this.error)throw new Error(this.error);
        this.resolveStop(this.metrics());
      }).catch(error=>{this.error=String(error);this.rejectStop(error);});
    },{once:true});
  }
  pushEvent(event) {
    this.eventCount++;
    if(this.events.length>=160)this.events.shift();
    this.events.push(event);
  }
  start() {this.startedAt=performance.now();this.recorder.start(this.timesliceMs);}
  pause() {if(this.recorder.state==='recording')this.recorder.pause();}
  resume() {if(this.recorder.state==='paused')this.recorder.resume();}
  stop() {
    if(this.stopAttemptPromise)return this.stopAttemptPromise;
    this.stopAttemptPromise=(async()=>{
      if(this.startedAt===null)return {...this.metrics(),note:'never started'};
      if(this.recorder.state!=='inactive')this.recorder.stop();
      return this.stopped;
    })();
    return this.stopAttemptPromise;
  }
  getBlob() {
    if(this.truncated)throw new Error('MediaRecorder retained prefix was truncated');
    return new Blob(this.parts,{type:this.recorder.mimeType});
  }
  async getCompleteBlob() {
    if(this.spool) {
      const stats=this.spool.summary();
      if(stats.status==='FINISHED' && stats.writtenBytes===this.bytes) {
        const file=await this.spool.getFile();
        if(file.size===this.bytes)return new File([file],file.name,{type:this.recorder.mimeType});
      }
    }
    if(!this.truncated)return this.getBlob();
    return null;
  }
  metrics() {
    return {mimeType:this.recorder.mimeType,timesliceMs:this.timesliceMs,
      durationWallMs:this.endedAt!==null?this.endedAt-this.startedAt:null,
      totalBytes:this.bytes,retainedBytes:this.retainedBytes,truncated:this.truncated,
      blobCount:this.blobCount,
      blobCadenceP95Ms:percentile(this.cadences),
      blobCadenceMeanMs:this.cadenceCount?this.cadenceTotalMs/this.cadenceCount:null,
      blobCadenceMaxMs:this.cadenceCount?this.cadenceMaxMs:null,
      blobCadenceSampleCount:this.cadences.length,
      blobCadenceTotalCount:this.cadenceCount,
      blobCadenceP95Scope:'rolling last 2048 events',
      events:this.events.slice(-70),sampleFramesKnown:false,
      spool:this.spool?.summary() || {status:this.sinkStatus},
      error:this.error,durable:false};
  }
  async dispose() {await this.spool?.discard();}
}
