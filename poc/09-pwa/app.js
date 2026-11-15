import { MeetingLease, makeChannel, withMaintenanceLock } from './lease.js';
import { ensureFixture, readFixture, editableText, saveEditableText, migrateFixture } from './db.js';

const APP_VERSION = 'v1'; // TEST_UPGRADE_MARKER
const SCHEMA_VERSION = APP_VERSION === 'v2' ? 2 : 1;
const query = new URLSearchParams(location.search);
const candidate = query.get('meeting') || 'meeting-poc09-01';
const meetingId = /^[a-zA-Z0-9_-]{1,64}$/.test(candidate) ? candidate : 'meeting-poc09-01';
const element = testid => document.querySelector(`[data-testid="${testid}"]`);
const lease = new MeetingLease((type) => {
  channel.post('writer-' + type);
  log('Writer ' + type);
  render();
});
const channel = makeChannel(meetingId, async event => {
  log('Other tab: ' + event.type);
  if (!lease.held && event.type === 'saved') await refreshFixture();
  if (event.type === 'writer-released' && migrationBlocked && APP_VERSION === 'v2') await migrate();
  if (!lease.held) render();
});

let fixture = null;
let releaseLease = null;
let registration = null;
let recording = false;
export function isRecording() { return recording; }
let bytesWritten = 0;
let tickNumber = 0;
let ticker = null;
let tickPromise = null;
let worker = null;
let workerSequence = 0;
const workerPending = new Map();
let saveTimer = null;
let saving = false;
let migrationBlocked = false;
let migrationError = null;

function log(message) {
  const li = document.createElement('li');
  li.textContent = new Date().toLocaleTimeString() + ' ' + message;
  element('log').prepend(li);
  while (element('log').childElementCount > 40) element('log').lastElementChild.remove();
}
function message(id, value) { element(id).textContent = value; }
function showNetwork() { message('network', navigator.onLine ? 'Online' : 'Offline'); }
function render() {
  const hasWrite = lease.held && fixture?.document?.schemaVersion === SCHEMA_VERSION;
  message('lease-status', lease.held ? 'WRITER (exclusive)' : 'READ ONLY / no writer lease');
  message('recording-status', recording ? 'Simulated recording active; no real microphone captured' : 'Fixture idle');
  if (fixture && !migrationError && !migrationBlocked) message('schema-status', `Meeting schema ${fixture.meeting.schemaVersion}; document schema ${fixture.document.schemaVersion}; revision ${fixture.document.revision}` + (fixture.snapshot ? '; original v1 snapshot retained' : ''));
  if (migrationBlocked) message('schema-status', 'Migration postponed: another tab holds a writer/recording lease');
  if (migrationError) message('schema-status', 'Migration FAILED: ' + migrationError);
  element('acquire').disabled = lease.held || migrationBlocked;
  element('release').disabled = !lease.held;
  element('start').disabled = !hasWrite || recording;
  element('stop').disabled = !recording;
  element('notes').disabled = !hasWrite;
  element('migrate').disabled = lease.held || recording;
  element('activate').disabled = !registration?.waiting;
}
async function refreshFixture() {
  fixture = await readFixture(meetingId);
  if (!lease.held) element('notes').value = editableText(fixture?.document);
  render();
}
function initWorker() {
  if (!window.Worker) throw new Error('Worker unavailable');
  worker = new Worker(new URL('./opfs-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = event => {
    const { requestId, ok, bytes, error } = event.data || {};
    const pending = workerPending.get(requestId);
    if (!pending) return;
    workerPending.delete(requestId);
    if (ok) pending.resolve(bytes);
    else pending.reject(new Error(error));
  };
  worker.onerror = event => {
    for (const pending of workerPending.values()) pending.reject(new Error(event.message || 'OPFS worker failed'));
    workerPending.clear();
  };
}
function workerCall(action, payload) {
  const requestId = ++workerSequence;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      workerPending.delete(requestId);
      reject(new Error('Worker ACK timeout; no durability confirmation'));
    }, 10000);
    workerPending.set(requestId, { resolve: value => { clearTimeout(timeout); resolve(value); }, reject: error => { clearTimeout(timeout); reject(error); } });
    const transfer = payload instanceof ArrayBuffer ? [payload] : [];
    worker.postMessage({ requestId, meetingId, action, payload }, transfer);
  });
}
async function checkOpfs() {
  try {
    bytesWritten = await workerCall('stat');
    message('opfs-status', `OPFS fixture: ${bytesWritten} confirmed bytes`);
  } catch (error) {
    message('opfs-status', 'OPFS error: ' + error.message);
    log('OPFS unavailable: ' + error.message);
  }
}
async function appendFixtureTick() {
  const buffer = new Uint8Array(64);
  for (let i = 0; i < buffer.length; i++) buffer[i] = (tickNumber + i) % 256;
  tickNumber += 1;
  const bytes = await workerCall('append', buffer.buffer);
  bytesWritten = bytes; // Only the worker's durable flush ACK is treated as committed.
  message('opfs-status', `OPFS fixture: ${bytes} confirmed bytes`);
  return bytes;
}
function scheduleTick() {
  if (!recording || tickPromise) return;
  tickPromise = appendFixtureTick().catch(error => {
    log('OPFS write FAILED: ' + error.message);
    message('opfs-status', 'Write not confirmed: ' + error.message);
    recording = false;
    clearInterval(ticker);
    channel.post('recording-error');
    render();
  }).finally(() => { tickPromise = null; });
}
async function startRecording() {
  if (!lease.held || recording || fixture?.document?.schemaVersion !== SCHEMA_VERSION) return;
  try {
    await appendFixtureTick(); // First durable ACK before reporting recording.
    recording = true;
    ticker = setInterval(scheduleTick, 250);
    channel.post('recording-started');
    log('Simulated recording started; OPFS bytes confirmed');
  } catch (error) {
    log('Recording refused: ' + error.message);
    message('opfs-status', 'Write not confirmed: ' + error.message);
  }
  render();
}
async function stopRecording() {
  if (!recording && !tickPromise) return;
  recording = false;
  clearInterval(ticker);
  if (tickPromise) await tickPromise;
  channel.post('recording-stopped');
  log('Simulated recording stopped; committed bytes=' + bytesWritten);
  render();
}
async function acquireWriter() {
  try {
    if (migrationBlocked && APP_VERSION === 'v2') {
      log('Migration must finish before writing');
      return;
    }
    const current = await readFixture(meetingId);
    if (current.document.schemaVersion !== SCHEMA_VERSION || current.meeting.schemaVersion !== SCHEMA_VERSION) {
      log('Schema mismatch: this app version cannot write newer data');
      message('save-status', 'Read-only: schema mismatch; reload latest app');
      return;
    }
    const release = await lease.acquire(meetingId);
    if (!release) { message('save-status', 'Other tab owns the writer lease'); log('Writer denied by Web Locks'); return; }
    releaseLease = release;
    fixture = await readFixture(meetingId);
    if (fixture.meeting.schemaVersion !== SCHEMA_VERSION || fixture.document.schemaVersion !== SCHEMA_VERSION) {
      await lease.release();
      releaseLease = null;
      message('save-status', 'Read-only: schema changed while obtaining lease');
      render();
      return;
    }
    element('notes').value = editableText(fixture.document);
    message('save-status', 'Ready; current revision ' + fixture.document.revision);
    render();
  } catch (error) { log('Acquire failed: ' + error.message); message('save-status', error.message); }
}
async function releaseWriter() {
  if (!lease.held) return;
  await stopRecording();
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  await persistNote();
  if (releaseLease) await releaseLease();
  releaseLease = null;
  await refreshFixture();
  render();
}
async function persistNote() {
  if (saving || !lease.held || !fixture?.document) return;
  const text = element('notes').value;
  if (text === editableText(fixture.document)) return;
  saving = true;
  message('save-status', 'Saving (not yet confirmed)...');
  let nonRetryable = false;
  try {
    const updated = await saveEditableText(meetingId, text, fixture.document.revision, SCHEMA_VERSION);
    fixture.document = updated;
    message('save-status', 'Saved revision ' + updated.revision + ' (IndexedDB commit ACK)');
    channel.post('saved', { revision: updated.revision });
    log('Saved revision ' + updated.revision);
  } catch (error) {
    message('save-status', 'NOT SAVED: ' + error.message);
    log('Save failed: ' + error.message);
    nonRetryable = /Revision conflict|Schema mismatch/.test(error.message);
  } finally {
    saving = false;
    if (!nonRetryable && lease.held && element('notes').value !== editableText(fixture.document)) {
      // Allow recovery after a transient error, without claiming a failed write succeeded.
      clearTimeout(saveTimer);
      saveTimer = setTimeout(persistNote, 700);
    }
  }
  render();
}
async function migrate() {
  if (lease.held) { log('Release the writer before migration'); return; }
  migrationError = null;
  message('schema-status', 'Migration: requesting exclusive maintenance lock...');
  try {
    const { acquired, value, reason } = await withMaintenanceLock(() => migrateFixture(meetingId));
    if (!acquired) {
      migrationBlocked = true;
      log('Migration postponed: ' + reason);
      message('schema-status', 'Migration postponed: ' + reason);
      return;
    }
    migrationBlocked = false;
    migrationError = null;
    log(value.changed ? 'Migration v1 -> v2 committed atomically; v1 snapshot preserved' : 'No migration needed');
    await refreshFixture();
    if (APP_VERSION === 'v1' && value.changed) message('save-status', 'Schema v2: reload the updated app before writing');
  } catch (error) { migrationError = error.message; log('Migration FAILED: ' + error.message); message('schema-status', 'Migration FAILED: ' + error.message); }
  finally { render(); }
}
function describeSW() {
  if (!registration) return;
  if (registration.waiting) {
    message('update-status', 'Update WAITING. No automatic activation or reload.');
  } else if (!navigator.serviceWorker.controller) {
    message('update-status', 'First install complete. Reload once to control the page.');
  } else {
    message('update-status', 'Service Worker active. Check for newer version to update.');
  }
  render();
}
async function initSW() {
  if (!('serviceWorker' in navigator)) { message('update-status', 'Service Worker unavailable'); return; }
  try {
    registration = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (installing) installing.addEventListener('statechange', () => {
        log('Service Worker state: ' + installing.state);
        describeSW();
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      log('Controller changed, NO automatic reload');
      message('update-status', 'New worker controls this tab. Reload intentionally when safe.');
      render();
    });
    await navigator.serviceWorker.ready;
    describeSW();
  } catch (error) { message('update-status', 'Service Worker error: ' + error.message); log('SW registration failed: ' + error.message); }
}
async function checkForUpdate() {
  if (!registration) return;
  try { await registration.update(); describeSW(); }
  catch (error) { message('update-status', 'Update check failed: ' + error.message); }
}
async function activateWaiting() {
  if (isRecording()) { message('update-status', 'BLOCKED: recording active in this tab'); log('Activation refused during recording'); return; }
  if (!registration?.waiting) { describeSW(); return; }
  try {
    const result = await withMaintenanceLock(async () => {
      const waiting = registration.waiting;
      if (!waiting) return false;
      let resolveChanged;
      const changed = new Promise(resolve => { resolveChanged = resolve; });
      const onChange = () => resolveChanged(true);
      navigator.serviceWorker.addEventListener('controllerchange', onChange, { once: true });
      const timeout = setTimeout(() => resolveChanged(false), 10000);
      waiting.postMessage({ type: 'ACTIVATE_AFTER_EXCLUSIVE_GATE' });
      const ok = await changed;
      clearTimeout(timeout);
      if (!ok) navigator.serviceWorker.removeEventListener('controllerchange', onChange);
      return ok;
    });
    if (!result.acquired) { message('update-status', 'BLOCKED: another tab holds a writer/recording lock'); log('Activation blocked by exclusive maintenance gate'); }
    else if (result.value) { message('update-status', 'Update ACTIVATED; no reload was forced. Reload only when safe.'); log('New SW activated, no automatic reload'); }
    else { message('update-status', 'Activation not confirmed; no reload'); log('SW activation timeout'); }
  } catch (error) { message('update-status', 'Activation failed: ' + error.message); log('SW activation failed: ' + error.message); }
  render();
}

async function boot() {
  message('version', APP_VERSION);
  message('meeting-id', meetingId);
  message('isolation', 'crossOriginIsolated=' + String(globalThis.crossOriginIsolated));
  showNetwork();
  addEventListener('online', showNetwork);
  addEventListener('offline', showNetwork);
  addEventListener('beforeunload', event => {
    const unsaved = lease.held && (saving || element('notes').value !== editableText(fixture?.document));
    if (recording || unsaved) { event.preventDefault(); event.returnValue = ''; }
  });
  addEventListener('pagehide', () => {
    clearInterval(ticker);
    if (lease.held) lease.release();
    channel.close();
    worker?.terminate();
  });
  element('acquire').addEventListener('click', acquireWriter);
  element('release').addEventListener('click', releaseWriter);
  element('start').addEventListener('click', startRecording);
  element('stop').addEventListener('click', stopRecording);
  element('migrate').addEventListener('click', migrate);
  element('check-update').addEventListener('click', checkForUpdate);
  element('activate').addEventListener('click', activateWaiting);
  element('reload').addEventListener('click', () => {
    if (recording) { message('update-status', 'BLOCKED: stop recording before intentional reload'); return; }
    if (lease.held) { message('update-status', 'BLOCKED: release writer before intentional reload'); return; }
    location.reload();
  });
  element('notes').addEventListener('input', () => {
    message('save-status', 'Unsaved changes (waiting for confirmed commit)');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistNote, 150);
  });
  try {
    fixture = await ensureFixture(meetingId);
    element('notes').value = editableText(fixture.document);
    initWorker();
    await checkOpfs();
    if (APP_VERSION === 'v2' && fixture.document.schemaVersion === 1) {
      await migrate(); // Only proceeds if every active writer has released the shared gate.
    }
    message('save-status', 'Loaded revision ' + fixture.document.revision + '; read-only until lease acquired');
    render();
    await initSW();
    log('Boot completed (' + APP_VERSION + '), no automatic writer takeover');
  } catch (error) {
    log('Initialization FAILED: ' + error.message);
    message('save-status', 'Initialization failed: ' + error.message);
  }
}
boot();
