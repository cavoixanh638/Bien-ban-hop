import { openIndexedDB, NotesRepository } from '../../poc/06-notes/notes.mjs';

/** G06 CAS/transaction semantics, extended to atomically commit pending-source sidecar. */
export class MeetingStore {
  constructor(db) { this.db = db; this.notes = new NotesRepository(db); }
  static async open(name = 'mochop-g10-v1') { return new MeetingStore(await openIndexedDB(name)); }
  list() { return this.notes.listMeetings(); }
  create(title) { return this.notes.createMeeting(title); }
  getMeeting(id) { return this.notes.getMeeting(id); }
  async load(meetingId) {
    const meeting = await this.notes.getMeeting(meetingId);
    if (!meeting) throw Error('Cuộc họp không còn tồn tại');
    const note = await this.notes.getNote(meeting.noteDocumentId);
    if (!note) throw Error('Không tìm được ghi chú');
    const journals = await this.notes.getJournal(note.noteDocumentId);
    const current = journals.findLast(j => j.revision === note.revision);
    return { meeting, note, pendingState: current?.pendingState ?? null };
  }
  async addRecording(meetingId, recordingId, lease) {
    if (!canWrite(lease, meetingId)) throw Error('Không giữ khóa ghi của cuộc họp');
    return this.db.run(['meetings'], 'readwrite', async tx => {
      const m = await tx.get('meetings', meetingId);
      if (!m) throw Error('Cuộc họp không tồn tại');
      if (!canWrite(lease, meetingId)) throw Error('Mất khóa ghi');
      const list = new Set(m.recordingIds ?? []);
      if (list.has(recordingId)) throw Error('ID bản ghi đã tồn tại');
      list.add(recordingId);
      m.recordingIds = [...list]; m.updatedAt = Date.now();
      await tx.put('meetings', m);
      return m;
    });
  }
  async save(meetingId, content, pendingState, expectedRevision, lease) {
    if (!canWrite(lease, meetingId)) throw Error('Không giữ khóa ghi');
    if (content?.type !== 'doc' || !Array.isArray(content.content)) throw TypeError('ProseMirror JSON không hợp lệ');
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw TypeError('revision không hợp lệ');
    if (pendingState && (pendingState.schemaVersion !== 1 || pendingState.meetingId !== meetingId ||
       !Array.isArray(pendingState.records))) throw TypeError('Pending provenance sai cuộc họp');
    const snapshot = structuredClone(content);
    const sidecar = pendingState ? structuredClone(pendingState) : null;
    // Completed IDB transaction is the ONLY saved acknowledgement.
    return this.db.run(['meetings', 'notes', 'journals'], 'readwrite', async tx => {
      const meeting = await tx.get('meetings', meetingId);
      if (!meeting) throw Error('Cuộc họp không tồn tại');
      const old = await tx.get('notes', meeting.noteDocumentId);
      if (!old || old.revision !== expectedRevision) throw Error('CONFLICT: revision cũ');
      if (!canWrite(lease, meetingId)) throw Error('Khóa ghi đã bị mất');
      const revision = expectedRevision + 1;
      await tx.put('notes', {noteDocumentId: meeting.noteDocumentId, revision, schemaVersion: 1, content: snapshot});
      await tx.put('journals', {journalId: meeting.noteDocumentId + ':' + revision,
        noteDocumentId: meeting.noteDocumentId, revision, previousRevision: expectedRevision,
        committedAt: Date.now(), kind: 'snapshot', content: snapshot, pendingState: sidecar});
      meeting.updatedAt = Date.now();
      await tx.put('meetings', meeting);
      return revision;
    });
  }
  close() { this.db.close?.(); }
}

export function canWrite(lease, meetingId) {
  return !!lease?.held && (!lease.meetingId || lease.meetingId === meetingId);
}

/** Single-flight autosave; newer edits during in-flight save cannot be reported saved. */
export class SaveQueue {
  constructor(save, onStatus = () => {}, {delay = 350, maxWait = 1500} = {}) {
    this.save = save; this.onStatus = onStatus;
    this.delay = delay; this.maxWait = maxWait;
    this.generation = 0; this.durableGeneration = 0;
    this.timer = null; this.maxTimer = null; this.inFlight = null;
    this.error = null; this.closed = false; this.firstDirty = 0;
  }
  edit() {
    if (this.closed) throw Error('SaveQueue đã đóng');
    this.generation++; this.error = null; this.onStatus('dirty');
    clearTimeout(this.timer);
    if (!this.firstDirty) this.firstDirty = Date.now();
    this.timer = setTimeout(() => this.flush().catch(() => {}), this.delay);
    if (!this.maxTimer) this.maxTimer = setTimeout(() => this.flush().catch(() => {}), this.maxWait);
  }
  async flush() {
    clearTimeout(this.timer); clearTimeout(this.maxTimer);
    this.timer = this.maxTimer = null;
    // Reuse the same promise for ALL concurrent flush callers. Do not create a
    // second writer after awaiting a previously in-flight commit.
    if (this.inFlight) return this.inFlight;
    if (this.generation === this.durableGeneration) return;
    const task = (async () => {
      this.onStatus('saving');
      while (this.durableGeneration < this.generation) {
        const target = this.generation;
        try {
          await this.save(target);
          this.durableGeneration = target; this.error = null;
        } catch (error) {
          this.error = error; this.onStatus('error', error); throw error;
        }
      }
      this.firstDirty = 0; this.onStatus('saved');
    })();
    this.inFlight = task;
    try { await task; } finally { if (this.inFlight === task) this.inFlight = null; }
  }
  async drain() {
    await this.flush();
    if (this.generation !== this.durableGeneration || this.error) throw Error('Vẫn còn thay đổi chưa được lưu');
  }
  async close() { await this.drain(); this.closed = true; clearTimeout(this.timer); clearTimeout(this.maxTimer); }
}
