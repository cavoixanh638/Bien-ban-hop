import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLocalRecordingMiddleware} from '../local-recordings.mjs';
import {wavHeader} from '../../poc/03-opfs/core.mjs';

async function fixture(){
  const root=await mkdtemp(join(tmpdir(),'mochop-g10-local-'));
  let handler;const server=createServer((req,res)=>{
    handler(req,res,()=>{res.statusCode=404;res.end('Missing');}).catch(e=>{res.statusCode=500;res.end(e.message);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  handler=createLocalRecordingMiddleware(root,{origin});
  return {root,server,origin,async cleanup(){await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});}};
}
const HEADERS={'X-MocHop-Local':'recording-v1'};
const ID='rec-test-0000000001';
const wav=Buffer.concat([Buffer.from(wavHeader(4,48000,1)),Buffer.alloc(4)]);

test('G10 local mirror: stream WAV into app/Recording/<id> without overwriting',async()=>{
  const f=await fixture();
  try{
    const root=f.origin+'/__moc_hop_local_recording/';
    const status=await fetch(root+'status',{headers:HEADERS});
    assert.equal(status.status,200);assert.equal((await status.json()).folder,'app/Recording');
    const url=root+ID+'/seg-0.wav';
    assert.equal((await fetch(url,{method:'HEAD',headers:HEADERS})).status,404);
    const created=await fetch(url,{method:'PUT',headers:{...HEADERS,'Content-Type':'audio/wav',Origin:f.origin},body:wav});
    assert.equal(created.status,201);
    const info=await created.json();
    assert.equal(info.bytes,wav.length);assert.match(info.sha256,/^[0-9a-f]{64}$/);
    assert.deepEqual(await readFile(join(f.root,'Recording',ID,'seg-0.wav')),wav);
    const exists=await fetch(url,{method:'HEAD',headers:HEADERS});
    assert.equal(exists.status,200);
    assert.equal(Number(exists.headers.get('X-Recording-Bytes')),wav.length);
    const duplicate=await fetch(url,{method:'PUT',headers:{...HEADERS,Origin:f.origin},body:wav});
    assert.equal(duplicate.status,409);
    assert.deepEqual(await readFile(join(f.root,'Recording',ID,'seg-0.wav')),wav);
  }finally{await f.cleanup();}
});
test('G10 local mirror: reject foreign origin, arbitrary paths, and broken WAV',async()=>{
  const f=await fixture();
  try{
    const root=f.origin+'/__moc_hop_local_recording/';
    assert.equal((await fetch(root+'status')).status,403);
    assert.equal((await fetch(root+'status',{headers:{...HEADERS,Origin:'https://evil.example'}})).status,403);
    const forbidden=await fetch(root+'rec-no/seg-0.wav',{method:'PUT',headers:{...HEADERS,Origin:f.origin},body:wav});
    assert.equal(forbidden.status,400);
    const broken=await fetch(root+ID+'/seg-0.wav',{method:'PUT',headers:{...HEADERS,Origin:f.origin},body:Buffer.alloc(100)});
    assert.equal(broken.status,422);
    await assert.rejects(()=>stat(join(f.root,'Recording',ID,'seg-0.wav')),e=>e.code==='ENOENT');
  }finally{await f.cleanup();}
});
