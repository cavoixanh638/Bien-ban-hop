// Browser origin-wide Web Locks are the authority. BroadcastChannel only carries hints.
export const MAINTENANCE_LOCK = 'mochop:poc09:maintenance';
export const WRITER_PREFIX = 'mochop:poc09:meeting-writer:';

export class MeetingLease {
  constructor(onChange = () => {}) {
    this.onChange = onChange;
    this.meetingId = null;
    this.held = false;
    this.run = null;
    this.endHold = null;
    this.pending = false;
  }
  async acquire(meetingId) {
    if (this.held || this.pending) return null;
    if (!navigator.locks) throw new Error('Web Locks unavailable: refusing unsafe fallback');
    this.pending = true;
    let finishReady;
    const ready = new Promise(resolve => { finishReady = resolve; });
    let signalled = false;
    const signal = value => { if (!signalled) { signalled = true; finishReady(value); } };
    this.run = navigator.locks.request(MAINTENANCE_LOCK, { mode: 'shared', ifAvailable: true }, async gate => {
      if (!gate) { signal(false); return; }
      await navigator.locks.request(WRITER_PREFIX + meetingId, { mode: 'exclusive', ifAvailable: true }, async writer => {
        if (!writer) { signal(false); return; }
        this.held = true;
        this.meetingId = meetingId;
        let resolveHold;
        const hold = new Promise(resolve => { resolveHold = resolve; });
        this.endHold = resolveHold;
        this.onChange('acquired', meetingId);
        signal(true);
        try { await hold; }
        finally {
          this.held = false;
          this.meetingId = null;
          this.endHold = null;
          this.onChange('released', meetingId);
        }
      });
    }).catch(error => { signal(error); throw error; }).finally(() => { this.pending = false; });
    const result = await ready;
    if (result instanceof Error) throw result;
    if (!result) { await this.run; return null; }
    this.pending = false;
    return () => this.release();
  }
  async release() {
    if (this.endHold) this.endHold();
    await this.run;
  }
}

// No application path may write during a schema migration/SW activation.
export async function withMaintenanceLock(work) {
  if (!navigator.locks) return { acquired: false, reason: 'Web Locks unavailable' };
  let acquired = false;
  let value;
  await navigator.locks.request(MAINTENANCE_LOCK, { mode: 'exclusive', ifAvailable: true }, async lock => {
    if (!lock) return;
    acquired = true;
    value = await work();
  });
  return { acquired, value, reason: acquired ? undefined : 'Another tab has an active writer' };
}

export function makeChannel(meetingId, onMessage) {
  if (!('BroadcastChannel' in globalThis)) return { post: () => {}, close: () => {} };
  const channel = new BroadcastChannel('mochop:poc09:events');
  channel.addEventListener('message', event => {
    if (event.data?.meetingId === meetingId) onMessage(event.data);
  });
  return {
    post(type, extras = {}) { channel.postMessage({ type, meetingId, ...extras }); },
    close() { channel.close(); }
  };
}
