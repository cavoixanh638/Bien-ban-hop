// Web Locks release notification is delivered before the source callback may
// have fully relinquished the origin-wide shared maintenance lock.
// Retry a bounded number of times; manual Retry remains available afterward.
export class MaintenanceRetry {
  constructor({ needed, attempt, schedule = (fn, ms) => setTimeout(fn, ms),
    cancel = timer => clearTimeout(timer), delaysMs = [250, 750, 1500, 3000] }) {
    Object.assign(this, { needed, attempt, schedule, cancel, delaysMs });
    this.timer = null;
    this.nextDelay = 0;
    this.closed = false;
  }
  notifyRelease() {
    if (this.closed || !this.needed()) return;
    this.clear();
    this.nextDelay = 0;
    this.queue();
  }
  queue() {
    if (this.closed || !this.needed() || this.timer !== null) return;
    if (this.nextDelay >= this.delaysMs.length) return;
    const delay = this.delaysMs[this.nextDelay++];
    this.timer = this.schedule(async () => {
      this.timer = null;
      if (this.closed || !this.needed()) return;
      try { await this.attempt(); }
      catch (_) { /* app reports migration error; manual button still works */ }
      if (!this.closed && this.needed()) this.queue();
    }, delay);
  }
  clear() {
    if (this.timer !== null) this.cancel(this.timer);
    this.timer = null;
  }
  close() { this.closed = true; this.clear(); }
}
