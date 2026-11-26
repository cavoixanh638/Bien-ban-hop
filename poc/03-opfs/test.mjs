import test from 'node:test';
import {strict as a} from 'node:assert';
import {Recorder,chunkFixture,checkHeader,HEADER_BYTES} from './core.mjs';
import {MemoryFiles,MemoryJournal} from './adapters.mjs';
const setup=async(opts={})=>{const fs=new MemoryFiles(),journal=new MemoryJournal(),r=new Recorder({fs,journal,recordingId:'fixture',sampleRate:48000,channels:1,segmentSeconds:2,...opts});await journal.save('fixture',r.manifest);return {fs,journal,r};};
const append=async(r,seq,first,count=4096)=>r.append(chunkFixture({sequenceNo:seq,firstSample:first,sampleCount:count}));
test('flush is the only point of durable ACK and seek sample accurate',async()=>{
  const {fs,r}=await setup(); const ack=await append(r,0,0);a.equal(ack.committed,false);
  a.equal((await r.readSample(0)).status,'pending');const result=await r.flush();a.equal(result.committedThroughSampleExclusive,4096);
  const seek=await r.readSample(303,4);a.equal(seek.status,'valid');a.equal(new DataView(seek.pcm).getFloat32(0,true),Math.fround(Math.sin(303*2*Math.PI*440/48000)*0.1));
  const b=fs.files.get('fixture/seg-0.wav');a.ok(checkHeader(b.subarray(0,44),4096*4,48000,1));
});
test('crash after OPFS flush before IndexedDB: uncommitted tail truncated',async()=>{
 const {fs,journal,r}=await setup();await append(r,0,0);await r.flush();await append(r,1,4096);
 await a.rejects(r.flush({faultAt:'afterOpfsFlush'}));const recovered=await Recorder.reopen({fs,journal,recordingId:'fixture'});
 a.equal(recovered.manifest.committedThroughSampleExclusive,4096);a.equal(recovered.lastRecovery.uncommittedBytes,4096*4);
 a.equal((await recovered.readSample(4096)).status,'missing');a.equal((await recovered.readSample(0)).status,'valid');
});
test('crash after journal commit preserves committed audio',async()=>{
 const {fs,journal,r}=await setup();await append(r,0,0);await a.rejects(r.flush({faultAt:'afterJournalCommit'}));
 const rr=await Recorder.reopen({fs,journal,recordingId:'fixture'});a.equal(rr.lastRecovery.committedRanges.length,1);a.equal((await rr.readSample(4095)).status,'valid');
});
test('missing file reported unavailable, never replaced with next file',async()=>{
 const {fs,journal,r}=await setup();await append(r,0,0,96000);await r.flush();fs.files.delete('fixture/seg-0.wav');
 const rr=await Recorder.reopen({fs,journal,recordingId:'fixture'});a.ok(rr.lastRecovery.unavailable.some(x=>x.reason==='missing_file'));a.equal((await rr.readSample(0)).status,'missing');a.equal((await rr.readSample(96000)).status,'missing');
});
test('header corruption repair only after full slice validation',async()=>{
 const {fs,journal,r}=await setup();await append(r,0,0);await r.flush();fs.files.get('fixture/seg-0.wav')[4]=0;
 const rr=await Recorder.reopen({fs,journal,recordingId:'fixture'});a.deepEqual(rr.lastRecovery.repairedHeaders,['seg-0']);a.equal((await rr.readSample(20)).status,'valid');
});
test('truncated file and checksum corruption are unavailable',async()=>{
 const {fs,journal,r}=await setup();await append(r,0,0);await r.flush();await append(r,1,4096);await r.flush();
 fs.files.get('fixture/seg-0.wav')[HEADER_BYTES+8]^=0xff;await fs.truncate('fixture/seg-0.wav',HEADER_BYTES+4096*4+128);
 const rr=await Recorder.reopen({fs,journal,recordingId:'fixture'});a.ok(rr.lastRecovery.unavailable.some(x=>x.reason==='checksum_mismatch'));a.ok(rr.lastRecovery.unavailable.some(x=>x.reason==='short_file'));
 a.equal((await rr.readSample(0)).status,'missing');a.equal((await rr.readSample(4096)).status,'missing');
});
test('duplicate rejected; missing sequence and sample range preserved as gap',async()=>{
 const {fs,journal,r}=await setup();await append(r,0,0);await a.rejects(append(r,0,0),/duplicate/);await append(r,2,8192);await r.flush();
 const rr=await Recorder.reopen({fs,journal,recordingId:'fixture'});a.deepEqual(rr.lastRecovery.gaps.map(x=>[x.sampleStart,x.sampleEndExclusive]),[[4096,8192]]);a.equal((await rr.readSample(4096)).status,'missing');a.equal((await rr.readSample(8192)).status,'valid');
});
test('quota errors never mark unflushed audio durable',async()=>{
 const {fs,journal,r}=await setup();await append(r,0,0);await r.flush();fs.failWritesAfter=fs.totalWritten+12;
 await a.rejects(append(r,1,4096),/quota/);const rr=await Recorder.reopen({fs,journal,recordingId:'fixture'});
 a.equal(rr.manifest.committedThroughSampleExclusive,4096);a.equal((await rr.readSample(4096)).status,'missing');
});
test('journal transaction failure after flush is rolled back',async()=>{
 const {fs,journal,r}=await setup();await append(r,0,0);journal.fail=true;await a.rejects(r.flush(),/journal/);journal.fail=false;
 const rr=await Recorder.reopen({fs,journal,recordingId:'fixture'});a.equal(rr.lastRecovery.committedRanges.length,0);a.equal(rr.lastRecovery.uncommittedBytes,4096*4);
});
test('three hour index boundary represented without allocating whole PCM',async()=>{
 const {r}=await setup();let sequence=0;for(let i=0;i<300;i++){await append(r,sequence++,i*4096);if(i%30===29)await r.flush();}
 a.equal(r.manifest.committedThroughSampleExclusive,300*4096);a.ok(r.manifest.segments.length>1);
});
