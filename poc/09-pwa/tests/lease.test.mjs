import test from 'node:test';
import assert from 'node:assert/strict';
import { MeetingLease, withMaintenanceLock, WRITER_PREFIX, MAINTENANCE_LOCK } from '../lease.js';

class MockLocks {
  constructor() { this.holders = new Map(); }
  async request(name, options, callback) {
    const active = this.holders.get(name) ?? [];
    const allowed = !active.length || (options.mode === 'shared' && active.every(mode => mode === 'shared'));
    if (!allowed && options.ifAvailable) return callback(null);
    if (!allowed) throw new Error('Mock deliberately does not queue');
    active.push(options.mode);
    this.holders.set(name, active);
    try { return await callback({ name, mode: options.mode }); }
    finally {
      active.splice(active.indexOf(options.mode), 1);
      if (!active.length) this.holders.delete(name);
    }
  }
}

function locksFixture() {
  const locks = new MockLocks();
  Object.defineProperty(globalThis, 'navigator', { value: { locks }, configurable: true, writable: true });
  return locks;
}

test('TC32: only one writer per meeting; lease can be recovered after release', async () => {
  const locks = locksFixture();
  const first = new MeetingLease();
  const second = new MeetingLease();
  const release1 = await first.acquire('m-01');
  assert.equal(typeof release1, 'function');
  assert.deepEqual(locks.holders.get(WRITER_PREFIX + 'm-01'), ['exclusive']);
  assert.equal(await second.acquire('m-01'), null);
  assert.equal(second.held, false);
  assert.equal(first.held, true);
  await release1();
  const release2 = await second.acquire('m-01');
  assert.equal(typeof release2, 'function');
  assert.equal(second.held, true);
  await release2();
  assert.equal(locks.holders.size, 0);
});

test('TC32/TC34: maintenance denied during any editing/recording lease, granted after release', async () => {
  const locks = locksFixture();
  const a = new MeetingLease();
  const b = new MeetingLease();
  const releaseA = await a.acquire('meeting-A');
  const releaseB = await b.acquire('meeting-B');
  assert.deepEqual(locks.holders.get(MAINTENANCE_LOCK), ['shared', 'shared']);
  let mutation = 0;
  assert.deepEqual(await withMaintenanceLock(() => { mutation++; }), { acquired: false, value: undefined, reason: 'Another tab has an active writer' });
  assert.equal(mutation, 0);
  await releaseA();
  assert.equal((await withMaintenanceLock(() => { mutation++; })).acquired, false);
  await releaseB();
  const result = await withMaintenanceLock(() => { mutation++; return 'migration committed'; });
  assert.equal(result.acquired, true);
  assert.equal(result.value, 'migration committed');
  assert.equal(mutation, 1);
  assert.equal(locks.holders.size, 0);
});

test('TC32: refuse unsafe fallback when Web Locks missing', async () => {
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true });
  await assert.rejects(() => new MeetingLease().acquire('meeting-A'), /Web Locks unavailable/);
  assert.equal((await withMaintenanceLock(() => {})).acquired, false);
});
