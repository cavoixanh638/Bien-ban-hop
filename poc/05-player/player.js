// PoC C: two independent engines; timeline.js owns the media/meeting distinction.
import {resolveMedia,meetingToMedia,mediaToMeeting,choosePreRoll,validateManifest} from './timeline.js';
export {meetingToMedia,mediaToMeeting,choosePreRoll,validateManifest};
export const RATE=16000,SEGMENT=300000,TOTAL=10800000,ID='synthetic-recording-01';
const segments=Array.from({length:36},(_,i)=>({segmentId:'seg-'+String(i).padStart(3,'0'),filePath:'synthetic://'+i,mediaStartMs:i*SEGMENT,mediaDurationMs:SEGMENT,sampleStart:i*SEGMENT*RATE/1000,sampleCount:SEGMENT*RATE/1000,completionState:i===20?'missing':'complete'}));
const refs=(start,end)=>segments.filter(s=>s.mediaStartMs<end&&s.mediaStartMs+s.mediaDurationMs>start).map(s=>s.segmentId);
const recorded=(ms0,ms1,a0,a1)=>({meetingStartMs:ms0,meetingEndMs:ms1,kind:'recorded',mediaStartMs:a0,mediaEndMs:a1,segmentRefs:refs(a0,a1)});
export const fixture={recordingId:ID,sampleRate:RATE,mappingPoints:[{inputMonoMs:0,sampleIndex:0},{inputMonoMs:TOTAL,sampleIndex:TOTAL*RATE/1000}],segments,
 intervals:[recorded(0,1800000,0,1800000),
  {meetingStartMs:1800000,meetingEndMs:1810000,kind:'paused',segmentRefs:[],reason:'meeting paused; no media samples'},
  recorded(1810000,3610000,1800000,3600000),
  {meetingStartMs:3610000,meetingEndMs:3625000,kind:'gap',segmentRefs:[],reason:'microphone disconnected; no media samples'},
  recorded(3625000,7445000,3600000,7420000),
  {meetingStartMs:7445000,meetingEndMs:7447000,kind:'gap',mediaStartMs:7420000,mediaEndMs:7422000,segmentRefs:[],reason:'known corrupt media samples (reserved range)'},
  recorded(7447000,10825000,7422000,TOTAL)],
 marks:[{anchorId:'boundary',recordingId:ID,audioOffsetMs:298000,typedAt:1794740000000,source:'live_recording',schemaVersion:1},{anchorId:'at90',recordingId:ID,audioOffsetMs:5400000,typedAt:1794740000000,source:'imported_playback',schemaVersion:1},{anchorId:'paused',recordingId:ID,audioOffsetMs:10200000,typedAt:1794740000000,source:'playback_paused',schemaVersion:1},{anchorId:'missing',recordingId:ID,audioOffsetMs:6060000,typedAt:1794740000000,source:'live_recording',schemaVersion:1}]};
export const resolve=(recordingId,audioOffsetMs)=>resolveMedia(fixture,recordingId,audioOffsetMs);
// Synthetic tone is indexed globally by sample, so adjacent windows must agree exactly.
const toneAt=n=>.14*Math.sin(2*Math.PI*220*n/RATE)+.06*Math.sin(2*Math.PI*440*n/RATE)+.035*Math.sin(2*Math.PI*880*n/RATE)+(n%(SEGMENT*RATE/1000)<32?.2:0);
export function windowPCM(startMs,durationMs){
 const first=Math.round(startMs*RATE/1000),length=Math.round(durationMs*RATE/1000);
 if(!Number.isSafeInteger(first)||!Number.isSafeInteger(length)||first<0||length<=0||length>RATE*2)throw Error('PCM window must be 0..2 seconds');
 const a=new Float32Array(length);for(let i=0;i<length;i++)a[i]=toneAt(first+i);return a;
}
export function segmentWAV(index,startMs=index*SEGMENT,endMs=(index+1)*SEGMENT){
 const seg=segments[index];if(!seg||startMs<seg.mediaStartMs||endMs>seg.mediaStartMs+SEGMENT||endMs<=startMs)throw Error('invalid WAV clip');
 const first=Math.round(startMs*RATE/1000),count=Math.round(endMs*RATE/1000)-first,raw=new ArrayBuffer(44+count*2),view=new DataView(raw);
 const str=(p,s)=>{for(let i=0;i<s.length;i++)view.setUint8(p+i,s.charCodeAt(i));};
 str(0,'RIFF');view.setUint32(4,36+count*2,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,RATE,true);view.setUint32(28,RATE*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,count*2,true);
 for(let i=0;i<count;i++)view.setInt16(44+i*2,Math.round(toneAt(first+i)*32767),true);
 return new Blob([raw],{type:'audio/wav'});
}
const clock=()=>performance.now();
export class C1{
 constructor(log=()=>{}){this.log=log;this.audio=[new Audio(),new Audio()];this.urls=new Map();this.idx=0;this.ms=298000;this.rate=1;this.playing=false;this.transitions=[];this.loop=null;this.epoch=0;
  for(const a of this.audio){a.preload='auto';a.preservesPitch=true;a.addEventListener('ended',()=>this.boundary(a));a.addEventListener('error',()=>this.log('audio-error',{error:a.error?.message||'media error'}));}
 }
 clipAt(ms){const r=resolve(ID,ms);if(r.status!=='valid')return r;return {...r,clipEndMs:this.loop?.enabled?Math.min(r.clipEndMs,this.loop.b):r.clipEndMs};}
 cleanup(){const inUse=new Set(this.audio.map(a=>a.dataset.clipKey).filter(Boolean));for(const [k,x] of this.urls)if(!inUse.has(k)){URL.revokeObjectURL(x.url);this.urls.delete(k);}}
 attach(a,ms){const r=this.clipAt(ms);if(r.status!=='valid'||r.clipEndMs<=ms){a.pause();a.removeAttribute('src');a.load();delete a.dataset.clipKey;this.cleanup();return r.status==='valid'?{status:'gap',reason:'A-B end'}:r;}
  const seg=segments.find(s=>s.segmentId===r.segmentId),index=segments.indexOf(seg),key=r.segmentId+':'+r.clipStartMs+':'+r.clipEndMs;
  if(!this.urls.has(key)){const blob=segmentWAV(index,r.clipStartMs,r.clipEndMs);this.urls.set(key,{url:URL.createObjectURL(blob),bytes:blob.size});}
  if(a.dataset.clipKey!==key){a.src=this.urls.get(key).url;a.dataset.clipKey=key;a.dataset.clipStart=String(r.clipStartMs);a.dataset.clipEnd=String(r.clipEndMs);a.load();}
  a.preservesPitch=true;a.playbackRate=this.rate;return r;
 }
 position(){const a=this.audio[this.idx];if(this.playing&&a.dataset.clipStart!==undefined)return Math.min(TOTAL,Number(a.dataset.clipStart)+a.currentTime*1000);return this.ms;}
 pause(){this.ms=this.position();this.playing=false;this.audio.forEach(a=>a.pause());this.epoch++;}
 async seek(ms){const r=this.clipAt(ms),started=clock();if(r.status!=='valid'){this.pause();this.log('unavailable',{ms,...r});return r;}
  const was=this.playing;this.pause();const epoch=this.epoch;this.ms=ms;this.idx=0;const a=this.audio[0];this.attach(a,ms);this.attach(this.audio[1],r.clipEndMs);this.cleanup();
  if(a.readyState<1)await new Promise((ok,no)=>{const timer=setTimeout(()=>{clean();no(Error('metadata timeout'));},12000);const clean=()=>{clearTimeout(timer);a.removeEventListener('loadedmetadata',ready);a.removeEventListener('error',error);};const ready=()=>{clean();ok();},error=()=>{clean();no(Error('invalid audio metadata'));};a.addEventListener('loadedmetadata',ready);a.addEventListener('error',error);});
  if(this.epoch!==epoch)return {status:'cancelled',reason:'newer seek'};
  a.currentTime=(ms-r.clipStartMs)/1000;this.log('seek-C1',{ms,elapsedMs:clock()-started});if(was)await this.play();return r;
 }
 async play(){const r=this.clipAt(this.ms);if(r.status!=='valid'){this.log('unavailable',{ms:this.ms,...r});return r;}
  const a=this.audio[this.idx];if(a.dataset.clipStart===undefined || !(Number(a.dataset.clipStart)<=this.ms&&this.ms<Number(a.dataset.clipEnd)))await this.seek(this.ms);
  try{await this.audio[this.idx].play();this.playing=true;}catch(error){this.playing=false;this.log('play-error',{error:String(error)});}return r;
 }
 boundary(a){if(!this.playing||a!==this.audio[this.idx])return;const ms=Number(a.dataset.clipEnd);this.ms=ms;
  if(this.loop?.enabled&&ms>=this.loop.b){this.seek(this.loop.a).catch(e=>this.log('loop-error',{error:String(e)}));return;}
  const r=this.clipAt(ms);if(r.status!=='valid'){this.pause();this.log('unavailable',{ms,...r});return;}
  this.idx=1-this.idx;const b=this.audio[this.idx];if(b.dataset.clipStart===undefined||Number(b.dataset.clipStart)!==ms)this.attach(b,ms);
  b.currentTime=0;const started=clock();b.play().then(()=>{const delayMs=clock()-started;this.transitions.push({ms,delayMs});this.log('boundary-C1',{ms,delayMs,notSampleAccurate:true});}).catch(e=>{this.pause();this.log('play-error',{error:String(e)});});
  this.attach(a,Number(b.dataset.clipEnd));this.cleanup();
 }
 setRate(v){if(!Number.isFinite(v)||v<.5||v>2)throw Error('invalid playback rate');this.rate=v;this.audio.forEach(a=>{a.playbackRate=v;a.preservesPitch=true;});}
 async setLoop(a,b,enabled){this.loop=enabled?{a,b,enabled:true}:null;if(enabled&&(!(a>=0&&a<b&&b<=TOTAL)||resolve(ID,a).status!=='valid'))throw Error('invalid A-B');if(this.playing){const ms=this.position();await this.seek(ms);} }
 stats(){return {urls:this.urls.size,estimatedBlobBytes:[...this.urls.values()].reduce((n,x)=>n+x.bytes,0),transitions:this.transitions,preservesPitchRequested:true};}
 destroy(){this.pause();for(const a of this.audio){a.removeAttribute('src');a.load();delete a.dataset.clipKey;}this.cleanup();}
}
export class C2{
 constructor(log=()=>{}){this.log=log;this.ctx=null;this.ms=298000;this.rate=1;this.playing=false;this.pending=[];this.scheduled=0;this.maxPending=0;this.boundaries=[];this.timer=null;this.halt=null;this.underruns=0;this.loop=null;this.looping=false;}
 position(){return this.playing?Math.min(this.halt?.ms??TOTAL,TOTAL,Math.max(this.anchorMs,this.anchorMs+(this.ctx.currentTime-this.anchorSec)*1000*this.rate)):this.ms;}
 pause(){this.ms=this.position();this.playing=false;clearInterval(this.timer);this.timer=null;for(const s of this.pending){s.onended=null;try{s.stop();}catch{}s.disconnect();}this.pending=[];this.halt=null;}
 async seek(ms){const r=resolve(ID,ms),started=clock();if(r.status!=='valid'){this.pause();this.log('unavailable',{ms,...r});return r;}const was=this.playing;this.pause();this.ms=ms;this.log('seek-C2',{ms,elapsedMs:clock()-started});if(was)await this.play();return r;}
 async play(){const r=resolve(ID,this.ms);if(r.status!=='valid')return r;if(!this.ctx)this.ctx=new AudioContext({sampleRate:RATE});await this.ctx.resume();this.playing=true;this.anchorMs=this.ms;this.anchorSec=this.ctx.currentTime+.12;this.scheduled=this.ms;this.halt=null;this.schedule();this.timer=setInterval(()=>this.schedule(),40);return r;}
 schedule(){if(!this.playing)return;
  if(this.loop?.enabled&&this.scheduled>=this.loop.b&&this.position()>=this.loop.b){if(!this.looping){this.looping=true;const target=this.loop.a;this.pause();this.seek(target).then(()=>this.play()).catch(e=>this.log('loop-error',{error:String(e)})).finally(()=>this.looping=false);}return;}
  if(this.halt){if(this.position()>=this.halt.ms){const blocked=this.halt;this.pause();this.log('unavailable',blocked);}return;}
  while(this.anchorSec+(this.scheduled-this.anchorMs)/1000/this.rate<this.ctx.currentTime+.75){
   if(this.scheduled>=TOTAL){this.pause();return;}
   const r=resolve(ID,this.scheduled);if(r.status!=='valid'){this.halt={ms:this.scheduled,...r};return;}
   const end=Math.min(this.scheduled+160,r.clipEndMs,this.loop?.enabled?this.loop.b:TOTAL,TOTAL);
   if(end<=this.scheduled){this.halt={ms:this.scheduled,status:'gap',reason:'A-B boundary'};return;}
   const start=this.anchorSec+(this.scheduled-this.anchorMs)/1000/this.rate;
   if(start<this.ctx.currentTime-.003){this.underruns++;this.log('underrun-C2',{atMs:this.scheduled,lateMs:(this.ctx.currentTime-start)*1000});this.pause();return;}
   const samples=windowPCM(this.scheduled,end-this.scheduled),buffer=this.ctx.createBuffer(1,samples.length,RATE);buffer.copyToChannel(samples,0);
   const node=this.ctx.createBufferSource();node.buffer=buffer;node.playbackRate.value=this.rate;node.connect(this.output||this.ctx.destination);node.start(start);this.pending.push(node);this.maxPending=Math.max(this.maxPending,this.pending.length);
   node.onended=()=>{this.pending=this.pending.filter(x=>x!==node);node.disconnect();};
   if(end%SEGMENT===0){this.boundaries.push({ms:end,scheduledStartSec:start,continuityByClock:true});this.log('boundary-C2',{ms:end});}
   this.scheduled=end;
   if(this.loop?.enabled&&end>=this.loop.b)return;
  }
 }
 setRate(v){if(!Number.isFinite(v)||v<.5||v>2)throw Error('invalid playback rate');const was=this.playing;this.pause();this.rate=v;if(was)this.play().catch(e=>this.log('play-error',{error:String(e)}));}
 async setLoop(a,b,enabled){if(enabled&&(!(a>=0&&a<b&&b<=TOTAL)||resolve(ID,a).status!=='valid'))throw Error('invalid A-B');const was=this.playing,at=this.position();this.pause();this.loop=enabled?{a,b,enabled:true}:null;this.ms=at;if(was)await this.play();}
 stats(){return {windows:this.pending.length,maxPending:this.maxPending,estimatedWindowBytes:this.maxPending*160*RATE/1000*4,boundaries:this.boundaries,pitchPreservation:false,underruns:this.underruns};}
 async destroy(){this.pause();await this.ctx?.close();this.ctx=null;}
}
export const format=ms=>{const t=Math.floor(Math.max(0,ms)/1000);return [Math.floor(t/3600),Math.floor(t/60)%60,t%60].map(n=>String(n).padStart(2,'0')).join(':');};
