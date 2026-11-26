import test from 'node:test';
import assert from 'node:assert/strict';
import {NotesRepository,Autosave,RevisionConflict,StorageFailure,createMemoryDB,openIndexedDB,createMockLease,normalizeWithPositions} from './notes.mjs';
import {createFakeIndexedDB} from './fake-idb.mjs';
const doc=text=>({type:'doc',content:[{type:'paragraph',content:text?[{type:'text',text}]:[]}]});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('search returns editor-aligned offsets across adjacent marks, paragraphs, and Unicode',async()=>{
  const r=new NotesRepository(createMemoryDB()),m=await r.createMeeting();
  await r.saveNote(m.noteDocumentId,{type:'doc',content:[
    {type:'paragraph',content:[{type:'text',text:'Mở '},{type:'text',text:'đường Nguyễn',marks:[{type:'bold'}]},{type:'text',text:' Trãi'}]},
    {type:'paragraph',content:[{type:'text',text:'Thành phố Hải Phòng'}]}
  ]},0);
  let [hit]=await r.search('DUONG NGUYEN');
  assert.equal(hit.location,3);assert.equal(hit.length,'đường Nguyễn'.length);
  [hit]=await r.search('hai phong');
  const plain='Mở đường Nguyễn Trãi\nThành phố Hải Phòng';
  assert.equal(plain.slice(hit.location,hit.location+hit.length),'Hải Phòng');
  assert.equal(normalizeWithPositions('Café').folded,'cafe');
});

test('autosave drains late edits while commit is pending and reports saved only at final ACK',async()=>{
  const db=createMemoryDB(),r=new NotesRepository(db),m=await r.createMeeting();
  const original=r.saveNote.bind(r);
  let release,entered;
  const gate=new Promise(resolve=>release=resolve);
  const observed=new Promise(resolve=>entered=resolve);
  r.saveNote=async(...args)=>{entered();await gate;return original(...args);};
  const transitions=[],autosave=new Autosave(r,m.noteDocumentId,await createMockLease().acquire(m.meetingId),{onStatus:(status,rev)=>transitions.push({status,rev})});
  await autosave.load();autosave.edit(doc('Bản đầu'));
  const flushing=autosave.flush();await observed;
  autosave.edit(doc('Bản mới trong lúc commit'));
  assert.notEqual(autosave.status,'saved');
  release();await flushing;
  assert.equal(autosave.status,'saved');assert.equal(autosave.revision,2);
  assert.equal((await r.getNote(m.noteDocumentId)).content.content[0].content[0].text,'Bản mới trong lúc commit');
  assert.deepEqual((await r.getJournal(m.noteDocumentId)).map(x=>x.revision),[1,2]);
  assert.equal(transitions.at(-1).status,'saved');await autosave.dispose();
});

test('autosave coalesces concurrent flush callers; dispose rejects dirty state',async()=>{
  const r=new NotesRepository(createMemoryDB()),m=await r.createMeeting(),leases=createMockLease(),lease=await leases.acquire(m.meetingId);
  const a=new Autosave(r,m.noteDocumentId,lease);await a.load();a.edit(doc('v1'));
  await assert.rejects(a.dispose(),StorageFailure);
  await Promise.all([a.flush(),a.flush(),a.flush()]);
  assert.equal((await r.getJournal(m.noteDocumentId)).length,1);
  await a.dispose();assert.ok(await leases.acquire(m.meetingId));
  lease.release();assert.equal(lease.held,false);
});

test('autosave maxWait starts at first dirty edit, even if continuous typing',async()=>{
  const r=new NotesRepository(createMemoryDB()),m=await r.createMeeting(),lease=await createMockLease().acquire(m.meetingId);
  const a=new Autosave(r,m.noteDocumentId,lease,{debounceMs:120,maxWaitMs:180});await a.load();
  const started=performance.now();
  for(let i=0;i<8;i++){a.edit(doc('Text '+i));await sleep(35)}
  const end=performance.now();
  assert.ok((await r.getNote(m.noteDocumentId)).revision>=1,'Max wait timer should flush before typing finishes');
  await a.flush();assert.equal((await r.getNote(m.noteDocumentId)).content.content[0].content[0].text,'Text 7');
  assert.ok(end-started>180);
  await a.dispose();
});

test('invalid mark content never receives saved ACK',async()=>{
 const r=new NotesRepository(createMemoryDB()),m=await r.createMeeting();
 await assert.rejects(r.saveNote(m.noteDocumentId,{type:'paragraph',content:[]},0),StorageFailure);
 assert.equal((await r.getNote(m.noteDocumentId)).revision,0);
});

test('Fake IndexedDB: open upgrade, durable CRUD and reopen',async()=>{
 const fake=createFakeIndexedDB(),db=await openIndexedDB('moc-hop-test',fake),r=new NotesRepository(db),m=await r.createMeeting('Họp đầu giờ');
 const next=await r.saveNote(m.noteDocumentId,doc('Đường Lê Hồng Phong'),0);
 assert.equal(next,1);assert.equal((await r.getJournal(m.noteDocumentId)).length,1);
 db.close();const reopened=await openIndexedDB('moc-hop-test',fake),r2=new NotesRepository(reopened);
 assert.equal((await r2.getNote(m.noteDocumentId)).content.content[0].content[0].text,'Đường Lê Hồng Phong');
 reopened.close();
});

test('Fake IndexedDB: aborted transaction does not publish snapshot/journal or advance revision',async()=>{
 const fake=createFakeIndexedDB(),db=await openIndexedDB('abort-test',fake),r=new NotesRepository(db),m=await r.createMeeting();
 fake.failNextCommit('QuotaExceededError');
 await assert.rejects(r.saveNote(m.noteDocumentId,doc('Không lưu'),0),/QuotaExceededError/);
 assert.equal((await r.getNote(m.noteDocumentId)).revision,0);
 assert.equal((await r.getJournal(m.noteDocumentId)).length,0);
 db.close();
});

test('Fake IndexedDB: simultaneous cross-connection save CAS yields one writer',async()=>{
 const fake=createFakeIndexedDB(),db1=await openIndexedDB('race',fake),db2=await openIndexedDB('race',fake);
 const r1=new NotesRepository(db1),r2=new NotesRepository(db2),m=await r1.createMeeting();
 const [a,b]=await Promise.allSettled([r1.saveNote(m.noteDocumentId,doc('A'),0),r2.saveNote(m.noteDocumentId,doc('B'),0)]);
 assert.equal([a,b].filter(x=>x.status==='fulfilled').length,1);
 assert.equal([a,b].filter(x=>x.status==='rejected'&&x.reason instanceof RevisionConflict).length,1);
 assert.equal((await r1.getJournal(m.noteDocumentId)).length,1);
 db1.close();db2.close();
});

test('Fake IndexedDB: legacy note upgraded on read without modifying backing store',async()=>{
 const fake=createFakeIndexedDB({seed:{notes:[{noteDocumentId:'old',schemaVersion:0,text:'Trưởng phòng',revision:0}]}});
 const db=await openIndexedDB('schema-upgrade',fake),r=new NotesRepository(db);
 assert.equal((await r.getNote('old')).content.content[0].content[0].text,'Trưởng phòng');
 assert.equal(fake.inspect('schema-upgrade').notes[0].schemaVersion,0);
 await r.saveNote('old',doc('Trưởng phòng mới'),0);
 assert.equal(fake.inspect('schema-upgrade').notes[0].schemaVersion,1);db.close();
});

test('Mock lease stale release cannot revoke a new owner',async()=>{
 const leases=createMockLease(),old=await leases.acquire('meeting');old.release();
 const now=await leases.acquire('meeting');old.release();
 assert.equal(now.held,true);assert.equal(await leases.acquire('meeting'),null);now.release();
 assert.ok(await leases.acquire('meeting'));
});

test('Fake IndexedDB: simulated mid-transaction crash leaves only committed revision',async()=>{
  const fake=createFakeIndexedDB({commitDelayMs:20}),db=await openIndexedDB('crash-fixture',fake);
  const repo=new NotesRepository(db),m=await repo.createMeeting();
  await repo.saveNote(m.noteDocumentId,doc('Đã xác nhận'),0);
  const inFlight=repo.saveNote(m.noteDocumentId,doc('Chưa xác nhận'),1);
  await sleep(25);
  fake.simulateCrash('crash-fixture');
  await assert.rejects(inFlight);
  db.close();
  const reopened=await openIndexedDB('crash-fixture',fake),after=new NotesRepository(reopened);
  assert.equal((await after.getNote(m.noteDocumentId)).revision,1);
  assert.equal((await after.getJournal(m.noteDocumentId)).length,1);
  assert.equal((await after.getNote(m.noteDocumentId)).content.content[0].content[0].text,'Đã xác nhận');
  reopened.close();
});

test('Fake IndexedDB: index/key error after writing snapshot aborts whole transaction',async()=>{
  const fake=createFakeIndexedDB(),db=await openIndexedDB('index-fixture',fake);
  const repo=new NotesRepository(db),m=await repo.createMeeting();
  await assert.rejects(db.run(['notes','journals'],'readwrite',async tx=>{
    await tx.put('notes',{noteDocumentId:m.noteDocumentId,revision:1,schemaVersion:1,content:doc('Không được ghi')});
    await tx.put('journals',{content:doc('Thiếu journalId')});
  }));
  assert.equal((await repo.getNote(m.noteDocumentId)).revision,0);
  assert.equal((await repo.getJournal(m.noteDocumentId)).length,0);
  db.close();
});

test('Shared note reference and multiple timeSpan marks survive independent meeting lifecycle',async()=>{
  const r=new NotesRepository(createMemoryDB()),a=await r.createMeeting('Cuộc họp A'),b=await r.createMeeting('Cuộc họp B');
  await r.db.run(['meetings'],'readwrite',async tx=>{
    const other=await tx.get('meetings',b.meetingId);other.noteDocumentId=a.noteDocumentId;await tx.put('meetings',other);
  });
  const spans={type:'doc',content:[{type:'paragraph',content:[
    {type:'text',text:'Phần một',marks:[{type:'timeSpan',attrs:{anchorId:'A',recordingId:'R1',audioOffsetMs:1000,typedAt:100,source:'live_recording',schemaVersion:1}}]},
    {type:'text',text:' / không liên kết '},
    {type:'text',text:'phần hai',marks:[{type:'bold'},{type:'timeSpan',attrs:{anchorId:'A',recordingId:'R2',audioOffsetMs:5000,typedAt:200,source:'imported_playback',schemaVersion:1}}]}
  ]}]};
  await r.saveNote(a.noteDocumentId,spans,0);
  await r.deleteMeeting(a.meetingId);
  assert.deepEqual((await r.getNote(a.noteDocumentId)).content,spans);
  await r.deleteMeeting(b.meetingId);
  assert.equal(await r.getNote(a.noteDocumentId),null);
});
