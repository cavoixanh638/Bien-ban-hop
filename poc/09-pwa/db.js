import { prepareMigrationV2 } from './migration-core.js';
// Only IndexedDB persists user fixture data. Never send it to SW CacheStorage.
const DB_NAME = 'mochop-pwa-poc09';
const IDB_VERSION = 1;
const AUDIO_RECORDING = 'rec-poc09-001';
let openPromise;

const request = req => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error || new Error('IndexedDB request failed'));
});
const done = tx => new Promise((resolve, reject) => {
  tx.oncomplete = resolve;
  tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
});
function openDb() {
  if (!openPromise) openPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('meetings', { keyPath: 'meetingId' });
      db.createObjectStore('documents', { keyPath: 'noteDocumentId' });
      db.createObjectStore('snapshots', { keyPath: 'meetingId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB upgrade blocked by open tab'));
  });
  return openPromise;
}
export const seededAudioId = AUDIO_RECORDING;
export const fixtureDocumentId = meetingId => 'note-' + meetingId;

export async function ensureFixture(meetingId) {
  const db = await openDb();
  const tx = db.transaction(['meetings', 'documents'], 'readwrite');
  const completion = done(tx);
  const store = tx.objectStore('meetings');
  const existing = await request(store.get(meetingId));
  if (!existing) {
    const noteDocumentId = fixtureDocumentId(meetingId);
    const fixture = {
      noteDocumentId, revision: 1, schemaVersion: 1,
      content: { type: 'doc', content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Opening note / anchor fixture', marks: [{ type: 'timeSpan', attrs: { anchorId: 'anchor-001', recordingId: AUDIO_RECORDING, audioOffsetMs: 1250, typedAt: 1794754800000, source: 'live_recording', schemaVersion: 1 } }] }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Draft v1 / editable second paragraph' }] }
      ] }
    };
    tx.objectStore('documents').put(fixture);
    store.put({ meetingId, noteDocumentId, recordingIds: [AUDIO_RECORDING], title: 'Synthetic safety fixture', schemaVersion: 1 });
  }
  await completion;
  return readFixture(meetingId);
}

export async function readFixture(meetingId) {
  const db = await openDb();
  const tx = db.transaction(['meetings', 'documents', 'snapshots'], 'readonly');
  const completion = done(tx);
  const meeting = await request(tx.objectStore('meetings').get(meetingId));
  if (!meeting) { await completion; return null; }
  const document = await request(tx.objectStore('documents').get(meeting.noteDocumentId));
  const snapshot = await request(tx.objectStore('snapshots').get(meetingId));
  await completion;
  return { meeting, document, snapshot };
}

export function editableText(document) {
  return document?.content?.content?.[1]?.content?.[0]?.text ?? '';
}
export async function saveEditableText(meetingId, input, expectedRevision, expectedSchemaVersion) {
  const db = await openDb();
  const tx = db.transaction(['meetings', 'documents'], 'readwrite');
  const completion = done(tx);
  try {
    const meeting = await request(tx.objectStore('meetings').get(meetingId));
    if (!meeting || meeting.schemaVersion !== expectedSchemaVersion) throw new Error('Schema mismatch: reload an updated app before writing');
    const store = tx.objectStore('documents');
    const document = await request(store.get(meeting.noteDocumentId));
    if (!document || document.revision !== expectedRevision || document.schemaVersion !== expectedSchemaVersion) throw new Error('Revision conflict: refusing overwrite');
    const next = structuredClone(document);
    next.content.content[1] = { type: 'paragraph', content: [{ type: 'text', text: input }] };
    next.revision += 1;
    store.put(next);
    await completion;
    return next;
  } catch (error) {
    try { tx.abort(); } catch (_) { /* already completed */ }
    await completion.catch(() => {});
    throw error;
  }
}

export async function migrateFixture(meetingId) {
  const db = await openDb();
  const tx = db.transaction(['meetings', 'documents', 'snapshots'], 'readwrite');
  const completion = done(tx);
  try {
    const meetings = tx.objectStore('meetings');
    const documents = tx.objectStore('documents');
    const meeting = await request(meetings.get(meetingId));
    if (!meeting) throw new Error('Fixture not initialized');
    const document = await request(documents.get(meeting.noteDocumentId));
    const plan = prepareMigrationV2(meetingId, meeting, document, new Date().toISOString());
    if (!plan.changed) { await completion; return { changed: false, meeting, document }; }
    // Snapshot and both replacements are committed atomically; no partial schema advance.
    tx.objectStore('snapshots').put(plan.snapshot);
    meetings.put(plan.meeting);
    documents.put(plan.document);
    await completion;
    return { changed: true, meeting: plan.meeting, document: plan.document };
  } catch (error) {
    try { tx.abort(); } catch (_) { /* already committed/aborted */ }
    await completion.catch(() => {});
    throw error;
  }
}
