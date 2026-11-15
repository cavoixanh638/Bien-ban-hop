import {performance} from 'node:perf_hooks';
import {NotesRepository,Autosave,openIndexedDB,createMockLease} from './notes.mjs';
import {createFakeIndexedDB} from './fake-idb.mjs';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const d=i=>({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'ghi chú '+i}]}]});
const fake=createFakeIndexedDB({commitDelayMs:3});
const db=await openIndexedDB('benchmark-local',fake);
const repo=new NotesRepository(db),meeting=await repo.createMeeting('Fixture 3 giây');
const lease=await createMockLease().acquire(meeting.meetingId);
const auto=new Autosave(repo,meeting.noteDocumentId,lease);
const inputAt=[],latencies=[],acks=[],states=[];
const realSave=repo.saveNote.bind(repo);
let acknowledged=-1;
repo.saveNote=async(id,doc,expected,held)=>{
  const last=Number(doc.content[0].content[0].text.slice('ghi chú '.length));
  const revision=await realSave(id,doc,expected,held);
  const now=performance.now();
  for(let i=acknowledged+1;i<=last;i++)latencies.push(now-inputAt[i]);
  acknowledged=last;acks.push({revision,lastEdit:last});
  return revision;
};
auto.onStatus=(status,rev)=>states.push({status,rev});
await auto.load();
const started=performance.now();
for(let i=0;i<36;i++){
  inputAt.push(performance.now());auto.edit(d(i));await wait(85);
}
await auto.flush();
const elapsed=performance.now()-started;
const sorted=[...latencies].sort((a,b)=>a-b);
const report={fixture:'Node + deterministic async IndexedDB-like adapter',
  edits:inputAt.length,autosaveDebounceMs:auto.debounceMs,maxWaitMs:auto.maxWaitMs,
  simulatedCommitDelayPerStoreStepMs:3,
  durationMs:Math.round(elapsed),revision:auto.revision,
  acknowledgments:acks,
  maxUnconfirmedMs:Math.round(Math.max(...latencies)),
  p95UnconfirmedMs:Math.round(sorted[Math.ceil(sorted.length*0.95)-1]),
  statusAfterFinalAck:auto.status,
  persistedLastEdit:(await repo.getNote(meeting.noteDocumentId)).content.content[0].content[0].text,
  errorStates:states.filter(s=>s.status==='error'||s.status==='conflict').length};
console.log(JSON.stringify(report,null,2));
await auto.dispose();db.close();
