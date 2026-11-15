# G03 evidence — 2026-11-15

## Deterministic suite

- Command: `npm test`, Node v22.16.0, Linux x64, synthetic PCM. **25/25 PASS, 0 FAIL** (10 base tests, 12 extended tests, 3 actual Node Worker-thread terminated/reopened tests). Logs: `logs/node-tests.tap`.
- Covered: durable vs buffer ACK, interrupted OPFS write, crash after flush before IDB, crash after journal, byte surplus, incomplete WAV, corrupt/missing file, checksum change after recovery, quota/IO failure, journal commit error, missing/duplicate sequence, wrong recording, nonfinite f32le, stereo and segment boundaries, `pending` reads, restart after damaged segment, old recording creation conflict, media gap without fake media offsets.
- Worker killed by `Worker.terminate()` (Node worker threads) after buffer ACK / after fsync / after atomic JSON journal; reopened in fresh Worker, previously acknowledged prefix recovered. **Not a forced browser crash, and JSON journal is not IDB**.

## 3-hour 48 kHz benchmark

- Command: `npm run bench` from local source content, using Node filesystem with `fsync` and **in-memory** journal adapter, deterministic 440-Hz cyclic f32le PCM, sampleRate 48,000, mono, chunk 5s, segment 300s, duration 10,800s (3 hours). Log: `logs/bench-48k.txt`.
- **518,400,000 samples / 2,073,600,000 PCM bytes / 36 WAV segments / 2,160 committed ranges.** Full reopen checksum sweep recovered all samples: **0 unavailable, 0 gaps**.
- Wall time ~31.395s of accelerated synthetic writing, not 3h wall-clock capture; full CRC recovery scan **9847.394 ms**; peak RSS sampled **89.7 MiB**.
- Write P50/P95/max **5.321 / 8.102 / 25.551 ms**; flush P50/P95/max **3.223 / 5.539 / 20.678 ms**. Includes Node adapter and JSON clone journal for each flush; batch max pending **5s / 960,000 PCM bytes**, *not* an extreme-condition loss bound.
- Seek from start, middle, near end and last sample **all `valid`**. P95 **4.868 ms (n=4, too few for production latency SLA)**, versus prior 1.5s full-file CRC per seek. Random seek checks only touched chunk CRC; memory remains bounded.
- Quick baseline: `npm run bench:quick` 1kHz 3h, report `logs/bench-1k.txt`. These numbers are informational only; 48k is the material performance run.

## WAV decoder compatibility

- Optional command: `node probe-wav.mjs`, local `ffprobe`: **PASS** `codec_name=pcm_f32le`, 48,000 Hz, stereo, duration 1.000s. Log: `logs/probe-wav.json`. This proves container header decode, not sample-perfect playback audio at browser boundaries.

## Browser gate — NOT_RUN

- Linux Chromium 144.0.7559.96 is installed, Python Playwright is available, but page navigation to `http://127.0.0.1:8765/browser-test.html`, local `file:` and `data:` all return `net::ERR_BLOCKED_BY_ADMINISTRATOR`. The page is not running on an origin with OPFS in this environment. A secure-origin page on `about:blank` has opaque origin and no `navigator.storage.getDirectory`.
- `browser-test.html` is committed for a real localhost/HTTPS Chrome/Edge run. Required remaining: OPFS SyncAccessHandle and IDB transactional durability in genuine browser, quota pressure, forced tab/browser shutdown/restart and 3h wall-clock while capturing with AudioWorklet. Windows Chrome/Edge specifically **NOT_RUN**.
- Browser 3h, CPU usage and true OPFS peak memory **NOT_RUN**. Node PASS is not TC12–TC21 integrated PASS, nor proof against power loss or browser origin eviction.

## SHA and evidence integrity

Run an exact branch Git SHA checkout and compare relevant Git blob IDs to the tested file hashes. Container cannot resolve `github.com` directly, so the branch is updated via the GitHub connector from exact local file bytes and file hashes are independently checked against GitHub blobs. This establishes source-blob equivalence, **not** a claim that `git clone` worked or that the browser suite ran. Code SHA, Tested SHA and any limitation are recorded in the worker checkpoint.
