import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const code = readFileSync(new URL('../opfs-worker.js', import.meta.url), 'utf8');

function workerMock(failShortWrite = false) {
  const files = new Map();
  let lastMessage;
  const directory = {
    async getDirectoryHandle(name) {
      assert.equal(name, 'poc09-fixture');
      return {
        async getFileHandle(file, opts) {
          if (!files.has(file) && opts.create) files.set(file, []);
          if (!files.has(file)) { const err = new Error('not found'); err.name = 'NotFoundError'; throw err; }
          return {
            async getFile() { return { size: files.get(file).length }; },
            async createSyncAccessHandle() {
              return {
                getSize() { return files.get(file).length; },
                write(bytes, { at }) {
                  assert.equal(at, files.get(file).length);
                  files.get(file).push(...bytes);
                  return failShortWrite ? bytes.length - 1 : bytes.length;
                },
                flush() {}, close() {}
              };
            }
          };
        }
      };
    }
  };
  const self = { postMessage(message) { lastMessage = message; } };
  const navigator = { storage: { async getDirectory() { return directory; } } };
  vm.runInNewContext(code, { self, navigator, Uint8Array, Error });
  return {
    async call(action, meetingId, payload) {
      await self.onmessage({ data: { requestId: 5, action, meetingId, payload } });
      return lastMessage;
    }, files
  };
}

test('Worker/OPFS: ACK only after complete append and flush, restore byte count', async () => {
  const worker = workerMock();
  let result = await worker.call('stat', 'm01');
  assert.equal(result.ok, true);
  assert.equal(result.bytes, 0);
  result = await worker.call('append', 'm01', new Uint8Array([1, 2, 3]).buffer);
  assert.equal(result.ok, true);
  assert.equal(result.bytes, 3);
  result = await worker.call('append', 'm01', new Uint8Array([4, 5]).buffer);
  assert.equal(result.bytes, 5);
  result = await worker.call('stat', 'm01');
  assert.equal(result.bytes, 5);
  assert.deepEqual(worker.files.get('m01.bin'), [1, 2, 3, 4, 5]);
});

test('Worker/OPFS negative: short write yields NO committed ACK', async () => {
  const worker = workerMock(true);
  const result = await worker.call('append', 'm02', new Uint8Array([8, 9]).buffer);
  assert.equal(result.ok, false);
  assert.match(result.error, /Partial OPFS write/);
  const invalid = await worker.call('append', '../escape', new Uint8Array([1]).buffer);
  assert.equal(invalid.ok, false);
  assert.match(invalid.error, /Invalid meeting ID/);
});
