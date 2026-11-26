import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcilePlaybackOptions} from '../src/playback-options.mjs';
import {scanVerifiedSilenceSpan} from '../src/silence-skip.mjs';

const options=(overrides={})=>({focusMs:0,rate:1,preservePitch:true,skipSilence:false,...overrides});
test('G00 continuous mode stays Continuous when silence skipping is enabled',()=>{
  const input=options({rate:1.5,skipSilence:true});
  const {settings,notice}=reconcilePlaybackOptions(input,'silence');
  assert.equal(settings.focusMs,0);
  assert.equal(settings.skipSilence,true);
  assert.equal(settings.preservePitch,true);
  assert.match(notice,/Liên tục.*bỏ qua im lặng.*giữ cao độ/);
  assert.equal(input.focusMs,0);
});
test('G00 switching focus and speed never unchecks streaming audio effects',()=>{
  for(const changed of ['initial','silence','focus','pitch','rate']){
    const input=options({focusMs:0,rate:.75,skipSilence:true,preservePitch:true});
    const r=reconcilePlaybackOptions(input,changed);
    assert.deepEqual(r.settings,input);
    assert.match(r.notice,/mốc luôn theo bản ghi gốc/);
  }
  const focused=options({focusMs:15000,skipSilence:true,rate:2});
  assert.deepEqual(reconcilePlaybackOptions(focused,'focus').settings,focused);
});
test('G00 1x pitch preservation is harmless; all three effects can be combined',()=>{
  const input=options({rate:1,focusMs:0,skipSilence:true});
  const {settings,notice}=reconcilePlaybackOptions(input,'initial');
  assert.equal(settings.preservePitch,true);
  assert.equal(settings.skipSilence,true);
  assert.match(notice,/giữ cao độ tự nhiên/);
});
test('G00 playback option validator still rejects unsafe values',()=>{
  assert.throws(()=>reconcilePlaybackOptions(options({focusMs:9000})),/không hợp lệ/);
  assert.throws(()=>reconcilePlaybackOptions(options({rate:0})),/không hợp lệ/);
  assert.throws(()=>reconcilePlaybackOptions(options({skipSilence:'yes'})),/không hợp lệ/);
});
const check={status:'valid',startSample:0,anchorSample:0,endSampleExclusive:8000*130};
test('G00 explicit A-B 90s silence scans in two <=60s bounded windows',async()=>{
  const calls=[];
  const reader={call:async(action,{sample,count})=>{
    assert.equal(action,'seek');
    calls.push({sample,count});
    const pcm=new Float32Array(count);
    pcm.fill(sample>8000*40&&sample<8000*50?.12:0);
    return {status:'valid',pcm:pcm.buffer};
  }};
  const result=await scanVerifiedSilenceSpan(reader,check,8000,90000);
  assert.equal(result.scannedSamples,8000*90);
  assert.ok(result.skippedMs>=30000);
  assert.ok(result.ranges.length>=2,'window boundaries must be safe and distinct');
  assert.ok(calls.every(x=>x.count<=16384));
  assert.equal(calls.at(-1).sample+calls.at(-1).count,8000*90);
});
test('G00 short A-B 0.4s remains playable, skip scan never invents missing audio',async()=>{
  const ch={status:'valid',startSample:0,anchorSample:0,endSampleExclusive:8000};
  const result=await scanVerifiedSilenceSpan({call:async(_,{count})=>
    ({status:'valid',pcm:new Float32Array(count).buffer})},ch,8000,400);
  assert.equal(result.scannedSamples,3200);
  assert.equal(result.skippedMs,0); // No false skip below 750ms.
});
test('G00 silence span rejects multi-hour unbounded scans, errors and cancellation',async()=>{
  await assert.rejects(()=>scanVerifiedSilenceSpan({},check,8000,180000),/120 giây/);
  const broken={call:async()=>({status:'gap'})};
  await assert.rejects(()=>scanVerifiedSilenceSpan(broken,check,8000,15000),/[Kk]hông đọc được PCM/);
  const result=await scanVerifiedSilenceSpan({call:async()=>{throw Error('should not read');}},check,8000,30000,{cancelled:()=>true});
  assert.equal(result,null);
});
