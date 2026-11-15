import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ZipStoreWriter,ZipStoreReader,Sha256,Crc32,blobSource,fileName} from './zip-stream.mjs';
import {exportMochop,importMochop,syntheticSource,BackupError} from './mochop-web.mjs';
import {nodeRepo} from './node-adapter.mjs';
const url=new URL('./',import.meta.url);
async function zipOf(source=syntheticSource()){const chunks=[];const sink=new WritableStream({write(b){chunks.push(b);}});await exportMochop(source,sink);return new Blob(chunks);}
async function setup(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'mochop-07-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return {root,repo:await nodeRepo(root)};}
async function rewrite(blob,callback){
  const reader=new ZipStoreReader(blobSource(blob)),entries=await reader.entries(),chunks=[];
  const writer=new ZipStoreWriter(new WritableStream({write(b){chunks.push(b);}}));
  for(const entry of entries){
    const data=new Uint8Array(await new Response(await reader.open(entry)).arrayBuffer());
    const result=callback(entry.name,data);
    if(result!==null)await writer.add(entry.name,new Blob([result??data]).stream());
  }
  await writer.close();return new Blob(chunks);
}
async function expectRejected(t,blob,opts){
  const {repo,root}=await setup(t);
  await assert.rejects(()=>importMochop(new ZipStoreReader(blobSource(blob)),repo,opts));
  assert.deepEqual(await fs.readdir(path.join(root,'index')),[],'no published meetings');
  assert.deepEqual(await fs.readdir(path.join(root,'stages')),[],'no abandoned staging directories');
}
test('sha256 streaming matches Node crypto even across 64-byte boundaries',()=>{
  for(const n of [0,1,55,56,63,64,65,512,100000]){
    const input=Uint8Array.from({length:n},(_,i)=>i*13&255);const hash=new Sha256();
    for(let i=0;i<input.length;i+=17)hash.update(input.subarray(i,i+17));
    assert.equal(hash.digestHex(),createHash('sha256').update(input).digest('hex'));
  }
});
test('CRC32 known test vector',()=>assert.equal(new Crc32().update(new TextEncoder().encode('123456789')).digest(),0xcbf43926));
test('ZIP64 native round-trip exact JSON, audio, timeSpan and CRC',async t=>{
  const source=syntheticSource(1024*1024+13),blob=await zipOf(source),{repo}=await setup(t);
  const entries=await new ZipStoreReader(blobSource(blob)).entries();
  assert.equal(entries.length,5); assert(blob.size>1024*1024);
  const res=await importMochop(new ZipStoreReader(blobSource(blob)),repo);
  assert.deepEqual(res.missingAudio,[]);
  const note=await repo.readJSON('meeting-demo','note.json');
  assert.deepEqual(note,source.note);
  const audio=await repo.readJSON('meeting-demo','audio-manifest.json');
  assert.deepEqual(audio,source.audio);
  const restored=await repo.audioHash('meeting-demo','audio/seg-1.pcm');
  assert.equal(restored.length,1024*1024+13);
  const ref=new Uint8Array(await new Response(await source.openAudio('audio/seg-1.pcm')).arrayBuffer());
  assert.deepEqual(restored,Buffer.from(ref));
});
test('missing audio strict failure; TC38 optional missing retains text and marks',async t=>{
  const source=syntheticSource(4096),full=await zipOf(source),missing=await rewrite(full,(name)=>name.endsWith('.pcm')?null:undefined);
  await expectRejected(t,missing);
  const {repo}=await setup(t);
  const res=await importMochop(new ZipStoreReader(blobSource(missing)),repo,{allowMissingAudio:true});
  assert.deepEqual(res.missingAudio,['audio/seg-1.pcm']);
  const restored=await repo.readJSON('meeting-demo','note.json');assert.deepEqual(restored,source.note);
  const audio=await repo.readJSON('meeting-demo','audio-manifest.json');
  assert.equal(audio.segments[0].completionState,'missing');assert.equal(audio.segments[0].missingReason,'restore_source_missing');
});
test('damaged content/CRC rejects, staging discarded',async t=>{
  const blob=await zipOf(syntheticSource(2048));
  // Modify ZIP file's actual bytes; central CRC and manifest SHA remain unchanged.
  const buf=new Uint8Array(await blob.arrayBuffer()),candidate=new ZipStoreReader(blobSource(blob));
  const entry=(await candidate.entries()).find(x=>x.name.endsWith('.pcm'));
  const local=buf.subarray(entry.offset,entry.offset+30);const dv=new DataView(local.buffer,local.byteOffset,local.byteLength);
  const dataPos=entry.offset+30+dv.getUint16(26,true)+dv.getUint16(28,true);
  buf[dataPos+100]^=0xff;
  await expectRejected(t,new Blob([buf]));
});
test('manifest SHA mismatch with valid ZIP CRC rejects',async t=>{
  const full=await zipOf(syntheticSource(2048));
  const damaged=await rewrite(full,(name,data)=>name.endsWith('.pcm')?Uint8Array.from(data,x=>x^1):undefined);
  await expectRejected(t,damaged);
});
test('unsupported schema fails before creating staging',async t=>{
  const full=await zipOf();const bad=await rewrite(full,(name,data)=>{
    if(name==='manifest.json'){let m=JSON.parse(new TextDecoder().decode(data));m.formatVersion=9;return new TextEncoder().encode(JSON.stringify(m));}
  });
  await expectRejected(t,bad);
});
test('path traversal forged in local+central headers rejected',async t=>{
  const blob=await zipOf(syntheticSource(10)),buf=new Uint8Array(await blob.arrayBuffer());
  const entry=(await new ZipStoreReader(blobSource(blob)).entries()).find(x=>x.name==='note.json');
  const byteNeedle=new TextEncoder().encode('note.json');const replacement=new TextEncoder().encode('../x.json');
  let count=0;
  for(let i=0;i+byteNeedle.length<=buf.length;i++)if(byteNeedle.every((v,j)=>buf[i+j]===v)){buf.set(replacement,i);count++;}
  assert(count>=2);
  await expectRejected(t,new Blob([buf]));
});
test('ZIP bomb metadata is rejected before staging',async t=>{
  const full=await zipOf(syntheticSource(100));
  const original=new ZipStoreReader(blobSource(full)),entries=await original.entries();
  const forged={entries:async()=>entries.map(e=>e.name==='meeting.json'?{...e,size:10000000,compressedSize:1}:e),open:e=>original.open(e)};
  const {root,repo}=await setup(t);
  await assert.rejects(()=>importMochop(forged,repo),/ZIP bomb/);
  assert.deepEqual(await fs.readdir(path.join(root,'stages')),[]);
});
test('casefold collision, duplicate IDs and orphan files rejected',async t=>{
  const full=await zipOf(syntheticSource(3));
  const original=new ZipStoreReader(blobSource(full)),entries=await original.entries();
  const forged={entries:async()=>[...entries,{...entries[0],name:'MEETING.JSON'}],open:e=>original.open(e)};
  const {repo}=await setup(t);
  await assert.rejects(()=>importMochop(forged,repo),/collision/);
  await importMochop(original,repo);
  await assert.rejects(()=>importMochop(new ZipStoreReader(blobSource(full)),repo),/EEXIST/);
  const note=await repo.readJSON('meeting-demo','note.json');assert.equal(note.revision,3);
});
test('concurrent publish cannot overwrite winner (hard-link commit)',async t=>{
  const full=await zipOf(syntheticSource(3000)),{repo,root}=await setup(t);
  const [a,b]=await Promise.allSettled([
    importMochop(new ZipStoreReader(blobSource(full)),repo),
    importMochop(new ZipStoreReader(blobSource(full)),repo)
  ]);
  assert.deepEqual([a.status,b.status].sort(),['fulfilled','rejected']);
  assert.equal((await fs.readdir(path.join(root,'index'))).length,1);
  assert.equal((await fs.readdir(path.join(root,'stages'))).length,1);
});
test('interrupted streaming discard; original meeting preserved',async t=>{
  const full=await zipOf(syntheticSource(700000)),{repo,root}=await setup(t);
  await importMochop(new ZipStoreReader(blobSource(full)),repo);
  const original=new ZipStoreReader(blobSource(full)),entries=await original.entries();
  const forged={entries:async()=>entries,open:async e=>{
    if(!e.name.endsWith('.pcm'))return original.open(e);
    let calls=0,readable=await original.open(e),reader=readable.getReader();
    return new ReadableStream({async pull(controller){if(calls++>1)throw Error('injected read fault');const x=await reader.read();if(x.done)controller.close();else controller.enqueue(x.value);},cancel(){reader.cancel();}});
  }};
  await assert.rejects(()=>importMochop(forged,repo),/injected|EEXIST/);
  assert.deepEqual((await repo.readJSON('meeting-demo','note.json')).content.content[0].content[0].text,'Quyết nghị kỳ họp, tiếng Việt.');
  assert.equal((await fs.readdir(path.join(root,'stages'))).length,1);
});
test('file bounds and truncated archive error do not publish',async t=>{
  const bytes=new Uint8Array(await (await zipOf()).arrayBuffer());
  await expectRejected(t,new Blob([bytes.subarray(0,bytes.length-100)]));
});
test('synchronous ZIP64 pipeline honors slow WritableStream backpressure',async()=>{
  let pending=0,peak=0,writes=0;const parts=[];
  const sink=new WritableStream({async write(buf){pending++;peak=Math.max(peak,pending);writes++;await new Promise(r=>setTimeout(r,1));parts.push(buf);pending--;}});
  const source=syntheticSource(4*1024*1024);
  const result=await exportMochop(source,sink);
  assert.equal(peak,1,'only one asynchronous sink write may be pending');
  assert(writes>10);assert(result.archive.peakChunk<=262144);
  const reader=new ZipStoreReader(blobSource(new Blob(parts)));
  assert.equal((await reader.entries()).length,5);
});
test('export sink failure is not reported as saved',async()=>{
  let calls=0,closed=false,aborted=false;
  const sink=new WritableStream({write(){if(++calls>5)throw Error('simulated quota');},close(){closed=true;},abort(){aborted=true;}});
  await assert.rejects(()=>exportMochop(syntheticSource(1024*1024),sink),/simulated quota/);
  assert.equal(closed,false); // The Streams spec may skip sink.abort once the sink has already errored.
  // The caller must remove its temporary output file after a rejected export.
});
test('import abortSignal mid-audio discards staging',async t=>{
  const blob=await zipOf(syntheticSource(5*1024*1024)),{repo,root}=await setup(t),aborter=new AbortController();
  await assert.rejects(()=>importMochop(new ZipStoreReader(blobSource(blob)),repo,{abortSignal:aborter.signal,onProgress:({processed})=>{if(processed>500000)aborter.abort();}}),/aborted/);
  assert.deepEqual(await fs.readdir(path.join(root,'stages')),[]);
  assert.deepEqual(await fs.readdir(path.join(root,'index')),[]);
});
test('meeting list tampering after valid CRC/ZIP triggers rollback',async t=>{
  const full=await zipOf(syntheticSource(64));
  const bad=await rewrite(full,(name,bytes)=>{
    if(name==='manifest.json'){const obj=JSON.parse(new TextDecoder().decode(bytes));obj.meetingIds=['another'];return new TextEncoder().encode(JSON.stringify(obj));}
  });
  await expectRejected(t,bad);
});
test('unsupported entry method and symlink rejected before staging',async t=>{
  const full=await zipOf(syntheticSource(10)),r=new ZipStoreReader(blobSource(full)),entries=await r.entries();
  for(const mutation of [{symlink:true},{method:99},{encrypted:true}]){
    const forged={entries:async()=>entries.map(e=>e.name==='meeting.json'?{...e,...mutation}:e),open:e=>r.open(e)};
    const {repo,root}=await setup(t);
    await assert.rejects(()=>importMochop(forged,repo),/unsafe\/unsupported/);
    assert.deepEqual(await fs.readdir(path.join(root,'stages')),[]);
  }
});
test('file that is present but unlisted cannot be published',async t=>{
  const full=await zipOf(syntheticSource(10)),original=new ZipStoreReader(blobSource(full)),entries=await original.entries();
  const extra={...entries.find(e=>e.name==='meeting.json'),name:'audio/extra.pcm'};
  await expectRejected(t,{entries:async()=>[...entries,extra],open:e=>original.open(e)});
});
test('huge declared metadata rejected before reading JSON into heap',async t=>{
  const blob=await zipOf(syntheticSource(50)),base=new ZipStoreReader(blobSource(blob)),entries=await base.entries();
  const big={entries:async()=>entries.map(e=>e.name==='note.json'?{...e,size:65*1024*1024,compressedSize:65*1024*1024}:e),open:e=>base.open(e)};
  const {repo,root}=await setup(t);
  await assert.rejects(()=>importMochop(big,repo),/ZIP size|metadata JSON size limit/);
  assert.deepEqual(await fs.readdir(path.join(root,'stages')),[]);
});
test('missing required note.json cannot be excused by allowMissingAudio',async t=>{
  const full=await zipOf(syntheticSource(30));
  const noNote=await rewrite(full,name=>name==='note.json'?null:undefined);
  await expectRejected(t,noNote,{allowMissingAudio:true});
});
test('staging write failure rolls back without publish',async t=>{
  const blob=await zipOf(syntheticSource(1024*1024)),{repo,root}=await setup(t);
  const broken={...repo,async stage(){
    const inner=await repo.stage();return {...inner,async create(name){
      const writer=await inner.create(name);if(!name.endsWith('.pcm'))return writer;
      let writes=0;return {...writer,async write(chunk){if(++writes===2)throw Error('disk quota failure');await writer.write(chunk);}};
    }};
  }};
  await assert.rejects(()=>importMochop(new ZipStoreReader(blobSource(blob)),broken),/quota/);
  assert.deepEqual(await fs.readdir(path.join(root,'stages')),[]);
  assert.deepEqual(await fs.readdir(path.join(root,'index')),[]);
});
test('exporting interrupted source cannot return a backup success',async()=>{
  const src=syntheticSource(100000),chunks=[];
  src.openAudio=async()=>{
    let once=false;
    return new ReadableStream({pull(controller){if(!once){once=true;controller.enqueue(new Uint8Array(1024));}else controller.error(Error('source disappeared'));}});
  };
  await assert.rejects(()=>exportMochop(src,new WritableStream({write(b){chunks.push(b);}})),/source disappeared/);
});
test('manifest payload changed with stale ZIP CRC must be rejected before staging (regression)',async t=>{
  const full=await zipOf(syntheticSource(128)),bytes=new Uint8Array(await full.arrayBuffer());
  const manifest=(await new ZipStoreReader(blobSource(full)).entries()).find(e=>e.name==='manifest.json');
  const header=new DataView(bytes.buffer,bytes.byteOffset+manifest.offset,30);
  const start=manifest.offset+30+header.getUint16(26,true)+header.getUint16(28,true);
  const content=new TextDecoder().decode(bytes.subarray(start,start+manifest.size));
  const needle='poc-07-web',at=content.indexOf(needle);
  assert(at>=0,'fixture manifest must have known marker');
  bytes[start+at+needle.length-1]='x'.charCodeAt(0);
  await expectRejected(t,new Blob([bytes]));
});
test('manifest declared ZIP length differs from actually streamed bytes: reject before staging',async t=>{
  const full=await zipOf(syntheticSource(32)),original=new ZipStoreReader(blobSource(full)),entries=await original.entries();
  const forged={entries:async()=>entries.map(e=>e.name==='manifest.json'?{...e,size:e.size+1,compressedSize:e.compressedSize+1}:e),
    open:e=>original.open(entries.find(x=>x.name===e.name))};
  await expectRejected(t,forged);
});
test('Windows reserved names, alternate streams and filename folding are rejected',()=>{
  for(const unsafe of ['audio/CON','audio/CON.pcm','audio/nul.wav','audio/COM1.a','audio/LPT9','audio/file:secret',
    'audio/trailing.','audio/trailing ','audio/flag?x','audio/f*ile','audio/e\u0301.pcm']){
    assert.throws(()=>fileName(unsafe),/unsafe ZIP path/);
  }
});
