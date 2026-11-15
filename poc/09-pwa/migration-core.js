// Deterministic, side-effect-free migration plan. Caller commits it in ONE IDB transaction.
export function validateFixture(meeting, document) {
  if (!meeting || !document || meeting.noteDocumentId !== document.noteDocumentId) throw new Error('Missing or mismatched meeting/document');
  if (!Array.isArray(meeting.recordingIds) || meeting.recordingIds.length < 1) throw new Error('Missing recording refs');
  const paragraphs = document.content?.content;
  const anchor = paragraphs?.[0]?.content?.[0]?.marks?.find(mark => mark.type === 'timeSpan');
  const attrs = anchor?.attrs;
  if (document.content?.type !== 'doc' || !Array.isArray(paragraphs) || !attrs || typeof attrs.anchorId !== 'string' || !meeting.recordingIds.includes(attrs.recordingId) || !Number.isInteger(attrs.audioOffsetMs)) throw new Error('Invalid timeSpan; aborting migration without writing');
  if (!paragraphs[1] || typeof paragraphs[1]?.content?.[0]?.text !== 'string') throw new Error('Invalid editable paragraph');
}

export function prepareMigrationV2(meetingId, meeting, document, timestamp) {
  if (!meeting || !document || meeting.meetingId !== meetingId) throw new Error('Missing or mismatched fixture');
  if (meeting.schemaVersion === 2 && document.schemaVersion === 2) return { changed: false, meeting, document };
  if (meeting.schemaVersion !== 1 || document.schemaVersion !== 1) throw new Error('Unknown/mixed schema; do not downgrade or rewrite');
  validateFixture(meeting, document);
  const snapshot = structuredClone({ meetingId, meeting, document, createdAt: timestamp });
  // Shallow top-level schema upgrade; content tree/timeSpan source stays byte-for-byte equivalent as JSON.
  const meetingV2 = { ...meeting, schemaVersion: 2, migratedFromSchemaVersion: 1 };
  const documentV2 = { ...document, schemaVersion: 2, migratedFromSchemaVersion: 1 };
  return { changed: true, meeting: meetingV2, document: documentV2, snapshot };
}
