import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcilePlaybackOptions} from '../src/playback-options.mjs';
import {scanVerifiedSilenceSpan} from '../src/silence-skip.mjs';

const options=(overrides={})=>({focusMs:0,rate:1,preservePitch:false,skipSilence:false,...overrides});
test('G00 screenshot regression: enabling skip-silence while Continuous selects visible 30s focus',()=>{
  const input=options({skipSilence:true});
  const {settings,notice}=reconcilePlaybackOptions(input,'silence');
  assert.equal(settings.focusMs,30000);
  assert.equal(settings.skipSilence,true);
  assert.match(notice,/tự chọn Nghe tập trung 30 giây/);
  assert.equal(input.focusMs,0,'pure helper must not mutate stored defaults');
});
test('G00 explicitly returning to Continuous unchecks incompatible processing',()=>{
  const result=reconcilePlaybackOptions(options({focusMs:0,skipSilence:true}),'focus');
  assert.equal(result.settings.focusMs,0);
  assert.equal(result.settings.skipSilence,false);
  assert.match(result.notice,/Đã tắt Bỏ qua im lặng/);
});
test('G00 slow-speed pitch preservation and silence skip are mutually exclusive, last choice wins',()=>{
  let r=reconcilePlaybackOptions(options({rate:.75,preservePitch:true}),'pitch');
  assert.equal(r.settings.focusMs,30000);
  assert.equal(r.settings.preservePitch,true);
  r=reconcilePlaybackOptions(options({rate:.75,preservePitch:true,skipSilence:true,focusMs:30000}),'silence');
  assert.equal(r.settings.preservePitch,false);
  assert.equal(r.settings.skipSilence,true);
  r=reconcilePlaybackOptions(options({rate:.75,preservePitch:true,skipSilence:true,focusMs:30000}),'pitch');
  assert.equal(r.settings.preservePitch,true);
  assert.equal(r.settings.skipSilence,false);
  r=reconcilePlaybackOptions(options({rate:.75,preservePitch:true,skipSilence:true,focusMs:30000}),'rate');
  assert.equal(r.settings.preservePitch,false);
  assert.equal(r.settings.skipSilence,true);
});
test('G00 rate=1 allows both toggles (pitch preservation is not invoked by player)',()=>{
  const r=reconcilePlaybackOptions(options({focusMs:30000,rate:1,preservePitch:true,skipSilence:true}),'pitch');
  assert.equal(r.settings.preservePitch,true);
  assert.equal(r.settings.skipSilence,true);
  assert.equal(r.notice,'');
});
test('G00 continuous switch turns off slow-speed pitch but otherwise preserves focus choice',()=>{
  const r=reconcilePlaybackOptions(options({rate:.5,preservePitch:true,focusMs:0}),'focus');
  assert.equal(r.settings.preservePitch,false);
  assert.equal(r.settings.focusMs,0);
  const s=reconcilePlaybackOptions(options({focusMs:60000,skipSilence:true}),'silence');
  assert.equal(s.settings.focusMs,60000);
});
test('G00 playback options reject invalid UI values, fail closed',()=>{
  assert.throws(()=>reconcilePlaybackOptions(options({focusMs:9000}),'silence'),/không hợp lệ/);
  assert.throws(()=>reconcilePlaybackOptions(options({rate:0}),'rate'),/không hợp lệ/);
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
