import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SOURCES, normalizeContext, makeAnchor, sameAnchor, wordRange, isWordChar,
  hasWordBoundary, shouldCoalesce, shouldRetainWordAnchor, isAllowedMeetingMark, safeKeyboardKey,
  getJsonMetrics, p95,
} from '../src/policy.mjs';

const linked = { anchorId: 'a-1', recordingId: 'rec-01', audioOffsetMs: 125000,
  typedAt: 1731670000000, source: 'live_recording', schemaVersion: 1 };
const burst = { anchor: linked, nextPos: 10, monotonicMs: 1000, startMonoMs: 800,
  contextEpoch: 4, contextState: 'valid', charCount: 4, closedByBoundary: false };
const next = { monotonicMs: 1100, from: 10, insertedLength: 1, insertedText: 'ờ',
  contextEpoch: 4, contextState: 'valid', recordingId: 'rec-01', source: 'live_recording' };

test('TC01: mark contract includes all six immutable attributes', () => {
  const anchor = makeAnchor({ recordingId: 'rec-01', audioOffsetMs: 125000.49, source: 'live_recording' },
    { anchorId: 'a-1', typedAt: 1731670000000 });
  assert.deepEqual(anchor, linked);
  assert.equal(Object.keys(anchor).length, 6);
});
test('TC01: all six source values explicitly recognized', () => {
  assert.equal(SOURCES.length, 6);
  assert.deepEqual(normalizeContext({ recordingId: 'rec', source: 'imported_playback', audioOffsetMs: 35 }),
    { recordingId: 'rec', source: 'imported_playback', audioOffsetMs: 35 });
});
for (const coverage of ['gap', 'missing', 'unavailable']) {
  test(`TC01: ${coverage} never gets an invented audio offset`, () => {
    assert.deepEqual(normalizeContext({ recordingId: 'rec', audioOffsetMs: 12000, coverage, source: 'live_recording' }),
      { recordingId: null, audioOffsetMs: null, source: 'unlinked' });
  });
}
test('TC01: missing source, negative, NaN and undefined offset cannot link', () => {
  for (const audioOffsetMs of [-1, Number.NaN, undefined]) {
    assert.equal(normalizeContext({ recordingId: 'rec', audioOffsetMs, source: 'live_recording' }).audioOffsetMs, null);
  }
});
test('TC02: fast typing within same word coalesces across repeated inserts', () => {
  assert.equal(shouldCoalesce(burst, next), true);
});
test('TC02: 2-minute no-Enter synthetic word/cadence creates many anchors', () => {
  let active = null, distinct = 0;
  for (let second = 0; second < 120; second++) {
    const insertedText = second % 4 === 0 ? ' ' : 'a';
    const op = { ...next, from: second, monotonicMs: second * 1000,
      insertedText, insertedLength: 1 };
    const reuse = shouldCoalesce(active, op);
    if (!reuse) distinct += 1;
    active = { ...burst, anchor: linked, nextPos: second + 1,
      monotonicMs: op.monotonicMs, startMonoMs: reuse ? active.startMonoMs : op.monotonicMs,
      charCount: reuse ? active.charCount + 1 : 1, closedByBoundary: hasWordBoundary(insertedText) };
  }
  assert.ok(distinct > 10); // algorithm-only; not TC02 browser PASS
});
test('TC02: group closed on punctuation/space and after max age', () => {
  assert.equal(shouldCoalesce(burst, { ...next, insertedText: ' ' }), false);
  assert.equal(shouldCoalesce(burst, { ...next, insertedText: ',' }), false);
  assert.equal(shouldCoalesce(burst, { ...next, monotonicMs: 3000 }), false);
});
test('TC04: Unicode Vietnamese combining marks are in word', () => {
  assert.equal(isWordChar('ữ'), true);
  assert.equal(isWordChar('\u0301'), true);
  assert.deepEqual(wordRange('gõ trường, tiếng', 7), { from: 3, to: 9, word: 'trường' });
});
test('TC04: short same-word accent replacement keeps original anchor', () => {
  assert.equal(shouldRetainWordAnchor({ oldAnchor: linked, sameWord: true,
    deletedText: 'o', insertedText: 'ờ' }), true);
});
test('TC04: Backspace+Insert without composition can keep anchor', () => {
  assert.equal(shouldRetainWordAnchor({ oldAnchor: linked, sameWord: true,
    deletedText: 'o', insertedText: 'ơ', recentBackspaceBurst: true }), true);
});
test('TC04: paste and punctuation cannot look like accent mutation', () => {
  assert.equal(shouldRetainWordAnchor({ oldAnchor: linked, sameWord: true, isPaste: true,
    deletedText: 'a', insertedText: 'á' }), false);
  assert.equal(shouldRetainWordAnchor({ oldAnchor: linked, sameWord: true,
    deletedText: '', insertedText: 'ý mới' }), false);
});
test('TC05: historical correction inherits only when local word revision', () => {
  assert.equal(shouldRetainWordAnchor({ oldAnchor: linked, sameWord: true, inputType: 'insertText',
    isOldSelection: true, insertedText: 'ê' }), true);
  assert.equal(shouldRetainWordAnchor({ oldAnchor: linked, sameWord: false, inputType: 'insertText',
    isOldSelection: true, insertedText: 'ê' }), false);
});
test('TC06: insertion from unrelated cursor/context does not group', () => {
  assert.equal(shouldCoalesce(burst, { ...next, from: 50 }), false);
  assert.equal(shouldCoalesce(burst, { ...next, contextEpoch: 5 }), false);
  assert.equal(shouldCoalesce(burst, { ...next, recordingId: 'rec-02' }), false);
});
test('TC06: playback pause and seek cause new grouping boundary', () => {
  assert.equal(shouldCoalesce(burst, { ...next, source: 'playback_paused' }), false);
  assert.equal(shouldCoalesce(burst, { ...next, contextState: 'gap' }), false);
});
test('TC07: same-meeting valid source retained, foreign recording rejected', () => {
  assert.equal(isAllowedMeetingMark(linked, new Set(['rec-01'])), true);
  assert.equal(isAllowedMeetingMark(linked, new Set(['rec-02'])), false);
});
test('TC08: group matches ALL attributes, not only offset', () => {
  assert.equal(sameAnchor(linked, { ...linked }), true);
  for (const attr of ['anchorId', 'recordingId', 'audioOffsetMs', 'typedAt', 'source', 'schemaVersion']) {
    assert.equal(sameAnchor(linked, { ...linked, [attr]: 'changed' }), false, attr);
  }
});
test('TC09: timeSpan attrs do not depend on bold/italic text marks', () => {
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'trường', marks: [{ type: 'timeSpan', attrs: linked }] },
    { type: 'text', text: ' tiếng', marks: [{ type: 'timeSpan', attrs: linked }, { type: 'bold' }] },
  ] }] };
  const m = getJsonMetrics(doc);
  assert.equal(m.uniqueAnchors, 1);
  assert.equal(m.markedTextNodes, 2);
  assert.equal(m.timeSpanRuns, 1); // same attrs across bold split
  assert.equal(m.totalMarkInstances, 3); // 2 timeSpan + 1 bold
});
test('TC11: model runs split when ANY timeSpan attribute changes, not merely the time offset', () => {
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'a', marks: [{ type: 'timeSpan', attrs: linked }] },
    { type: 'text', text: 'b', marks: [{ type: 'timeSpan', attrs: linked }, { type: 'italic' }] },
    { type: 'text', text: 'c', marks: [{ type: 'timeSpan', attrs: { ...linked, typedAt: linked.typedAt + 5 } }] },
    { type: 'text', text: 'd', marks: [{ type: 'timeSpan', attrs: { ...linked, typedAt: linked.typedAt + 5 } }, { type: 'bold' }] },
    { type: 'text', text: 'e' },
    { type: 'text', text: 'f', marks: [{ type: 'timeSpan', attrs: linked }] },
  ] }, { type: 'paragraph', content: [{ type: 'text', text: 'g', marks: [{ type: 'timeSpan', attrs: linked }] }] }] };
  const metrics = getJsonMetrics(doc);
  assert.equal(metrics.timeSpanRuns, 4);
  assert.equal(metrics.textNodes, 7);
  assert.equal(metrics.markedTextNodes, 6);
});
test('TC10: paste unlinked allowed, never assigns source audio', () => {
  const a = makeAnchor({ source: 'paste', recordingId: 'rec-01', audioOffsetMs: 100 },
    { anchorId: 'paste-1', typedAt: 1731670000000 });
  assert.equal(a.recordingId, null);
  assert.equal(a.audioOffsetMs, null);
  assert.equal(isAllowedMeetingMark(a, new Set()), true);
});
test('TC10: malformed or unknown provenance cannot link', () => {
  assert.equal(isAllowedMeetingMark({ ...linked, schemaVersion: 77 }, new Set(['rec-01'])), false);
  assert.equal(isAllowedMeetingMark({ ...linked, source: 'made_up' }, new Set(['rec-01'])), false);
  assert.equal(isAllowedMeetingMark({ ...linked, audioOffsetMs: -10 }, new Set(['rec-01'])), false);
});
test('TC07/TC10: malformed partial timeSpan and inconsistent source are rejected', () => {
  const allowed = new Set(['rec-01']);
  for (const attr of ['anchorId', 'typedAt', 'schemaVersion', 'source']) {
    const invalid = { ...linked };
    delete invalid[attr];
    assert.equal(isAllowedMeetingMark(invalid, allowed), false, attr);
  }
  assert.equal(isAllowedMeetingMark({ ...linked, anchorId: '' }, allowed), false);
  assert.equal(isAllowedMeetingMark({ ...linked, typedAt: '1731670000000' }, allowed), false);
  assert.equal(isAllowedMeetingMark({ ...linked, typedAt: Number.NaN }, allowed), false);
  assert.equal(isAllowedMeetingMark({ ...linked, source: 'paste' }, allowed), false);
  assert.equal(isAllowedMeetingMark({ ...linked, source: 'unlinked' }, allowed), false);
  assert.equal(isAllowedMeetingMark({ ...linked, recordingId: null, audioOffsetMs: null }, allowed), false);
  assert.equal(isAllowedMeetingMark({ ...linked, recordingId: null }, allowed), false);
  assert.equal(isAllowedMeetingMark({ ...linked, recordingId: 'rec-01', audioOffsetMs: 125000.2 }, allowed), false);
  assert.equal(isAllowedMeetingMark({ ...linked, recordingId: null, audioOffsetMs: null,
    source: 'paste' }, allowed), true);
});
test('TC11: no incorrect coalescing across changes in any identity dimension', () => {
  for (const op of [ { ...next, contextEpoch: 1 }, { ...next, source: 'paste' },
    { ...next, insertedLength: 30 }, { ...next, isPaste: true },
    { ...next, isHistory: true }, { ...next, isNewIdea: true } ]) {
    assert.equal(shouldCoalesce(burst, op), false);
  }
});
test('TC11: metrics and P95 counted from JSON not DOM assumptions', () => {
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'a', marks: [{ type: 'timeSpan', attrs: linked }] },
    { type: 'text', text: 'b', marks: [] },
  ] }] };
  const m = getJsonMetrics(doc);
  assert.equal(m.characters, 2);
  assert.equal(m.textNodes, 2);
  assert.equal(m.markedTextNodes, 1);
  assert.equal(m.unlinkedChars, 1);
  assert.equal(p95([]), null);
  assert.equal(p95(Array.from({ length: 100 }, (_, i) => i + 1)), 95);
});

test('TC03 trace privacy: printable keys are redacted while IME control signals remain', () => {
  for (const key of ['a', 'ư', 'ê', 'ó', '1', ' ']) assert.equal(safeKeyboardKey(key), '[printable]');
  for (const key of ['Backspace', 'Delete', 'ArrowLeft', 'Process', 'Dead', 'Enter']) {
    assert.equal(safeKeyboardKey(key), key);
  }
  assert.equal(safeKeyboardKey('SomeUnknownKey'), '[other]');
});
