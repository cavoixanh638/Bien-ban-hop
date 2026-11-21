import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planPitchWindow,readPitchWav,PITCH_MAX_BYTES} from '../src/pitch-playback.mjs';

const check={status:'valid',startSample:8000,anchorSample:12000,
 endSampleExclusive:8000*90,preRollLimited:false};
test('G00 pitch preservation requires a bounded focused verified WAV window',()=>{
  const p=planPitchWindow(check,8000,15000);
  assert.equal(p.frames,12000-8000+15000*8);
  assert.equal(p.endSample,132000);
  assert.equal(p.bytes,p.frames*4);
  assert.throws(()=>planPitchWindow(check,8000,0),/Nghe tập trung/);
  assert.throws(()=>planPitchWindow(check,8000,61000),/Nghe tập trung/);
  assert.throws(()=>planPitchWindow(check,192000,60000),/quá lớn/);
  assert.ok(PITCH_MAX_BYTES<64*1024*1024);
});
test('G00 pitch window builds a 32-bit float WAV from verified samples only',async()=>{
  const p=planPitchWindow(check,8000,15000),calls=[];
  const reader={call:async(action,{sample,count})=>{
    assert.equal(action,'seek');calls.push([sample,count]);
    return {status:'valid',pcm:new ArrayBuffer(count*4)};
  }};
  const blob=await readPitchWav(reader,p);
  assert.equal(blob.size,44+p.bytes);
  assert.equal(new TextDecoder().decode(new Uint8Array(await blob.slice(0,4).arrayBuffer())),'RIFF');
  assert.ok(calls.length>1);assert.equal(calls[0][0],p.startSample);
  assert.equal(calls.at(-1)[0]+calls.at(-1)[1],p.endSample);
});
test('G00 pitch window fails closed on missing PCM, cancelled fetch, and bad byte length',async()=>{
  const p=planPitchWindow(check,8000,15000);
  await assert.rejects(()=>readPitchWav({call:async()=>({status:'gap'})},p),/thiếu hoặc hỏng/);
  await assert.rejects(()=>readPitchWav({call:async()=>({status:'valid',pcm:new ArrayBuffer(3)})},p),/thiếu hoặc hỏng/);
  assert.equal(await readPitchWav({call:async()=>{throw Error('must not read');}},p,{cancelled:()=>true}),null);
});
