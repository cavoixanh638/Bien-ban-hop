import test from 'node:test';
import assert from 'node:assert/strict';
import {committedContiguousEnd,selectCommittedPlayback} from '../src/playback-start.mjs';
import {planVerifiedWavClip} from '../src/audio-clip.mjs';
import {buildMeetingTimeline} from '../src/meeting-timeline.mjs';
import {makeSafeLoop} from '../src/replay-tools.mjs';

const manifest={recordingId:'r',sampleRate:8000,sampleRanges:[
  {sampleStart:0,sampleEndExclusive:8000},
  {sampleStart:8000,sampleEndExclusive:16000},
  {sampleStart:24000,sampleEndExclusive:32000}
]};
test('G00 contiguous WAV segments may be traversed, but a gap always terminates',()=>{
  assert.equal(committedContiguousEnd(manifest.sampleRanges,4000),16000);
  assert.equal(committedContiguousEnd(manifest.sampleRanges,25000),32000);
  assert.equal(committedContiguousEnd(manifest.sampleRanges,18000),null);
  assert.equal(selectCommittedPlayback(manifest,'r',500).endSampleExclusive,16000);
  assert.equal(planVerifiedWavClip(manifest,500,1500).count,8000);
  assert.throws(()=>planVerifiedWavClip(manifest,1500,3500),/vùng thiếu/);
});
test('G00 A-B may span verified adjacent ranges only in same recording',()=>{
  const timeline=buildMeetingTimeline(['r'],new Map([['r',manifest]]));
  const ok=makeSafeLoop(timeline,500,1500);
  assert.equal(ok.durationMs,1000);
  assert.throws(()=>makeSafeLoop(timeline,1500,3200),/khoảng thiếu/);
  assert.throws(()=>makeSafeLoop(timeline,2200,3400),/cùng một phiên/);
});
test('G00 fail closed for overlapping or malformed committed WAV ranges',()=>{
  assert.throws(()=>committedContiguousEnd([
    {sampleStart:0,sampleEndExclusive:8000},
    {sampleStart:7900,sampleEndExclusive:12000}],4000),/chồng lấn/);
});
