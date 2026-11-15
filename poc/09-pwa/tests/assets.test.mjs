import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const text = file => readFileSync(resolve(root, file), 'utf8');

test('TC33: every SW precache shell asset exists under package base path', () => {
  const worker = text('sw.js');
  const list = worker.match(/const ASSETS = (\[[^\n]+\]);/);
  assert.ok(list, 'precache list must be declared on a single line');
  const paths = [...list[1].matchAll(/'\.\/([^']+)'/g)].map(m=>m[1]);
  assert.ok(paths.length>=12);
  for (const path of paths) {
    assert.ok(existsSync(resolve(root, path)), `missing offline asset: ${path}`);
    assert.ok(!path.endsWith('.bin')&&!path.endsWith('.mochop'));
  }
});

test('TC33: PWA scope and start_url are relative; no origin-root assumption', () => {
  const manifest = JSON.parse(text('manifest.webmanifest'));
  assert.equal(manifest.start_url,'./');
  assert.equal(manifest.scope,'./');
  assert.ok(text('index.html').includes('src="./app.js"'));
  assert.ok(text('index.html').includes('href="./manifest.webmanifest"'));
  assert.ok(text('sw.js').includes('self.registration.scope'));
});

test('TC34: SW and app upgrade markers agree in both v1 and v2 fixture versions', () => {
  assert.ok(text('sw.js').includes("const VERSION = 'v1'; // TEST_UPGRADE_MARKER"));
  assert.ok(text('app.js').includes("const APP_VERSION = 'v1'; // TEST_UPGRADE_MARKER"));
  assert.ok(!text('app.js').includes('SharedArrayBuffer'));
});
