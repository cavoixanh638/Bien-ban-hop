// Fixture orchestration: acknowledgement is a durability boundary, not proof that
// a pending Worker request was cancelled. Never relinquish the writer on an
// indeterminate Worker timeout/error.
export class RecordingSession {
  constructor({ append, canWrite, onState = () => {}, onError = () => {},
    schedule = (cb, ms) => setInterval(cb, ms),
    unschedule = timer => clearInterval(timer), intervalMs = 250 }) {
    this.append = append;
    this.canWrite = canWrite;
    this.onState = onState;
    this.onError = onError;
    this.schedule = schedule;
    this.unschedule = unschedule;
    this.intervalMs = intervalMs;
    this.phase = 'idle';
    this.epoch = 0;
    this.timer = null;
    this.startTask = null;
    this.tickTask = null;
    this.stopTask = null;
    this.indeterminate = false;
  }
  get active() { return this.phase === 'active'; }
  get busy() { return this.phase !== 'idle'; }
  setPhase(phase) { this.phase = phase; this.onState(phase); }
  cancelTimer() {
    if (this.timer != null) this.unschedule(this.timer);
    this.timer = null;
  }
  fail(error) {
    if (error?.indeterminate) this.indeterminate = true;
    this.cancelTimer();
    if (this.phase !== 'stopping') this.setPhase('failed');
    this.onError(error);
  }
  start() {
    if (this.phase !== 'idle' || !this.canWrite()) return Promise.resolve(false);
    const epoch = ++this.epoch;
    this.setPhase('starting');
    const task = (async () => {
      try {
        // The first ACK must settle even if Stop/Release arrives immediately.
        await this.append();
        if (this.phase !== 'starting' || epoch !== this.epoch || !this.canWrite()) return false;
        this.setPhase('active');
        this.timer = this.schedule(() => { void this.tick(); }, this.intervalMs);
        return true;
      } catch (error) {
        this.fail(error);
        return false;
      }
    })();
    this.startTask = task;
    void task.finally(() => { if (this.startTask === task) this.startTask = null; });
    return task;
  }
  tick() {
    if (this.phase !== 'active' || this.tickTask || !this.canWrite()) return Promise.resolve(false);
    const task = (async () => {
      try { await this.append(); return true; }
      catch (error) { this.fail(error); return false; }
    })();
    this.tickTask = task;
    void task.finally(() => { if (this.tickTask === task) this.tickTask = null; });
    return task;
  }
  stop() {
    if (this.stopTask) return this.stopTask;
    if (this.phase === 'idle') return Promise.resolve(true);
    ++this.epoch;
    this.setPhase('stopping');
    this.cancelTimer();
    const task = (async () => {
      // Both first append and periodic append finish before releasing Web Locks.
      await Promise.all([this.startTask, this.tickTask].filter(Boolean));
      if (this.indeterminate) {
        this.setPhase('failed');
        throw new Error('Uncertain OPFS write: keep writer lock until worker is safely reconciled');
      }
      this.setPhase('idle');
      return true;
    })();
    this.stopTask = task;
    void task.finally(() => { if (this.stopTask === task) this.stopTask = null; }).catch(() => {});
    return task;
  }
}
