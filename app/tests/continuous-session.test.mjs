import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMeetingTimeline,locateMeetingPosition,nextContiguousSession}
  from '../src/meeting-timeline.mjs';

const m=(id,ranges,intervals=[])=>({recordingId:id,sampleRate:8000,
  sampleRanges:ranges.map(([sampleStart,sampleEndExclusive])=>
    ({sampleStart,sampleEndExclusive})),intervals});

test('G00 Continuous can advance from one fully verified session to the next without inventing pause time',()=>{
  const model=buildMeetingTimeline(['first','second'],new Map([
    ['first',m('first',[[0,8000]])],
    ['second',m('second',[[0,16000]])]
  ]));
  const next=nextContiguousSession(model,'first',1000);
  assert.deepEqual(next,{recordingId:'second',absoluteMs:1000,session:2});
  assert.deepEqual(locateMeetingPosition(model,next.absoluteMs),{
    status:'valid',recordingId:'second',session:2,
    localMs:0,absoluteMs:1000,segmentEndMs:3000
  });
  assert.equal(nextContiguousSession(model,'second',2000),null);
});
test('G00 never auto-advances past trailing or leading uncommitted audio gaps',()=>{
  const trailing=buildMeetingTimeline(['a','b'],new Map([
    ['a',m('a',[[0,8000]],[{kind:'gap',meetingEndMs:1500}])],
    ['b',m('b',[[0,8000]])]
  ]));
  assert.equal(nextContiguousSession(trailing,'a',1000),null);
  const leading=buildMeetingTimeline(['a','b'],new Map([
    ['a',m('a',[[0,8000]])],
    ['b',m('b',[[4000,16000]])]
  ]));
  assert.equal(nextContiguousSession(leading,'a',1000),null);
});
test('G00 finishing a range before the end of its session cannot auto-jump sources',()=>{
  const model=buildMeetingTimeline(['a','b'],new Map([
    ['a',m('a',[[0,8000],[16000,24000]])],
    ['b',m('b',[[0,8000]])]
  ]));
  assert.equal(nextContiguousSession(model,'a',1000),null);
  assert.equal(nextContiguousSession(model,'a',2200),null);
  assert.deepEqual(nextContiguousSession(model,'a',3000),{
    recordingId:'b',absoluteMs:3000,session:2
  });
  assert.equal(nextContiguousSession(model,'unknown',1000),null);
});
