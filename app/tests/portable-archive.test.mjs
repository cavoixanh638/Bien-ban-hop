import test from 'node:test';
import assert from 'node:assert/strict';
import {exportMochopV2,importMochopV2} from '../src/portable-archive.mjs';
import {checkBundle,remapBundle,checkAudioJournal} from '../src/portable-model.mjs';
import {wavHeader,crc32} from '../../poc/03-opfs/core.mjs';
const ids=['rec-test-session-00000001','rec-test-session-00000002'];
function source({sessions=2,history=true}={}){
  const meeting={meetingId:'old-meeting-1',schemaVersion:1,noteDocumentId:'note-original',
    title:'Họp Tiếng Việt',recordingIds:ids.slice(0,sessions),createdAt:1,updatedAt:100};
  const doc={type:'doc',content:meeting.recordingIds.map((id,i)=>({
    type:'paragraph',content:[{type:'text',text:'Nội dung tiếng Việt phiên '+(i+1),marks:[
      {type:'timeSpan',attrs:{anchorId:'span-'+i,recordingId:id,audioOffsetMs:50,
        typedAt:1794740000000+i,source:'live_recording',schemaVersion:1}}
    ]}]
  }))};
  if(!doc.content.length)doc.content.push({type:'paragraph'});
  const note={noteDocumentId:meeting.noteDocumentId,schemaVersion:1,revision:history?2:0,content:doc};
  const logs=history?[{journalId:'note-original:1',noteDocumentId:meeting.noteDocumentId,revision:1,previousRevision:0,kind:'snapshot',content:doc},
    {journalId:'note-original:2',noteDocumentId:meeting.noteDocumentId,revision:2,previousRevision:1,kind:'snapshot',content:doc}]:[];
  const recordings=new Map(),audio=new Map();
  for(const id of meeting.recordingIds){
    const frames=4800,raw=new Uint8Array(frames*4),header=wavHeader(raw.byteLength,48000,1);
    raw[8]=53;raw[64]=111;raw[100]=222;
    const wav=new Uint8Array(header.length+raw.length);wav.set(header);wav.set(raw,44);
    audio.set(id+'/seg-0.wav',wav);
    const j={schemaVersion:1,recordingId:id,sampleRate:48000,channels:1,format:'f32le',revision:1,
      nextSequenceNo:1,acceptedThroughSampleExclusive:frames,committedThroughSampleExclusive:frames,
      intervals:[],segments:[{segmentId:'seg-0',filePath:id+'/seg-0.wav',sampleStart:0,
        sampleCount:frames,byteLength:wav.length,completionState:'checkpointed'}],
      chunks:[{segmentId:'seg-0',filePath:id+'/seg-0.wav',sequenceNo:0,firstSample:0,sampleCount:frames,
        byteOffset:44,byteLength:raw.length,crc32:crc32(raw)}]};
    recordings.set(id,j);
  }
  return {meeting,note,history:logs,pendingState:{schemaVersion:1,meetingId:meeting.meetingId,records:[]},
    recordings,openAudio:async path=>new Blob([audio.get(path)]).stream(),audio};
}
async function archiveFor(s){
  const chunks=[];
  const sink=new WritableStream({write:x=>chunks.push(new Uint8Array(x))});
  const {manifest,archive}=await exportMochopV2(s,sink);
  return {blob:new Blob(chunks,{type:'application/zip'}),manifest,archive};
}
function repo(){
  const result={published:[],discarded:0,writes:[]};
  return {
    result,
    async stage(mapped){
      const stored=new Map();
      return {
        async writeAudio(path,stream,size){
          const reader=stream.getReader(),pieces=[];let bytes=0;
          try{for(;;){const {value,done}=await reader.read();if(done)break;pieces.push(value);bytes+=value.length;}}
          finally{reader.releaseLock();}
          assert.equal(bytes,size);
          stored.set(path,new Uint8Array(await new Blob(pieces).arrayBuffer()));
          result.writes.push(path);
        },
        async publish(bundle){result.published.push({bundle,stored});return {meetingId:bundle.meeting.meetingId};},
        async discard(){result.discarded++;}
      };
    }
  };
}
test('G10 v2: export and import TWO recordings, remap all mark references, preserve note revision/history',async()=>{
  const src=source(),{blob,manifest}=await archiveFor(src),target=repo();
  assert.equal(manifest.formatVersion,2);assert.equal(manifest.recordingIds.length,2);
  assert.equal(manifest.files.filter(f=>f.path.endsWith('.wav')).length,2);
  const generated=['new-meeting-0001','new-note-0002','uuid-0003','uuid-0004'];
  let n=0;const result=await importMochopV2(blob,target,{makeId:()=>generated[n++]});
  assert.ok(result.meetingId);
  assert.equal(target.result.published.length,1);
  const {bundle,stored}=target.result.published[0];
  assert.notEqual(bundle.meeting.meetingId,src.meeting.meetingId);
  assert.equal(bundle.meeting.recordingIds.length,2);
  assert.equal(bundle.history.length,2);assert.equal(bundle.note.revision,2);
  assert.equal(bundle.history[1].content.content[1].content[0].marks[0].attrs.recordingId,bundle.meeting.recordingIds[1]);
  assert.equal(bundle.note.content.content[0].content[0].marks[0].attrs.recordingId,bundle.meeting.recordingIds[0]);
  assert.equal(bundle.pendingState.records.length,0);
  assert.equal(stored.size,2);
  for(const [old,newId] of bundle.idMap){
    assert.deepEqual(stored.get(newId+'/seg-0.wav'),src.audio.get(old+'/seg-0.wav'));
    checkAudioJournal(bundle.recordings.get(newId),newId);
  }
});
test('G10 v2: repeated import creates independent meetings and does not overwrite old note',async()=>{
  const src=source(),{blob}=await archiveFor(src),target=repo();let n=0;
  const first=await importMochopV2(blob,target,{makeId:()=>('imported-'+(++n))});
  const second=await importMochopV2(blob,target,{makeId:()=>('imported-'+(++n))});
  assert.notEqual(first.meetingId,second.meetingId);
  assert.notEqual(target.result.published[0].bundle.meeting.recordingIds[0],
    target.result.published[1].bundle.meeting.recordingIds[0]);
});
test('G10 v2: note-only meeting exports, imports and opens without WAV',async()=>{
  const src=source({sessions:0,history:false}),{blob}=await archiveFor(src);
  const target=repo();await importMochopV2(blob,target);
  assert.equal(target.result.published[0].bundle.recordings.size,0);
  assert.equal(target.result.published[0].bundle.note.revision,0);
});
test('G10 v2: corrupted WAV CRC/SHA rejected, no meeting published; stage discarded',async()=>{
  const {blob}=await archiveFor(source()),bytes=new Uint8Array(await blob.arrayBuffer());
  const sig=new TextEncoder().encode('RIFF');
  let at=-1;for(let i=0;i<bytes.length-100;i++)
    if(bytes[i]===sig[0]&&bytes[i+1]===sig[1]&&bytes[i+2]===sig[2]&&bytes[i+3]===sig[3]){at=i;break;}
  assert.ok(at>=0);bytes[at+88]^=1;
  const target=repo();
  await assert.rejects(()=>importMochopV2(new Blob([bytes]),target),/SHA256\/CRC|ZIP|CRC|hash|checksum/i);
  assert.equal(target.result.published.length,0);assert.equal(target.result.discarded,1);
});
test('G10 v2: fail during writing WAV triggers staged rollback, no meeting visible',async()=>{
  const {blob}=await archiveFor(source());let discarded=0,published=0;
  await assert.rejects(()=>importMochopV2(blob,{async stage(){return{
    async writeAudio(){throw Error('quota');},async publish(){published++;},
    async discard(){discarded++;}
  };}}),/quota/);
  assert.equal(discarded,1);assert.equal(published,0);
});
test('G10 v2: fail closed when a timeSpan points to an unknown recording',()=>{
  const src=source();
  src.note.content.content[0].content[0].marks[0].attrs.recordingId='rec-foreign-999999999';
  assert.throws(()=>checkBundle(src.meeting,src.note,src.history,src.pendingState,src.recordings),/file ngoài cuộc họp/);
});
test('G10 v2: invalid audio journal checksum/length cannot be declared complete',()=>{
  const src=source();src.recordings.get(ids[0]).segments[0].byteLength+=4;
  assert.throws(()=>checkAudioJournal(src.recordings.get(ids[0]),ids[0]),/kích thước|không khớp/);
});
test('G10 v2: unverified pending input is preserved as archive provenance but never activated on second machine',()=>{
  const src=source();
  const pending={schemaVersion:1,meetingId:src.meeting.meetingId,records:[{inputMonoMs:1500,recordingId:ids[0]}]};
  const result=remapBundle({...src,pendingState:pending},()=>Math.random().toString(36).slice(2));
  assert.deepEqual(result.archivedPendingState,pending);
  assert.deepEqual(result.pendingState.records,[]);
});
