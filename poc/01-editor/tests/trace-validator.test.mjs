import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/check-trace.mjs', import.meta.url));
const good = {
  schemaVersion: 1, privacy: 'lengths-and-types-only', kind: 'ime-event-trace', sampleCount: 4,
  testEnvironment: { os: 'Windows build test fixture', browser: 'Chrome test fixture', ime: 'UniKey',
    imeVersion: 'test only', inputMode: 'Telex', scenario: 'synthetic' },
  summary: { firstAnchorId: 'a', lastAnchorId: 'a', uniqueAnchorCount: 1 },
  events: [
    { seq: 1, kind: 'beforeinput', monoMs: 1000, inputType: 'insertText', dataLength: 1 },
    { seq: 2, kind: 'keydown', monoMs: 1001, key: '[printable]' },
    { seq: 3, kind: 'input', monoMs: 1002, inputType: 'insertText', dataLength: 1 },
    { seq: 4, kind: 'insert-anchored', monoMs: 1004, anchorId: 'a', source: 'unlinked', insertedLength: 1 },
  ],
};
function check(value) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mochop-trace-fixture-'));
  try {
    const file = path.join(directory, 'trace.json');
    fs.writeFileSync(file, JSON.stringify(value));
    const proc = spawnSync(process.execPath, [script, file], { encoding: 'utf8' });
    return { code: proc.status, log: `${proc.stdout}\n${proc.stderr}` };
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

test('TC03 trace validator: accepts structural fixture WITHOUT certifying Windows IME', () => {
  const result = check(good);
  assert.equal(result.code, 0, result.log);
  assert.match(result.log, /not evidence of native IME/);
});
test('TC03 trace validator: rejects raw key and invented event payload', () => {
  const copy = structuredClone(good);
  copy.events[1].key = 'ư';
  assert.equal(check(copy).code, 1);
  const unexpected = structuredClone(good);
  unexpected.events[3].typedText = 'sensitive';
  assert.equal(check(unexpected).code, 1);
});
test('TC03 trace validator: rejects faked anchor count, stale sample count', () => {
  const a = structuredClone(good);
  a.summary.uniqueAnchorCount = 3;
  assert.equal(check(a).code, 1);
  const b = structuredClone(good);
  b.sampleCount = 5;
  assert.equal(check(b).code, 1);
});
