import { Extension, Mark } from '@tiptap/core';
import { DOMSerializer, Fragment, Slice } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import {
  getJsonMetrics, hasWordBoundary, isAllowedMeetingMark, isWordChar,
  makeAnchor, normalizeContext, p95, safeKeyboardKey, sameAnchor, shouldCoalesce, shouldRetainWordAnchor, wordRange,
} from './policy.mjs';

const trackerKey = new PluginKey('mochop-input-tracker');
const TRACE_LIMIT = 10000;
const CUSTOM_CLIPBOARD = 'application/x-mochop-slice+json';
const attrsFromElement = {
  anchorId: 'data-time-anchor-id', recordingId: 'data-time-recording-id',
  audioOffsetMs: 'data-time-offset-ms', typedAt: 'data-time-typed-at',
  source: 'data-time-source', schemaVersion: 'data-time-schema-version',
};

export const TimeSpan = Mark.create({
  name: 'timeSpan',
  inclusive: false,
  excludes: 'timeSpan',
  spanning: true,
  addAttributes() {
    return Object.fromEntries(Object.entries(attrsFromElement).map(([key, dataAttr]) => [key, {
      default: key === 'schemaVersion' ? 1 : null,
      parseHTML: element => {
        const raw = element.getAttribute(dataAttr);
        if (raw === null || raw === '') return key === 'schemaVersion' ? 1 : null;
        if (key === 'audioOffsetMs' || key === 'typedAt' || key === 'schemaVersion') {
          const val = Number(raw);
          return Number.isSafeInteger(val) ? val : null;
        }
        return raw;
      },
      renderHTML: attrs => attrs[key] === null || attrs[key] === undefined ? {} : { [dataAttr]: attrs[key] },
    }]));
  },
  parseHTML() { return [{ tag: 'span[data-time-anchor-id]' }]; },
  renderHTML({ HTMLAttributes }) {
    return ['span', { ...HTMLAttributes, class: 'time-span' }, 0];
  },
});

function markAt(node) { return node?.marks?.find(mark => mark.type.name === 'timeSpan')?.attrs ?? null; }
function nearMark(doc, pos) {
  const $pos = doc.resolve(Math.max(0, Math.min(doc.content.size, pos)));
  return markAt($pos.nodeBefore) || markAt($pos.nodeAfter);
}
function markFromRange(doc, from, to) {
  let result = null;
  if (from < to) {
    doc.nodesBetween(Math.max(0, from), Math.min(to, doc.content.size), node => {
      if (!result && node.isText) result = markAt(node);
    });
  }
  return result || nearMark(doc, from);
}
function textBlockAt(doc, pos) {
  const $pos = doc.resolve(Math.max(0, Math.min(doc.content.size, pos)));
  const parent = $pos.parent;
  if (!parent.inlineContent) return null;
  const start = $pos.start();
  return { start, text: parent.textBetween(0, parent.content.size, '', '\ufffc') };
}
function wordBoundsInDoc(doc, pos) {
  const block = textBlockAt(doc, pos);
  if (!block) return null;
  const range = wordRange(block.text, pos - block.start);
  return { from: block.start + range.from, to: block.start + range.to, word: range.word };
}
function safeSource(anchor, allowed) {
  return isAllowedMeetingMark(anchor, allowed) ? anchor : null;
}
function removeTimeSpanFromFragment(fragment) {
  return Fragment.fromArray(fragment.content.map(node => {
    const marks = node.marks.filter(mark => mark.type.name !== 'timeSpan');
    const child = node.content.size ? removeTimeSpanFromFragment(node.content) : node.content;
    return node.copy(child).mark(marks);
  }));
}
function sanitizeSlice(slice, allowed, trusted) {
  if (!trusted) return new Slice(removeTimeSpanFromFragment(slice.content), slice.openStart, slice.openEnd);
  const walk = fragment => Fragment.fromArray(fragment.content.map(node => {
    const marks = node.marks.filter(m => m.type.name !== 'timeSpan' || isAllowedMeetingMark(m.attrs, allowed));
    return node.copy(node.content.size ? walk(node.content) : node.content).mark(marks);
  }));
  return new Slice(walk(slice.content), slice.openStart, slice.openEnd);
}
function plainTextSelected(view) {
  const { from, to } = view.state.selection;
  return view.state.doc.textBetween(from, to, '\n\n');
}

// Mark inspection must not silently choose between two different time sources.
export function readAnchorAtCursor(state) {
  const { selection } = state;
  if (!selection.empty) {
    const seen = new Map();
    let hasUnlinked = false;
    state.doc.nodesBetween(selection.from, selection.to, node => {
      if (!node.isText) return;
      const a = markAt(node);
      if (a) seen.set(JSON.stringify(a), a);
      else hasUnlinked = true;
    });
    if (seen.size > 1 || (seen.size && hasUnlinked)) return { status: 'mixed', candidates: [...seen.values()], hasUnlinked };
    if (seen.size === 1) return { status: 'linked', anchor: [...seen.values()][0] };
    return { status: 'unlinked', anchor: null };
  }
  const $pos = selection.$from;
  const left = markAt($pos.nodeBefore), right = markAt($pos.nodeAfter);
  if (left && right && !sameAnchor(left, right)) return { status: 'ambiguous', left, right };
  const anchor = left || right;
  return anchor ? { status: anchor.recordingId ? 'linked' : 'unlinked', anchor } : { status: 'unlinked', anchor: null };
}

// StepMap range collection; excludes marks/formatting, maps ranges to final post-transaction positions.
function collectChanges(transactions) {
  const changes = [];
  for (let ti = 0; ti < transactions.length; ti++) {
    const tr = transactions[ti];
    if (!tr.docChanged || tr.getMeta('mochop:mark-applied') || tr.getMeta('history$')) continue;
    for (let si = 0; si < tr.steps.length; si++) {
      const step = tr.steps[si];
      // Only ReplaceStep / ReplaceAroundStep have slice/insert information; mark steps map no changes.
      if (!('slice' in step) && !('insert' in step)) continue;
      step.getMap().forEach((oldFrom, oldTo, newFrom, newTo) => {
        if (newTo <= newFrom && oldTo <= oldFrom) return;
        const following = tr.mapping.slice(si + 1);
        let from = following.map(newFrom, -1), to = following.map(newTo, 1);
        for (let j = ti + 1; j < transactions.length; j++) {
          from = transactions[j].mapping.map(from, -1);
          to = transactions[j].mapping.map(to, 1);
        }
        changes.push({ from: Math.min(from, to), to: Math.max(from, to), oldFrom, oldTo,
          inputType: tr.getMeta('uiEvent'), tr, transactionIndex: ti });
      });
    }
  }
  return changes;
}

export class InputTracker {
  constructor({ meetingId, recordingIds, getAudioContext, clock = null, maxTrace = TRACE_LIMIT } = {}) {
    if (!meetingId || typeof getAudioContext !== 'function') throw new Error('meetingId + getAudioContext required');
    this.meetingId = meetingId;
    this.allowed = new Set(recordingIds || []);
    this.getAudioContext = getAudioContext;
    this.clock = clock || { mono: () => performance.now(), epoch: () => Date.now() };
    this.maxTrace = maxTrace;
    this.trace = [];
    this.latencies = [];
    this.nextId = 0;
    this.sessionId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `session-${Math.floor(Math.random() * 1e12)}`;
    this.inputPaintLatencies = [];
    this.active = null;
    this.pendingDeletion = null;
    this.lastIntent = null;
    this.composing = false;
    this.compositionBase = null;
    this.pendingPaste = null;
    this.clipboardTokens = new Set();
    this.view = null;
  }

  now() { return { mono: this.clock.mono(), epoch: this.clock.epoch() }; }
  log(kind, detail = {}) {
    this.trace.push({ seq: this.trace.length ? this.trace[this.trace.length - 1].seq + 1 : 1,
      kind, monoMs: Math.round(this.clock.mono()), ...detail });
    if (this.trace.length > this.maxTrace) this.trace.shift();
  }
  getContext(mono) {
    const raw = this.getAudioContext(mono) || {};
    let normalized = normalizeContext(raw);
    if (normalized.recordingId && !this.allowed.has(normalized.recordingId)) normalized = normalizeContext({ source: 'unlinked' });
    return { ...normalized, epoch: raw.epoch ?? 0, coverage: raw.coverage ?? 'valid' };
  }
  newAnchor(context, epoch) {
    return makeAnchor(context, { anchorId: `span-${this.sessionId}-${++this.nextId}`, typedAt: epoch });
  }
  reset(reason) {
    this.active = null;
    this.pendingDeletion = null;
    this.log('boundary', { reason });
  }
  event(name, view, event) {
    if (name === 'beforeinput') {
      this.lastIntent = { type: event.inputType || 'unknown',
        selectionFrom: view.state.selection.from, selectionTo: view.state.selection.to,
        mono: this.clock.mono() };
    }
    if (name === 'compositionstart') {
      this.composing = true;
      this.compositionBase = { from: view.state.selection.from, oldAnchor: nearMark(view.state.doc, view.state.selection.from),
        now: this.now() };
    }
    if (name === 'compositionend') {
      this.composing = false;
      // Defers mark surgery until the browser and IME have finished their own DOM reconciliation.
      setTimeout(() => this.finishComposition(), 0);
    }
    if (name === 'keydown' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) this.reset('keyboard-selection');
    this.log(name, { inputType: event.inputType || undefined, key: name === 'keydown' ? safeKeyboardKey(event.key) : undefined,
      from: view.state.selection.from, to: view.state.selection.to,
      dataLength: typeof event.data === 'string' ? event.data.length : undefined,
      isComposing: this.composing });
    return false; // Never block browser/IME input.
  }
  finishComposition() {
    const view = this.view, base = this.compositionBase;
    this.compositionBase = null;
    if (!view || !base || this.composing) return;
    const range = wordBoundsInDoc(view.state.doc, view.state.selection.from);
    if (!range || range.from === range.to) return;
    const previous = safeSource(base.oldAnchor, this.allowed) || safeSource(nearMark(view.state.doc, range.from), this.allowed);
    const ctx = this.getContext(base.now.mono);
    const anchor = previous || this.active?.anchor || this.newAnchor(ctx, base.now.epoch);
    const mark = view.state.schema.marks.timeSpan.create(anchor);
    const tr = view.state.tr;
    // Only unmarked portions of the composition word, not existing neighbors.
    view.state.doc.nodesBetween(range.from, range.to, (node, pos) => {
      if (node.isText && !markAt(node)) tr.addMark(Math.max(pos, range.from), Math.min(pos + node.nodeSize, range.to), mark);
    });
    if (tr.docChanged) {
      tr.setMeta('mochop:mark-applied', true);
      view.dispatch(tr);
      this.log('composition-anchored', { from: range.from, to: range.to, anchorId: anchor.anchorId });
    }
  }
  clipboard(view, event, cut = false) {
    const data = event.clipboardData;
    if (!data || view.state.selection.empty) return false;
    const token = `slice-${this.meetingId}-${++this.nextId}-${Math.round(this.clock.mono())}`;
    this.clipboardTokens.add(token);
    // Bounded lifetime: avoid turning copied arbitrary external text into trusted provenance.
    if (this.clipboardTokens.size > 30) this.clipboardTokens.delete(this.clipboardTokens.values().next().value);
    const selection = view.state.selection.content().content;
    const holder = document.createElement('div');
    holder.appendChild(DOMSerializer.fromSchema(view.state.schema).serializeFragment(selection));
    data.setData('text/html', holder.innerHTML);
    data.setData('text/plain', plainTextSelected(view));
    data.setData(CUSTOM_CLIPBOARD, JSON.stringify({ meetingId: this.meetingId, token, schemaVersion: 1 }));
    event.preventDefault();
    this.log(cut ? 'cut' : 'copy', { from: view.state.selection.from, to: view.state.selection.to, token });
    if (cut) {
      const tr = view.state.tr.deleteSelection().setMeta('uiEvent', 'cut').scrollIntoView();
      view.dispatch(tr);
      this.reset('cut');
    }
    return true;
  }
  paste(view, event) {
    let trusted = false;
    const raw = event.clipboardData?.getData(CUSTOM_CLIPBOARD);
    if (raw) {
      try {
        const data = JSON.parse(raw);
        trusted = data.meetingId === this.meetingId && data.schemaVersion === 1
          && this.clipboardTokens.has(data.token);
      } catch { /* malformed external clipboard is untrusted */ }
    }
    this.pendingPaste = { trusted, mono: this.clock.mono() };
    this.active = null;
    this.log('paste', { trusted, from: view.state.selection.from, to: view.state.selection.to,
      hasHtml: Boolean(event.clipboardData?.getData('text/html')), textLength: event.clipboardData?.getData('text/plain')?.length ?? 0 });
    return false;
  }
  transformPasted(slice) {
    return sanitizeSlice(slice, this.allowed, Boolean(this.pendingPaste?.trusted));
  }
  append(transactions, oldState, newState) {
    if (this.composing) return null;
    const now = this.now();
    const changes = collectChanges(transactions);
    if (!changes.length) return null;
    const isHistory = transactions.some(tr => Boolean(tr.getMeta('history$')));
    if (isHistory) {
      this.active = null;
      this.pendingDeletion = null;
      this.log('history', {});
      return null;
    }
    const incomingPaste = transactions.some(tr => tr.getMeta('uiEvent') === 'paste');
    const isPaste = incomingPaste || Boolean(this.pendingPaste && now.mono - this.pendingPaste.mono < 1000);
    const trustedPaste = isPaste && Boolean(this.pendingPaste?.trusted);
    const tr = newState.tr;
    for (const change of changes) {
      const { from, to, oldFrom, oldTo } = change;
      const insertedText = newState.doc.textBetween(Math.max(0, from), Math.min(newState.doc.content.size, to), '\n');
      const deletedText = oldState.doc.textBetween(Math.max(0, oldFrom), Math.min(oldState.doc.content.size, oldTo), '\n');
      const oldAnchor = safeSource(markFromRange(oldState.doc, oldFrom, oldTo), this.allowed);
      const context = this.getContext(now.mono);
      const type = this.lastIntent && now.mono - this.lastIntent.mono < 1000 ? this.lastIntent.type : change.inputType || 'unknown';
      if (!insertedText.length) {
        if (deletedText.length > 0 && deletedText.length <= 3 && !hasWordBoundary(deletedText) && oldAnchor) {
          this.pendingDeletion = { pos: from, oldAnchor, at: now.mono, deletedText };
        } else this.pendingDeletion = null;
        this.active = null;
        this.log('delete', { at: from, deletedLength: deletedText.length, type });
        continue;
      }
      if (trustedPaste) {
        this.log('paste-preserved', { from, to, length: insertedText.length });
        continue;
      }
      const oldWord = wordBoundsInDoc(oldState.doc, oldFrom);
      const isSameWord = Boolean(oldWord && oldWord.word.length &&
        oldFrom >= oldWord.from && oldTo <= oldWord.to && !hasWordBoundary(insertedText));
      const recentBurst = Boolean(this.pendingDeletion && now.mono - this.pendingDeletion.at < 850
        && this.pendingDeletion.pos === from && !hasWordBoundary(insertedText));
      const stable = oldAnchor || (recentBurst ? this.pendingDeletion.oldAnchor : null);
      const isOldSelection = !this.active || oldFrom !== this.active.nextPos;
      const keepOld = shouldRetainWordAnchor({ oldAnchor: stable, sameWord: isSameWord || recentBurst,
        insertedText, deletedText: deletedText || (recentBurst ? this.pendingDeletion.deletedText : ''),
        inputType: type, isPaste, isHistory, isOldSelection, recentBackspaceBurst: recentBurst });
      const canGroup = shouldCoalesce(this.active, { monotonicMs: now.mono, from,
        insertedLength: insertedText.length, insertedText, contextEpoch: context.epoch,
        recordingId: context.recordingId, source: context.source, contextState: context.coverage,
        isPaste, isHistory, isNewIdea: false });
      let anchor;
      if (isPaste) anchor = this.newAnchor({ source: 'paste' }, now.epoch);
      else if (keepOld) anchor = stable;
      else if (canGroup) anchor = this.active.anchor;
      else anchor = this.newAnchor(context, now.epoch);
      // A valid source must match the explicitly allowed meeting recordings.
      const safe = safeSource(anchor, this.allowed) || this.newAnchor({ source: 'unlinked' }, now.epoch);
      tr.addMark(from, to, newState.schema.marks.timeSpan.create(safe));
      this.log('insert-anchored', { from, to, insertedLength: insertedText.length,
        deletedLength: deletedText.length, type, anchorId: safe.anchorId, source: safe.source,
        reused: keepOld || canGroup, paste: isPaste, heuristic: recentBurst ? 'backspace-insert' : undefined });
      this.pendingDeletion = null;
      this.active = isPaste || hasWordBoundary(insertedText) ? null : {
        anchor: safe, contextEpoch: context.epoch, contextState: context.coverage,
        startMonoMs: canGroup && this.active ? this.active.startMonoMs : now.mono,
        monotonicMs: now.mono, nextPos: to,
        charCount: canGroup && this.active ? this.active.charCount + insertedText.length : insertedText.length,
        closedByBoundary: false,
      };
    }
    this.pendingPaste = null;
    if (!tr.docChanged) return null;
    tr.setMeta('mochop:mark-applied', true);
    this.latencies.push(this.clock.mono() - now.mono);
    if (this.latencies.length > 50000) this.latencies.shift();
    const start = this.lastIntent?.mono;
    if (!isPaste && typeof requestAnimationFrame === 'function' && Number.isFinite(start)
      && now.mono - start < 1000) {
      requestAnimationFrame(() => {
        const ms = this.clock.mono() - start;
        this.inputPaintLatencies.push(ms);
        if (this.inputPaintLatencies.length > 50000) this.inputPaintLatencies.shift();
        this.log('input-paint-proxy', { durationMs: Math.round(ms * 100) / 100 });
      });
    }
    return tr;
  }
  snapshot(view) {
    const state = view?.state || this.view?.state;
    const json = state?.doc?.toJSON();
    if (!json) return null;
    const metrics = getJsonMetrics(json);
    const dom = (view || this.view)?.dom;
    metrics.domTimeSpanWrappers = dom?.querySelectorAll('[data-time-anchor-id]').length ?? null;
    metrics.domTextNodes = dom && typeof document !== 'undefined' ? (() => {
      const walker = document.createTreeWalker(dom, NodeFilter.SHOW_TEXT);
      let count = 0;
      while (walker.nextNode()) count += 1;
      return count;
    })() : null;
    metrics.p95AppendMs = p95(this.latencies);
    metrics.samples = this.latencies.length;
    metrics.p95InputToPaintMs = p95(this.inputPaintLatencies);
    metrics.paintSamples = this.inputPaintLatencies.length;
    return metrics;
  }
  exportTrace() {
    return { schemaVersion: 1, kind: 'ime-event-trace',
      // Trace deliberately does NOT export typed text, browser clipboard HTML or audio bytes.
      privacy: 'lengths-and-types-only',
      userAgent: typeof navigator === 'undefined' ? 'node' : navigator.userAgent,
      meetingId: this.meetingId, sampleCount: this.trace.length,
      metrics: this.snapshot(), events: this.trace };
  }
}

export function createTrackingExtension(tracker) {
  return Extension.create({
    name: 'mochopInputTracking',
    addProseMirrorPlugins() {
      return [new Plugin({
        key: trackerKey,
        view: view => { tracker.view = view; return { destroy() { if (tracker.view === view) tracker.view = null; } }; },
        props: {
          handleDOMEvents: {
            beforeinput: (view, event) => tracker.event('beforeinput', view, event),
            input: (view, event) => tracker.event('input', view, event),
            compositionstart: (view, event) => tracker.event('compositionstart', view, event),
            compositionupdate: (view, event) => tracker.event('compositionupdate', view, event),
            compositionend: (view, event) => tracker.event('compositionend', view, event),
            keydown: (view, event) => tracker.event('keydown', view, event),
            mousedown: () => { tracker.reset('pointer-selection'); return false; },
            copy: (view, event) => tracker.clipboard(view, event, false),
            cut: (view, event) => tracker.clipboard(view, event, true),
            paste: (view, event) => tracker.paste(view, event),
          },
          transformPasted: slice => tracker.transformPasted(slice),
        },
        appendTransaction: (transactions, oldState, newState) => tracker.append(transactions, oldState, newState),
      })];
    },
  });
}
