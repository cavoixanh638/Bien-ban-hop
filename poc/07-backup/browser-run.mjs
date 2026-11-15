import {createBrowserRepo} from './browser-opfs.mjs';
import {ZipStoreWriter} from './zip-stream.mjs';
import {syntheticSource,exportMochop,importMochop,openBlobArchive} from './mochop-web.mjs';
export async function run({bytes=1024*1024}={}){
  const repo=await createBrowserRepo();await repo.reset();
  const source=syntheticSource(bytes),out=await repo.archiveSink('generated.mochop');
  let exportBytes=0,importBytes=0;
  let peakHeap=performance.memory?.usedJSHeapSize??null;
  const sample=()=>{if(performance.memory?.usedJSHeapSize!==undefined)peakHeap=Math.max(peakHeap??0,performance.memory.usedJSHeapSize)};
  const started=performance.now();
  let result;
  try{result=await exportMochop(source,out.sink,{writerFactory:sink=>new ZipStoreWriter(sink,{onProgress:n=>{exportBytes=n;sample();}})});}
  catch(error){await out.remove().catch(()=>{});throw error;}
  const exportMs=performance.now()-started;
  const blob=await out.file();
  if(blob.size!==result.archive.size)throw Error('saved ZIP size mismatch');
  const startedImport=performance.now();
  const restored=await importMochop(openBlobArchive(blob),repo,{onProgress:({processed})=>{importBytes=processed;sample();}});
  const importMs=performance.now()-startedImport;
  const another=await createBrowserRepo(),meeting=await another.getMeeting('meeting-demo');
  const note=await meeting.readJSON('note.json');
  if(JSON.stringify(note)!==JSON.stringify(source.note))throw Error('note/timeSpan changed after reload');
  const audio=await meeting.readJSON('audio-manifest.json');
  if(JSON.stringify(audio)!==JSON.stringify(source.audio))throw Error('audio mapping changed');
  const file=await meeting.readFile('audio/seg-1.pcm');
  if(file.size!==bytes)throw Error('audio length mismatch');
  const quota=await navigator.storage.estimate();
  return {status:'PASS',browser:navigator.userAgent,bytes,archiveBytes:blob.size,exportMs,importMs,exportBytes,importBytes,
    peakSampledHeap:peakHeap,quota:quota.quota,usage:quota.usage,missingAudio:restored.missingAudio,zip64:result.archive.zip64};
}
