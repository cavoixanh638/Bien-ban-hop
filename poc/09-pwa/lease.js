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
    this.activeToken = null;
  }
  async acquire(meetingId) {
    if (this.held || this.pending) return null;
    if (!navigator.locks) throw new Error('Web Locks unavailable: refusing unsafe fallback');
    this.pending = true;
    const token = Symbol('writer-lease');
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
        this.activeToken = token;
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
          if (this.activeToken === token) this.activeToken = null;
          this.onChange('released', meetingId);
        }
      });
    }).catch(error => { signal(error); throw error; }).finally(() => { this.pending = false; });
    const result = await ready;
    if (result instanceof Error) throw result;
    if (!result) { await this.run; return null; }
    this.pending = false;
    // Old callbacks must never release a newly acquired lease.
    return () => this.release(token);
  }
  async release(token = this.activeToken) {
    if (!token || token !== this.activeToken) return false;
    if (this.endHold) this.endHold();
    await this.run;
    return true;
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

export function makeChannel(meetingId, onMessage, onAnyWriterReleased = () => {}) {
  if (!('BroadcastChannel' in globalThis)) return { post: () => {}, close: () => {} };
  const channel = new BroadcastChannel('mochop:poc09:events');
  channel.addEventListener('message', event => {
    // Maintenance lock spans ALL meetings on the origin, not only this one.
    if (event.data?.type === 'writer-released') onAnyWriterReleased(event.data);
    if (event.data?.meetingId === meetingId) onMessage(event.data);
  });
  return {
    post(type, extras = {}) { channel.postMessage({ type, meetingId, ...extras }); },
    close() { channel.close(); }
  };
}
