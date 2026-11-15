import test from 'node:test';
import assert from 'node:assert/strict';
import { MeetingLease, withMaintenanceLock } from '../lease.js';
import { MaintenanceRetry } from '../maintenance-retry.js';
import { prepareMigrationV2 } from '../migration-core.js';

class MockLocks {
  constructor() { this.holders=new Map(); }
  async request(name, options, callback) {
    const active=this.holders.get(name)??[];
    const allowed=!active.length||(options.mode==='shared'&&active.every(m=>m==='shared'));
    if(!allowed) return callback(null);
    active.push(options.mode);this.holders.set(name,active);
    try {return await callback({name});}
    finally{active.splice(active.indexOf(options.mode),1);if(!active.length)this.holders.delete(name);}
  }
}
class ManualClock {
  constructor() {this.timers=new Map();this.id=0;}
  schedule(fn,ms) {const id=++this.id;this.timers.set(id,{fn,ms});return id;}
  cancel(id) {this.timers.delete(id);}
  async runNext() {const [id,item]=this.timers.entries().next().value??[];if(!item)throw Error('No timer');this.timers.delete(id);await item.fn();return item.ms;}
}
const seed=()=>({
  meeting:{meetingId:'meeting-A',noteDocumentId:'note-A',recordingIds:['rec-A'],schemaVersion:1},
  document:{noteDocumentId:'note-A',revision:5,schemaVersion:1,content:{type:'doc',content:[
    {type:'paragraph',content:[{type:'text',text:'Moc hop',marks:[{type:'timeSpan',attrs:{anchorId:'anchor-A',recordingId:'rec-A',audioOffsetMs:1250,typedAt:1794754800000,source:'live_recording',schemaVersion:1}}]}]},
    {type:'paragraph',content:[{type:'text',text:'Vietnamese notes'}]}
  ]}}
});

test('G09-ADD-03: migration A retries despite B global writer releasing after first failed attempt', async () => {
  const locks=new MockLocks();
  Object.defineProperty(globalThis,'navigator',{value:{locks},configurable:true});
  const writerB=new MeetingLease();const releaseB=await writerB.acquire('meeting-B');
  const initial=seed();let current=structuredClone(initial);
  let blocked=true,attempts=0;
  const clock=new ManualClock();
  const retry=new MaintenanceRetry({needed:()=>blocked,
    attempt:async()=>{attempts++;const result=await withMaintenanceLock(()=>{
      const plan=prepareMigrationV2('meeting-A', current.meeting, current.document,'test-time');
      current={meeting:plan.meeting,document:plan.document,snapshot:plan.snapshot};
      blocked=false;return true;
    });return result.acquired;},
    schedule:(fn,ms)=>clock.schedule(fn,ms),cancel:id=>clock.cancel(id)
  });
  retry.notifyRelease();
  assert.equal(await clock.runNext(),250);
  assert.equal(blocked,true);
  assert.equal(attempts,1);
  await releaseB();
  assert.equal(await clock.runNext(),750);
  assert.equal(blocked,false);
  assert.equal(attempts,2);
  assert.equal(clock.timers.size,0);
  assert.equal(current.document.schemaVersion,2);
  assert.equal(current.document.revision,5);
  assert.deepEqual(current.document.content,initial.document.content);
  assert.deepEqual(current.snapshot.document,initial.document);
  retry.close();
});

test('G09-ADD-03: bounded retry after 4 blocked attempts, manual Retry remains possible', async () => {
  const clock=new ManualClock();let attempts=0,blocked=true;
  const retry=new MaintenanceRetry({needed:()=>blocked,attempt:async()=>{attempts++;return false;},
    schedule:(fn,ms)=>clock.schedule(fn,ms),cancel:id=>clock.cancel(id)});
  retry.notifyRelease();
  for (const expected of [250,750,1500,3000]) assert.equal(await clock.runNext(),expected);
  assert.equal(attempts,4);
  assert.equal(clock.timers.size,0);
  blocked=false;retry.notifyRelease();
  assert.equal(clock.timers.size,0);
  retry.close();
});
