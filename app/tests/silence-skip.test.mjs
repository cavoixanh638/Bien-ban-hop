import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planSilenceScan,buildSilenceRanges,scanVerifiedSilence}
  from '../src/silence-skip.mjs';

const check={status:'valid',startSample:0,anchorSample:0,endSampleExclusive:24000};
test('G00 silence detection is bounded to a confirmed focused recording region',()=>{
  const p=planSilenceScan(check,8000,15000);
  assert.equal(p.frames,24000);
  assert.equal(p.endSample,24000);
  assert.throws(()=>planSilenceScan(check,8000,0),/Nghe tập trung/);
  assert.throws(()=>planSilenceScan(check,8000,61000),/Nghe tập trung/);
  assert.throws(()=>planSilenceScan({status:'gap'},8000,15000),/mốc âm thanh/);
});
test('G00 conservative silence-only intervals keep edges and leave voice untouched',async()=>{
  const reads=[];
  const reader={call:async(_,{sample,count})=>{
    reads.push([sample,count]);
    const pcm=new Float32Array(count);
    for(let i=0;i<count;i++){
      const at=sample+i;pcm[i]=at>=8000&&at<16000 ? .15:0;
    }
    return {status:'valid',pcm:pcm.buffer};
  }};
  const result=await scanVerifiedSilence(reader,check,8000,15000);
  assert.ok(result.ranges.length>=2);
  assert.ok(result.skippedMs>1000&&result.skippedMs<2000);
  for(const range of result.ranges){
    assert.ok(range.endSample<=8000||range.startSample>=16000);
    assert.ok(range.endSample>range.startSample);
  }
  assert.equal(reads[0][0],0);
  assert.equal(reads.at(-1)[0]+reads.at(-1)[1],24000);
});
test('G00 silence analysis fails closed on corruption, truncated PCM and cancellation',async()=>{
  await assert.rejects(()=>scanVerifiedSilence({call:async()=>({status:'missing'})},check,8000,15000),
    /không đọc được PCM/);
  await assert.rejects(()=>scanVerifiedSilence({call:async()=>({status:'valid',pcm:new ArrayBuffer(4)})},check,8000,15000),
    /không đọc được PCM/);
  assert.equal(await scanVerifiedSilence({call:async()=>{throw Error('unexpected read');}},check,8000,15000,
    {cancelled:()=>true}),null);
  const p=planSilenceScan(check,8000,15000);
  assert.throws(()=>buildSilenceRanges(p,[{startSample:0,endSample:100,rms:NaN}]),/RMS/);
});
