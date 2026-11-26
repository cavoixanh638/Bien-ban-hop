/** Optional *real-library* ZIP candidate adapters; only loaded when explicitly selected.
 * Tested dependency-free baseline is zip-stream.mjs; never label these PASS until npm installed.
 * Versions pinned in package.json (no dynamic CDN loading).
 */
import {Sha256} from './zip-stream.mjs';
import {exportMochop,validateContract,LIMITS,BackupError} from './mochop-web.mjs';
const json=thing=>new TextEncoder().encode(JSON.stringify(thing));
/** fflate@0.8.3 Zip writer emits classic 16-bit entry counts and 32-bit
 * compressed sizes, offsets, and EOCD; its ZIP64 *reader* support does not
 * make this writer safe above classic ZIP limits. 0xffffffff is a ZIP64
 * sentinel, so reserve that value as well. This guard is fail-closed; a
 * partial sink MUST be discarded by the caller after a rejected export.
 */
export const CLASSIC_ZIP32_MAX_BYTES = 0xfffffffe;
export const CLASSIC_ZIP32_MAX_ENTRIES = 0xfffe; // 0xffff is the ZIP64 sentinel
export class ClassicZip32Budget {
  constructor({maxBytes=CLASSIC_ZIP32_MAX_BYTES,maxEntries=CLASSIC_ZIP32_MAX_ENTRIES}={}){
    if(!Number.isSafeInteger(maxBytes)||maxBytes<0||maxBytes>CLASSIC_ZIP32_MAX_BYTES||
       !Number.isSafeInteger(maxEntries)||maxEntries<0||maxEntries>CLASSIC_ZIP32_MAX_ENTRIES)
      throw new BackupError('invalid classic ZIP budget');
    this.maxBytes=maxBytes;this.maxEntries=maxEntries;this.bytes=0;
  }
  checkEntries(entryCount){
    if(!Number.isSafeInteger(entryCount)||entryCount>this.maxEntries||entryCount<0)
      throw new BackupError('fflate@0.8.3 cannot emit ZIP64 entry counts');
  }
  reserve(chunkSize){
    if(!Number.isSafeInteger(chunkSize)||chunkSize<0)throw new BackupError('invalid ZIP chunk length');
    if(chunkSize>this.maxBytes-this.bytes)
      throw new BackupError('fflate@0.8.3 classic ZIP overflow: ZIP64 writer unavailable');
    this.bytes+=chunkSize;
  }
}

function statsReadable(stream,name){
  const source=stream.getReader(),sha=new Sha256();let size=0,resolve,reject;
  const done=new Promise((a,b)=>{resolve=a;reject=b;});
  const transformed=new ReadableStream({
    async pull(controller){
      try{const item=await source.read();if(item.done){resolve({path:name,size,sha256:sha.digestHex()});controller.close();return;}
        if(!(item.value instanceof Uint8Array))throw Error('invalid source bytes');
        sha.update(item.value);size+=item.value.byteLength;controller.enqueue(item.value);
      }catch(e){reject(e);controller.error(e);}
    },
    async cancel(reason){await source.cancel(reason);reject(reason);}
  },{highWaterMark:1});
  return {stream:transformed,done};
}
export async function exportWithClientZip(source,sink){
  validateContract(source.meeting,source.note,source.audio);
  const {makeZip}=await import('client-zip');
  const files=[];let completedManifest;
  async function* inputs(){
    const metadata=[['meeting.json',source.meeting],['note.json',source.note],['audio-manifest.json',source.audio]];
    for(const [name,obj] of metadata){
      const {stream,done}=statsReadable(new Blob([json(obj)]).stream(),name);
      yield {name,input:stream};files.push(await done);
    }
    for(const segment of source.audio.segments){
      const name=segment.filePath;
      const {stream,done}=statsReadable(await source.openAudio(name),name);
      yield {name,input:stream};files.push(await done);
    }
    completedManifest={format:'mochop',formatVersion:1,schemaVersion:1,appVersion:'poc-07-client-zip',meetingIds:[source.meeting.meetingId],files};
    if(json(completedManifest).length>LIMITS.manifestBytes)throw new BackupError('manifest too large');
    yield {name:'manifest.json',input:json(completedManifest)};
  }
  await makeZip(inputs()).pipeTo(sink);
  if(!completedManifest)throw Error('client-zip did not complete generator');
  return {manifest:completedManifest,archive:{candidate:'client-zip',entries:files.length+1}};
}
export async function exportWithFflate(source,sink,{fflateModule,classicBudget}={}){
  validateContract(source.meeting,source.note,source.audio);
  const quota=classicBudget??new ClassicZip32Budget();
  quota.checkEntries(source.audio.segments.length+4); // Meeting, note, audio manifest, audio files, root manifest
  // Dependency injection is used ONLY by a deterministic adapter test;
  // production loads the exact pinned npm package dynamically.
  const fflate=fflateModule??await import('fflate');
  let output,chain=Promise.resolve(),pendingBytes=0,peakPendingBytes=0,problem=null;
  const writer=sink.getWriter();
  const zip=new fflate.Zip((error,bytes)=>{
    if(error){problem=error;return;}
    if(bytes?.length){
      try{quota.reserve(bytes.length)}catch(e){problem=e;return;}
      pendingBytes+=bytes.length;peakPendingBytes=Math.max(pendingBytes,peakPendingBytes);
      chain=chain.then(()=>writer.write(bytes)).then(()=>{pendingBytes-=bytes.length;});}
  });
  output={
    async add(name,readable){
      const input=new fflate.ZipPassThrough(name);zip.add(input);
      const sha=new Sha256();let size=0;const reader=readable.getReader();
      try{for(;;){const {done,value}=await reader.read();if(done)break;
        sha.update(value);size+=value.byteLength;input.push(value);
        await chain;if(problem)throw problem;
      }}finally{reader.releaseLock();}
      input.push(new Uint8Array(0),true);await chain;if(problem)throw problem;
      return {path:name,size,sha256:sha.digestHex()};
    },
    async close(){zip.end();await chain;if(problem)throw problem;await writer.close();writer.releaseLock();return {candidate:'fflate',peakPendingBytes};},
    async abort(e){zip.terminate?.();try{await writer.abort(e);}catch{}writer.releaseLock();}
  };
  return exportMochop(source,sink,{writerFactory:()=>output});
}
export async function exportWithZipJs(source,sink){
  const {ZipWriter}=await import('@zip.js/zip.js');
  const zip=new ZipWriter(sink,{zip64:true,useWebWorkers:false});
  const output={
    async add(name,readable){
      let size=0;const sha=new Sha256();
      const transform=new TransformStream({transform(chunk,controller){sha.update(chunk);size+=chunk.byteLength;controller.enqueue(chunk);}});
      await zip.add(name,readable.pipeThrough(transform),{level:0,zip64:true});
      return {path:name,size,sha256:sha.digestHex()};
    },
    async close(){await zip.close();return {candidate:'zip.js'};},
    async abort(e){await zip.abort?.(e);}
  };
  return exportMochop(source,sink,{writerFactory:()=>output});
}
/** zip.js random-access import uses Central Directory + streamed entry.getData.
 * client-zip has no import API; all exporters can share this verified reader.
 */
export async function zipJsReader(blob){
  const {ZipReader,BlobReader}=await import('@zip.js/zip.js');
  const reader=new ZipReader(new BlobReader(blob),{useWebWorkers:false,checkCrc32:true,strictness:'strict',checkOverlappingEntry:true});
  const original=await reader.getEntries();
  const entries=original.map(e=>({name:e.filename,size:e.uncompressedSize,compressedSize:e.compressedSize,
    crc32:e.crc32??e.signature,directory:e.directory,symlink:e.symlink,encrypted:e.encrypted,method:e.compressionMethod,source:e}));
  return {
    entries:async()=>entries,
    async open(entry){
      // Pull-driven TransformStream prevents blob-wide materialization. zip.js honors WritableStream backpressure.
      const transform=new TransformStream(undefined,{highWaterMark:1},{highWaterMark:1});
      entry.source.getData(transform.writable,{checkCrc32:true,strictness:'strict'}).catch(e=>transform.writable.abort(e));
      return transform.readable;
    },
    async close(){await reader.close();}
  };
}
export const CANDIDATES=Object.freeze({
  'native-store':{export:exportMochop,import:'native ZIP64 reader; STORED only'},
  fflate:{export:exportWithFflate,import:'unzip streaming API exists, not wired to secure staging; use zip.js for validated restore'},
  'client-zip':{export:exportWithClientZip,import:'none; zip.js reader for restore'},
  'zip.js':{export:exportWithZipJs,import:'zip.js random-access Central Directory streaming into staging'}
});
