import test from 'node:test';
import assert from 'node:assert/strict';
import { RecordingSession } from '../recording-session.js';
import { AutosaveSession } from '../autosave-session.js';
import { MeetingLease, WRITER_PREFIX } from '../lease.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
class MockLocks {
  constructor() { this.holders = new Map(); }
  async request(name, options, callback) {
    const active = this.holders.get(name) ?? [];
    const allowed = !active.length || (options.mode === 'shared' && active.every(mode => mode === 'shared'));
    if (!allowed) return callback(null);
    active.push(options.mode);
    this.holders.set(name, active);
    try { return await callback({ name, mode: options.mode }); }
    finally {
      active.splice(active.indexOf(options.mode), 1);
      if (!active.length) this.holders.delete(name);
    }
  }
}
function lockFixture() {
  const locks = new MockLocks();
  Object.defineProperty(globalThis, 'navigator', { value: { locks }, configurable: true });
  return locks;
}
function fixtureSession({append,lease,clock}) {
  return new RecordingSession({ append, canWrite:()=>lease.held,
    schedule:cb=>{clock.callbacks.add(cb);return cb;}, unschedule:cb=>clock.callbacks.delete(cb)});
}

test('G09-ADD-01: release requested before first Worker ACK holds exclusive lock; no late recording/ticker', async () => {
  const locks = lockFixture();
  const owner = new MeetingLease();
  const contender = new MeetingLease();
  const release = await owner.acquire('m-A');
  const ack = deferred();
  const clock = {callbacks: new Set()};
  let written = 0;
  const rec = fixtureSession({append:()=>ack.promise.then(bytes=>{written += bytes;}), lease:owner, clock});
  const starting = rec.start();
  assert.equal(rec.phase,'starting');
  let released = false;
  const releasing = (async()=> {await rec.stop(); await release(); released = true;})();
  assert.equal(await contender.acquire('m-A'), null);
  assert.equal(released, false);
  assert.equal(owner.held, true);
  assert.equal(clock.callbacks.size, 0);
  ack.resolve(64);
  assert.equal(await starting, false, 'late ACK must not resurrect recording');
  await releasing;
  assert.equal(written, 64, 'first ACK is retained as committed, not discarded');
  assert.equal(rec.phase, 'idle');
  assert.equal(clock.callbacks.size, 0);
  assert.equal(released, true);
  assert.equal(locks.holders.has(WRITER_PREFIX+'m-A'),false);
  const takeover = await contender.acquire('m-A');
  assert.equal(typeof takeover,'function');
  await takeover();
});

test('G09-ADD-01: stop during start, then ACK; epoch refuses late timer', async () => {
  lockFixture();
  const owner = new MeetingLease(); const release = await owner.acquire('m-B');
  const ack = deferred(); const clock={callbacks:new Set()};
  const rec=fixtureSession({append:()=>ack.promise,lease:owner,clock});
  const started=rec.start(); const stopped=rec.stop();
  ack.resolve(64);
  assert.equal(await started,false);
  assert.equal(await stopped,true);
  assert.equal(rec.active,false); assert.equal(clock.callbacks.size,0);
  await release();
});

test('G09-ADD-01: stop awaits an in-flight periodic ACK; timeout is fail-closed', async () => {
  lockFixture();
  const owner=new MeetingLease(); const release=await owner.acquire('m-C');
  const clock={callbacks:new Set()}; const pending=deferred();
  let appendCalls=0;
  const rec=fixtureSession({append:()=>++appendCalls===1?Promise.resolve(64):pending.promise,lease:owner,clock});
  assert.equal(await rec.start(),true);
  assert.equal(clock.callbacks.size,1);
  const ticking=rec.tick();
  const stopping=rec.stop();
  let finished=false;
  void stopping.then(()=>finished=true,()=>finished=true);
  await Promise.resolve();
  assert.equal(finished,false);
  assert.equal(clock.callbacks.size,0);
  assert.equal(owner.held,true);
  const err=new Error('Worker ACK timed out'); err.indeterminate=true;
  pending.reject(err);
  assert.equal(await ticking,false);
  await assert.rejects(stopping,/Uncertain OPFS write/);
  assert.equal(rec.phase,'failed');
  assert.equal(owner.held,true,'keep lock on indeterminate write');
  await release(); // Fixture cleanup only; production handler refuses this release.
});

test('G09-ADD-02: delayed save A then edit B and release; B is committed before lock release', async () => {
  lockFixture(); const owner=new MeetingLease(); const release=await owner.acquire('save-A');
  let userText='A'; let committedText=''; let revision=1;
  const first=deferred();
  const statuses=[];
  const saves=[];
  const save=new AutosaveSession({
    canWrite:()=>owner.held,
    readInput:()=>userText,
    readCommitted:()=>committedText,
    commit:async text=>{
      const expected=revision; saves.push([text, expected]);
      if(text==='A') await first.promise;
      return {revision:expected+1,text};
    },
    onCommit:doc=>{committedText=doc.text;revision=doc.revision;},
    onStatus:(state,doc)=>statuses.push([state,doc?.revision])
  });
  const savingA=save.flush();
  userText='B';
  const releasing=(async()=>{ await save.freezeAndDrain(); await release(); })();
  assert.equal(owner.held,true);
  assert.equal(statuses.some(([status])=>status==='saved'),false);
  first.resolve();
  await Promise.all([savingA,releasing]);
  assert.deepEqual(saves,[['A',1],['B',2]]);
  assert.equal(revision,3); assert.equal(committedText,'B');
  assert.equal(statuses.at(-1)[0],'saved');
  assert.equal(owner.held,false);
});

test('G09-ADD-02: quota/transaction abort during pending save preserves B and writer; retry can commit', async () => {
  lockFixture(); const owner=new MeetingLease(); const release=await owner.acquire('save-B');
  const first=deferred(); let userText='A'; let committedText='';let revision=1;
  let tries=0; const statuses=[];
  const save=new AutosaveSession({canWrite:()=>owner.held,
    readInput:()=>userText,readCommitted:()=>committedText,
    commit:async text=>{if(++tries===1)await first.promise;return {text,revision:revision+1};},
    onCommit:doc=>{committedText=doc.text;revision=doc.revision;},
    onStatus:(status)=>statuses.push(status)});
  const savingA=save.flush(); savingA.catch(()=>{});
  userText='B';
  const releasing=save.freezeAndDrain();
  first.reject(new Error('QuotaExceededError: IDB transaction aborted'));
  await assert.rejects(releasing,/QuotaExceeded/);
  await assert.rejects(savingA,/QuotaExceeded/);
  assert.equal(owner.held,true);
  assert.equal(save.freezing,false);
  assert.equal(save.dirty,true);
  assert.equal(userText,'B');
  assert.ok(!statuses.includes('saved'));
  await save.freezeAndDrain();
  assert.equal(committedText,'B'); assert.equal(revision,2);
  await release();
});

test('G09-ADD-02: CAS conflict does not announce Saved or release, dirty edit survives', async () => {
  lockFixture(); const owner=new MeetingLease(); const release=await owner.acquire('save-C');
  let userText='B'; const statuses=[];
  const save=new AutosaveSession({canWrite:()=>owner.held,readInput:()=>userText,
    readCommitted:()=>'',commit:async()=>{throw new Error('Revision conflict');},
    onCommit:()=>assert.fail('must never commit conflict'),onStatus:s=>statuses.push(s)});
  await assert.rejects(save.freezeAndDrain(),/Revision conflict/);
  assert.equal(save.dirty,true);
  assert.equal(owner.held,true);
  assert.deepEqual(statuses,['saving','error']);
  await release(); // Fixture cleanup only, app won't release after failed drain.
});

test('G09-ADD-01: FIRST append timeout is indeterminate and cannot release the writer', async () => {
  lockFixture();
  const owner=new MeetingLease();const release=await owner.acquire('start-timeout');
  const ack=deferred();const clock={callbacks:new Set()};
  const rec=fixtureSession({append:()=>ack.promise,lease:owner,clock});
  const started=rec.start();
  const timeout=new Error('First ACK timeout');timeout.indeterminate=true;
  ack.reject(timeout);
  assert.equal(await started,false);
  assert.equal(rec.active,false);
  assert.equal(clock.callbacks.size,0);
  await assert.rejects(rec.stop(),/Uncertain OPFS write/);
  assert.equal(owner.held,true);
  await release(); // Fixture cleanup after asserting the app's stop/release guard.
});

test('G09-ADD-01: acknowledged rollback failure does not start timer, permits safe stop', async () => {
  lockFixture();const owner=new MeetingLease();const release=await owner.acquire('start-rolledback');
  const clock={callbacks:new Set()};
  const rec=fixtureSession({append:async()=>{const e=new Error('Partial write safely rolled back');e.indeterminate=false;throw e;},lease:owner,clock});
  assert.equal(await rec.start(),false);
  assert.equal(rec.phase,'failed');
  assert.equal(await rec.stop(),true);
  assert.equal(clock.callbacks.size,0);
  await release();
});
