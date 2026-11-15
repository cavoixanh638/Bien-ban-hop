import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {CoverageLedger, checkChunk, encodeWavPcm16} from '../src/contract.mjs';

const valid = (sequenceNo, firstSample, sampleCount = 8) => ({
  recordingId:'rec-1', sequenceNo, firstSample, sampleCount, sampleRate:48000,
  channels:1, format:'f32le', pcm:new ArrayBuffer(sampleCount * 4)
});

test('frozen f32le capture contract validates frames vs bytes and integer indices', () => {
  assert.equal(checkChunk(valid(0,0)), true);
  assert.throws(() => checkChunk({...valid(0,0),pcm:new ArrayBuffer(4)}), /byteLength/);
  assert.throws(() => checkChunk({...valid(0,0),firstSample:0.5}), /firstSample/);
  assert.throws(() => checkChunk({...valid(0,0),format:'pcm16'}), /format/);
  assert.throws(() => checkChunk({...valid(0,0),firstSample:Number.MAX_SAFE_INTEGER}), /unsafe/);
  assert.throws(() => checkChunk({...valid(0,0),channels:2}), /byteLength/);
});

test('ledger identifies gap, duplicates, bad sequence and refuses different recording', () => {
  const ledger = new CoverageLedger();
  ledger.accept(valid(0, 0));
  ledger.accept(valid(1, 16)); // skipped frames [8,16)
  ledger.accept(valid(1, 16)); // duplicated packet
  const stats = ledger.summary();
  assert.equal(stats.missingFrames, 8);
  assert.equal(stats.overlappedFrames, 8);
  assert.equal(stats.sequenceErrorCount, 1);
  assert.equal(stats.receivedFrames, 24);
  assert.deepEqual(ledger.gaps[0],{start:8,end:16,count:8});
  assert.throws(()=>ledger.accept({...valid(3,24),recordingId:'other'}),/mixed recordingIds/);
});

test('WAV diagnostic prefix is byte-correct and signed PCM16', () => {
  const b = encodeWavPcm16(new Float32Array([-1,-0.5,0,0.5,1]),48000,1);
  const v = new DataView(b);
  assert.equal(b.byteLength,54);
  assert.equal(v.getUint32(4,true),46);
  assert.equal(v.getUint16(22,true),1);
  assert.equal(v.getUint32(24,true),48000);
  assert.equal(v.getInt16(44,true),-32768);
  assert.equal(v.getInt16(48,true),0);
  assert.equal(v.getInt16(52,true),32767);
});

function fakeWorklet(batchFrames=2048,poolSize=2) {
  const transmitted = [];
  const signals = [];
  let Processor;
  class Base {
    constructor(){this.port={postMessage: message => signals.push(message), onmessage:null};}
  }
  const context = {AudioWorkletProcessor:Base, Float32Array, ArrayBuffer, Number,
    sampleRate:48000,currentTime:0,
    registerProcessor:(name,value)=>{assert.equal(name,'transfer-capture');Processor=value;}};
  runInNewContext(readFileSync(new URL('../src/capture-processor.js',import.meta.url),'utf8'),context);
  const port={postMessage:(message)=>transmitted.push(message),start:()=>{},onmessage:null};
  const processor=new Processor();
  processor.command({type:'attach',port,recordingId:'rec-1',batchFrames,poolSize,channels:1});
  processor.command({type:'start'});
  function feed(n, offset=0) {
    const src=new Float32Array(n);
    for(let i=0;i<n;i++)src[i]=((i+offset)%97)/97;
    processor.process([[src]],[[new Float32Array(n)]]);
  }
  return {processor,port,feed,transmitted,signals,context};
}

test('worklet uses actual non-128 quanta and batches exactly; pause does not advance frameCursor', () => {
  const h=fakeWorklet(2048,4);
  for (let i=0;i<8;i++) h.feed(255, i*255); // 2040 frames
  h.feed(16,2040); // first 2048 and eight from next
  assert.equal(h.transmitted.filter(x=>x.type==='chunk').length,1);
  const chunk=h.transmitted.find(x=>x.type==='chunk').chunk;
  assert.equal(chunk.sampleCount,2048);
  assert.equal(chunk.firstSample,0);
  assert.equal(chunk.pcm.byteLength,8192);
  h.processor.command({type:'pause'});
  assert.equal(h.processor.frameCursor,2056);
  const partial=h.transmitted.filter(x=>x.type==='chunk')[1].chunk;
  assert.equal(partial.firstSample,2048);
  assert.equal(partial.sampleCount,8);
  h.feed(127);
  assert.equal(h.processor.frameCursor,2056);
  h.processor.command({type:'resume'});
  h.feed(127);
  assert.equal(h.processor.frameCursor,2183);
  h.processor.command({type:'stop'});
  const stats=h.signals.at(-1);
  assert.equal(stats.type,'stopped');
  assert.equal(stats.quantumCounts['255'],8);
  assert.equal(stats.quantumCounts['16'],1);
  assert.equal(stats.quantumCounts['127'],2);
  assert.equal(stats.sampleIndex,2183);
  assert.equal(h.transmitted.at(-1).type,'source-ended');
});

test('worklet bounded pool causes explicit loss; later sampleIndex reveals hole', () => {
  const h=fakeWorklet(2048,2);
  for(let i=0;i<32;i++)h.feed(128,i*128); // two full buffers in flight
  assert.equal(h.processor.allocated,2);
  assert.equal(h.processor.inFlight,2);
  h.feed(128,4096); // worklet cannot borrow, must mark gap
  assert.equal(h.processor.frameCursor,4224);
  assert.equal(h.processor.workletDroppedFrames,128);
  const returned=h.transmitted.find(x=>x.type==='chunk').chunk.pcm;
  h.port.onmessage({data:{type:'recycle',pcm:returned}});
  for(let i=0;i<16;i++)h.feed(128,4224+i*128);
  h.processor.command({type:'stop'});
  const chunks=h.transmitted.filter(x=>x.type==='chunk').map(x=>x.chunk);
  assert.deepEqual(chunks.map(x=>x.firstSample),[0,2048,4224]);
  assert.equal(h.processor.allocated,2);
  const gap=h.signals.find(x=>x.type==='gap');
  assert.equal(gap.reason,'pool-exhausted');
  assert.deepEqual([gap.start,gap.end,gap.count],[4096,4224,128]);
});

test('no input and unavailable state do not claim silence as recorded', () => {
  const h=fakeWorklet(2048,2);
  h.feed(128);
  h.processor.process([[]],[[new Float32Array(255)]]);
  assert.equal(h.processor.workletDroppedFrames,255);
  h.processor.command({type:'unavailable',reason:'track-ended'});
  h.feed(128);
  assert.equal(h.processor.frameCursor,383);
  const statuses=h.signals.filter(x=>x.type==='unavailable');
  assert.equal(statuses.length,1);
  assert.equal(statuses[0].reason,'track-ended');
});
