import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Exercise the ACTUAL InputTracker methods with deterministic ProseMirror-like
// transactions. The dependency stubs below are intentionally NOT a claim of
// running Tiptap or native browser/IME behavior.
const base = new URL('../src/', import.meta.url);
const policyUrl = new URL('policy.mjs', base).href;
const changesUrl = new URL('step-changes.mjs', base).href;
let source = fs.readFileSync(fileURLToPath(new URL('tracker.mjs', base)), 'utf8');
source = source.replace("import { Extension, Mark } from '@tiptap/core';", `
const Extension = { create: value => value };
const Mark = { create: value => value };
`);
source = source.replace("import { DOMSerializer, Fragment, Slice } from '@tiptap/pm/model';", `
class Fragment {
  constructor(content) { this.content = content; this.size = content.reduce((n, c) => n + c.nodeSize, 0); }
  static fromArray(content) { return new Fragment(content); }
}
class Slice { constructor(content, openStart, openEnd) { Object.assign(this, { content, openStart, openEnd }); } }
const DOMSerializer = { fromSchema: () => ({ serializeFragment: (fragment) => fragment }) };
export { Fragment, Slice };
`);
source = source.replace("import { Plugin, PluginKey } from '@tiptap/pm/state';", `
class Plugin { constructor(spec) { this.spec = spec; } }
class PluginKey { constructor(key) { this.key = key; } }
`);
source = source.replace("} from './policy.mjs';", `} from '${policyUrl}';`);
source = source.replace("import { collectTextChanges } from './step-changes.mjs';", `import { collectTextChanges } from '${changesUrl}';`);
const mod = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const { InputTracker, Fragment, Slice, readAnchorAtCursor } = mod;

class FakeNode {
  constructor(text, anchor = null) {
    this.text = text; this.marks = anchor ? [{ type: { name: 'timeSpan' }, attrs: anchor }] : [];
    this.content = { size: 0 }; this.isText = true; this.nodeSize = text.length;
  }
  copy(content) { const newNode = new FakeNode(this.text); newNode.content = content; newNode.marks = this.marks; return newNode; }
  mark(marks) { const node = this.copy(this.content); node.marks = marks; return node; }
}
class FakeDoc {
  constructor(parts) {
    this.parts = parts.map(x => new FakeNode(x.text, x.anchor));
    this.text = this.parts.map(n => n.text).join('');
    this.content = { size: this.text.length + 2 };
  }
  textBetween(from, to) { return this.text.slice(Math.max(0, from - 1), Math.max(0, to - 1)); }
  nodesBetween(from, to, fn) {
    let pos = 1;
    for (const node of this.parts) {
      if (pos < to && pos + node.nodeSize > from) fn(node, pos);
      pos += node.nodeSize;
    }
  }
  resolve(pos) {
    const at = Math.max(0, pos - 1);
    let offset = 0;
    let nodeBefore = null, nodeAfter = null;
    for (const node of this.parts) {
      if (offset < at && at <= offset + node.nodeSize) nodeBefore = node;
      if (offset <= at && at < offset + node.nodeSize && !nodeAfter) nodeAfter = node;
      offset += node.nodeSize;
    }
    return { nodeBefore, nodeAfter, start: () => 1,
      parent: { inlineContent: true, content: { size: this.text.length },
        textBetween: (from, to) => this.text.slice(from, to) },
    };
  }
}
class ReplaceMap {
  constructor(from, oldSize, newSize) { Object.assign(this, { from, oldSize, newSize }); }
  forEach(cb) { cb(this.from, this.from + this.oldSize, this.from, this.from + this.newSize); }
  map(pos, assoc = 1) {
    const end = this.from + this.oldSize;
    if (pos < this.from) return pos;
    if (pos > end) return pos + this.newSize - this.oldSize;
    if (pos === this.from && pos === end) return this.from + (assoc < 0 ? 0 : this.newSize);
    if (pos === this.from) return this.from;
    if (pos === end) return this.from + this.newSize;
    return this.from + (assoc < 0 ? 0 : this.newSize);
  }
  invert() { return new ReplaceMap(this.from, this.newSize, this.oldSize); }
}
class Mapping {
  constructor(maps) { this.maps = maps; }
  map(pos, assoc) { return this.maps.reduce((p, m) => m.map(p, assoc), pos); }
  slice(from = 0, to = this.maps.length) { return new Mapping(this.maps.slice(from, to)); }
  invert() { return new Mapping(this.maps.slice().reverse().map(m => m.invert())); }
}
function makeTransaction(from, oldSize, newSize) {
  const map = new ReplaceMap(from, oldSize, newSize);
  return { docChanged: true, mapping: new Mapping([map]), steps: [{ slice: {}, getMap: () => map }],
    getMeta: () => undefined,
  };
}
function makeNewState(doc) {
  const marks = [];
  const tr = { docChanged: false, marks,
    addMark(from, to, mark) { this.docChanged = true; marks.push({ from, to, mark }); return this; },
    setMeta() { return this; },
  };
  return { doc, tr, schema: { marks: { timeSpan: { create: attrs => ({ attrs }) } } } };
}
const baseEpoch = 1794750000000;
const anchorA = { anchorId: 'old-A', recordingId: 'rec-1', audioOffsetMs: 12000,
  typedAt: baseEpoch, source: 'live_recording', schemaVersion: 1 };
const anchorB = { ...anchorA, anchorId: 'old-B', audioOffsetMs: 14000 };
function newTracker(context = { source: 'live_recording', recordingId: 'rec-1', audioOffsetMs: 95000, coverage: 'valid', epoch: 1 }) {
  let mono = 1000;
  const tracker = new InputTracker({ meetingId: 'meet-1', recordingIds: ['rec-1'],
    getAudioContext: () => context,
    clock: { mono: () => mono, epoch: () => baseEpoch + mono },
  });
  return { tracker, advance(ms) { mono += ms; } };
}

// Editing a linked old word while the simulated recording has moved to 95 s.
test('TC04/TC05 adapter: same-word correction retains original 12 s, not current 95 s', () => {
  const { tracker } = newTracker();
  const oldDoc = new FakeDoc([{ text: 'truong', anchor: anchorA }]);
  const newDoc = new FakeDoc([{ text: 'trương', anchor: anchorA }]);
  const nextState = makeNewState(newDoc);
  const appended = tracker.append([makeTransaction(4, 1, 1)], { doc: oldDoc }, nextState);
  assert.equal(appended.marks.length, 1);
  assert.deepEqual(appended.marks[0].mark.attrs, anchorA);
});

test('TC06 adapter: insertion within one lexical word but across two marks gets a new anchor', () => {
  const { tracker } = newTracker();
  const oldDoc = new FakeDoc([{ text: 'tru', anchor: anchorA }, { text: 'ong', anchor: anchorB }]);
  const newDoc = new FakeDoc([{ text: 'trux' }, { text: 'ong', anchor: anchorB }]);
  const appended = tracker.append([makeTransaction(4, 0, 1)], { doc: oldDoc }, makeNewState(newDoc));
  assert.equal(appended.marks.length, 1);
  const created = appended.marks[0].mark.attrs;
  assert.notEqual(created.anchorId, anchorA.anchorId);
  assert.notEqual(created.anchorId, anchorB.anchorId);
  assert.equal(created.audioOffsetMs, 95000);
});

test('TC06 adapter: replacement of a selection across two anchors never steals first provenance', () => {
  const { tracker } = newTracker();
  const oldDoc = new FakeDoc([{ text: 'ab', anchor: anchorA }, { text: 'cd', anchor: anchorB }]);
  const newDoc = new FakeDoc([{ text: 'aX' }, { text: 'd', anchor: anchorB }]);
  const appended = tracker.append([makeTransaction(2, 2, 1)], { doc: oldDoc }, makeNewState(newDoc));
  assert.equal(appended.marks.length, 1);
  assert.notEqual(appended.marks[0].mark.attrs.anchorId, anchorA.anchorId);
  assert.notEqual(appended.marks[0].mark.attrs.anchorId, anchorB.anchorId);
});

function dataTransfer() {
  const values = new Map();
  return { getData: type => values.get(type) || '', setData: (type, value) => values.set(type, value) };
}
function copiedView() {
  const node = new FakeNode('abc', anchorA);
  const selection = { empty: false, from: 1, to: 4,
    content: () => new Slice(Fragment.fromArray([node]), 0, 0) };
  return { state: { selection, schema: {}, doc: new FakeDoc([{ text: 'abc', anchor: anchorA }]) } };
}
function fakeDocument() {
  globalThis.document = { createElement: () => ({ appendChild() {}, innerHTML: '<span>abc</span>' }) };
}

test('TC07 adapter: same-session clipboard uses immutable local Slice, not modified HTML', () => {
  fakeDocument();
  const { tracker } = newTracker();
  const data = dataTransfer();
  const view = copiedView();
  assert.equal(tracker.clipboard(view, { clipboardData: data, preventDefault() {} }), true);
  data.setData('text/html', '<span data-time-anchor-id="foreign">malicious</span>');
  tracker.paste(view, { clipboardData: data });
  const attacker = new Slice(Fragment.fromArray([new FakeNode('evil', anchorB)]), 0, 0);
  const selected = tracker.transformPasted(attacker);
  assert.equal(selected.content.content[0].text, 'abc');
  assert.deepEqual(selected.content.content[0].marks[0].attrs, anchorA);
});

test('TC10 adapter: changed plain text fails trust and strips injected timeSpan', () => {
  fakeDocument();
  const { tracker } = newTracker();
  const data = dataTransfer();
  const view = copiedView();
  assert.equal(tracker.clipboard(view, { clipboardData: data, preventDefault() {} }), true);
  data.setData('text/plain', 'evil');
  tracker.paste(view, { clipboardData: data });
  const attacker = new Slice(Fragment.fromArray([new FakeNode('evil', anchorB)]), 0, 0);
  const selected = tracker.transformPasted(attacker);
  assert.equal(selected.content.content[0].text, 'evil');
  assert.equal(selected.content.content[0].marks.length, 0);
});

test('TC07/TC10 adapter: cursor reading refuses foreign/invalid source when allow-list supplied', () => {
  const foreign = { ...anchorA, recordingId: 'foreign-rec' };
  const doc = new FakeDoc([{ text: 'abc', anchor: foreign }]);
  const state = { doc, selection: { empty: true, $from: doc.resolve(2) } };
  assert.equal(readAnchorAtCursor(state, new Set(['rec-1'])).status, 'unlinked');
  assert.equal(readAnchorAtCursor(state, new Set(['foreign-rec'])).status, 'linked');
});

test('TC10 adapter: paste pending state cannot relabel a subsequent non-paste keystroke', () => {
  fakeDocument();
  const { tracker } = newTracker();
  const view = copiedView();
  const data = dataTransfer();
  tracker.clipboard(view, { clipboardData: data, preventDefault() {} });
  tracker.paste(view, { clipboardData: data });
  assert.equal(tracker.pendingPaste.trusted, true);
  tracker.event('beforeinput', view, { inputType: 'insertText', data: 'x' });
  assert.equal(tracker.pendingPaste, null);
});


test('TC22/TC10: caret exactly at linked/unlinked boundary never plays adjacent audio', () => {
  const doc = new FakeDoc([{ text: 'abc', anchor: anchorA }, { text: 'de', anchor: null }]);
  const state = { doc, selection: { empty: true, $from: doc.resolve(4) } };
  const result = readAnchorAtCursor(state, new Set(['rec-1']));
  assert.equal(result.status, 'ambiguous');
  assert.deepEqual(result.left, anchorA);
  assert.equal(result.right, null);
  // At a genuine document edge, there is no competing text source.
  state.selection.$from = doc.resolve(1);
  assert.equal(readAnchorAtCursor(state, new Set(['rec-1'])).status, 'linked');
});

test('TC22: caret at unlinked/linked boundary or foreign-invalid source is ambiguous', () => {
  const foreign = { ...anchorA, recordingId: 'foreign-rec' };
  const docs = [
    new FakeDoc([{ text: 'ab', anchor: null }, { text: 'cd', anchor: anchorA }]),
    new FakeDoc([{ text: 'ab', anchor: anchorA }, { text: 'cd', anchor: foreign }]),
  ];
  for (const doc of docs) {
    assert.equal(readAnchorAtCursor({ doc, selection: { empty: true, $from: doc.resolve(3) } }, new Set(['rec-1'])).status, 'ambiguous');
  }
  const both = new FakeDoc([{ text: 'ab', anchor: anchorA }, { text: 'cd', anchor: anchorA }]);
  assert.equal(readAnchorAtCursor({ doc: both, selection: { empty: true, $from: both.resolve(3) } }, new Set(['rec-1'])).status, 'linked');
});

test('TC07: OS clipboard HTML strips audio metadata while in-session move retains immutable Slice', () => {
  let exportedFragment = null;
  globalThis.document = { createElement: () => ({
    appendChild(fragment) { exportedFragment = fragment; },
    get innerHTML() { return '<em>abc</em>'; },
  }) };
  const { tracker } = newTracker();
  const data = dataTransfer();
  const view = copiedView();
  assert.equal(tracker.clipboard(view, { clipboardData: data, preventDefault() {} }), true);
  assert.equal(exportedFragment.content[0].marks.length, 0, 'OS HTML fragment must have no timeSpan');
  assert.equal(data.getData('text/html'), '<em>abc</em>');
  assert.equal(data.getData('text/plain'), 'abc');
  assert.ok(data.getData('application/x-mochop-slice+json'));
  tracker.paste(view, { clipboardData: data });
  const originalSlice = tracker.transformPasted(new Slice(Fragment.fromArray([]), 0, 0));
  assert.deepEqual(originalSlice.content.content[0].marks[0].attrs, anchorA, 'trusted same-session paste still retains audio provenance');
});

test('TC08: Undo/Redo metadata does not cause automatic re-anchoring', () => {
  const { tracker } = newTracker();
  const oldDoc = new FakeDoc([{ text: 'truong', anchor: anchorA }]);
  const newDoc = new FakeDoc([{ text: 'trương', anchor: anchorA }]);
  const tx = makeTransaction(4, 1, 1);
  tx.getMeta = key => key === 'history$' ? { redo: false } : undefined;
  tracker.active = { anchor: anchorA, contextEpoch: 1, contextState: 'valid',
    startMonoMs: 900, monotonicMs: 900, nextPos: 4, charCount: 3 };
  tracker.pendingDeletion = { pos: 4, oldAnchor: anchorA, at: 999, deletedText: 'a' };
  tracker.pendingPaste = { trusted: true, mono: 999 };
  tracker.lastIntent = { type: 'insertText', mono: 999, epoch: baseEpoch + 999 };
  const appended = tracker.append([tx], { doc: oldDoc }, makeNewState(newDoc));
  assert.equal(appended, null);
  assert.equal(tracker.trace.at(-1)?.kind, 'history');
  assert.equal(tracker.active, null);
  assert.equal(tracker.pendingDeletion, null);
  assert.equal(tracker.pendingPaste, null);
  assert.equal(tracker.lastIntent, null);
  // Typing AFTER Undo must use the current audio context, never stale active marks.
  const postHistory = tracker.append([makeTransaction(4, 0, 1)],
    { doc: new FakeDoc([{ text: 'abc', anchor: anchorA }]) },
    makeNewState(new FakeDoc([{ text: 'abc', anchor: anchorA }, { text: 'x' }])));
  assert.equal(postHistory.marks.length, 1);
  assert.notEqual(postHistory.marks[0].mark.attrs.anchorId, anchorA.anchorId);
  assert.equal(postHistory.marks[0].mark.attrs.audioOffsetMs, 95000);
});
