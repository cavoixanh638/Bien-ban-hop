import {Recorder,chunkFixture} from './core.mjs';
import {MemoryJournal} from './adapters.mjs';
import {NodeFiles} from './node-adapter.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const rate=1000,seconds=10800,frames=rate*seconds,block=8192;
const dir=await mkdtemp(join(tmpdir(),'mochop-opfs-bench-')),fs=new NodeFiles(dir),journal=new MemoryJournal();
const r=new Recorder({fs,journal,recordingId:'benchmark',sampleRate:rate,channels:1,segmentSeconds:300});
await r.initialize();
let peak=process.memoryUsage().rss,start=performance.now(),maxPendingSec=0;
for(let seq=0,sample=0;sample<frames;seq++){
 const count=Math.min(block,frames-sample);
 await r.append(chunkFixture({recordingId:'benchmark',sequenceNo:seq,firstSample:sample,sampleCount:count,sampleRate:rate}));
 sample+=count;await r.flush();maxPendingSec=Math.max(maxPendingSec,count/rate);
 if(seq%20===0)peak=Math.max(peak,process.memoryUsage().rss);
}
const recovery=await Recorder.reopen({fs,journal,recordingId:'benchmark'});
const seekResults=[];
for(const pos of [0,Math.floor(frames/2),frames-1]){
 const t=performance.now(),x=await recovery.readSample(pos,1);
 seekResults.push({sample:pos,status:x.status,latencyMs:Math.round((performance.now()-t)*100)/100});
}
const report={environment:'Node '+process.version+' / Node filesystem fsync + in-memory journal',fixture:{sampleRate:rate,channels:1,format:'f32le',durationSeconds:seconds,chunkFrames:block},runtimeSeconds:(performance.now()-start)/1000,segments:r.manifest.segments.length,committedSamples:r.manifest.committedThroughSampleExclusive,committedBytes:r.manifest.chunks.reduce((n,x)=>n+x.byteLength,0),maxUnconfirmedSeconds:maxPendingSec,metrics:r.metrics,peakRssMiB:Math.round(peak/1048576),seekResults,unavailable:recovery.lastRecovery.unavailable.length};
console.log(JSON.stringify(report,null,2));await fs.close();await rm(dir,{recursive:true,force:true});
