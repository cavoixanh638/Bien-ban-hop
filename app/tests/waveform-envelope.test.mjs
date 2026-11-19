import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildMeetingTimeline} from '../src/meeting-timeline.mjs';
import {planWaveformProbes,pcmEnergy,readWaveformEnvelope,
  WAVEFORM_MAX_BINS,WAVEFORM_MAX_FRAMES} from '../src/waveform-envelope.mjs';

const manifest=(id,ranges)=>({recordingId:id,sampleRate:1000,
  sampleRanges:ranges.map(([sampleStart,sampleEndExclusive])=>({sampleStart,sampleEndExclusive}))});
const model=()=>buildMeetingTimeline(['rec-one','rec-two'],new Map([
  ['rec-one',manifest('rec-one',[[0,1000],[2000,3000]])],
  ['rec-two',manifest('rec-two',[[0,2000]])]
]));
test('G00 waveform planner never probes missing regions, bounds PCM and keeps session identity',()=>{
  const t=model(),plan=planWaveformProbes(t,{bins:50,frames:256});
  assert.ok(plan.probes.length>0);
  assert.ok(plan.probes.length<50);
  assert.ok(plan.probes.some(x=>x.recordingId==='rec-one'));
  assert.ok(plan.probes.some(x=>x.recordingId==='rec-two'));
  for(const p of plan.probes){
    assert.ok(p.count<=256&&p.count>0);
    const session=t.sessions.find(s=>s.recordingId===p.recordingId);
    assert.ok(session.ranges.some(r=>p.sample>=r.sampleStart&&p.sample+p.count<=r.sampleEndExclusive));
  }
  assert.throws(()=>planWaveformProbes(t,{bins:WAVEFORM_MAX_BINS+1}),/Giới hạn/);
  assert.throws(()=>planWaveformProbes(t,{frames:WAVEFORM_MAX_FRAMES+1}),/Giới hạn/);
});
test('G00 waveform calculates bounded RMS and peak but refuses invalid PCM',()=>{
  assert.deepEqual(pcmEnergy(new Float32Array([1,0,-1,0]),4),{peak:1,rms:Math.sqrt(.5)});
  assert.throws(()=>pcmEnergy(new Float32Array([1]),2),/đúng độ dài/);
  assert.throws(()=>pcmEnergy(new Float32Array([NaN]),1),/không hữu hạn/);
});
test('G00 waveform performs bounded verified reads; gaps are null and never synthesized',async()=>{
  const t=model(),calls=[];
  const result=await readWaveformEnvelope(t,async({recordingId,sample,count})=>{
    calls.push({recordingId,sample,count});
    return {status:'valid',pcm:new Float32Array(count).fill(.25)};
  },{bins:50,frames:100});
  assert.equal(result.approximate,true);
  assert.equal(result.probesRead,calls.length);
  assert.equal(result.samplesRead,calls.reduce((n,x)=>n+x.count,0));
  assert.ok(result.levels.some(v=>v===null));
  assert.ok(result.levels.some(v=>v!==null&&v.rms>0));
  assert.ok(calls.every(x=>x.count<=100));
});
test('G00 waveform fails closed on missing/unverified PCM and cancellation',async()=>{
  const t=model();
  await assert.rejects(()=>readWaveformEnvelope(t,async()=>({status:'gap'})),/Không thể xác minh PCM/);
  const controller=new AbortController();
  await assert.rejects(()=>readWaveformEnvelope(t,async({count})=>{
    controller.abort();return {status:'valid',pcm:new Float32Array(count)};
  },{signal:controller.signal}),{name:'AbortError'});
});
