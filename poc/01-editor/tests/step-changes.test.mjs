import test from 'node:test';
import assert from 'node:assert/strict';
import { collectTextChanges } from '../src/step-changes.mjs';

// In-memory mock of StepMap/Mapping's coordinate semantics for one contiguous
// replacement. This exercises our adapter independently of any other worker.
class ReplaceMap {
  constructor(from, oldSize, newSize) {
    this.from = from; this.oldSize = oldSize; this.newSize = newSize;
  }
  forEach(callback) {
    callback(this.from, this.from + this.oldSize, this.from, this.from + this.newSize);
  }
  map(pos, assoc = 1) {
    const { from, oldSize, newSize } = this;
    const end = from + oldSize;
    if (pos < from) return pos;
    if (pos > end) return pos + newSize - oldSize;
    if (pos === from && pos === end) return from + (assoc < 0 ? 0 : newSize);
    if (pos === from) return from;
    if (pos === end) return from + newSize;
    return from + (assoc < 0 ? 0 : newSize);
  }
  invert() { return new ReplaceMap(this.from, this.newSize, this.oldSize); }
}
class Mapping {
  constructor(maps) { this.maps = maps; }
  map(pos, assoc = 1) { return this.maps.reduce((p, m) => m.map(p, assoc), pos); }
  slice(start = 0, end = this.maps.length) { return new Mapping(this.maps.slice(start, end)); }
  invert() { return new Mapping(this.maps.slice().reverse().map(m => m.invert())); }
}
function makeTr(maps, { history = false, markApplied = false, format = false } = {}) {
  const mapping = new Mapping(maps);
  return { docChanged: true, mapping,
    steps: maps.map(m => format ? { getMap: () => m } : { slice: {}, getMap: () => m }),
    getMeta: key => key === 'history$' ? history : key === 'mochop:mark-applied' && markApplied,
  };
}

test('TC05/TC06 step mapping: single insert keeps oldState base position', () => {
  const result = collectTextChanges([makeTr([new ReplaceMap(4, 0, 3)])]);
  assert.equal(result.length, 1);
  assert.deepEqual([result[0].oldFrom, result[0].oldTo], [4, 4]);
  assert.deepEqual([result[0].from, result[0].to], [4, 7]);
});

test('TC05/TC06 step mapping: second step old coordinates invert previous step', () => {
  const result = collectTextChanges([makeTr([
    new ReplaceMap(1, 0, 2), new ReplaceMap(8, 1, 2),
  ])]);
  assert.equal(result.length, 2);
  assert.deepEqual([result[1].oldFrom, result[1].oldTo], [6, 7]);
  assert.deepEqual([result[1].from, result[1].to], [8, 10]);
});

test('TC05/TC06 step mapping: invert preceding transactions, not just StepMap', () => {
  const result = collectTextChanges([
    makeTr([new ReplaceMap(1, 0, 2)]),
    makeTr([new ReplaceMap(8, 1, 2)]),
  ]);
  assert.equal(result.length, 2);
  assert.deepEqual([result[1].oldFrom, result[1].oldTo], [6, 7]);
  assert.deepEqual([result[1].from, result[1].to], [8, 10]);
});

test('TC08/TC09: history and mark-only steps are not treated as new input', () => {
  const map = new ReplaceMap(3, 1, 2);
  assert.deepEqual(collectTextChanges([makeTr([map], { history: true })]), []);
  assert.deepEqual(collectTextChanges([makeTr([map], { markApplied: true })]), []);
  assert.deepEqual(collectTextChanges([makeTr([map], { format: true })]), []);
});

test('TC04: delete-and-insert both retain original selection coordinates', () => {
  const result = collectTextChanges([makeTr([
    new ReplaceMap(3, 1, 0), new ReplaceMap(3, 0, 1),
  ])]);
  assert.equal(result.length, 2);
  assert.deepEqual([result[0].oldFrom, result[0].oldTo], [3, 4]);
  assert.deepEqual([result[1].oldFrom, result[1].oldTo], [3, 4]);
});
