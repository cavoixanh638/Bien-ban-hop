// Mốc Họp PoC C — independent synthetic fixture and competing playback adapters.
// No production claims. Launch via a local HTTP server (secure context recommended).
export const RATE=16000, SEGMENT=300000, TOTAL=10800000, ID='synthetic-recording-01';
export const fixture={
 recordingId:ID,sampleRate:RATE,mappingPoints:[{inputMonoMs:0,sampleIndex:0},{inputMonoMs:TOTAL,sampleIndex:TOTAL*RATE/1000}],
 segments:Array.from({length:36},(_,i)=>({segmentId:'seg-'+String(i).padStart(3,'0'),filePath:'synthetic://'+i,mediaStartMs:i*SEGMENT,mediaDurationMs:SEGMENT,sampleStart:i*SEGMENT*RATE/1000,sampleCount:SEGMENT*RATE/1000,completionState:i===20?'missing':'complete'})),
 intervals:[{meetingStartMs:0,meetingEndMs:1800000,kind:'recorded'},{meetingStartMs:1800000,meetingEndMs:1810000,kind:'paused',reason:'pause'},{meetingStartMs:1810000,meetingEndMs:3600000,kind:'recorded'},{meetingStartMs:3600000,meetingEndMs:3615000,kind:'gap',reason:'microphone gap'},{meetingStartMs:3615000,meetingEndMs:TOTAL,kind:'recorded'}],
 marks:[{anchorId:'boundary',recordingId:ID,audioOffsetMs:298000,typedAt:1794740000000,source:'live_recording',schemaVersion:1},{anchorId:'at90',recordingId:ID,audioOffsetMs:5400000,typedAt:1794740000000,source:'imported_playback',schemaVersion:1},{anchorId:'paused',recordingId:ID,audioOffsetMs:10200000,typedAt:1794740000000,source:'playback_paused',schemaVersion:1},{anchorId:'missing',recordingId:ID,audioOffsetMs:6060000,typedAt:1794740000000,source:'live_recording',schemaVersion:1}]
};
export function resolve(recordingId,ms){
 if(recordingId==null||ms==null)return {status:'unlinked',reason:'no anchor'};
 if(recordingId!==ID||!Number.isFinite(ms)||ms<0||ms>=TOTAL)return {status:'unsupported',reason:'unknown recording or offset'};
 const s=fixture.segments[Math.floor(ms/SEGMENT)];
 if(!s||s.completionState==='missing')return {status:'missing',reason:'missing '+s?.segmentId};
 if(s.completionState==='pending')return {status:'pending',reason:'not committed'};
 const x=fixture.intervals.find(x=>x.meetingStartMs<=ms&&ms<x.meetingEndMs);
 if(!x||x.kind!=='recorded')return {status:'gap',reason:x?.reason||'not recorded'};
 return {status:'valid',segmentId:s.segmentId,localOffsetMs:ms-s.mediaStartMs};
}
const tone=t=>0.14*Math.sin(2*Math.PI*220*t)+.06*Math.sin(2*Math.PI*440*t)+.035*Math.sin(2*Math.PI*880*t);
export function windowPCM(startMs,durationMs){
 const first=Math.round(startMs*RATE/1000),len=Math.max(1,Math.round(durationMs*RATE/1000));
 const out=new Float32Array(len);for(let i=0;i<len;i++)out[i]=tone((first+i)/RATE);return out;
}
export function segmentWAV(index){
 const count=SEGMENT*RATE/1000,raw=new ArrayBuffer(44+count*2),v=new DataView(raw);
 const str=(p,s)=>{for(let i=0;i<s.length;i++)v.setUint8(p+i,s.charCodeAt(i));};
 str(0,'RIFF');v.setUint32(4,36+count*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,RATE,true);v.setUint32(28,RATE*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,count*2,true);
 const first=index*count;for(let i=0;i<count;i++)v.setInt16(44+2*i,Math.round(tone((first+i)/RATE)*32767),true);
 return new Blob([raw],{type:'audio/wav'});
}
export class C1 {
 constructor(log){this.log=log;this.audio=[new Audio(),new Audio()];this.urls=new Map();this.idx=0;this.ms=298000;this.rate=1;this.playing=false;this.transitions=[];
  for(const a of this.audio){a.preload='auto';a.preservesPitch=true;a.addEventListener('ended',()=>this.boundary(a));}
 }
 prepare(i){
  if(!fixture.segments[i]||fixture.segments[i].completionState!=='complete')return false;
  if(!this.urls.has(i))this.urls.set(i,URL.createObjectURL(segmentWAV(i)));
  for(const [j,u] of this.urls)if(Math.abs(i-j)>2){URL.revokeObjectURL(u);this.urls.delete(j);}
  return this.urls.get(i);
 }
 attach(a,i){let url=this.prepare(i);if(!url)return false;if(a.dataset.i!==String(i)){a.src=url;a.dataset.i=String(i);a.load();}a.preservesPitch=true;a.playbackRate=this.rate;return true;}
 position(){const a=this.audio[this.idx];return this.playing?Math.min(TOTAL,Number(a.dataset.i)*SEGMENT+a.currentTime*1000):this.ms;}
 pause(){this.ms=this.position();this.playing=false;this.audio.forEach(a=>a.pause());}
 async seek(ms){const r=resolve(ID,ms);if(r.status!=='valid'){this.pause();this.log('unavailable',{ms,...r});return r;}
  const was=this.playing;this.pause();this.ms=ms;this.idx=0;const i=Math.floor(ms/SEGMENT),a=this.audio[0];this.attach(a,i);this.attach(this.audio[1],i+1);
  if(a.readyState<1)await new Promise((ok,no)=>{const timer=setTimeout(()=>{clean();no(Error('metadata timeout'));},10000);const clean=()=>{clearTimeout(timer);a.removeEventListener('loadedmetadata',okReady);a.removeEventListener('error',err);};const okReady=()=>{clean();ok();},err=()=>{clean();no(Error('invalid audio'));};a.addEventListener('loadedmetadata',okReady);a.addEventListener('error',err);});
  a.currentTime=(ms%SEGMENT)/1000;if(was)await this.play();return r;
 }
 async play(){let r=resolve(ID,this.ms);if(r.status!=='valid'){this.log('unavailable',r);return r;}let a=this.audio[this.idx];if(a.readyState<1)await this.seek(this.ms);try{await a.play();this.playing=true;}catch(error){this.playing=false;this.log('play-error',{error:String(error)});}return r;}
 boundary(a){if(!this.playing||a!==this.audio[this.idx])return;const next=Number(a.dataset.i)+1,ms=next*SEGMENT,r=resolve(ID,ms);this.ms=ms;
  if(r.status!=='valid'){this.pause();this.log('unavailable',{ms,...r});return;}
  this.idx=1-this.idx;const b=this.audio[this.idx];this.attach(b,next);b.currentTime=0;
  const start=performance.now();b.play().then(()=>{const delayMs=performance.now()-start;this.transitions.push({ms,delayMs});this.log('boundary-C1',{ms,delayMs,notSampleAccurate:true});}).catch(e=>this.log('play-error',{error:String(e)}));
  this.attach(a,next+1);
 }
 setRate(v){this.rate=v;this.audio.forEach(a=>{a.playbackRate=v;a.preservesPitch=true;});}
 stats(){return {urls:this.urls.size,estimatedBlobBytes:this.urls.size*(44+SEGMENT*RATE/1000*2),transitions:this.transitions,preservesPitch:true};}
 destroy(){this.pause();for(const a of this.audio){a.removeAttribute('src');a.load();}for(const u of this.urls.values())URL.revokeObjectURL(u);this.urls.clear();}
}
export class C2{
 constructor(log){this.log=log;this.ctx=null;this.ms=298000;this.rate=1;this.playing=false;this.pending=[];this.scheduled=0;this.maxPending=0;this.boundaries=[];this.timer=null;}
 position(){return this.playing?Math.min(TOTAL,Math.max(0,this.anchorMs+(this.ctx.currentTime-this.anchorSec)*1000*this.rate)):this.ms;}
 pause(){this.ms=this.position();this.playing=false;clearInterval(this.timer);this.timer=null;for(const s of this.pending){s.onended=null;try{s.stop();}catch{}s.disconnect();}this.pending=[];}
 async seek(ms){const r=resolve(ID,ms);if(r.status!=='valid'){this.pause();this.log('unavailable',{ms,...r});return r;}const was=this.playing;this.pause();this.ms=ms;if(was)await this.play();return r;}
 async play(){const r=resolve(ID,this.ms);if(r.status!=='valid')return r;if(!this.ctx)this.ctx=new AudioContext({sampleRate:RATE});await this.ctx.resume();this.playing=true;this.anchorMs=this.ms;this.anchorSec=this.ctx.currentTime+.08;this.scheduled=this.ms;this.schedule();this.timer=setInterval(()=>this.schedule(),40);return r;}
 schedule(){if(!this.playing)return;
  while(this.anchorSec+(this.scheduled-this.anchorMs)/1000/this.rate<this.ctx.currentTime+.75){
   if(this.scheduled>=TOTAL){this.pause();return;}
   let r=resolve(ID,this.scheduled);if(r.status!=='valid'){this.log('pending-stop',{atMs:this.scheduled,...r});return;}
   const end=Math.min(this.scheduled+160,(Math.floor(this.scheduled/SEGMENT)+1)*SEGMENT,TOTAL);
   const samples=windowPCM(this.scheduled,end-this.scheduled),buffer=this.ctx.createBuffer(1,samples.length,RATE);buffer.copyToChannel(samples,0);
   const node=this.ctx.createBufferSource();node.buffer=buffer;node.playbackRate.value=this.rate;node.connect(this.ctx.destination);
   const start=this.anchorSec+(this.scheduled-this.anchorMs)/1000/this.rate;node.start(Math.max(start,this.ctx.currentTime));this.pending.push(node);this.maxPending=Math.max(this.maxPending,this.pending.length);
   node.onended=()=>{this.pending=this.pending.filter(x=>x!==node);node.disconnect();};
   if(end%SEGMENT===0){this.boundaries.push({ms:end,scheduledStartSec:start,continuityByClock:true});this.log('boundary-C2',{ms:end});}
   this.scheduled=end;
  }
 }
 setRate(v){const was=this.playing;this.pause();this.rate=v;if(was)this.play().catch(e=>this.log('play-error',{error:String(e)}));}
 stats(){return {windows:this.pending.length,maxPending:this.maxPending,estimatedWindowBytes:this.maxPending*160*RATE/1000*4,boundaries:this.boundaries,pitchPreservation:false};}
 async destroy(){this.pause();await this.ctx?.close();this.ctx=null;}
}
export const format=ms=>{const t=Math.floor(Math.max(0,ms)/1000);return [Math.floor(t/3600),Math.floor(t/60)%60,t%60].map(n=>String(n).padStart(2,'0')).join(':');};
