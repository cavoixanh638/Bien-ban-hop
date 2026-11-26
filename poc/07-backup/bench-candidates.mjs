/** Run with installed exact pinned npm dependencies. No fake/aliased libraries allowed.
 * node bench-candidates.mjs --candidate zip.js --bytes 536870912 --output logs/zipjs.json
 * Expected format: candidate-specific export + zip.js random-access import.
 */
import {performance} from 'node:perf_hooks';
import * as fs from 'node:fs/promises';
import {openAsBlob} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {syntheticSource,importMochop} from './mochop-web.mjs';
import {exportWithFflate,exportWithClientZip,exportWithZipJs,zipJsReader} from './candidates.mjs';
import {nodeRepo,fileSink} from './node-adapter.mjs';
const argv=process.argv.slice(2),param=(name,defaultValue)=>argv.includes(name)?argv[argv.indexOf(name)+1]:defaultValue;
const candidate=param('--candidate',''),bytes=Number(param('--bytes','536870912')),outFile=param('--output','');
const outputFns={'fflate':exportWithFflate,'client-zip':exportWithClientZip,'zip.js':exportWithZipJs};
if(!outputFns[candidate])throw Error('unknown candidate');
if(!Number.isSafeInteger(bytes)||bytes<0||bytes>8*1024**3)throw Error('invalid bytes');
const root=await fs.mkdtemp(path.join(os.tmpdir(),'mochop-candidate-'));
const max={rss:0,heap:0,external:0};
const sample=()=>{const m=process.memoryUsage();max.rss=Math.max(max.rss,m.rss);max.heap=Math.max(max.heap,m.heapUsed);max.external=Math.max(max.external,m.external);};
const interval=setInterval(sample,100);
try{
  const file=path.join(root,'candidate.mochop'),disk=await fileSink(file);
  const source=syntheticSource(bytes);
  const t0=performance.now();
  const exported=await outputFns[candidate](source,disk.sink);
  const t1=performance.now();
  const zip=await openAsBlob(file);
  const reader=await zipJsReader(zip),repo=await nodeRepo(path.join(root,'restored'));
  let restored;
  try{restored=await importMochop(reader,repo);}finally{await reader.close();}
  const t2=performance.now();
  const note=await repo.readJSON('meeting-demo','note.json');
  if(JSON.stringify(note)!==JSON.stringify(source.note))throw Error('note/marks roundtrip mismatch');
  const manifest=await repo.readJSON('meeting-demo','audio-manifest.json');
  if(JSON.stringify(manifest)!==JSON.stringify(source.audio))throw Error('timeline roundtrip mismatch');
  const folder=await repo.locate('meeting-demo'),fileStat=await fs.stat(path.join(folder,'audio/seg-1.pcm'));
  if(fileStat.size!==bytes)throw Error('audio size mismatch');
  sample();
  const result={status:'PASS',candidate,actualLibraryImport:'zip.js',bytes,zipBytes:zip.size,
    exportSeconds:(t1-t0)/1000,importSeconds:(t2-t1)/1000,peakRSSbytes:max.rss,peakHeapBytes:max.heap,
    peakExternalBytes:max.external,details:exported.archive,missingAudio:restored.missingAudio,
    environment:{node:process.version,platform:process.platform,date:new Date().toISOString()}};
  if(outFile)await fs.writeFile(outFile,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
}finally{clearInterval(interval);await fs.rm(root,{recursive:true,force:true});}
