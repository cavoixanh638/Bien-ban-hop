import { MeetingLease, makeChannel, withMaintenanceLock } from './lease.js';
import { ensureFixture, readFixture, editableText, saveEditableText, migrateFixture } from './db.js';
import { RecordingSession } from './recording-session.js';
import { AutosaveSession } from './autosave-session.js';
import { MaintenanceRetry } from './maintenance-retry.js';

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
  if (!lease.held) render();
}, event => {
  // Other meetings also share the global maintenance lock.
  if (migrationBlocked && APP_VERSION === 'v2') scheduleMigrationRetry(event.meetingId);
});

let fixture = null;
let releaseLease = null;
let registration = null;
let recordingSession;
export function isRecording() { return recordingSession?.busy || false; }
let bytesWritten = 0;
let tickNumber = 0;
let releasing = false;
let worker = null;
let workerSequence = 0;
const workerPending = new Map();
let saveTimer = null;
let saveSession;
let migrationAttempt = null;
let migrationRetry;
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
  message('recording-status', recordingSession?.phase === 'active'
    ? 'Simulated recording active; no real microphone captured'
    : `Fixture ${recordingSession?.phase ?? 'idle'}`);
  if (fixture && !migrationError && !migrationBlocked) message('schema-status', `Meeting schema ${fixture.meeting.schemaVersion}; document schema ${fixture.document.schemaVersion}; revision ${fixture.document.revision}` + (fixture.snapshot ? '; original v1 snapshot retained' : ''));
  if (migrationBlocked) message('schema-status', 'Migration postponed: another tab holds a writer/recording lease');
  if (migrationError) message('schema-status', 'Migration FAILED: ' + migrationError);
  element('acquire').disabled = lease.held || migrationBlocked || releasing;
  element('release').disabled = !lease.held || releasing;
  element('start').disabled = !hasWrite || isRecording() || releasing;
  element('stop').disabled = !isRecording() || releasing;
  element('notes').disabled = !hasWrite || releasing;
  element('migrate').disabled = lease.held || isRecording() || !!migrationAttempt;
  element('retry-migration').hidden = !migrationBlocked;
  element('retry-migration').disabled = !!migrationAttempt || lease.held;
  element('activate').disabled = !registration?.waiting || lease.held || isRecording() || releasing;
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
    const { requestId, ok, bytes, error, indeterminate } = event.data || {};
    const pending = workerPending.get(requestId);
    if (!pending) return;
    workerPending.delete(requestId);
    if (ok) pending.resolve(bytes);
    else {
      const failure = new Error(error || 'Worker NACK');
      failure.indeterminate = Boolean(indeterminate);
      pending.reject(failure);
    }
  };
  worker.onerror = event => {
    for (const pending of workerPending.values()) {
      const error = new Error(event.message || 'OPFS Worker failed; outcome unknown');
      error.indeterminate = true;
      pending.reject(error);
    }
    workerPending.clear();
  };
}
function workerCall(action, payload) {
  const requestId = ++workerSequence;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      workerPending.delete(requestId);
      const error = new Error('Worker ACK timeout; OPFS write outcome unknown');
      error.indeterminate = true;
      reject(error);
    }, 10000);
    workerPending.set(requestId, { resolve: value => { clearTimeout(timeout); resolve(value); }, reject: error => { clearTimeout(timeout); reject(error); } });
    const transfer = payload instanceof ArrayBuffer ? [payload] : [];
    try { worker.postMessage({ requestId, meetingId, action, payload }, transfer); }
    catch (error) {
      clearTimeout(timeout);
      workerPending.delete(requestId);
      error.indeterminate = action === 'append';
      reject(error);
    }
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
recordingSession = new RecordingSession({
  append: appendFixtureTick,
  canWrite: () => lease.held && !releasing,
  onState: phase => {
    if (phase === 'active') channel.post('recording-started');
    if (phase === 'idle') channel.post('recording-stopped');
    render();
  },
  onError: error => {
    log('OPFS write FAILED: ' + error.message);
    message('opfs-status', 'Write not confirmed: ' + error.message);
    channel.post('recording-error');
  }
});
async function startRecording() {
  if (releasing || !lease.held || fixture?.document?.schemaVersion !== SCHEMA_VERSION) return;
  const started = await recordingSession.start();
  if (started) log('Simulated recording started; first durable OPFS ACK confirmed');
}
async function stopRecording() {
  await recordingSession.stop();
  log('Simulated recording stopped; committed bytes=' + bytesWritten);
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
saveSession = new AutosaveSession({
  canWrite: () => lease.held && !!fixture?.document,
  readInput: () => element('notes').value,
  readCommitted: () => editableText(fixture?.document),
  commit: text => saveEditableText(meetingId, text, fixture.document.revision, SCHEMA_VERSION),
  onCommit: updated => {
    fixture.document = updated;
    channel.post('saved', { revision: updated.revision });
    log('IndexedDB committed revision ' + updated.revision);
  },
  onStatus: (state, value) => {
    if (state === 'saving') message('save-status', 'Saving (not yet confirmed)...');
    if (state === 'dirty') message('save-status', 'Unsaved edits newer than acknowledged revision');
    if (state === 'saved') message('save-status', 'Saved revision ' + value.revision + ' (IndexedDB commit ACK)');
    if (state === 'error') { message('save-status', 'NOT SAVED: ' + value.message); log('Save failed: ' + value.message); }
  }
});
async function releaseWriter() {
  if (!lease.held || releasing) return;
  releasing = true; // Disable all input BEFORE awaiting first OPFS ACK / IDB commit.
  clearTimeout(saveTimer);
  saveTimer = null;
  render();
  try {
    await stopRecording(); // Also waits for a pending first ACK or periodic write.
    await saveSession.freezeAndDrain(); // Wait for A and any later dirty edit B.
    if (saveSession.dirty) throw new Error('Unsaved text; refusing to release writer');
    if (!releaseLease) throw new Error('Missing lease release token');
    await releaseLease();
    releaseLease = null;
    saveSession.unfreeze();
    releasing = false;
    await refreshFixture(); // Only refresh after committed data and lock release.
    render();
  } catch (error) {
    // No destructive refresh on failure. Keep dirty text visible and the lock held.
    saveSession.unfreeze();
    releasing = false;
    message('save-status', 'RELEASE BLOCKED - NOT SAVED/UNCONFIRMED: ' + error.message);
    log('Release refused: ' + error.message);
    render();
  }
}
function scheduleSave() {
  clearTimeout(saveTimer);
  if (releasing || !lease.held) return;
  saveTimer = setTimeout(() => { void persistNote().catch(() => {}); }, 150);
}
async function persistNote() {
  if (!lease.held || !fixture?.document) return false;
  return saveSession.flush();
}
migrationRetry = new MaintenanceRetry({
  needed: () => migrationBlocked && APP_VERSION === 'v2' && !lease.held,
  attempt: migrate
});
function scheduleMigrationRetry(sourceMeetingId) {
  log('Maintenance gate may be free after writer release: ' + sourceMeetingId);
  migrationRetry.notifyRelease();
}

async function migrate() {
  if (migrationAttempt) return migrationAttempt;
  if (lease.held || releasing) { log('Release the writer before migration'); return; }
  const attempt = (async () => {
    migrationError = null;
    message('schema-status', 'Migration: requesting exclusive maintenance lock...');
    try {
      const { acquired, value, reason } = await withMaintenanceLock(() => migrateFixture(meetingId));
      if (!acquired) {
        migrationBlocked = true;
        log('Migration postponed: ' + reason);
        message('schema-status', 'Migration postponed: ' + reason);
        return false;
      }
      migrationBlocked = false;
      migrationError = null;
      log(value.changed ? 'Migration v1 -> v2 committed atomically; v1 snapshot preserved' : 'No migration needed');
      await refreshFixture();
      if (APP_VERSION === 'v1' && value.changed) message('save-status', 'Schema v2: reload the updated app before writing');
      return true;
    } catch (error) {
      migrationError = error.message;
      log('Migration FAILED: ' + error.message);
      message('schema-status', 'Migration FAILED: ' + error.message);
      return false;
    }
  })();
  migrationAttempt = attempt;
  try { return await attempt; }
  finally { if (migrationAttempt === attempt) migrationAttempt = null; render(); }
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
  if (isRecording() || lease.held || releasing || saveSession.dirty) {
    message('update-status', 'BLOCKED: finish recording and release writer before activation');
    return;
  }
  if (!registration?.waiting) { describeSW(); return; }
  const waiting = registration.waiting;
  let controllerChanged;
  let changedResolve;
  const changed = new Promise(resolve => { changedResolve = resolve; });
  controllerChanged = () => changedResolve(true);
  navigator.serviceWorker.addEventListener('controllerchange', controllerChanged, { once: true });
  // SW itself must acquire exclusive maintenance Web Lock. A direct postMessage
  // from a different same-origin client cannot bypass an active writer.
  const port = new MessageChannel();
  const outcome = new Promise(resolve => {
    const timeout = setTimeout(() => resolve({ accepted: false, reason: 'SW activation response timeout' }), 10000);
    port.port1.onmessage = event => { clearTimeout(timeout); resolve(event.data); };
  });
  try {
    waiting.postMessage({ type: 'REQUEST_SAFE_ACTIVATION' }, [port.port2]);
    const response = await outcome;
    if (!response?.accepted) {
      message('update-status', 'BLOCKED: ' + (response?.reason || 'SW refused activation'));
      log('Activation refused: ' + (response?.reason || 'unknown'));
      return;
    }
    const ok = await Promise.race([changed, new Promise(resolve => setTimeout(() => resolve(false), 10000))]);
    if (ok) { message('update-status', 'Update ACTIVATED; no reload was forced. Reload only when safe.'); log('New SW activated, no automatic reload'); }
    else { message('update-status', 'Activation requested but controllerchange unconfirmed; do not reload until safe'); }
  } catch (error) {
    message('update-status', 'Activation failed: ' + error.message);
    log('SW activation failed: ' + error.message);
  } finally {
    navigator.serviceWorker.removeEventListener('controllerchange', controllerChanged);
    port.port1.close();
    render();
  }
}

async function boot() {
  message('version', APP_VERSION);
  message('meeting-id', meetingId);
  message('isolation', 'crossOriginIsolated=' + String(globalThis.crossOriginIsolated));
  showNetwork();
  addEventListener('online', showNetwork);
  addEventListener('offline', showNetwork);
  addEventListener('beforeunload', event => {
    const unsaved = lease.held && (saveSession.pending || saveSession.dirty || releasing);
    if (isRecording() || unsaved) { event.preventDefault(); event.returnValue = ''; }
  });
  addEventListener('pagehide', () => {
    clearTimeout(saveTimer);
    migrationRetry.close();
    if (lease.held) void lease.release();
    channel.close();
    worker?.terminate();
  });
  element('acquire').addEventListener('click', acquireWriter);
  element('release').addEventListener('click', releaseWriter);
  element('start').addEventListener('click', startRecording);
  element('stop').addEventListener('click', stopRecording);
  element('migrate').addEventListener('click', migrate);
  element('retry-migration').addEventListener('click', migrate);
  element('check-update').addEventListener('click', checkForUpdate);
  element('activate').addEventListener('click', activateWaiting);
  element('reload').addEventListener('click', () => {
    if (isRecording() || releasing) { message('update-status', 'BLOCKED: finish recording and release writer before reload'); return; }
    if (lease.held) { message('update-status', 'BLOCKED: release writer before intentional reload'); return; }
    location.reload();
  });
  element('notes').addEventListener('input', () => {
    message('save-status', 'Unsaved changes (waiting for confirmed commit)');
    scheduleSave();
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
