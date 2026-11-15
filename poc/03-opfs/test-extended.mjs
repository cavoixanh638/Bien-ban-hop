import test from 'node:test';
import {strict as a} from 'node:assert';
import {Recorder,chunkFixture,HEADER_BYTES,checkHeader} from './core.mjs';
import {MemoryFiles,MemoryJournal} from './adapters.mjs';
const setup=async(opts={})=>{const fs=new MemoryFiles(),journal=new MemoryJournal(),r=new Recorder({fs,journal,recordingId:'fixture',sampleRate:48000,channels:1,segmentSeconds:2,...opts});await journal.save('fixture',r.manifest);return {fs,journal,r};};
const chunk=(seq,start,count=4096)=>chunkFixture({sequenceNo:seq,firstSample:start,sampleCount:count});
test('pending seek does not mutate OPFS and cannot reconcile active writes',async()=>{
 const {fs,r}=await setup();await r.append(chunk(0,0));const size=await fs.size('fixture/seg-0.wav');
 a.equal((await r.readSample(0)).status,'pending');a.equal(await fs.size('fixture/seg-0.wav'),size);
 await a.rejects(r.reconcile(),/active unflushed/);a.equal((await r.flush()).committedThroughSampleExclusive,4096);
 a.equal((await r.readSample(0)).status,'valid');
});
test('old durable bytes readable while append pending, without truncation',async()=>{
 const {fs,r}=await setup();await r.append(chunk(0,0));await r.flush();await r.append(chunk(1,4096));
 const before=await fs.size('fixture/seg-0.wav');a.equal((await r.readSample(512)).status,'valid');
 a.equal((await r.readSample(4096)).status,'pending');a.equal(await fs.size('fixture/seg-0.wav'),before);
 await r.flush();a.equal((await r.readSample(4096)).status,'valid');
});
test('truncate extra bytes not recorded in IDB; preserve committed valid samples',async()=>{
 const {fs,journal,r}=await setup();await r.append(chunk(0,0));await r.flush();
 const path='fixture/seg-0.wav',size=await fs.size(path);
 await fs.write(path,size,new Uint8Array(4*100));
 const rr=await Recorder.reopen({fs,journal,recordingId:'fixture'});
 a.equal(rr.lastRecovery.truncatedBytes,400);a.equal(rr.lastRecovery.uncommittedBytes,400);
 a.equal(await fs.size(path),size);a.equal((await rr.readSample(4095)).status,'valid');
});
test('recover after lost file, never overwrite previous segment, append to new file',async()=>{
 const {fs,journal,r}=await setup();await r.append(chunk(0,0));await r.flush();
 fs.files.delete('fixture/seg-0.wav');const rr=await Recorder.reopen({fs,journal,recordingId:'fixture'});
 a.equal(rr.lastRecovery.unavailable.length,1);await rr.append(chunk(1,4096));await rr.flush();
 a.equal((await rr.readSample(0)).status,'missing');a.equal((await rr.readSample(4096)).status,'valid');
 a.ok(fs.files.has('fixture/seg-4096.wav'));a.equal(fs.files.has('fixture/seg-0.wav'),false);
});
test('post-reconcile corruption detected on targeted seek without scanning all files',async()=>{
 const {fs,journal,r}=await setup();await r.append(chunk(0,0));await r.flush();
 const rr=await Recorder.reopen({fs,journal,recordingId:'fixture'});
 fs.files.get('fixture/seg-0.wav')[HEADER_BYTES+100]^=1;
 const result=await rr.readSample(300);a.equal(result.status,'missing');a.equal(result.reason,'checksum_mismatch_after_reconcile');
});
test('post-reconcile file disappearance cannot synthesize missing bytes',async()=>{
 const {fs,journal,r}=await setup();await r.append(chunk(0,0));await r.flush();
 const rr=await Recorder.reopen({fs,journal,recordingId:'fixture'});fs.files.delete('fixture/seg-0.wav');
 a.deepEqual([ (await rr.readSample(120)).status,fs.files.has('fixture/seg-0.wav') ],['missing',false]);
});
test('partial checksum failure and header damage recover other valid interval',async()=>{
 const {fs,journal,r}=await setup();await r.append(chunk(0,0));await r.flush();await r.append(chunk(1,4096));await r.flush();
 fs.files.get('fixture/seg-0.wav')[HEADER_BYTES+8]^=1;fs.files.get('fixture/seg-0.wav')[4]^=1;
 const rr=await Recorder.reopen({fs,journal,recordingId:'fixture'});
 a.deepEqual(rr.lastRecovery.repairedHeaders,['seg-0']);a.equal(rr.lastRecovery.unavailable.length,1);
 a.equal((await rr.readSample(0)).status,'missing');a.equal((await rr.readSample(4096)).status,'valid');
});
test('invalid sample/sequence, nonfinite payload and cross-recording injection rejected',async()=>{
 const {r}=await setup();
 await a.rejects(r.append({...chunk(0,0),recordingId:'another'}),/source/);
 await a.rejects(r.append({...chunk(0,0),sampleCount:1000}),/length/);
 const bad=chunk(0,0);new DataView(bad.pcm).setFloat32(0,Infinity,true);
 await a.rejects(r.append(bad),/nonfinite/);
 await a.rejects(r.append({...chunk(0,0),sequenceNo:-1}),/sequence/);
});
test('audio manifest carries recorded/ gap / unavailable interval with file refs and reasons',async()=>{
 const {fs,journal,r}=await setup();await r.append(chunk(0,0));await r.append(chunk(2,8192));await r.flush();
 const initial=await r.toAudioManifest();a.equal(initial.intervals.filter(x=>x.kind==='recorded').length,2);
 a.equal(initial.intervals.find(x=>x.kind==='gap').reason,'missing_samples_or_sequence');a.equal('mediaStartMs' in initial.intervals.find(x=>x.kind==='gap'),false);
 a.ok(initial.intervals.filter(x=>x.kind==='recorded').every(x=>x.segmentRefs.length&&x.mediaEndMs>x.mediaStartMs));
 fs.files.get('fixture/seg-0.wav')[HEADER_BYTES+8]^=1;
 const rr=await Recorder.reopen({fs,journal,recordingId:'fixture'}),status=await rr.toAudioManifest();
 a.ok(status.intervals.some(x=>x.kind==='unavailable'&&x.reason==='checksum_mismatch'));
});
test('worker-style failure at append prevents later false ACK; can reopen committed prefix',async()=>{
 const {fs,journal,r}=await setup();await r.append(chunk(0,0));await r.flush();
 fs.failWritesAfter=fs.totalWritten+16;
 await a.rejects(r.append(chunk(1,4096)),/quota/);
 await a.rejects(r.flush(),/failed/);
 const rr=await Recorder.reopen({fs,journal,recordingId:'fixture'});
 a.equal(rr.manifest.committedThroughSampleExclusive,4096);a.equal((await rr.readSample(4095)).status,'valid');
});
test('stereo boundary sample and WAV header width accepted',async()=>{
 const {fs,r}=await setup({channels:2,segmentSeconds:0.1});
 const x=chunkFixture({recordingId:'fixture',sequenceNo:0,firstSample:0,sampleCount:9600,sampleRate:48000,channels:2});
 await r.append(x);await r.flush();const m=await r.toAudioManifest();a.equal(m.segments.length,2);
 const q=await r.readSample(4799,2);a.equal(q.status,'valid');a.equal(q.pcm.byteLength,2*2*4);
 a.ok(checkHeader(fs.files.get('fixture/seg-4800.wav').subarray(0,44),4800*2*4,48000,2));
});

test('duplicate recording create fails rather than silently replace existing journal',async()=>{
 const {fs,journal,r}=await setup();await r.append(chunk(0,0));await r.flush();
 const another=new Recorder({fs,journal,recordingId:'fixture',sampleRate:48000});
 await a.rejects(another.initialize(),/already exists/);
 const rr=await Recorder.reopen({fs,journal,recordingId:'fixture'});
 a.equal((await rr.readSample(0)).status,'valid');
});
