# G02 exact-source verification — 2026-11-15

- **Code commit:** `0083a670e5537952899afb247949bc71442b46b8` (tree `c121f43cea43ccb95dbee4539320bf0481c340de`).
- Source check: each of the **20 application + test files** materialized in an isolated empty folder `/mnt/data/g02-verified-tree-0083a670` had the **same Git blob SHA** as the corresponding `poc/02-capture/` file in that exact remote commit; 20/20 verified by Git tree API. The 19 changed/new files were also byte-verified individually during Git tree push.
- **Important distinction:** this is a clean **source-only materialization and Git blob verification**, **not a `git clone` / Git checkout with commit metadata**. Do not claim a clean Git checkout was executed.
- Platform: Linux x86_64, Node.js `v22.16.0`, browser runtime Chromium 144.0.7559.96 managed (URLBlocklist blocks localhost).
- Command in isolated source folder: `npm test`; exit code **0**; **36 PASS, 0 FAIL, 0 skipped**, runtime 649.963599 ms. Exact stdout source is in `evidence/unit-tests-round2.txt` (identical test list; clean materialization shows 36/36).
- Command in isolated source folder: `npm run test:virtual3h`; exit code **0**; **PASS_METADATA_ONLY**; 48 kHz × 10,800 s = 518,400,000 indexed frames, not wall-clock recording or persisted audio.
- Command from active source folder: `npm run test:browser -- --quick`; exit 2 **NOT_RUN BLOCKED_ENV** (Chromium managed URLBlocklist). See `evidence/browser-run.txt` and `evidence/browser-results.json`.
- Requirements independently tested by deterministic Node fixtures: G02-ADD-01..04; G02-ADD-05 bounded queue/rolling diagnostic. The real browser AudioWorklet, OPFS WebM seek, mic/screen real audio, Windows Chrome/Edge, and three-hour wall-clock capture remain **NOT_RUN**.
- Workstream scope: only `poc/02-capture/` and own checkpoint; no production build/merge/deploy. Storage durability ACK remains G03's responsibility.

## Representative SHA matches

| File | local Git blob = exact remote Git blob |
|---|---|
| `src/controller.mjs` | `e7b0370adb6e6fb5d3ce64cb56485f4299a8c955` |
| `src/capture-processor.js` | `7e6cd12524ad78e31e35496e294855dfb604819c` |
| `src/clock-mapper.mjs` | `7a167940b6b2c95361f77170ae7a2fbaeda57276` |
| `src/media-recorder.mjs` | `f405811bf9f63da691cb23e11d0fdb407006ca92` |
| `src/stream-spool.mjs` | `7ef9d64d2e95831bc03671ad744d82acf29e1021` |
| `tests/lifecycle.test.mjs` | `293179d2a5519f1171a589bcca5325216059c919` |
| `tests/unit.test.mjs` | `c6d446dfbc5edd020509a350c090a69d8d598d64` |
