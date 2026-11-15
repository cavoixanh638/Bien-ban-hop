// Dependency-free decision policy shared by the ProseMirror adapter and Node tests.
// All links are data provenance, NOT audio availability or speech timestamps.
export const SOURCES = Object.freeze([
  'live_recording', 'imported_playback', 'playback_paused',
  'historical_edit', 'paste', 'unlinked',
]);
const SOURCE_SET = new Set(SOURCES);
const WORD = /[\p{L}\p{M}\p{N}_]/u;
export const isWordChar = (char) => Boolean(char && WORD.test(char));

// A redacted IME trace must NEVER contain a printable keystroke.
export function safeKeyboardKey(key) {
  const allowed = new Set(['Backspace', 'Delete', 'Enter', 'Escape', 'Tab', 'Insert',
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End',
    'PageUp', 'PageDown', 'Control', 'Alt', 'Meta', 'Shift',
    'Process', 'Dead', 'Unidentified', 'Compose']);
  if (allowed.has(key)) return key;
  return typeof key === 'string' && key.length === 1 ? '[printable]' : '[other]';
}

export function normalizeContext(context = {}) {
  const source = SOURCE_SET.has(context.source) ? context.source : 'unlinked';
  const recordingId = typeof context.recordingId === 'string' && context.recordingId.trim()
    ? context.recordingId : null;
  const audioOffsetMs = Number.isFinite(context.audioOffsetMs) && context.audioOffsetMs >= 0
    ? Math.round(context.audioOffsetMs) : null;
  // Never invent a media position when paused/gap/micro lost/unavailable.
  if (!recordingId || audioOffsetMs === null || context.coverage === 'gap'
    || context.coverage === 'missing' || context.coverage === 'unavailable'
    || source === 'unlinked' || source === 'paste' || source === 'historical_edit') {
    return { recordingId: null, audioOffsetMs: null, source: source === 'paste' ? 'paste' : 'unlinked' };
  }
  return { recordingId, audioOffsetMs, source };
}

export function makeAnchor(context, { anchorId, typedAt }) {
  if (!anchorId || !Number.isSafeInteger(typedAt)) throw new Error('anchorId and epoch-ms typedAt required');
  return { anchorId, ...normalizeContext(context), typedAt, schemaVersion: 1 };
}

export function sameAnchor(a, b) {
  return Boolean(a && b && ['anchorId', 'recordingId', 'audioOffsetMs', 'typedAt', 'source', 'schemaVersion']
    .every(key => a[key] === b[key]));
}

export function wordRange(text, cursor) {
  const index = Math.max(0, Math.min(text.length, cursor));
  let from = index, to = index;
  while (from > 0 && isWordChar(text[from - 1])) from -= 1;
  while (to < text.length && isWordChar(text[to])) to += 1;
  return { from, to, word: text.slice(from, to) };
}

export function hasWordBoundary(text) {
  return [...text].some(char => !isWordChar(char));
}

export function shouldCoalesce(previous, next, config = {}) {
  if (!previous || !next || !previous.anchor) return false;
  const maxGapMs = config.maxGapMs ?? 1200;
  const maxAgeMs = config.maxAgeMs ?? 1800;
  const maxChars = config.maxChars ?? 24;
  return next.monotonicMs >= previous.monotonicMs
    && next.monotonicMs - previous.monotonicMs <= maxGapMs
    && next.monotonicMs - previous.startMonoMs <= maxAgeMs
    && (previous.charCount + next.insertedLength) <= maxChars
    && next.from === previous.nextPos
    && !previous.closedByBoundary
    && !next.isPaste && !next.isHistory && !next.isNewIdea
    && !next.isCompositionRestart && !hasWordBoundary(next.insertedText || '')
    && next.contextEpoch === previous.contextEpoch
    && next.recordingId === previous.anchor.recordingId
    && next.source === previous.anchor.source
    && next.contextState === previous.contextState;
}

// Conservative: only a short same-word revision can retain an existing mark.
// Uncertainty resolves to a new real context anchor or an explicit unlinked mark.
export function shouldRetainWordAnchor(action) {
  const { oldAnchor, isPaste, isHistory, deletedText = '', insertedText = '',
    sameWord, inputType = '', isOldSelection, recentBackspaceBurst } = action;
  if (!oldAnchor || isPaste || isHistory || !sameWord) return false;
  if (hasWordBoundary(insertedText) || hasWordBoundary(deletedText)) return false;
  if (insertedText.length > 16 || deletedText.length > 16) return false;
  if (deletedText.length > 0) return true; // replacement of part of same word
  if (recentBackspaceBurst) return true; // UniKey/EVKey backspace + insert without composition
  if (isOldSelection && insertedText.length <= 2 && /insertText|insertCompositionText/.test(inputType)) return true;
  return false;
}

export function isAllowedMeetingMark(mark, allowedRecordingIds) {
  if (!mark || mark.schemaVersion !== 1 || !SOURCE_SET.has(mark.source)) return false;
  if (mark.recordingId === null && mark.audioOffsetMs === null) return true;
  return Boolean(mark.recordingId && allowedRecordingIds.has(mark.recordingId)
    && Number.isSafeInteger(mark.audioOffsetMs) && mark.audioOffsetMs >= 0);
}

export function getJsonMetrics(doc) {
  let textNodes = 0, markedTextNodes = 0, timeSpanRuns = 0;
  let characters = 0, unlinkedChars = 0;
  const anchors = new Set();
  const traverse = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'text') {
      textNodes += 1;
      characters += (node.text || '').length;
      const mark = (node.marks || []).find(m => m.type === 'timeSpan');
      if (mark) {
        markedTextNodes += 1;
        timeSpanRuns += 1;
        anchors.add(mark.attrs?.anchorId);
        if (!mark.attrs?.recordingId) unlinkedChars += (node.text || '').length;
      } else unlinkedChars += (node.text || '').length;
    }
    (node.content || []).forEach(traverse);
  };
  traverse(doc);
  return { textNodes, markedTextNodes, timeSpanRuns, uniqueAnchors: anchors.size,
    characters, unlinkedChars, jsonBytes: new TextEncoder().encode(JSON.stringify(doc)).byteLength };
}

export function p95(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
}
