import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemoryDB} from '../../poc/06-notes/notes.mjs';
import {CaptureClockMapper} from '../../poc/02-capture/src/clock-mapper.mjs';
import {MeetingStore,SaveQueue} from '../src/meeting-store.mjs';
import {verifiedClickedAnchor} from '../src/anchor-bridge.mjs';
import {resolvePlaybackStart,selectCommittedPlayback} from '../src/playback-start.mjs';
import {buildMeetingTimeline,locateMeetingPosition,meetingPositionFor,firstPlayablePosition} from '../src/meeting-timeline.mjs';
import {contextFor,resolvePending,intervalFor} from '../src/clock-bridge.mjs';
import {fixture as audioFixture} from '../../poc/05-player/player.js';
import {resolveMedia,meetingToMedia,choosePreRoll} from '../../poc/05-player/timeline.js';
import {exportDOCX} from '../../poc/08-export/exporter.mjs';

const doc=(text='Ghi chú tiếng Việt')=>({type:'doc',content:[{type:'paragraph',content:[{type:'text',text}]}]});
const setup=async()=>{const db=createMemoryDB(),store=new MeetingStore(db),meeting=await store.create('Họp thử');
  const lease={held:true,meetingId:meeting.meetingId};return {db,store,meeting,lease};};
test('G10/G06: note plus pending provenance committed atomically with same revision',async()=>{
  const {store,meeting,lease}=await setup();
  const pending={schemaVersion:1,meetingId:meeting.meetingId,records:[{mark:{anchorId:'a'}}]};
  assert.equal(await store.save(meeting.meetingId,doc(),pending,0,lease),1);
  let loaded=await store.load(meeting.meetingId);
  assert.equal(loaded.note.revision,1);assert.deepEqual(loaded.pendingState,pending);
  assert.equal(loaded.note.content.content[0].content[0].text,'Ghi chú tiếng Việt');
});
test('G10/G06: stale revision and invalid lease cannot replace last durable note',async()=>{
  const {store,meeting,lease}=await setup();await store.save(meeting.meetingId,doc('A'),null,0,lease);
  await assert.rejects(()=>store.save(meeting.meetingId,doc('B'),null,0,lease),/CONFLICT/);
  await assert.rejects(()=>store.save(meeting.meetingId,doc('B'),null,1,{held:false}),/khóa ghi/);
  const saved=await store.load(meeting.meetingId);
  assert.equal(saved.note.content.content[0].content[0].text,'A');
  assert.equal(saved.note.revision,1);
});
test('G10/G06: foreign pending journal never persisted',async()=>{
  const {store,meeting,lease}=await setup();
  await assert.rejects(()=>store.save(meeting.meetingId,doc(),{schemaVersion:1,meetingId:'other',records:[]},0,lease),/sai cuộc họp/);
  assert.equal((await store.load(meeting.meetingId)).note.revision,0);
});
test('G10/G06: only durable note save updates revision, failure leaves original untouched',async()=>{
  const {db,store,meeting,lease}=await setup();
  db.failNextCommit('simulated quota');
  await assert.rejects(()=>store.save(meeting.meetingId,doc('B'),null,0,lease),/simulated quota/);
  assert.equal((await store.load(meeting.meetingId)).note.revision,0);
});
test('G10/G06: recording reference updates only under same-meeting lease',async()=>{
  const {store,meeting,lease}=await setup();
  await assert.rejects(()=>store.addRecording(meeting.meetingId,'rec-1',{held:true,meetingId:'another'}),/khóa ghi/);
  const current=await store.addRecording(meeting.meetingId,'rec-1',lease);
  assert.deepEqual(current.recordingIds,['rec-1']);
  await assert.rejects(()=>store.addRecording(meeting.meetingId,'rec-1',lease),/đã tồn tại/);
});
test('G10 SaveQueue: new edit during pending save drains both generations, one writer only',async()=>{
  let release,active=0,peak=0,commits=[],states=[];
  const gate=new Promise(ok=>{release=ok});
  const q=new SaveQueue(async target=>{
    active++;peak=Math.max(active,peak);
    if(target===1)await gate;
    commits.push(target);active--;
  },s=>states.push(s),{delay:100000,maxWait:100000});
  q.edit();const first=q.flush();
  await Promise.resolve();
  q.edit();const second=q.flush();
  release();await Promise.all([first,second]);await q.drain();await q.close();
  assert.deepEqual(commits,[1,2]);assert.equal(peak,1);
  assert.equal(states.at(-1),'saved');assert.equal(q.durableGeneration,2);
});
test('G10 SaveQueue: save failure cannot be shown as saved and blocks release',async()=>{
  const states=[];let attempts=0;
  const q=new SaveQueue(async()=>{attempts++;if(attempts===1)throw Error('quota');},s=>states.push(s),{delay:100000,maxWait:100000});
  q.edit();await assert.rejects(()=>q.drain(),/quota/);
  assert.notEqual(states.at(-1),'saved');assert.equal(q.durableGeneration,0);
  await q.drain();await q.close();assert.equal(q.durableGeneration,1);
});
const clk=()=>{
  const m=new CaptureClockMapper(48000,{recordingId:'rec-x'});
  const stamp={contextTime:1,performanceTime:1000};
  m.receive({type:'started',sampleIndex:0,contextTimeSec:0},stamp);
  m.receive({type:'progress',sampleIndex:48000,contextTimeSec:1},stamp);
  return {m,stamp};
};
const cfg={meetingId:'meeting-x',recordingId:'rec-x',generation:'generation-x',sampleRate:48000};
test('G10/G01/G02 clock: exact last point valid; future typedAt pending then finalized after durable ACK',()=>{
  const {m,stamp}=clk();
  const end=contextFor(m,cfg,1000);assert.equal(end.coverage,'valid');assert.equal(end.audioOffsetMs,1000);
  const pending=contextFor(m,cfg,1500);assert.equal(pending.coverage,'pending');
  assert.equal(pending.audioOffsetMs,null);assert.ok(pending.intervalId);
  const entry={...pending,mark:{anchorId:'a',typedAt:1794740000000}};
  assert.equal(resolvePending(m,entry,{...cfg,committedSampleExclusive:49000}).status,'pending');
  m.receive({type:'progress',sampleIndex:96000,contextTimeSec:2},stamp);
  assert.equal(resolvePending(m,entry,{...cfg,committedSampleExclusive:49000}).status,'pending');
  const ready=resolvePending(m,entry,{...cfg,committedSampleExclusive:96001});
  assert.equal(ready.status,'valid');assert.equal(ready.audioOffsetMs,1500);
  assert.equal(ready.recordingId,'rec-x');assert.equal(ready.intervalId,entry.intervalId);
});
test('G10/G01/G02 wrong source/generation/meeting fails closed without nearest segment',()=>{
  const {m,stamp}=clk(),c=contextFor(m,cfg,1500);
  m.receive({type:'progress',sampleIndex:96000,contextTimeSec:2},stamp);
  for(const patch of [{meetingId:'another'},{recordingId:'wrong'},{generation:'new-generation'},{intervalId:'wrong'}]){
    assert.notEqual(resolvePending(m,{...c,...patch},{...cfg,committedSampleExclusive:96001}).status,'valid');
  }
});
test('G10/G02: paused interval is never a valid recording anchor',()=>{
  const {m,stamp}=clk();
  m.receive({type:'paused',sampleIndex:48000,contextTimeSec:1},stamp);
  assert.equal(intervalFor(m,1500),null);
  assert.equal(contextFor(m,cfg,1500).source,'unlinked');
});
test('G10/G05: media offset and meeting time are different at pause; wrong source is denied',()=>{
  assert.equal(resolveMedia(audioFixture,audioFixture.recordingId,1805000).status,'valid');
  assert.equal(meetingToMedia(audioFixture,audioFixture.recordingId,1805000).status,'gap');
  assert.equal(resolveMedia(audioFixture,'foreign-recording',1805000).status,'unsupported');
});

test('G10: clicking the visible timeSpan verifies the model, not an ambiguous cursor',()=>{
  const attrs={anchorId:'same',recordingId:'rec-x',audioOffsetMs:1234,typedAt:1794740000000,source:'live_recording',schemaVersion:1};
  const model={descendants(fn){fn({isText:true,marks:[{type:{name:'timeSpan'},attrs}]});}};
  assert.deepEqual(verifiedClickedAnchor(model,'same',new Set(['rec-x'])),attrs);
  assert.equal(verifiedClickedAnchor(model,'same',new Set(['other'])),null);
  assert.equal(verifiedClickedAnchor(model,'same',new Set(['rec-x']),new Set(['same'])),null);
  assert.equal(verifiedClickedAnchor(model,'missing',new Set(['rec-x'])),null);
});
test('G10: duplicate anchor with conflicting provenance cannot be played',()=>{
  const a={anchorId:'same',recordingId:'rec-x',audioOffsetMs:2000,typedAt:1794740000000,source:'live_recording',schemaVersion:1};
  const b={...a,recordingId:'other'};
  const model={descendants(fn){fn({isText:true,marks:[{type:'timeSpan',attrs:a}]});fn({isText:true,marks:[{type:'timeSpan',attrs:b}]});}};
  assert.equal(verifiedClickedAnchor(model,'same',new Set(['rec-x','other'])),null);
});

test('G10 playback: unavailable pre-roll falls back only to exact valid anchor, with notice',()=>{
  const m={recordingId:'rec-a',segments:[{segmentId:'s',mediaStartMs:100,mediaDurationMs:2000,completionState:'complete'}],
    intervals:[{kind:'recorded',mediaStartMs:100,mediaEndMs:2100,segmentRefs:['s']}]};
  const fallback=resolvePlaybackStart(m,'rec-a',500,5000,resolveMedia,choosePreRoll);
  assert.equal(fallback.status,'valid');assert.equal(fallback.startMs,500);
  assert.equal(fallback.preRollLimited,true);assert.equal(fallback.originalMs,500);
  const normal=resolvePlaybackStart(m,'rec-a',500,0,resolveMedia,choosePreRoll);
  assert.equal(normal.status,'valid');assert.equal(normal.startMs,500);assert.equal(normal.preRollLimited,false);
  assert.notEqual(resolvePlaybackStart(m,'other',500,5000,resolveMedia,choosePreRoll).status,'valid');
  assert.notEqual(resolvePlaybackStart(m,'rec-a',50,5000,resolveMedia,choosePreRoll).status,'valid');
});

test('G10 Word export: Times New Roman is default font including Vietnamese characters',()=>{
  const bytes=exportDOCX({title:'Biên bản họp',document:doc('Tại sao lại có những điều không nên làm vậy?')});
  const uncompressedZip=new TextDecoder().decode(bytes);
  assert.match(uncompressedZip,/w:ascii="Times New Roman"/);
  assert.match(uncompressedZip,/w:hAnsi="Times New Roman"/);
  assert.match(uncompressedZip,/w:cs="Times New Roman"/);
  assert.match(uncompressedZip,/Tại sao lại có những điều không nên làm vậy\?/);
});

test('G10 audio: playback clamps pre-roll to first committed PCM sample without false error',()=>{
  const manifest={recordingId:'rec-test-0000000001',sampleRate:48000,
    sampleRanges:[{sampleStart:0,sampleEndExclusive:48000}]};
  const start=selectCommittedPlayback(manifest,manifest.recordingId,500,5000);
  assert.equal(start.status,'valid');assert.equal(start.startSample,0);
  assert.equal(start.endSampleExclusive,48000);
  assert.equal(start.preRollLimited,true);
  assert.equal(selectCommittedPlayback(manifest,manifest.recordingId,1500,5000).status,'missing');
});

test('G10 audio: last exclusive sample is natural EOF, not a second unknown recording',()=>{
  const manifest={recordingId:'rec-test-0000000001',sampleRate:48000,
    sampleRanges:[{sampleStart:0,sampleEndExclusive:48001}]};
  const end=selectCommittedPlayback(manifest,manifest.recordingId,1000,0);
  assert.equal(end.status,'valid');
  assert.equal(end.anchorSample,48000);
  assert.equal(end.endSampleExclusive,48001);
  assert.notEqual(selectCommittedPlayback(manifest,'rec-other',1000,0).status,'valid');
});

test('G10 audio: never bridge a dropped sample interval or a foreign recording',()=>{
  const manifest={recordingId:'rec-test-0000000001',sampleRate:48000,
    sampleRanges:[{sampleStart:0,sampleEndExclusive:48000},
      {sampleStart:96000,sampleEndExclusive:144000}]};
  assert.equal(selectCommittedPlayback(manifest,manifest.recordingId,1500,5000).status,'missing');
  const right=selectCommittedPlayback(manifest,manifest.recordingId,2500,5000);
  assert.equal(right.status,'valid');assert.equal(right.startSample,96000);
  assert.equal(right.endSampleExclusive,144000);
  assert.equal(selectCommittedPlayback(manifest,manifest.recordingId,4000,0).status,'missing');
});

test('G10 timeline: aggregate two recordings in order, preserve a 1s gap and source boundaries',()=>{
  const a='rec-timeline-aaaaaaaa',b='rec-timeline-bbbbbbbb';
  const manifests=new Map([
    [a,{recordingId:a,sampleRate:10000,sampleRanges:[{sampleStart:0,sampleEndExclusive:10000},
      {sampleStart:20000,sampleEndExclusive:30000}],intervals:[{kind:'gap',meetingEndMs:2000}]}],
    [b,{recordingId:b,sampleRate:10000,sampleRanges:[{sampleStart:0,sampleEndExclusive:20000}],intervals:[]}]
  ]);
  const timeline=buildMeetingTimeline([a,b],manifests);
  assert.equal(timeline.totalMs,5000);
  assert.equal(timeline.sessions.length,2);
  assert.equal(timeline.unavailableCount,1);
  assert.equal(locateMeetingPosition(timeline,250).recordingId,a);
  assert.equal(locateMeetingPosition(timeline,1500).status,'gap');
  assert.equal(locateMeetingPosition(timeline,2900).session,1);
  assert.equal(locateMeetingPosition(timeline,3000).recordingId,b);
  assert.equal(locateMeetingPosition(timeline,4000).localMs,1000);
  assert.equal(meetingPositionFor(timeline,b,800),3800);
  assert.equal(locateMeetingPosition(timeline,5000).status,'end');
});
test('G10 timeline: no file is substituted at a missing, empty, or foreign timeline point',()=>{
  const a='rec-timeline-aaaaaaaa',empty='rec-timeline-empty000';
  const timeline=buildMeetingTimeline([a,empty],new Map([
    [a,{recordingId:a,sampleRate:48000,sampleRanges:[{sampleStart:48000,sampleEndExclusive:96000}],
      intervals:[{kind:'gap',meetingEndMs:1000}]}],
    [empty,{recordingId:empty,sampleRate:48000,sampleRanges:[],intervals:[]}]
  ]));
  assert.equal(locateMeetingPosition(timeline,0).status,'gap');
  assert.equal(locateMeetingPosition(timeline,500).status,'gap');
  assert.equal(locateMeetingPosition(timeline,1500).recordingId,a);
  assert.equal(firstPlayablePosition(timeline),1000);
  assert.equal(meetingPositionFor(timeline,'another',1000),null);
  assert.equal(locateMeetingPosition(timeline,-1).status,'invalid');
  assert.throws(()=>buildMeetingTimeline([a],new Map()),/thiếu manifest/);
});
test('G10 timeline: a trailing pool-exhausted interval is visible as missing audio',()=>{
  const id='rec-timeline-aaaaaaaa';
  const tl=buildMeetingTimeline([id],new Map([[id,{
    recordingId:id,sampleRate:48000,
    sampleRanges:[{sampleStart:0,sampleEndExclusive:48000}],
    intervals:[{kind:'gap',reason:'pool-exhausted',meetingEndMs:2000}]
  }]]));
  assert.equal(tl.totalMs,2000);
  assert.equal(tl.unavailableCount,1);
  assert.equal(locateMeetingPosition(tl,1200).status,'gap');
});
