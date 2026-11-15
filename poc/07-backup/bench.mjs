/** Node cross-process perf and actual ZIP64 stress (without npm). */
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {ZipStoreWriter,ZipStoreReader} from './zip-stream.mjs';
import {exportMochop,importMochop,syntheticSource} from './mochop-web.mjs';
import {nodeRepo,fileSink,sourceFile} from './node-adapter.mjs';
const arg=(name,fallback)=>{const x=process.argv.indexOf(name);return x>=0?process.argv[x+1]:fallback;};
const bytes=Number(arg('--bytes',536870912)),count=Number(arg('--zip64-count',0));
const keep=process.argv.includes('--keep');
const output=arg('--output','');
const root=await fs.mkdtemp(path.join(os.tmpdir(),'mochop-07-bench-'));
let peakRSS=process.memoryUsage().rss,peakHeap=process.memoryUsage().heapUsed;
function sample(){const m=process.memoryUsage();peakRSS=Math.max(peakRSS,m.rss);peakHeap=Math.max(peakHeap,m.heapUsed);}
const sampler=setInterval(sample,100);
let result;
try{
  if(count){
    const f=path.join(root,'zip64.mochop'),writer=new ZipStoreWriter((await fileSink(f)).sink);
    const started=performance.now();
    for(let i=0;i<count;i++)await writer.add(`audio/item-${i.toString().padStart(6,'0')}.pcm`,new Blob([]).stream());
    const done=await writer.close();
    const src=await sourceFile(f);
    const entries=await new ZipStoreReader(src,{maxEntries:Math.max(count,10000),maxCentralBytes:32*1024*1024}).entries();
    await src.close();
    result={kind:'zip64-count',count,readBack:entries.length,zipBytes:done.size,seconds:(performance.now()-started)/1000};
  }else{
    if(!Number.isSafeInteger(bytes)||bytes<0)throw Error('invalid bytes');
    const f=path.join(root,'archive.mochop'),out=await fileSink(f),src=syntheticSource(bytes);
    let written=0,processed=0;
    const t0=performance.now();
    const packed=await exportMochop(src,out.sink,{writerFactory:sink=>new ZipStoreWriter(sink,{onProgress:n=>{written=n;sample();}})});
    const t1=performance.now();
    const zipped=await sourceFile(f);
    const repo=await nodeRepo(path.join(root,'restored'));
    const restored=await importMochop(new ZipStoreReader(zipped),repo,{onProgress:progress=>{processed=progress.processed;sample();}});
    const t2=performance.now();
    const note=await repo.readJSON('meeting-demo','note.json');
    const audio=await repo.readJSON('meeting-demo','audio-manifest.json');
    const savedDir=await repo.locate('meeting-demo');
    const audioFile=await fs.stat(path.join(savedDir,'audio/seg-1.pcm'));
    if(JSON.stringify(note)!==JSON.stringify(src.note)||JSON.stringify(audio)!==JSON.stringify(src.audio)||audioFile.size!==bytes)throw Error('roundtrip mismatch');
    await zipped.close();
    result={kind:'node-ZIP64-store',bytes,zipBytes:packed.archive.size,exportSeconds:(t1-t0)/1000,importSeconds:(t2-t1)/1000,
      files:restored.files,missingAudio:restored.missingAudio,exportedBytesObserved:written,restoredBytesObserved:processed,
      peakChunk:packed.archive.peakChunk,shaSample:packed.manifest.files.find(x=>x.path.startsWith('audio/')).sha256};
  }
  sample();result.peakRSSbytes=peakRSS;result.peakHeapBytes=peakHeap;
  result.node=process.version;result.platform=process.platform;result.arch=process.arch;
  result.date=new Date().toISOString();result.status='PASS';
  if(output)await fs.writeFile(output,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
}finally{clearInterval(sampler);if(!keep)await fs.rm(root,{recursive:true,force:true});else console.error('kept',root);}
