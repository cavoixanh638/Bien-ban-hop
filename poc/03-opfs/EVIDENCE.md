# OPFS PoC 03 — evidence 2026-11-15

## Deterministic Node tests

Command: `npm test` in `poc/03-opfs/`. Local implementation reference, Node v22.16.0, 10 tests **PASS**, 0 FAIL, duration ~475 ms. Coverage: append/recycle ACK vs flush, seek, crash after OPFS flush before journal, crash after journal, missing file, header repair, corruption/short file, duplicated sequence & gap, quota, failed journal transaction, segment rollover.

**Qualification:** these results are from a local prototype of the algorithm. The GitHub transcription is not byte-identical to that prototype and has not been independently run from a clean checkout; therefore the GitHub code's own tests remain **NOT_RUN** until repeated. This evidence must not be used as full TC12/15/18/19 PASS.

## Synthetic three-hour workload

- Command: `npm run bench` (local prototype)
- Node v22.16.0, filesystem-backed temp files with `fsync`, memory-backed journal substitute.
- Deterministic 1,000 Hz, mono, f32le PCM for 10,800 seconds (3 hours); 8,192-frame chunks; 300-second segments.
- Runtime: 11.91 s wall time in benchmark simulation (not real-time capture).
- Segments: 36. Committed: 10,800,000 samples / 43,200,000 PCM bytes. Missing/unavailable: 0.
- Maximum pending duration based on 1 chunk/flush: 8.192 s. **Not a 48 kHz / real-time safety guarantee.**
- Cumulative write time: 282.78 ms. Flush time: 812.94 ms. Journal time: 924.33 ms. Flush count: 1,319. Max pending PCM bytes: 32,768.
- Sampled peak RSS: ~60 MiB.
- Seek at samples 0, 5,400,000, 10,799,999: all `valid`. First seek ~1,548 ms; middle ~1,502 ms; final ~1,613 ms (slow due to full-file checksum verification on every seek).
- Data cleanup: temp filesystem deleted after benchmark.

## Mandatory outstanding verification

- Run the **committed exact GitHub version** from clean checkout (Node test & benchmark) and capture SHA.
- Run `browser-test.html` on genuine Windows Chrome and Edge: Dedicated Worker, OPFS SyncAccessHandle, IndexedDB, crash/close/reopen, quotas, browser storage clearing.
- Run realistic 48 kHz mono/stereo 3h and measure cumulative/peak memory, write/flush P95, dropped chunks, browser CPU and seek latency; prove/reject ~10s unconfirmed loss bound under load.
- Test kill -9/browser crash and quota failure against browser-backed OPFS; current fault injection does not simulate OS/power-loss flush.
- Establish true playback WAV validity in native media decoder (current Node seek reads PCM bytes directly, browser smoke does not play audio).

Status: `PASS` for local simulation tests and synthetic benchmark observations only; `NOT_RUN` for browser/Windows and exact committed code validation.
