# G03 — Audio OPFS durable writer, checkpoints and reconcile (PoC B)

This is an **independent PoC** for Biên bản họp Gói 1.2, not the integrated application. It imports nothing from other workers and does not write NoteDocument/Meeting/ZIP.

## Quick start

Requirements: Node >= 20 for portable deterministic tests. No npm packages required.

```sh
cd poc/03-opfs
npm test                  # deterministic Node fault/recovery and killed Worker tests
npm run bench             # full synthetic 3h mono 48 kHz, ~2.07 GB temporary filesystem I/O
npm run bench:quick       # 3h at 1 kHz, ~43.2 MB
node probe-wav.mjs        # optional: requires ffprobe to verify PCM-f32le WAV decoder
python -m http.server 8765
# open http://localhost:8765/browser-test.html in Windows Chrome/Edge
```

The benchmark creates its own temporary directory and removes the 2 GB audio after completion; allow adequate free space. Node uses filesystem + `fsync`, while the journal is memory-backed for the benchmark; **that is not actual OPFS/IndexedDB persistence**. The killed-Worker tests use a Node worker thread and atomic on-disk JSON journal to reproduce restart semantics, still not IDB.

## Browser Dedicated Worker RPC

`worker.mjs` imports `OpfsFiles` with `FileSystemSyncAccessHandle` and `IDBJournal`. `init` expects `{recordingId, sampleRate, channels, segmentSeconds}` or `{recordingId, reopen:true}`. Calls are serialized and carry `{id,action,payload}`. Responses carry `{id,ok,result}` or `{id,ok:false,error}`.

Actions: `init`, `append`, `flush`, `reconcile`, `seek`, `manifest`, `metrics`, `close`. `append` accepts the COMMON fixture `{recordingId,sequenceNo,firstSample,sampleCount,sampleRate,channels,format:'f32le',pcm:ArrayBuffer}`; transfer ownership with `worker.postMessage(message,[pcm])`. An append ACK is **buffer released, not durable**. Only a successful flush followed by journal transaction returns `committedThroughSampleExclusive`. The caller schedules flush (e.g., every <=5 s); no auto scheduler or two-tab lock is included here. `seek` reads by sample frame index with `{sample,count}` and returns `valid` + PCM or `pending/missing` with reason. `manifest` returns Audio Manifest fixture-compatible segment and interval metadata.

Browser smoke deliberately simulates a fault **after OPFS flush but before the journal**, terminates Worker, reopens recording, rejects uncommitted PCM, verifies committed PCM and appends after recovery. It cleans up its own synthetic recording. Browser test must run on secure origin (localhost/HTTPS), with actual IndexedDB and OPFS access.

## Storage layout and journal contract

- OPFS: `<recordingId>/seg-<firstSample>.wav` (segment boundaries every 300 s by default). WAV is 44-byte RIFF IEEE-float32 / `f32le`, interleaved channels, little-endian. Segment header rewritten and `FileSystemSyncAccessHandle.flush()` called **before** journal commit. Entire 3h audio is never decoded into RAM.
- IndexedDB DB `mochop-opfs-poc-v1`, store `audioManifest`, key recordingId. `schemaVersion:1`, `sampleRate`, `channels`, `nextSequenceNo`, `acceptedThroughSampleExclusive`, `committedThroughSampleExclusive`, `segments`, `chunks` with `firstSample/sampleCount/byteOffset/byteLength/CRC32`, `intervals` with gaps, and `revision`. Initialization uses IDB `add` to reject accidental overwrites of existing sessions.
- On reopen `reconcile()` checks file existence, committed extent, WAV header, CRC32 of every journaled chunk, and orphan/extra bytes. It reconstructs a repairable WAV header, truncates unjournaled file tails, and never promotes them to committed. For missing/corrupt chunks it returns explicit `unavailable` sample ranges and reasons while preserving independently valid data.
- `committedRanges` show verified `[sampleStart,sampleEndExclusive)` and `[byteStart,byteEndExclusive)` associated with `segmentId`. `readSample` checks CRC32 **only for touched chunks after the first full reconciliation**, avoiding O(3h) rehash per seek. If a chunk is tampered with after recovery, a targeted seek returns `missing` rather than wrong samples.
- `toAudioManifest()` exposes `recorded`, `gap`, `unavailable` intervals. Paused/micro-stop intervals must be supplied by capture/timeline integration; storage never fabricates pause or media coverage in a gap.

## Recovery state machine

1. `append` transfers PCM into file, tracks pending chunks, returns `bufferReleased` without `committed`.
2. `flush` writes per-file WAV headers, invokes sync flush, commits revised manifest to a **completed** IndexedDB transaction, then emits durable ACK.
3. If the Worker or browser dies before journal ACK, any extra file bytes are uncommitted and discarded at reopen. If journal ACK was saved but file is missing/corrupt, manifest journal still exists but interval is `unavailable`, **never silently played as adjacent audio**.
4. `reconcile()` rejects use during active unflushed writes to avoid accidentally truncating buffers. `readSample` during such a window returns `pending` for new bytes and can read independently committed bytes.
5. During recovery, a corrupt/lost existing segment is never opened for append again; new audio uses a new segment path. Duplicate/overlapping sequences, wrong recording, invalid PCM payload, quota failures or journal failures cannot produce fake committed ACK.

## Limitations / not yet validated

- Actual Windows Chrome/Edge OPFS+IndexedDB, forced browser-kill, quota under real browser, power outage and CPU under simultaneous audio capture: **NOT_RUN**. Container Chromium navigation is blocked by environment policy (`ERR_BLOCKED_BY_ADMINISTRATOR`), not a browser PASS/FAIL of the implementation.
- In-memory Node journal benchmark does not prove durability of IDB or atomically related storage; OPFS and IDB have no common transaction. Even an ACK cannot guarantee survival of physical device failure.
- 5-second unconfirmed audio from the 48 kHz benchmark is an **idealized cadence**, not a worst-case bound when the system stalls. Target ~10 s must be verified with real capture/browser/storage pressure.
- CRC32 detects accidental corruption, **not cryptographic integrity**; full CRC revalidation on reopening 2.07 GB took about 10 s on tested Node machine. Random seeking after recovery verifies only the required bounded PCM chunk.
- Writer lease, edit autosave, actual live mic, virtual player decode and backup are owned by other workstreams and require a separate integrated acceptance pass.

See [EVIDENCE.md](EVIDENCE.md) and [logs](logs/) for exact synthetic results and environment details.
