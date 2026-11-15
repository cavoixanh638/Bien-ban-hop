/** Cross-language ZIP interoperability: Node runtime (different stack from Python zipfile). */
import * as fs from 'node:fs/promises';
import {fileSink,nodeRepo,sourceFile} from './node-adapter.mjs';
import {ZipStoreReader} from './zip-stream.mjs';
import {syntheticSource,exportMochop,importMochop} from './mochop-web.mjs';
const [operation,archiveName,repoName]=process.argv.slice(2);
if(operation==='export'){
  const out=await fileSink(archiveName);
  try{const result=await exportMochop(syntheticSource(1048576),out.sink);console.log(JSON.stringify({status:'PASS',operation,size:result.archive.size}));}
  catch(e){await out.cleanup();throw e;}
}else if(operation==='import'){
  const zip=await sourceFile(archiveName);
  try{
    const repo=await nodeRepo(repoName),result=await importMochop(new ZipStoreReader(zip),repo);
    const note=await repo.readJSON('meeting-demo','note.json');
    if(note?.content?.content?.[0]?.content?.[0]?.marks?.[0]?.attrs?.audioOffsetMs!==12345)throw Error('anchor altered');
    console.log(JSON.stringify({status:'PASS',operation,...result}));
  }finally{await zip.close();}
}else{throw Error('usage: node interop.mjs export ZIP | import ZIP REPO');}
