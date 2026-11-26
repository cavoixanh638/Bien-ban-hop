import test from 'node:test';
import assert from 'node:assert/strict';
import {ProgressiveSilenceIndex,planStreamChunk,
  SILENCE_LOOKAHEAD_MS,PITCH_CHUNK_MS,PITCH_CHUNK_MAX_BYTES}
  from '../src/streaming-playback.mjs';
import {readPitchWav} from '../src/pitch-playback.mjs';

const pcmReader=(levelAt=()=>.2)=>({
  reads:[],
  async call(action,{sample,count}){
    assert.equal(action,'seek');
    this.reads.push({sample,count});
    const pcm=new Float32Array(count);
    for(let i=0;i<count;i++)pcm[i]=levelAt(sample+i);
    return {status:'valid',pcm:pcm.buffer};
  }
});
test('G00 pitch playback plans <=6s verified chunks no matter how long the meeting is',()=>{
  const rate=48000,end=rate*3*3600,plans=[];
  let at=0;
  for(let i=0;i<5;i++){
    const p=planStreamChunk(rate,at,end,end);
    assert.equal(p.frames,rate*PITCH_CHUNK_MS/1000);
    assert.ok(p.bytes<=PITCH_CHUNK_MAX_BYTES);
    assert.equal(p.startSample,at);
    at=p.endSample;plans.push(p);
  }
  assert.equal(plans.length,5);
  assert.equal(at,rate*30);
  const short=planStreamChunk(rate,100,120,120);
  assert.equal(short.frames,20);
  assert.throws(()=>planStreamChunk(rate,100,101,100),/Không thể chọn/);
});
test('G00 progressive silence only reads bounded lookahead, never full three-hour recording',async()=>{
  const rate=8000,total=rate*3*3600,reader=pcmReader(()=>.2);
  const changes=[];
  const index=new ProgressiveSilenceIndex(reader,rate,0,total,{
    onScanned:item=>changes.push(item)});
  const d=await index.next(0);
  assert.equal(d.skipTo,null);
  assert.equal(d.availableUntil,rate*SILENCE_LOOKAHEAD_MS/1000);
  assert.equal(index.scannedSamples,rate*8);
  assert.equal(reader.reads.reduce((n,r)=>n+r.count,0),rate*8);
  assert.ok(reader.reads.every(r=>r.count<=16384));
  assert.equal(changes.length,1);
  assert.equal(index.ranges.length,0);
  await index.next(rate*8);
  assert.equal(index.scannedSamples,rate*16);
  assert.ok(reader.reads.length<20);
});
test('G00 silence skipping never removes verified voice and preserves source sample positions',async()=>{
  const rate=8000,reader=pcmReader(sample=>sample>=rate*2&&sample<rate*7?0:.2);
  const index=new ProgressiveSilenceIndex(reader,rate,0,rate*16);
  const first=await index.next(0);
  assert.ok(first.availableUntil>=rate*2);
  const skip=await index.next(rate*3);
  assert.ok(skip.skipTo>rate*6);
  assert.ok(skip.skipTo<=rate*7);
  const after=await index.next(skip.skipTo);
  assert.equal(after.skipTo,null);
  assert.ok(after.availableUntil>rate*7);
  assert.ok(index.ranges.every(r=>r.endSample>skip.skipTo));
});
test('G00 cancelled or unverified progressive read never creates a playable region',async()=>{
  const rate=8000,reader=pcmReader();
  let cancelled=true;
  const index=new ProgressiveSilenceIndex(reader,rate,0,rate*60,
    {cancelled:()=>cancelled});
  assert.equal(await index.next(0),null);
  assert.equal(reader.reads.length,0);
  cancelled=false;
  const invalid=new ProgressiveSilenceIndex({call:async()=>({status:'gap'})},rate,0,rate*30);
  await assert.rejects(()=>invalid.next(0),/[Kk]hông đọc được PCM/);
});
test('G00 6s native-pitch WAV stream chunks are independent and original PCM remains unchanged',async()=>{
  const rate=8000,reader=pcmReader(s=>Math.sin(s/16)*.1);
  const plan=planStreamChunk(rate,rate*13,rate*3*3600,rate*20);
  assert.equal(plan.frames,rate*6);
  const blob=await readPitchWav(reader,plan);
  assert.equal(blob.size,44+plan.frames*4);
  assert.equal(new TextDecoder().decode(new Uint8Array(await blob.slice(0,4).arrayBuffer())),'RIFF');
  assert.equal(reader.reads[0].sample,rate*13);
  assert.equal(reader.reads.at(-1).sample+reader.reads.at(-1).count,rate*19);
});
