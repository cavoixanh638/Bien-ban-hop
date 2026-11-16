# G10-R — Restore/transfer workboard (2026-11-16)

Starting source HEAD: `46d12dc76e8d7033c1aab5087463b865c1f5d0b0` (GitHub branch `integration/20261115-g10-v1.2`). **Checkpoint commit before implementation**, not proof of a working restore.

## Scope

1. One portable `.mochop` archive includes meeting, complete ProseMirror note/timeSpan marks, pending provenance if safe, **all** recording IDs and WAV segments, manifest and integrity checks. Fail closed for missing/corrupt/unsafe paths; versioned metadata; no silent omissions.
2. Import into an empty browser/other Windows computer with a new meeting ID and remapped recording references; restore OPFS and IndexedDB with rollback/cleanup on failure. Do not overwrite an existing meeting. Must restore a second recording session and click-to-play from both.
3. Browser UI: Export all recordings; Import with clear progress/status, no recording in progress; tests of single/multiple sessions, integrity, rollback, re-import collision, and production build/Chromium on separate browser contexts.

## Gates and evidence

For each revision record HEAD/Tested SHA, native Node, Linux/Windows build, HTTP Chromium E2E, and separately NOT_RUN Windows physical microphone/long-duration/cross-hardware transfer. No merge/deploy without acceptance. Preserve source `poc/07-backup` and G03/G06 contracts, adding dedicated G10 adapters if format changes are needed.
