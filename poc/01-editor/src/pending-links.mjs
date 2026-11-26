// Out-of-band, conservative pending-link journal for the frozen NoteDocument
// timeSpan schema. No dynamic audio coverage/clock state is written to marks.
// Integration may persist exportState alongside the note revision (G06 owns IO).
import { isAllowedMeetingMark, sameAnchor } from './policy.mjs';

const READY = new Set(['gap', 'missing', 'unavailable', 'stopped', 'paused', 'unsupported', 'unlinked']);
const validId = id => typeof id === 'string' && id.trim().length > 0 && id.length <= 256;
const nonnegative = v => Number.isFinite(v) && v >= 0;
const validGeneration = v => (typeof v === 'string' && v.length > 0 && v.length <= 128)
  || (Number.isSafeInteger(v) && v >= 0);
const clone = entry => ({ ...entry, mark: { ...entry.mark } });

export function pendingContext(raw, inputMonoMs, allowed) {
  if (!raw || raw.coverage !== 'pending' || raw.source !== 'live_recording'
    || !validId(raw.recordingId) || !(allowed instanceof Set) || !allowed.has(raw.recordingId)
    || !nonnegative(inputMonoMs) || !validGeneration(raw.generation)
    || !validId(raw.intervalId) || (raw.audioOffsetMs !== null && raw.audioOffsetMs !== undefined)) return null;
  return { recordingId: raw.recordingId, source: raw.source, inputMonoMs,
    generation: raw.generation, intervalId: raw.intervalId };
}

// A matching ID must occur as one contiguous text run, potentially split by
// bold/italic text nodes. A disconnected duplicate (copy/paste) is unsafe.
export function inspectPendingRun(doc, entry) {
  const ranges = [];
  let changed = false;
  if (!doc || typeof doc.nodesBetween !== 'function' || !doc.content) return { status: 'invalid-document', ranges: [] };
  doc.nodesBetween(0, doc.content.size, (node, pos) => {
    if (!node.isText) return;
    const mark = node.marks?.find(m => m.type?.name === 'timeSpan' || m.type === 'timeSpan');
    if (mark?.attrs?.anchorId !== entry.mark.anchorId) return;
    if (!sameAnchor(mark.attrs, entry.mark)) changed = true;
    ranges.push({ from: pos, to: pos + node.nodeSize });
  });
  ranges.sort((a, b) => a.from - b.from);
  if (changed) return { status: 'mark-mutated', ranges: [] };
  if (!ranges.length) return { status: 'deleted', ranges: [] };
  if (ranges.some((r, i) => i > 0 && r.from !== ranges[i - 1].to)) {
    return { status: 'multiple-runs', ranges: [] };
  }
  const chars = ranges.reduce((n, r) => n + r.to - r.from, 0);
  if (chars !== entry.expectedChars) return { status: 'length-changed', ranges: [] };
  return { status: 'ready', ranges, chars };
}

export class PendingLinkJournal {
  constructor({ meetingId, recordingIds, maxEntries = 2048 } = {}) {
    if (!validId(meetingId) || !(recordingIds instanceof Set)) throw new Error('meeting and recording allow-list required');
    this.meetingId = meetingId;
    this.allowed = recordingIds;
    this.maxEntries = maxEntries;
    this.records = new Map();
  }
  get size() { return this.records.size; }
  has(anchorId) { return this.records.has(anchorId); }
  get(anchorId) { const entry = this.records.get(anchorId); return entry ? clone(entry) : null; }
  register(mark, context, expectedChars) {
    if (!isAllowedMeetingMark(mark, this.allowed) || mark.recordingId !== null
      || mark.audioOffsetMs !== null || mark.source !== 'unlinked'
      || !context || !this.allowed.has(context.recordingId) || context.source !== 'live_recording'
      || !nonnegative(context.inputMonoMs) || !validGeneration(context.generation)
      || !validId(context.intervalId) || !Number.isSafeInteger(expectedChars) || expectedChars < 1
      || this.records.has(mark.anchorId) || this.records.size >= this.maxEntries) return false;
    this.records.set(mark.anchorId, { mark: { ...mark }, meetingId: this.meetingId,
      recordingId: context.recordingId, source: context.source,
      inputMonoMs: context.inputMonoMs, generation: context.generation,
      intervalId: context.intervalId, expectedChars });
    return true;
  }
  noteEdit(anchorId, deltaChars) {
    const entry = this.records.get(anchorId);
    if (!entry) return;
    if (!Number.isSafeInteger(deltaChars) || entry.expectedChars + deltaChars < 0) {
      this.records.delete(anchorId);
      return;
    }
    entry.expectedChars += deltaChars;
  }
  cancel(anchorId) { return this.records.delete(anchorId); }
  clear() { this.records.clear(); }
  exportState() {
    return { schemaVersion: 1, meetingId: this.meetingId,
      records: Array.from(this.records.values(), clone) };
  }
  // Input is a sidecar from the SAME meeting's storage, not clipboard or HTML.
  // Corrupt/foreign entries are skipped. Unknown clock => text stays unlinked.
  restoreState(snapshot, doc) {
    // Validate into a scratch journal so a foreign/corrupt sidecar cannot
    // silently clear an already active local pending editor session.
    if (!snapshot || snapshot.schemaVersion !== 1 || snapshot.meetingId !== this.meetingId
      || !Array.isArray(snapshot.records) || snapshot.records.length > this.maxEntries) return 0;
    const candidate = new PendingLinkJournal({ meetingId: this.meetingId,
      recordingIds: this.allowed, maxEntries: this.maxEntries });
    for (const record of snapshot.records) {
      if (!record || record.meetingId !== this.meetingId) continue;
      const context = { recordingId: record.recordingId, source: record.source,
        inputMonoMs: record.inputMonoMs, generation: record.generation, intervalId: record.intervalId };
      if (!candidate.register(record.mark, context, record.expectedChars)) continue;
      if (inspectPendingRun(doc, record).status !== 'ready') candidate.cancel(record.mark.anchorId);
    }
    this.records = candidate.records;
    return this.records.size;
  }
  // The resolver is strictly meeting/recording/generation/interval-scoped.
  // It MUST explicitly attest clock coverage for the original inputMonoMs.
  // A provisional offset or nearest segment is NEVER sufficient.
  prepare(doc, resolver) {
    if (typeof resolver !== 'function') throw new Error('pending resolver required');
    const plans = [], results = [];
    for (const [anchorId, entry] of this.records) {
      if (!this.allowed.has(entry.recordingId)) {
        this.cancel(anchorId);
        results.push({ anchorId, status: 'invalidated', reason: 'recording-not-allowed' });
        continue;
      }
      const run = inspectPendingRun(doc, entry);
      if (run.status !== 'ready') {
        this.cancel(anchorId);
        results.push({ anchorId, status: 'invalidated', reason: run.status });
        continue;
      }
      let decision;
      try { decision = resolver(clone(entry)); }
      catch { results.push({ anchorId, status: 'pending', reason: 'resolver-error' }); continue; }
      if (!decision || decision.status === 'pending') {
        results.push({ anchorId, status: 'pending' }); continue;
      }
      if (READY.has(decision.status)) {
        this.cancel(anchorId);
        results.push({ anchorId, status: 'invalidated', reason: decision.status });
        continue;
      }
      const trusted = decision.status === 'valid' && decision.coverage === 'valid'
        && decision.meetingId === this.meetingId
        && decision.recordingId === entry.recordingId && decision.source === entry.source
        && decision.generation === entry.generation && decision.intervalId === entry.intervalId
        && decision.inputMonoMs === entry.inputMonoMs
        && Number.isSafeInteger(decision.audioOffsetMs) && decision.audioOffsetMs >= 0;
      if (!trusted) {
        // A contradictory "valid" decision is not a reason to guess a link.
        // Preserve the pending sidecar for a future authoritative calibration.
        results.push({ anchorId, status: 'pending', reason: 'unverified-coverage' });
        continue;
      }
      plans.push({ anchorId, mark: { ...entry.mark, recordingId: entry.recordingId,
        audioOffsetMs: decision.audioOffsetMs, source: entry.source }, ranges: run.ranges });
      results.push({ anchorId, status: 'prepared' });
    }
    return { plans, results };
  }
  complete(plans) { for (const plan of plans) this.records.delete(plan.anchorId); }
}
