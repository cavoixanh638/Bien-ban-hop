# 06-notes — Meeting / NoteDocument / IndexedDB PoC

Independent workstream implementation for Mốc Họp V1.2. No real audio, microphone, PWA, backup or actual ProseMirror editor are bundled.

## Run

From a clean checkout of branch \`gemini/20261115-06-notes\`:

\`\`\`sh
cd poc/06-notes
node --test notes.test.mjs
python -m http.server 8765
\`\`\`

Open \`http://localhost:8765/\` in Chrome/Edge (the server must run inside \`poc/06-notes\`). The demo uses browser IndexedDB at that origin, without installing packages or network calls. Avoid opening \`file://\` (storage/origin restrictions). If a different port/origin is used, its IndexedDB is separate.

## Contract and boundaries

- \`notes.mjs\`: \`openIndexedDB\`, \`NotesRepository\`, \`Autosave\`, \`createMockLease\`, \`migrateNote\`, \`createMemoryDB\`.
- Storage: \`meetings\`, \`notes\`, \`journals\` IndexedDB object stores; a write transaction covers snapshot + append-only committed revision entry + meeting timestamp. The revision returned by \`saveNote(content, expectedRevision)\` is only an ACK when the transaction's \`oncomplete\` fires. An aborted transaction cannot falsely advance the revision.
- ProseMirror content is preserved as JSON (including text, rich text marks, \`timeSpan.attrs\`, anchor IDs, Vietnamese diacritics). Full-text search strips diacritics from query and indexed text in memory. The path into the corresponding meeting is returned.
- \`migrateNote\` reads legacy \`{schemaVersion:0,text:"…"}\` without modifying the old storage, upgrades to \`{type:"doc",content:[…]}\` in memory, then writes schema 1 only after a subsequent successful save. Unknown newer schemas are rejected.
- Lease interface: \`acquire(meetingId) => Promise<{ held, release() }|null>\`. The bundled mock rejects a second writer **within one JS instance only**. Integrate with real multi-tab Web Locks implementation from 09-pwa before shipping.
- Audio reference adapter: \`canDelete(recordingIds, meeting)\` may veto deletion; \`onDelete(recordingIds, meeting)\` is a fake cleanup hook. Actual audio files are owned by 03-opfs; all-in-one restoration is owned by 07-backup.
- \`Autosave\` defaults: trailing debounce 350 ms, maximum scheduling wait 1500 ms after first unsaved edit; status is \`dirty/saving/saved/error/conflict\`. These timers **do not guarantee** a transaction finishes within two seconds or survive a browser kill. Failed/conflicting writes remain unacknowledged. Errors must be shown to the user; do not equate dispatch with durable commit.
- Journals preserve committed snapshots, not uncommitted keystrokes. Recovery is to load the latest committed document; unacknowledged typing can be lost on crash.

## Demo limitations

The textarea demo is intentionally **plain text only**. It creates a ProseMirror document with paragraph/text nodes and autosaves it; it is disabled when a stored note contains marks, so editing the demo cannot accidentally destroy a \`timeSpan\`. A real Tiptap/ProseMirror editor from 01-editor is needed to edit marked documents. This is an independent proof-of-concept, not the final product.

Meeting deletion is confirmed in the demo. It checks the audio-reference adapter before the database transaction and preserves note documents if referenced by another meeting. For production, revalidate audio reference integrity under a coordinated deletion protocol to avoid a race with concurrent audio references.

## Tests and provenance

\`notes.test.mjs\` provides nine isolated, repeatable tests with synthetic fixtures:

1. create/rename/reopen/delete;
2. lossless Vietnamese/marks/anchor round-trip, full-text search, committed journal;
3. revision conflicts;
4. quota-like failed commit with no false acknowledgment;
5. lease collision, autosave status;
6. failed autosave with retry;
7. legacy schema non-destructive migration;
8. future schema rejection;
9. audio reference delete veto.

During initial preparation, these nine test functions ran in the ChatGPT JavaScript V8 test harness against the committed \`notes.mjs\` source, 9 PASS / 0 FAIL. **That harness is not the Node CLI and it uses a deterministic memory adapter.** The following remain NOT_RUN: \`node --test\` from an independent checkout; browser IndexedDB transaction, quota, crash/kill and persistence verification; Chrome/Edge on Windows; timed 2-second data-loss window under real browser load; and integrated TC29/TC35. A CI or human tester must run these before marking the workstream DONE.

## Relevant acceptance mapping

- **TC29, partial (memory fixture only):** revision ACK after commit, autosave dirty/error state and retry; real IndexedDB crash/quota/reload NOT_RUN.
- **TC35, partial (memory fixture only):** migration legacy fixture and future-schema refusal; real browser upgrade/restore NOT_RUN.
- **TC32:** only mock in-process lease, not the real multi-tab lock; NOT_RUN.
