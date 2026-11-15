import test from 'node:test';
import assert from 'node:assert/strict';
import {BoundedBlobSpool} from '../src/stream-spool.mjs';
import {MediaRecorderProbe} from '../src/media-recorder.mjs';

const deferred=()=>{let resolve;const promise=new Promise(ok=>{resolve=ok;});return {promise,resolve};};
test('bounded streaming sink caps queued bytes, records gaps, never advertises incomplete full recording',async()=>{
  const gate=deferred(),writes=[];
  const sink=new BoundedBlobSpool(async()=>({
    async write(blob){await gate.promise;writes.push(blob.size);},
    async close(){},getFile:()=>new Blob([new Uint8Array(writes.reduce((a,b)=>a+b,0))])
  }),{maxQueueBytes:10,maxQueueChunks:2});
  assert.equal(sink.append(new Blob([new Uint8Array(6)])),true);
  assert.equal(sink.append(new Blob([new Uint8Array(5)])),false);
  assert.equal(sink.append(new Blob([new Uint8Array(4)])),true);
  assert.equal(sink.append(new Blob([new Uint8Array(1)])),false);
  gate.resolve();
  const result=await sink.finalize();
  assert.equal(result.writtenBytes,10);assert.equal(result.rejectedBytes,6);
  assert.equal(result.rejectedChunks,2);assert.equal(result.peakPendingBytes,10);
  assert.equal(result.status,'INCOMPLETE');assert.equal(result.durable,false);
  await assert.rejects(sink.getFile(),/not complete/);
});

test('streaming stores exact ordered WebM pieces without retaining them all in JS RAM',async()=>{
  const observed=[];
  const sink=new BoundedBlobSpool(async()=>({
    async write(blob){observed.push(...new Uint8Array(await blob.arrayBuffer()));},
    async close(){},getFile:()=>new Blob([new Uint8Array(observed)])
  }),{maxQueueBytes:1000000,maxQueueChunks:50});
  for(let i=0;i<30;i++) {
    assert.equal(sink.append(new Blob([new Uint8Array([i])])),true);
    await new Promise(resolve=>setImmediate(resolve));
  }
  const result=await sink.finalize();
  assert.equal(result.status,'FINISHED');assert.equal(result.writtenBytes,30);
  assert.deepEqual([...new Uint8Array(await (await sink.getFile()).arrayBuffer())],Array.from({length:30},(_,i)=>i));
  assert.equal(sink.summary().pendingBytes,0);
});

test('writer failure is FAIL, cannot return a falsely complete file',async()=>{
  const sink=new BoundedBlobSpool(async()=>({write:async()=>{throw new Error('quota');},close:async()=>{}}));
  assert.equal(sink.append(new Blob(['a'])),true);
  const result=await sink.finalize();
  assert.equal(result.status,'FAILED');assert.match(result.failure,/quota/);
  await assert.rejects(sink.getFile(),/not complete/);
});

test('MediaRecorderProbe streams > retention cap, assembles full diagnostic file and never calls it durable',async t=>{
  const old=Object.getOwnPropertyDescriptor(globalThis,'MediaRecorder');
  class FakeRecorder extends EventTarget {
    static isTypeSupported(){return true;}
    constructor(_stream,config){super();this.mimeType=config.mimeType;this.state='inactive';}
    start(){this.state='recording';}
    send(bytes){const event=new Event('dataavailable');event.data=new Blob([Uint8Array.from(bytes)]);
      this.dispatchEvent(event);}
    stop(){this.state='inactive';this.dispatchEvent(new Event('stop'));}
  }
  Object.defineProperty(globalThis,'MediaRecorder',{configurable:true,writable:true,value:FakeRecorder});
  t.after(()=>{if(old)Object.defineProperty(globalThis,'MediaRecorder',old);else delete globalThis.MediaRecorder;});
  const stored=[];
  const make=async()=>({
    async write(blob){stored.push(new Uint8Array(await blob.arrayBuffer()));},
    async close(){},
    async getFile(){return new Blob(stored);},
    async discard(){stored.length=0;}
  });
  const probe=new MediaRecorderProbe({},{timesliceMs:500,maxRetainedBytes:3,spoolFactory:make,maxSpoolQueueBytes:100});
  probe.start();
  probe.recorder.send([1,2]);
  await new Promise(resolve=>setImmediate(resolve));
  probe.recorder.send([3,4]);
  await new Promise(resolve=>setImmediate(resolve));
  probe.recorder.send([5,6]);
  await new Promise(resolve=>setImmediate(resolve));
  const metrics=await probe.stop();
  assert.equal(metrics.totalBytes,6);
  assert.equal(metrics.truncated,true);
  assert.equal(metrics.retainedBytes,2);
  assert.equal(metrics.spool.writtenBytes,6);
  assert.equal(metrics.spool.status,'FINISHED');
  assert.equal(metrics.durable,false);
  const file=await probe.getCompleteBlob();
  assert.deepEqual([...new Uint8Array(await file.arrayBuffer())],[1,2,3,4,5,6]);
  assert.equal(file.type,'audio/webm;codecs=opus');
  await probe.dispose();
  assert.equal(stored.length,0);
});
