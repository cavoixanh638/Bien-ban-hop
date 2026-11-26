import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareMigrationV2 } from '../migration-core.js';

function seed() {
  return {
    meeting: { meetingId: 'm1', noteDocumentId: 'n1', schemaVersion: 1, recordingIds: ['rec-1'], title: 'Fixture' },
    document: { noteDocumentId: 'n1', schemaVersion: 1, revision: 7, content: {
      type: 'doc', content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Some linked text', marks: [{ type: 'timeSpan', attrs: { anchorId: 'a1', recordingId: 'rec-1', audioOffsetMs: 1250, typedAt: 1794754800000, source: 'live_recording', schemaVersion: 1 } }] }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Some notes' }] }
      ]
    } }
  };
}

test('TC35: migration preserves every timeSpan attr, recording reference, note text, and revision', () => {
  const { meeting, document } = seed();
  const beforeMeeting = structuredClone(meeting);
  const beforeDocument = structuredClone(document);
  const result = prepareMigrationV2('m1', meeting, document, '2026-11-15T00:00:00.000Z');
  assert.equal(result.changed, true);
  assert.equal(result.meeting.schemaVersion, 2);
  assert.equal(result.document.schemaVersion, 2);
  assert.equal(result.document.revision, 7);
  assert.deepEqual(result.document.content, beforeDocument.content);
  assert.deepEqual(result.meeting.recordingIds, beforeMeeting.recordingIds);
  assert.deepEqual(result.snapshot.meeting, beforeMeeting);
  assert.deepEqual(result.snapshot.document, beforeDocument);
  assert.deepEqual(document, beforeDocument, 'pure planner must not mutate original');
  assert.deepEqual(meeting, beforeMeeting);
});

test('TC35: idempotent v2, reject mixed/newer schema instead of downgrade', () => {
  const { meeting, document } = seed();
  const upgraded = prepareMigrationV2('m1', meeting, document, 'timestamp');
  assert.equal(prepareMigrationV2('m1', upgraded.meeting, upgraded.document, 'timestamp').changed, false);
  assert.throws(() => prepareMigrationV2('m1', { ...meeting, schemaVersion: 3 }, document, 'timestamp'), /Unknown\/mixed/);
  assert.throws(() => prepareMigrationV2('m1', { ...meeting, schemaVersion: 2 }, document, 'timestamp'), /Unknown\/mixed/);
});

test('TC35 negative: tampered link or missing paragraph cannot produce migration plan', () => {
  const { meeting, document } = seed();
  document.content.content[0].content[0].marks[0].attrs.recordingId = 'someone-else';
  assert.throws(() => prepareMigrationV2('m1', meeting, document, 'timestamp'), /Invalid timeSpan/);
  document.content.content[0].content[0].marks[0].attrs.recordingId = 'rec-1';
  document.content.content.pop();
  assert.throws(() => prepareMigrationV2('m1', meeting, document, 'timestamp'), /editable paragraph/);
  assert.equal(meeting.schemaVersion, 1);
  assert.equal(document.schemaVersion, 1);
});
