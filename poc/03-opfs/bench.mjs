import {Recorder} from './core.mjs';
import {MemoryJournal} from './adapters.mjs';
import {NodeFiles} from './node-adapter.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const args=Object.fromEntries(process.argv.slice(2).map(x=>x.replace(/^--/,'').split('=')));
const sampleRate=Number(args['sample-rate']??48000),durationSeconds=Number(args.duration??10800);
const channels=Number(args.channels??1),chunkSeconds=Number(args['chunk-seconds']??5);
const block=sampleRate*chunkSeconds,frames=sampleRate*durationSeconds;
if (![sampleRate,durationSeconds,channels,chunkSeconds].every(x=>Number.isSafeInteger(x)&&x>0)||channels>2)throw Error('invalid benchmark parameters');
const dir=await mkdtemp(join(tmpdir(),'mochop-opfs-bench-'));
const fs=new NodeFiles(dir),journal=new MemoryJournal();
const recorder=new Recorder({fs,journal,recordingId:'benchmark',sampleRate,channels,segmentSeconds:300});
await journal.save('benchmark',recorder.manifest);
// Uniform deterministic 440Hz sine from a short immutable cycle. 48kHz needs
// 1200 samples/cycle, so 3h does not require generating 518m Math.sin calls.
const gcd=(a,b)=>b?gcd(b,a%b):a;
const period=sampleRate/gcd(sampleRate,440),cycle=new Float32Array(period);
for(let i=0;i<period;i++)cycle[i]=Math.sin(i*2*Math.PI*440/sampleRate)*0.1;
function makeChunk(sequenceNo,firstSample,sampleCount){
 const pcm=new ArrayBuffer(sampleCount*channels*4),data=new Float32Array(pcm);
 for(let i=0;i<sampleCount;i++)for(let c=0;c<channels;c++)data[i*channels+c]=cycle[(firstSample+i)%period];
 return {recordingId:'benchmark',sequenceNo,firstSample,sampleCount,sampleRate,channels,format:'f32le',pcm};
}
const start=performance.now(),stats={writeMs:[],flushMs:[],seekMs:[]};
let peak=process.memoryUsage().rss,unconfirmedPeak=0,totalSamples=0;
const percentile=(values,q)=>{if(!values.length)return 0;const ordered=values.toSorted((a,b)=>a-b);return Number(ordered[Math.min(ordered.length-1,Math.ceil(ordered.length*q)-1)].toFixed(3));};
try{
 for(let seq=0,sample=0;sample<frames;seq++){
  const count=Math.min(block,frames-sample),chunk=makeChunk(seq,sample,count),t=performance.now();
  const ack=await recorder.append(chunk);
  if(ack.committed!==false)throw Error('premature committed ACK');
  const writeMs=performance.now()-t;stats.writeMs.push(writeMs);sample+=count;
  unconfirmedPeak=Math.max(unconfirmedPeak,recorder.pending.reduce((n,x)=>n+x.sampleCount,0));
  const f=performance.now(),committed=await recorder.flush();stats.flushMs.push(performance.now()-f);
  if(committed.committedThroughSampleExclusive!==sample)throw Error('wrong committed coverage');
  totalSamples=sample;
  if(seq%10===0)peak=Math.max(peak,process.memoryUsage().rss);
 }
 const verificationStart=performance.now();const recovered=await Recorder.reopen({fs,journal,recordingId:'benchmark'});
 const recoveryVerifyMs=performance.now()-verificationStart;
 const positions=[0,Math.floor(frames/2),frames-sampleRate,frames-1];
 const seekResults=[];
 for(const sample of positions){const t=performance.now(),result=await recovered.readSample(sample,1),ms=performance.now()-t;
  stats.seekMs.push(ms);if(result.status!=='valid')throw Error(`seek failed ${sample}: ${result.status}`);
  const v=new DataView(result.pcm).getFloat32(0,true);
  if(Math.abs(v-cycle[sample%period])>0.000001)throw Error('sample corruption at '+sample);
  seekResults.push({sample,status:result.status,latencyMs:Number(ms.toFixed(3))});}
 const end=frames-1,manifest=await recovered.toAudioManifest();
 if(recovered.lastRecovery.unavailable.length||totalSamples!==frames)throw Error('lost coverage');
 const r={status:'PASS',environment:{node:process.version,platform:process.platform,arch:process.arch,backend:'Node filesystem fsync + in-memory journal (NOT browser OPFS/IndexedDB)'},fixture:{sampleRate,channels,format:'f32le',durationSeconds,chunkSeconds,segmentSeconds:300,signal:'deterministic cyclic 440Hz f32le'},runtimeWallSeconds:Number(((performance.now()-start)/1000).toFixed(3)),recoveryVerifyMs:Number(recoveryVerifyMs.toFixed(3)),segments:recorder.manifest.segments.length,committedSamples:totalSamples,committedPcmBytes:recorder.manifest.chunks.reduce((n,x)=>n+x.byteLength,0),committedRanges:recovered.lastRecovery.committedRanges.length,unavailableRanges:recovered.lastRecovery.unavailable.length,gapRanges:recovered.lastRecovery.gaps.length,maxUnconfirmedSeconds:unconfirmedPeak/sampleRate,metrics:recorder.metrics,latencyMs:{writeP50:percentile(stats.writeMs,0.5),writeP95:percentile(stats.writeMs,0.95),writeMax:percentile(stats.writeMs,1),flushP50:percentile(stats.flushMs,0.5),flushP95:percentile(stats.flushMs,0.95),flushMax:percentile(stats.flushMs,1),seekP95:percentile(stats.seekMs,0.95)},peakRssMiB:Number((peak/1048576).toFixed(1)),seekResults,validRecordedIntervals:manifest.intervals.filter(x=>x.kind==='recorded').length};
 console.log(JSON.stringify(r,null,2));
}finally{await fs.close();await rm(dir,{recursive:true,force:true});}
