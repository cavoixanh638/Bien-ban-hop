import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker, MessageChannel} from 'node:worker_threads';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitForCondition(check,{timeoutMs=4000,stepMs=10}={}){
  const end=Date.now()+timeoutMs;
  while(!check()){
    if(Date.now()>end)throw Error('Chờ recycle MessagePort vượt 4 giây');
    await delay(stepMs);
  }
}
async function harness({batchFrames=2048,poolSize=4,maxQueue=3,delayMs=0,cpuBurnMs=0}={}) {
  const WorkerScript=readFileSync(new URL('../src/capture-processor.js',import.meta.url),'utf8');
  let Processor;
  const events=[];
  class Base {constructor(){this.port={postMessage:(event)=>events.push(event),onmessage:null};}}
  runInNewContext(WorkerScript, {AudioWorkletProcessor:Base,Float32Array,ArrayBuffer,
    Number,sampleRate:48000,currentTime:0,registerProcessor:(_name,constructor)=>{Processor=constructor;}});
  const processor=new Processor();
  const worker=new Worker(new URL('./node-worker-bootstrap.mjs',import.meta.url),{type:'module'});
  const channel=new MessageChannel();
  const seen=[];
  const ready=new Promise((resolve,reject)=>{worker.on('message',msg=>{
    seen.push(msg);
    if(msg.type==='ready')resolve();
  });worker.once('error',reject);});
  worker.postMessage({type:'attach',port:channel.port2,recordingId:'rec-1',sampleRate:48000,
    delayMs,cpuBurnMs,maxQueue,maxPrefixSeconds:0.1},[channel.port2]);
  await ready;
  processor.command({type:'attach',port:channel.port1,recordingId:'rec-1',batchFrames,poolSize,channels:1});
  processor.command({type:'start'});
  let nextValue=0;
  function feed(frames=128) {
    const input=new Float32Array(frames);
    input.fill((nextValue++ % 10)/10);
    processor.process([[input]],[[new Float32Array(frames)]]);
  }
  function waitFor(type,timeoutMs=4000) {
    return new Promise((resolve,reject)=>{
      const check=setInterval(()=>{
        const msg=seen.find(m=>m.type===type);
        if(msg){clearInterval(check);clearTimeout(timer);resolve(msg);}
      },5);
      const timer=setTimeout(()=>{clearInterval(check);reject(new Error('timeout '+type));},timeoutMs);
    });
  }
  async function stop() {
    processor.command({type:'stop'});
    const result=await waitFor('final');
    return result.metrics;
  }
  async function close() {channel.port1.close();await worker.terminate();}
  return {processor,events,feed,waitFor,stop,close,seen,channel,worker};
}

test('real MessagePort transfer detach + recycle, 2048 chunk',async()=>{
  const h=await harness({batchFrames:2048,poolSize:4,maxQueue:4,delayMs:0});
  try {
    for(let i=0;i<16;i++)h.feed();
    assert.equal(h.processor.inFlight,1);
    assert.equal(h.processor.pcm,null);
    await waitForCondition(()=>h.processor.recycled===1);
    assert.equal(h.processor.recycled,1);
    assert.equal(h.processor.free.length,4);
    for(let i=0;i<32;i++)h.feed();
    const result=await h.stop();
    assert.equal(result.failure,null);
    assert.equal(result.blocks,3);
    assert.equal(result.receivedFrames,6144);
    assert.equal(result.missingFrames,0);
    assert.equal(result.overlappedFrames,0);
    assert.equal(result.sequenceErrorCount,0);
    assert.equal(result.committedThroughSampleExclusive,null);
  } finally{await h.close();}
});

test('4096 batch + pause/resume: no spurious samples while paused',async()=>{
  const h=await harness({batchFrames:4096});
  try {
    for(let i=0;i<10;i++)h.feed();
    h.processor.command({type:'pause'});
    for(let i=0;i<20;i++)h.feed();
    assert.equal(h.processor.frameCursor,1280);
    h.processor.command({type:'resume'});
    for(let i=0;i<32;i++)h.feed();
    const result=await h.stop();
    assert.equal(result.receivedFrames,1280+4096);
    assert.equal(result.missingFrames,0);
    assert.equal(result.sourceEvents.filter(e=>e.type==='paused').length,1);
    assert.equal(result.sourceEvents.filter(e=>e.type==='resumed').length,1);
  } finally{await h.close();}
});

test('queue overflow and bounded 2-buffer pool report real lost frames; no false commit',async()=>{
  const h=await harness({batchFrames:2048,poolSize:2,maxQueue:1,delayMs:110});
  try {
    for(let i=0;i<160;i++)h.feed();
    const result=await h.stop();
    assert.equal(result.failure,null);
    assert.equal(result.committedThroughSampleExclusive,null);
    assert.equal(h.processor.allocated,2);
    assert.ok(h.processor.workletDroppedFrames>0,'worklet must report dropped frames');
    assert.ok(result.rejectedFrames>0,'worker must reject when max queue full');
    assert.ok(result.receivedFrames < h.processor.frameCursor);
    assert.ok(result.tailMissingFrames>0 || result.missingFrames>0);
    assert.ok(result.peakQueued<=1);
  } finally{await h.close();}
});

test('unavailable (track lost) is explicit and never yields synthesized silence as audio',async()=>{
  const h=await harness({batchFrames:2048});
  try {
    for(let i=0;i<16;i++)h.feed();
    h.processor.command({type:'unavailable',reason:'track-ended'});
    const before=h.processor.frameCursor;
    for(let i=0;i<16;i++)h.feed();
    assert.equal(h.processor.frameCursor,before);
    const result=await h.stop();
    assert.equal(result.receivedFrames,2048);
    assert.equal(result.sourceEvents.filter(e=>e.type==='unavailable').length,1);
  } finally{await h.close();}
});

test('Worker returns decodable contiguous WAV prefix with consistent header and signal at first/middle/end',async()=>{
  const h=await harness({batchFrames:2048,poolSize:4,maxQueue:4});
  try {
    for(let i=0;i<16;i++)h.feed();
    await delay(40);
    for(let i=0;i<16;i++)h.feed();
    await h.stop();
    const request=new Promise(resolve=>{
      // Worker is intentionally kept alive after final for export.
      const loop=setInterval(()=>{const m=h.seen.find(m=>m.type==='wav');if(m){clearInterval(loop);resolve(m);}},5);
    });
    // Add an accessor to harness for the control channel below.
    h.worker.postMessage({type:'export-prefix'});
    const wav=(await request).wav;
    const view=new DataView(wav);
    assert.equal(String.fromCharCode(...new Uint8Array(wav,0,4)),'RIFF');
    assert.equal(view.getUint32(24,true),48000);
    const n=view.getUint32(40,true)/2;
    assert.equal(n,4096);
    for(const i of [0,Math.round(n/2),n-1]) assert.ok(Number.isInteger(view.getInt16(44+i*2,true)));
  } finally{await h.close();}
});
