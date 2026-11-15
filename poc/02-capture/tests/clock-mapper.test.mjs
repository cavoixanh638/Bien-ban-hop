import test from 'node:test';
import assert from 'node:assert/strict';
import {CaptureClockMapper,estimateInputMonoMs} from '../src/clock-mapper.mjs';

const ref={contextTime:.1,performanceTime:100}; // eventMonoMs = contextTimeSec*1000
const ev=(type,sampleIndex,contextTimeSec,extra={})=>({type,sampleIndex,contextTimeSec,...extra});

test('START ACK + periodic + stop map sample points independent of 3-second message delivery delay',()=>{
  const m=new CaptureClockMapper(48000);
  m.receive(ev('started',0,0),ref,3000);
  m.receive(ev('progress',48005,1),ref,4000); // +100 ppm oscillator drift
  m.receive(ev('progress',96010,2),ref,5000);
  m.receive(ev('stopped',144014,3),ref,6000);
  const summary=m.summary();
  assert.ok(summary.mappingPoints.length>=3);
  assert.deepEqual([summary.mappingPoints[0].inputMonoMs,summary.mappingPoints[0].sampleIndex],[0,0]);
  assert.equal(m.resolveInput(1500).status,'valid');
  assert.ok(Math.abs(m.resolveInput(1500).sampleIndex-72008)<=3);
  assert.equal(summary.intervals.length,1);
  assert.equal(summary.maxTimestampTransportLagMs,3000);
  assert.equal(summary.sensorLatencyCalibrated,false);
});

test('paused ten seconds yields a paused interval without adding ten seconds of media samples',()=>{
  const m=new CaptureClockMapper(48000);
  m.receive(ev('started',0,0),ref);
  m.receive(ev('progress',48000,1),ref);
  m.receive(ev('paused',96000,2),ref);
  m.receive(ev('resumed',96000,12),ref);
  m.receive(ev('progress',120000,12.5),ref);
  m.receive(ev('stopped',144000,13),ref);
  const result=m.summary();
  assert.equal(result.intervals.map(x=>x.kind).join(','),'recorded,paused,recorded');
  assert.equal(m.resolveInput(5000).status,'paused');
  assert.equal(m.resolveInput(1500).sampleIndex,72000);
  assert.equal(m.resolveInput(12250).sampleIndex,108000);
});

test('explicit pool gap and sink queue loss must NOT be interpolated as valid audio',()=>{
  const m=new CaptureClockMapper(48000);
  m.receive(ev('started',0,0),ref);
  m.receive(ev('progress',48000,1),ref);
  m.receive(ev('gap',72000,1.5,{start:48000,end:72000,reason:'pool-exhausted',count:24000}),ref);
  m.receive(ev('progress',96000,2),ref);
  m.receive(ev('stopped',120000,2.5),ref);
  const intervals=m.summary().intervals;
  assert.equal(intervals.filter(x=>x.kind==='gap').length,1);
  assert.equal(m.resolveInput(1250).status,'gap');
  m.applySinkGaps([{type:'gap',reason:'sink-queue-full',start:77000,end:83000}]);
  assert.equal(m.resolveInput(1700).status,'gap');
  assert.equal(m.resolveInput(1700).reason,'sink-queue-full');
  assert.equal(m.resolveInput(2100).status,'valid');
});

test('unavailable source remains unavailable and never maps notes to old sampleIndex',()=>{
  const m=new CaptureClockMapper(48000);
  m.receive(ev('started',0,0),ref);
  m.receive(ev('progress',48000,1),ref);
  m.receive(ev('unavailable',48000,1,{reason:'track-ended'}),ref);
  assert.equal(m.resolveInput(3000).status,'unavailable');
  m.receive(ev('stopped',48000,4),ref);
  assert.equal(m.resolveInput(3000).status,'unavailable');
});

test('zero output timestamp is uncalibrated; later valid context/output pair retrospectively anchors exact Worklet events',()=>{
  const m=new CaptureClockMapper(48000);
  m.receive(ev('started',0,0),{contextTime:0,performanceTime:0},6000);
  assert.equal(m.summary().pendingEvents,1);
  m.receive(ev('progress',48000,1),ref,7000);
  assert.equal(m.summary().pendingEvents,0);
  assert.equal(m.summary().mappingPoints.length,2);
  assert.equal(m.resolveInput(500).sampleIndex,24000);
  assert.equal(estimateInputMonoMs(ev('started',0,0),null),null);
});


test('G02-ADD-06 exact final clock point is valid and 1500ms stays pending until next progress',()=>{
  const m=new CaptureClockMapper(48000,{recordingId:'rec-clock'});
  m.receive(ev('started',0,0),ref);
  m.receive(ev('progress',48000,1),ref);
  assert.equal(m.resolveInput(1000).status,'valid');
  assert.equal(m.resolveInput(1000).sampleIndex,48000);
  const pending=m.queueInput(1500,'note-1500');
  assert.equal(pending.status,'pending');
  assert.equal(pending.inputMonoMs,1500);
  assert.equal(pending.recordingId,'rec-clock');
  assert.equal(pending.source,'live_recording');
  assert.equal(m.summary().pendingInputAnchors,1);
  m.receive(ev('progress',96000,2),ref);
  assert.deepEqual(m.takeInputResolutions().map(v=>[v.anchorId,v.status,v.sampleIndex]),
    [['note-1500','valid',72000]]);
  assert.equal(m.summary().pendingInputAnchors,0);
});

test('G02-ADD-06 pause/stop/unavailable never reconcile a future note to stale samples',()=>{
  const make=()=>{const m=new CaptureClockMapper(48000);m.receive(ev('started',0,0),ref);
    m.receive(ev('progress',48000,1),ref);return m;};
  const pause=make();pause.queueInput(1500,'pa');
  pause.receive(ev('paused',60000,1.25),ref);
  assert.equal(pause.takeInputResolutions()[0].status,'paused');
  assert.equal(pause.resolveInput(1300).status,'paused');
  const stop=make();stop.queueInput(1500,'st');
  stop.receive(ev('stopped',48000,1),ref);
  assert.equal(stop.takeInputResolutions()[0].status,'unlinked');
  assert.equal(stop.resolveInput(1500).status,'unlinked');
  const missing=make();missing.queueInput(1500,'un');
  missing.receive(ev('unavailable',48000,1,{reason:'track-ended'}),ref);
  assert.equal(missing.takeInputResolutions()[0].status,'unavailable');
});

test('G02-ADD-06 pool/sink gaps and bounded pending queue fail closed',()=>{
  const m=new CaptureClockMapper(48000);
  m.receive(ev('started',0,0),ref);
  m.receive(ev('progress',48000,1),ref);
  m.queueInput(1250,'pool-gap');
  m.receive(ev('gap',72000,1.5,{start:48000,end:72000,reason:'pool-exhausted'}),ref);
  assert.equal(m.takeInputResolutions()[0].status,'gap');
  const q=new CaptureClockMapper(48000);
  q.receive(ev('started',0,0),ref);
  for(let i=0;i<1024;i++)
    assert.equal(q.queueInput(1500,'id'+i).queued,true);
  const over=q.queueInput(1500,'overflow');
  assert.equal(over.status,'pending');
  assert.equal(over.queued,false);
  assert.equal(q.summary().pendingAnchorOverflow,1);
  assert.equal(q.summary().pendingInputAnchors,1024);
});

test('G02-ADD-06 stopped single-point interval drains pending instead of leaving it forever',()=>{
  const m=new CaptureClockMapper(48000,{recordingId:'rec-short'});
  m.receive(ev('started',0,0),ref);
  assert.equal(m.queueInput(500,'short-note').status,'pending');
  m.receive(ev('stopped',0,1),ref);
  const result=m.takeInputResolutions();
  assert.equal(result.length,1);
  assert.equal(result[0].anchorId,'short-note');
  assert.equal(result[0].status,'unlinked');
  assert.equal(m.summary().pendingInputAnchors,0);
});
