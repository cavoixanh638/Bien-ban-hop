# G06 — Node + browser-attempt evidence (2026-11-15)

**Code/Tested branch SHA:** `4dcc4625f8640d79a8a8d3674710cf5f0a2465ef` · `gemini/20261115-06-notes`.

## Provenance and environment

- Runner: **Node v22.16.0, Linux x86_64**, Python 3.13.5; Chromium 144.0.7559.96 on Linux for the browser attempt.
- GitHub direct clone inaccessible (container DNS cannot resolve github.com). The files were reconstructed into an otherwise clean local directory, with **Git blob SHA verified against the exact GitHub blobs** before running. This is a byte-identical source verification, **not** a successful `git clone` or a GitHub Actions run.
- Verified Git blob hashes:
  - `notes.mjs` `77c952dd0d1426b0cdccae8f05a4ecf2c1f38381`
  - `notes.test.mjs` `442a859a1b4da3885bf04e73820239dcb2d87f0a`
  - `notes.regression.test.mjs` `893734546c7c3577c8d6d55f91638fd1ec34bbc4`
  - `fake-idb.mjs` `31523a6b88a4682061db27456bbd1870e6a241a6`
  - `bench_autosave.mjs` `ca37a616cec8e8126d0d29bc9e5492d3b948c316`
  - `browser_smoke.py` `d6d5643a3d0e8e92434ce228e4a105355c2fe759`

## Node test log

Command: `node --test --test-reporter=tap notes.test.mjs notes.regression.test.mjs`

Exit code **0**; **22 PASS / 0 FAIL / 0 cancelled / 0 skipped**, elapsed **945.26486 ms** (TAP v13).

| # | Case | Status | Duration (ms) |
|---|---|---|---:|
| 1 | search returns editor-aligned offsets across adjacent marks, paragraphs, and Unicode | PASS | 5.696 |
| 2 | autosave drains late edits while commit is pending and reports saved only at final ACK | PASS | 3.457 |
| 3 | autosave coalesces concurrent flush callers; dispose rejects dirty state | PASS | 0.907 |
| 4 | autosave maxWait starts at first dirty edit, even if continuous typing | PASS | 284.494 |
| 5 | invalid mark content never receives saved ACK | PASS | 0.631 |
| 6 | Fake IndexedDB: open upgrade, durable CRUD and reopen | PASS | 55.652 |
| 7 | Fake IndexedDB: aborted transaction does not publish snapshot/journal or advance revision | PASS | 52.963 |
| 8 | Fake IndexedDB: simultaneous cross-connection save CAS yields one writer | PASS | 50.383 |
| 9 | Fake IndexedDB: legacy note upgraded on read without modifying backing store | PASS | 30.108 |
| 10 | Mock lease stale release cannot revoke a new owner | PASS | 0.766 |
| 11 | Fake IndexedDB: simulated mid-transaction crash leaves only committed revision | PASS | 344.642 |
| 12 | Fake IndexedDB: index/key error after writing snapshot aborts whole transaction | PASS | 38.183 |
| 13 | Shared note reference and multiple timeSpan marks survive independent meeting lifecycle | PASS | 2.372 |
| 14 | create / rename / reopen / remove meeting | PASS | 10.078 |
| 15 | lossless ProseMirror round trip / Vietnamese / marks / revision journal | PASS | 4.589 |
| 16 | conflicting writers cannot silently overwrite | PASS | 3.179 |
| 17 | failed commit cannot advance revision or journal | PASS | 0.452 |
| 18 | mock lease and acknowledgment state | PASS | 1.099 |
| 19 | save failure remains unsaved and retry succeeds | PASS | 0.576 |
| 20 | legacy schema fixture migrates on read without destructive rewrite | PASS | 0.572 |
| 21 | newer schema is rejected, not downgraded | PASS | 0.176 |
| 22 | audio-reference veto protects shared recording | PASS | 0.724 |

**Fixture classification:** Node deterministic memory adapter and asynchronous IndexedDB-like fake only. These tests do **not** establish real browser IndexedDB transaction durability, crash behavior or cross-tab Web Locks.

## Measured autosave window (synthetic)

Command: `node bench_autosave.mjs` (exit 0).

```json
{
  "fixture": "Node + deterministic async IndexedDB-like adapter",
  "edits": 36,
  "debounceMs": 350,
  "maxWaitMs": 1500,
  "fakeCommitStepDelayMs": 3,
  "durationMs": 3080,
  "revisionsCommitted": 2,
  "lastEditPersisted": "ghi chú 35",
  "maxUnconfirmedMs": 1526,
  "p95UnconfirmedMs": 1526,
  "errorStates": 0
}
```

This measurement is *not* a Windows/Chrome/Edge latency result or a guarantee of a <=2-second unconfirmed window under load, tab throttling, quota or power loss.

## Browser execution attempt

Command: `CHROMIUM_EXECUTABLE=/usr/bin/chromium python browser_smoke.py` (exit **2**).

```json
{
  "runner": "Playwright Python, real browser IndexedDB",
  "browserVersion": "144.0.7559.96",
  "status": "NOT_RUN",
  "error": "Page.goto: net::ERR_BLOCKED_BY_ADMINISTRATOR at http://127.0.0.1:42633/"
}
```

Chromium launched successfully but the managed browser policy blocked even loopback navigation **before test JS could execute**. Do not report IndexedDB browser subcases PASS. The smoke script is committed for rerun on an unrestricted browser; no attempt was made to circumvent the policy.

## Acceptance mapping and remaining checks

- **TC29 (autosave), logic fixture PASS**: snapshot/journal atomic fake commit ACK, no false saved after rollback, conflict and late edit handling. **NOT_RUN** real IndexedDB `oncomplete` under quota, abrupt browser kill and measured 2-second window on Windows.
- **TC35 (schema), logic fixture PASS**: schema 0 non-destructive read and commit, unknown future version rejection. **NOT_RUN** real Chromium DB upgrade across versions, index damage, power-loss recovery.
- **TC32 multi-tab), mock PASS for revision compare-and-swap only**; **NOT_RUN** actual two-tab writer-lock protocol owned by 09.
- **Integrated Mốc Họp product acceptance:** NOT_RUN; this run is solely G06 independent PoC evidence.
