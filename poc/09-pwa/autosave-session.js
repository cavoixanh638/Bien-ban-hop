// Single-flight, revision-aware autosave. A pending commit is not a saved ACK
// for text typed afterward. Freeze input before draining on writer release.
export class AutosaveSession {
  constructor({ canWrite, readInput, readCommitted, commit, onCommit, onStatus }) {
    Object.assign(this, { canWrite, readInput, readCommitted, commit, onCommit, onStatus });
    this.pending = null;
    this.freezing = false;
  }
  get dirty() { return this.readInput() !== this.readCommitted(); }
  flush() {
    if (this.pending) return this.pending;
    if (!this.canWrite()) return Promise.resolve(false);
    const task = (async () => {
      while (this.canWrite() && this.dirty) {
        const text = this.readInput();
        this.onStatus('saving');
        try {
          const committed = await this.commit(text);
          this.onCommit(committed, text); // committed revision is now authoritative
          this.onStatus(this.dirty ? 'dirty' : 'saved', committed);
        } catch (error) {
          this.onStatus('error', error);
          throw error;
        }
      }
      return !this.dirty;
    })();
    this.pending = task;
    void task.finally(() => { if (this.pending === task) this.pending = null; }).catch(() => {});
    return task;
  }
  async freezeAndDrain() {
    this.freezing = true;
    try {
      await this.flush();
      if (this.dirty) await this.flush();
      if (this.dirty) throw new Error('Cannot release: unsaved changes remain visible');
      return true;
    } catch (error) {
      this.freezing = false;
      throw error;
    }
  }
  unfreeze() { this.freezing = false; }
}
