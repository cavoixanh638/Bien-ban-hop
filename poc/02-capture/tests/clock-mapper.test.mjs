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
