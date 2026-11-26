import test from "node:test";
import assert from "node:assert/strict";
import {createMemoryDB,NotesRepository,Autosave,createMockLease,RevisionConflict,migrateNote} from "./notes.mjs";

const linked={type:"doc",content:[{type:"paragraph",content:[
  {type:"text",text:"Đường Nguyễn Trãi — tiếng Việt.",marks:[{type:"bold"},{type:"timeSpan",attrs:{anchorId:"a-01",recordingId:"rec-01",audioOffsetMs:12000,typedAt:1794720000000,source:"live_recording",schemaVersion:1}}]},
  {type:"text",text:" Ghi chú không có audio."}
]}]};

test("create / rename / reopen / remove meeting",async()=>{
  const db=createMemoryDB(),repo=new NotesRepository(db);
  const m=await repo.createMeeting("Họp sáng");
  await repo.renameMeeting(m.meetingId,"Họp buổi sáng");
  const reopened=new NotesRepository(db);
  assert.equal((await reopened.getMeeting(m.meetingId)).title,"Họp buổi sáng");
  assert.equal((await reopened.getNote(m.noteDocumentId)).revision,0);
  assert.equal(await reopened.deleteMeeting(m.meetingId),true);
  assert.equal(await reopened.getNote(m.noteDocumentId),null);
});

test("lossless ProseMirror round trip / Vietnamese / marks / revision journal",async()=>{
  const repo=new NotesRepository(createMemoryDB()),m=await repo.createMeeting();
  assert.equal(await repo.saveNote(m.noteDocumentId,linked,0),1);
  assert.deepEqual((await repo.getNote(m.noteDocumentId)).content,linked);
  assert.deepEqual((await repo.getJournal(m.noteDocumentId))[0].content,linked);
  assert.equal((await repo.search("duong nguyen trai")).length,1);
  assert.equal((await repo.search("TIENG VIET")).length,1);
});

test("conflicting writers cannot silently overwrite",async()=>{
  const repo=new NotesRepository(createMemoryDB()),m=await repo.createMeeting();
  await repo.saveNote(m.noteDocumentId,linked,0);
  await assert.rejects(repo.saveNote(m.noteDocumentId,{type:"doc",content:[]},0),RevisionConflict);
  assert.deepEqual((await repo.getNote(m.noteDocumentId)).content,linked);
  assert.equal((await repo.getJournal(m.noteDocumentId)).length,1);
});

test("failed commit cannot advance revision or journal",async()=>{
  const db=createMemoryDB(),repo=new NotesRepository(db),m=await repo.createMeeting();
  db.failNextCommit("quota");
  await assert.rejects(repo.saveNote(m.noteDocumentId,linked,0),/quota/);
  assert.equal((await repo.getNote(m.noteDocumentId)).revision,0);
  assert.deepEqual(await repo.getJournal(m.noteDocumentId),[]);
});

test("mock lease and acknowledgment state",async()=>{
  const repo=new NotesRepository(createMemoryDB()),m=await repo.createMeeting(),leases=createMockLease();
  const lease=await leases.acquire(m.meetingId);
  assert.equal(await leases.acquire(m.meetingId),null);
  const states=[],auto=new Autosave(repo,m.noteDocumentId,lease,{onStatus:s=>states.push(s)});
  await auto.load();auto.edit(linked);assert.notEqual(auto.status,"saved");
  await auto.flush();assert.equal(auto.status,"saved");assert.equal(auto.revision,1);
  assert.deepEqual(states.slice(-3),["dirty","saving","saved"]);
  await auto.dispose();assert.ok(await leases.acquire(m.meetingId));
});

test("save failure remains unsaved and retry succeeds",async()=>{
  const db=createMemoryDB(),repo=new NotesRepository(db),m=await repo.createMeeting();
  const auto=new Autosave(repo,m.noteDocumentId,await createMockLease().acquire(m.meetingId));
  await auto.load();auto.edit(linked);db.failNextCommit("index failure");
  await assert.rejects(auto.flush(),/index failure/);
  assert.equal(auto.status,"error");assert.equal(auto.revision,0);
  await auto.flush();assert.equal(auto.status,"saved");assert.equal(auto.revision,1);await auto.dispose();
});

test("legacy schema fixture migrates on read without destructive rewrite",async()=>{
  const id="legacy-1",db=createMemoryDB({notes:[{noteDocumentId:id,revision:0,schemaVersion:0,text:"Cũ: thành phố Hải Phòng"}]});
  const repo=new NotesRepository(db);
  const doc=await repo.getNote(id);
  assert.equal(doc.content.content[0].content[0].text,"Cũ: thành phố Hải Phòng");
  assert.equal(doc.schemaVersion,1);
  assert.equal(db.snapshot().notes[0].schemaVersion,0);
  assert.equal(await repo.saveNote(id,doc.content,0),1);
  assert.equal(db.snapshot().notes[0].schemaVersion,1);
});
test("newer schema is rejected, not downgraded",()=>{
  assert.throws(()=>migrateNote({schemaVersion:99,content:{type:"doc",content:[]}}),/Newer/);
});

test("audio-reference veto protects shared recording",async()=>{
  let removed=0;
  const repo=new NotesRepository(createMemoryDB(),{audioReferences:{canDelete:async ids=>ids.length===0,onDelete:async()=>removed++}});
  const m=await repo.createMeeting();
  await repo.db.run(["meetings"],"readwrite",async tx=>{const current=await tx.get("meetings",m.meetingId);current.recordingIds=["shared-rec"];await tx.put("meetings",current);});
  await assert.rejects(repo.deleteMeeting(m.meetingId),/Audio is referenced/);
  assert.ok(await repo.getMeeting(m.meetingId));assert.equal(removed,0);
});
