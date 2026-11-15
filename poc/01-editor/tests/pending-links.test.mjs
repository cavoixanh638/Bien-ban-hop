import test from 'node:test';
import assert from 'node:assert/strict';
import { PendingLinkJournal, inspectPendingRun, pendingContext } from '../src/pending-links.mjs';
import { CalibratedClockFixture } from '../fixtures/pending-clock.mjs';
import { isAllowedMeetingMark } from '../src/policy.mjs';

const typedAt = 1794750000000;
const note = { anchorId: 'pending-a', recordingId: null, audioOffsetMs: null,
  typedAt, source: 'unlinked', schemaVersion: 1 };
const ctx = { recordingId: 'rec-1', source: 'live_recording', inputMonoMs: 1500,
  generation: 'generation-1', intervalId: 'interval-1' };
const allowed = new Set(['rec-1']);
function journal(meetingId = 'meeting-A') { return new PendingLinkJournal({ meetingId, recordingIds: allowed }); }
function clock() {
  const t = new CalibratedClockFixture({ meetingId: 'meeting-A', recordingId: 'rec-1',
    generation: 'generation-1', intervalId: 'interval-1' });
  assert.equal(t.progress(0, 0), true);
  assert.equal(t.progress(1000, 48000), true);
  return t;
}
function doc(parts) {
  const nodes = parts.map(x => ({ isText: true, nodeSize: x.text.length,
    marks: x.mark ? [{ type: { name: 'timeSpan' }, attrs: x.mark }] : [] }));
  return { content: { size: nodes.reduce((n, x) => n + x.nodeSize, 2) },
    nodesBetween(from, to, fn) {
      let pos = 1;
      for (const node of nodes) { if (pos < to && pos + node.nodeSize > from) fn(node, pos); pos += node.nodeSize; }
    },
  };
}
const d = (text = 'trường') => doc([{ text, mark: note }]);
function pending(j, text = 'trường') { assert.equal(j.register(note, ctx, text.length), true); }

test('G01-ADD-01 exact last-point clock is valid, no extrapolation after it', () => {
  const t = clock();
  const entry = { ...ctx, meetingId: 'meeting-A' };
  assert.equal(t.resolve({ ...entry, inputMonoMs: 1000 }).audioOffsetMs, 1000);
  assert.equal(t.resolve(entry).status, 'pending');
  assert.equal(t.progress(2000, 96000), true);
  assert.deepEqual(t.resolve(entry), { meetingId: 'meeting-A', recordingId: 'rec-1',
    source: 'live_recording', generation: 'generation-1', intervalId: 'interval-1',
    inputMonoMs: 1500, status: 'valid', coverage: 'valid', audioOffsetMs: 1500 });
});

test('G01-ADD-01 out-of-band pending record leaves six-attribute Mark safely unlinked', () => {
  const j = journal(); pending(j);
  assert.equal(Object.keys(note).length, 6);
  assert.equal(isAllowedMeetingMark(note, allowed), true);
  assert.equal(note.recordingId, null);
  assert.equal(note.audioOffsetMs, null);
  assert.equal('coverage' in note, false);
  const record = j.get(note.anchorId);
  assert.equal(record.inputMonoMs, 1500);
  assert.equal(record.mark.typedAt, typedAt);
  assert.equal(record.recordingId, 'rec-1');
  assert.equal(record.meetingId, 'meeting-A');
  assert.equal(record.mark.source, 'unlinked');
});

test('G01-ADD-01 confirmed clock changes ONLY audio attrs, preserves anchorId and typedAt', () => {
  const j = journal(); pending(j);
  const t = clock();
  assert.equal(j.prepare(d(), entry => t.resolve(entry)).plans.length, 0);
  assert.equal(j.size, 1);
  t.progress(2000, 96000);
  const { plans } = j.prepare(d(), entry => t.resolve(entry));
  assert.equal(plans.length, 1);
  assert.equal(plans[0].mark.anchorId, note.anchorId);
  assert.equal(plans[0].mark.typedAt, typedAt);
  assert.equal(plans[0].mark.audioOffsetMs, 1500);
  assert.equal(plans[0].mark.source, 'live_recording');
  assert.equal(plans[0].mark.recordingId, 'rec-1');
  assert.deepEqual(plans[0].ranges, [{ from: 1, to: 7 }]);
  j.complete(plans);
  assert.equal(j.size, 0);
});

test('G01-ADD-01 no pending source if unknown generation, interval, or foreign recording', () => {
  const raw = { source: 'live_recording', recordingId: 'rec-1', audioOffsetMs: null,
    coverage: 'pending', generation: 'g', intervalId: 'i' };
  assert.deepEqual(pendingContext(raw, 1500, allowed), { recordingId: 'rec-1',
    source: 'live_recording', inputMonoMs: 1500, generation: 'g', intervalId: 'i' });
  for (const patch of [{ coverage: 'gap' }, { recordingId: 'foreign' }, { generation: null },
    { intervalId: null }, { audioOffsetMs: 10 }, { source: 'playback_paused' }]) {
    assert.equal(pendingContext({ ...raw, ...patch }, 1500, allowed), null);
  }
});

test('G01-ADD-01 mixed-mark format split may still finalize one contiguous group', () => {
  const j = journal(); pending(j);
  const split = doc([{ text: 'tr', mark: note }, { text: 'ường', mark: note }]);
  assert.equal(inspectPendingRun(split, j.get(note.anchorId)).status, 'ready');
  const t = clock(); t.progress(2000, 96000);
  assert.equal(j.prepare(split, e => t.resolve(e)).plans.length, 1);
});

test('G01-ADD-01 IME Telex/VNI mutation can retain initial provenance with adjusted length', () => {
  const j = journal(); pending(j, 'truong');
  j.noteEdit(note.anchorId, -1); // simulated Backspace
  j.noteEdit(note.anchorId, +1); // simulated Insert with altered diacritic
  assert.equal(j.get(note.anchorId).inputMonoMs, 1500);
  const changed = doc([{ text: 'trường', mark: note }]);
  const t = clock(); t.progress(2000, 96000);
  assert.equal(j.prepare(changed, e => t.resolve(e)).plans[0].mark.audioOffsetMs, 1500);
});

test('G01-ADD-01 delete prior to finalize never creates phantom audio link', () => {
  const j = journal(); pending(j);
  const t = clock(); t.progress(2000, 96000);
  const gone = doc([{ text: 'khác', mark: null }]);
  const r = j.prepare(gone, e => t.resolve(e));
  assert.equal(r.plans.length, 0);
  assert.equal(r.results[0].reason, 'deleted');
  assert.equal(j.size, 0);
});

test('G01-ADD-01 copied same-session marked text in two places must not finalize', () => {
  const j = journal(); pending(j);
  const duplicated = doc([{ text: 'trường', mark: note }, { text: ' ', mark: null }, { text: 'trường', mark: note }]);
  const t = clock(); t.progress(2000, 96000);
  assert.equal(j.prepare(duplicated, e => t.resolve(e)).plans.length, 0);
  assert.equal(j.size, 0);
});

test('G01-ADD-01 pending mark copied adjacent to itself fails expected length guard', () => {
  const j = journal(); pending(j);
  const cloned = doc([{ text: 'trườngtrường', mark: note }]);
  const t = clock(); t.progress(2000, 96000);
  assert.equal(j.prepare(cloned, e => t.resolve(e)).plans.length, 0);
  assert.equal(j.size, 0);
});

test('G01-ADD-01 other meeting cannot import pending sidecar, even if text was copied', () => {
  const j = journal(); pending(j);
  const other = journal('meeting-B');
  assert.equal(other.restoreState(j.exportState(), d()), 0);
  assert.equal(other.prepare(d(), () => ({ status: 'valid' })).plans.length, 0);
});

test('G01-ADD-01 pending sidecar survives offline/reopen safely with matching note', () => {
  const j = journal(); pending(j);
  const exported = JSON.parse(JSON.stringify(j.exportState()));
  assert.equal(JSON.stringify(exported).includes('trường'), false);
  const restarted = journal();
  assert.equal(restarted.restoreState(exported, d()), 1);
  assert.equal(restarted.prepare(d(), () => ({ status: 'pending' })).plans.length, 0);
  const t = clock(); t.progress(2000, 96000);
  assert.equal(restarted.prepare(d(), e => t.resolve(e)).plans[0].mark.audioOffsetMs, 1500);
});

test('G01-ADD-01 reopen missing note/changed mark invalidates pending source', () => {
  const j = journal(); pending(j);
  const changed = doc([{ text: 'trường', mark: { ...note, typedAt: typedAt + 1 } }]);
  assert.equal(journal().restoreState(j.exportState(), changed), 0);
  assert.equal(journal().restoreState(j.exportState(), doc([])), 0);
});

test('G01-ADD-01 no current audio offset may resolve from different recording or generation', () => {
  const j = journal(); pending(j);
  const t = clock(); t.progress(2000, 96000);
  const valid = t.resolve(j.get(note.anchorId));
  for (const patch of [{ recordingId: 'rec-2' }, { generation: 'generation-2' },
    { intervalId: 'interval-2' }, { inputMonoMs: 1501 }, { meetingId: 'meeting-B' },
    { coverage: 'pending' }, { source: 'playback_paused' }, { audioOffsetMs: null },
    { audioOffsetMs: Number.NaN }, { audioOffsetMs: -1 }]) {
    assert.equal(j.prepare(d(), () => ({ ...valid, ...patch })).plans.length, 0);
    assert.equal(j.size, 1, 'bad resolver must not permanently discard legitimate pending');
  }
  assert.equal(j.prepare(d(), () => valid).plans.length, 1);
});

test('G01-ADD-01 pause before next point forbids interpolating across suspended interval', () => {
  const j = journal(); pending(j);
  const t = clock(); t.close('paused', 1600);
  assert.equal(t.progress(2000, 96000), false);
  const res = j.prepare(d(), e => t.resolve(e));
  assert.equal(res.plans.length, 0);
  assert.equal(res.results[0].reason, 'paused');
  assert.equal(j.size, 0);
});

for (const status of ['gap', 'missing', 'stopped', 'unavailable']) {
  test(`G01-ADD-01 ${status} fails closed and keeps unlinked text`, () => {
    const j = journal(); pending(j);
    const t = clock(); t.close(status, 1600);
    assert.equal(j.prepare(d(), e => t.resolve(e)).plans.length, 0);
    assert.equal(j.size, 0);
    assert.equal(note.recordingId, null);
  });
}

test('G01-ADD-01 small drift is resolved only after both calibrated points arrive', () => {
  const j = journal(); pending(j);
  const t = clock();
  assert.equal(j.prepare(d(), e => t.resolve(e)).plans.length, 0);
  t.progress(2000, 96010); // +~104 ppm relative to t=1000
  const offset = j.prepare(d(), e => t.resolve(e)).plans[0].mark.audioOffsetMs;
  assert.ok(Math.abs(offset - 1500) <= 1);
});

test('G01-ADD-01 provider exception or transient missing callback never invents link', () => {
  const j = journal(); pending(j);
  assert.equal(j.prepare(d(), () => { throw new Error('clock offline'); }).plans.length, 0);
  assert.equal(j.prepare(d(), () => null).plans.length, 0);
  assert.equal(j.size, 1);
});

test('G01-ADD-01 cannot duplicate pending ID or fill unbounded journal', () => {
  const j = new PendingLinkJournal({ meetingId: 'meeting-A', recordingIds: allowed, maxEntries: 1 });
  assert.equal(j.register(note, ctx, 6), true);
  assert.equal(j.register(note, ctx, 6), false);
  assert.equal(j.register({ ...note, anchorId: 'pending-b' }, ctx, 6), false);
  assert.equal(j.size, 1);
});

test('G01-ADD-01 hostile foreign sidecar does not erase existing local pending journal', () => {
  const j = journal(); pending(j);
  const payload = { ...j.exportState(), meetingId: 'meeting-B' };
  assert.equal(j.restoreState(payload, d()), 0);
  assert.equal(j.size, 1);
});

test('G01-ADD-01 revoke recording allow-list before finalization fails closed', () => {
  const ids = new Set(['rec-1']);
  const j = new PendingLinkJournal({ meetingId: 'meeting-A', recordingIds: ids });
  pending(j);
  ids.delete('rec-1');
  const t = clock(); t.progress(2000, 96000);
  const res = j.prepare(d(), e => t.resolve(e));
  assert.equal(res.plans.length, 0);
  assert.equal(res.results[0].reason, 'recording-not-allowed');
  assert.equal(j.size, 0);
});
