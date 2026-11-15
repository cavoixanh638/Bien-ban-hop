import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,resolve,ID,SEGMENT,TOTAL,RATE,windowPCM,segmentWAV,C2,meetingToMedia,mediaToMeeting,choosePreRoll,validateManifest} from './player.js';
import {resolveMedia} from './timeline.js';
const at=ms=>resolve(ID,ms);
test('frozen contract: 36 source segments, contiguous 3h media with complete references',()=>{
 assert.deepEqual(validateManifest(fixture),{valid:true,errors:[]});assert.equal(fixture.segments.length,36);
 for(let i=0;i<36;i++){const s=fixture.segments[i];assert.equal(s.mediaStartMs,i*SEGMENT);assert.equal(s.sampleStart,i*SEGMENT*RATE/1000);assert.equal(s.sampleCount,SEGMENT*RATE/1000);}
 assert.equal(fixture.segments.at(-1).mediaStartMs+SEGMENT,TOTAL);
});
test('G00 BUG: media 1805000 is valid while meeting 1805000 is paused',()=>{
 assert.equal(at(1805000).status,'valid');assert.equal(at(1805000).segmentId,'seg-006');
 assert.equal(meetingToMedia(fixture,ID,1805000).status,'gap');
 assert.equal(meetingToMedia(fixture,ID,1815000).audioOffsetMs,1805000);
 assert.equal(mediaToMeeting(fixture,ID,1805000).meetingMs,1815000);
});
test('gap on meeting clock does not fabricate a gap on media clock',()=>{
 assert.equal(meetingToMedia(fixture,ID,3615000).status,'gap');
 assert.equal(at(3605000).status,'valid');
 assert.equal(meetingToMedia(fixture,ID,3625000).audioOffsetMs,3600000);
 assert.equal(mediaToMeeting(fixture,ID,3605000).meetingMs,3630000);
});
test('actual media hole is distinct from a meeting pause, clips stop at its exact edges',()=>{
 assert.equal(at(7420000).status,'gap');assert.equal(at(7421999).status,'gap');assert.equal(at(7422000).status,'valid');
 assert.equal(at(7419900).clipEndMs,7420000);assert.equal(at(7422000).clipStartMs,7422000);
 assert.equal(meetingToMedia(fixture,ID,7445500).status,'gap');assert.equal(meetingToMedia(fixture,ID,7447000).audioOffsetMs,7422000);
});
test('04:58->05:02, minute 90/170 and A-B cross segment without false gaps',()=>{
 for(const x of [298000,299999,300000,302000,5400000,10200000])assert.equal(at(x).status,'valid');
 assert.equal(at(298000).segmentId,'seg-000');assert.equal(at(300000).segmentId,'seg-001');
 assert.equal(at(5400000).segmentId,'seg-018');assert.equal(at(10200000).segmentId,'seg-034');
 assert.equal(at(299999).clipEndMs,300000);assert.equal(at(300000).clipStartMs,300000);
});
test('missing, pending, wrong source, uncovered range never fallback to adjacent segment',()=>{
 assert.equal(at(6060000).status,'missing');assert.equal(resolve('other',300000).status,'unsupported');
 assert.equal(resolve(null,null).status,'unlinked');assert.equal(at(TOTAL).status,'unsupported');
 const m={...fixture,segments:fixture.segments.map(s=>({...s}))};m.segments[1].completionState='pending';
 assert.equal(resolveMedia(m,ID,300000).status,'pending');
 const withoutRef={...fixture,intervals:fixture.intervals.map(x=>({...x,segmentRefs:[...x.segmentRefs]}))};withoutRef.intervals[0].segmentRefs=[];
 assert.equal(validateManifest(withoutRef).valid,false);assert.equal(resolveMedia(withoutRef,ID,298000).status,'missing');
 const uncovered={...fixture,intervals:fixture.intervals.filter(x=>x.meetingStartMs!==7445000)};
 assert.equal(resolveMedia(uncovered,ID,7420100).status,'gap');
});
test('pre-roll 0/3/5/10 keeps anchor immutable, refuses to cross missing media',()=>{
 const mark=fixture.marks.find(m=>m.anchorId==='paused'),before=JSON.stringify(mark);
 for(const s of [0,3,5,10]){const x=choosePreRoll(fixture,mark,s);assert.equal(x.status,'valid');assert.equal(x.originalMs,10200000);assert.equal(x.startMs,10200000-s*1000);assert.equal(JSON.stringify(mark),before);}
 const afterHole={recordingId:ID,audioOffsetMs:7422500};const x=choosePreRoll(fixture,afterHole,3);
 assert.equal(x.status,'blocked');assert.equal(x.cause,'gap');assert.equal(afterHole.audioOffsetMs,7422500);
 assert.equal(choosePreRoll(fixture,{recordingId:'wrong',audioOffsetMs:1000},5).status,'blocked');
});
test('WAV header valid and PCM globally sample-continuous at segment boundary',async()=>{
 const a=windowPCM(299990,10),b=windowPCM(300000,10),whole=windowPCM(299990,20);
 assert.equal(a.length,160);assert.equal(b.length,160);
 for(let i=0;i<160;i++){assert.equal(a[i],whole[i]);assert.equal(b[i],whole[i+160]);}
 const wav=segmentWAV(1,300000,300040),v=new DataView(await wav.arrayBuffer());
 assert.equal(v.getUint32(24,true),RATE);assert.equal(v.getUint32(40,true),40*RATE/1000*2);
 assert.equal(v.getUint16(22,true),1);assert.equal(wav.size,44+40*RATE/1000*2);
});
test('windowPCM rejects full recording decode and limits one window to 2s',()=>{
 assert.throws(()=>windowPCM(0,300000));assert.equal(windowPCM(0,160).byteLength,160*RATE/1000*4);
});
test('C2 scheduler clips to gap, no sample from invalid media can be scheduled',async()=>{
 const previous=globalThis.AudioContext,starts=[];class Context{
  constructor(){this.currentTime=0;this.destination={};}async resume(){}async close(){}
  createBuffer(_ch,len,_rate){return{copyToChannel(arr){assert.equal(len,arr.length);}};}
  createBufferSource(){const src={playbackRate:{value:1},onended:null,connect(){},disconnect(){},stop(){},start(t){starts.push({t,ms:src.ms});}};return src;}
 }
 globalThis.AudioContext=Context;
 try{const logs=[],p=new C2((kind,data)=>logs.push({kind,data}));await p.seek(7419900);await p.play();
  assert.equal(p.scheduled,7420000);assert.equal(p.halt.status,'gap');assert.equal(p.pending.length,1);assert.ok(p.maxPending<=6);p.ctx.currentTime=0.5;p.schedule();assert.equal(p.playing,false);assert.ok(logs.some(x=>x.kind==='unavailable'));await p.destroy();
  const q=new C2();await q.seek(299950);await q.play();assert.ok(q.boundaries.some(x=>x.ms===300000));assert.ok(q.pending.length<10);await q.destroy();
 }finally{globalThis.AudioContext=previous;}
});
