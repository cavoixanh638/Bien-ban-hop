# 09-PWA — continuation test evidence (2026-11-15)

**Status:** fixture-based standalone PoC; review pending actual browser runs. G00 `TRACKER.md` ADD-01 to ADD-04 reviewed and addressed in owned source. The 10 existing Node mock tests were expanded to **28/28 PASS** (Node v22.16.0, Linux x86_64, no npm downloads) and real nested-path static HTTP smoke to **9/9 PASS** (Python 3.13.5). This is **not** TC32–TC35 acceptance for Windows/Chrome/Edge or the integrated application.

| Gate | Result | Evidence | Unverified boundary |
|---|---|---|---|
| G09-ADD-01: start/release, stop-during-first-ACK, late tick, first-timeout, stale release token | **PASS** (deterministic Node mocks) | `session-races.test.mjs`, `lease.test.mjs` | Browser Worker scheduling and renderer crash **NOT_RUN** |
| G09-ADD-02: save A delayed, type B, drain before release, quota abort, CAS conflict | **PASS** (deterministic Node mocks) | `session-races.test.mjs`; confirmed revisions 1→2→3, B retained; error retains dirty text and lease | Real IndexedDB `transaction.complete` race **NOT_RUN** |
| G09-ADD-03: meeting B blocks A migration; release event crosses meeting IDs; bounded retry and v1 notes/marks/revision preserved | **PASS** (deterministic Node mocks) | `maintenance-retry.test.mjs`, `lease.test.mjs` | Real BroadcastChannel/Web Locks/IDB multi-meeting flow **NOT_RUN** |
| G09-ADD-04: SW self-acquires exclusive lock, direct message while B writes denied, outside-scope/unsupported SW locks denied, HTML+JS same shell version | **PASS** (SW event/Web Locks/cache mocks) | `sw.test.mjs` | Real waiting-worker activation and full trust boundary **NOT_RUN** |
| TC32: single writer and recovery after release, unsafe no-lock fallback | **PASS** (Node mock) | `lease.test.mjs` | Real 2-tab/renderer crash **NOT_RUN** |
| TC33: app shell precache/base/scope, no fixture bytes in cache | **PASS** (Node SW mock + static HTTP) | `assets.test.mjs`, `sw.test.mjs`, `HTTP_SMOKE_20261115.txt` | Browser offline reload + OPFS + `crossOriginIsolated=false` **NOT_RUN** |
| TC34: waiting worker no auto `skipWaiting` or reload; guarded explicit activation | **PASS** (SW mock) | `sw.test.mjs`; `app.js` intentionally has no auto reload | Browser SW lifecycle **NOT_RUN** |
| TC35: old document and every timeSpan attr/revision preserved; mixed schema rejected; no partial migration plan | **PASS** (pure migration mock) | `migration.test.mjs`, `maintenance-retry.test.mjs` | IndexedDB atomic rollback under live browser **NOT_RUN** |
| OPFS short write / rollback failure | **PASS** (Worker/mock OPFS) | `worker.test.mjs`; NACK; successfully truncate to before size or classify indeterminate | Real browser OPFS quota/corruption **NOT_RUN** |
| 10 Chromium Playwright scenarios | **NOT_RUN** | `test_pwa.py`, `BROWSER_NOT_RUN_20261115.txt` | Managed browser `Page.goto net::ERR_BLOCKED_BY_ADMINISTRATOR` prevents page navigation |
| GitHub Pages HTTPS base-path / origin security / headers | **NOT_RUN** | No deployment authorized | Must run on an authorized endpoint before live use |
| Windows Chrome/Edge and actual device/real audio | **NOT_RUN** | Not available in this runtime | G01, G02/G03, G00 integration gates separate |

## Reproduction commands

From `poc/09-pwa/`, standalone without downloads:

```text
$ node --version
v22.16.0
$ npm test
# tests 28
# pass 28
# fail 0
# cancelled 0
# duration_ms 226.438534
$ python tests/http_smoke.py
9/9 nested HTTP static asset checks PASS
```

Raw tested logs: [`NODE_TEST_20261115.txt`](NODE_TEST_20261115.txt) · [`HTTP_SMOKE_20261115.txt`](HTTP_SMOKE_20261115.txt) · blocked browser evidence [`BROWSER_NOT_RUN_20261115.txt`](BROWSER_NOT_RUN_20261115.txt). The Playwright test process **exited nonzero** before the first scenario executed; the report labels the scenario suite **NOT_RUN**, not PASS. Chrom(ium) policy `URLBlocklist` was not changed or bypassed.

## Scope, safety, and integration guidance

- All fixtures synthetic; no real meeting/audio data, external API, credentials or network dependency. Worker uses 64-byte dummy chunks, not a 3-hour capture benchmark.
- `MeetingLease` only grants writer via Web Locks. Lease can only release once recording start/periodic append and autosave acknowledged; unknown Worker completion blocks release. Crash may lose only non-ACKed data; production needs journal reconciliation.
- `AutosaveSession` loops until current dirty input equals acknowledged IDB revision, freezes editing before releasing, and never refreshes dirty text after save failure.
- `MaintenanceRetry` retries after **any** meeting releases global maintenance gate; limited delays 250/750/1500/3000ms and manual button, no uncontrolled background polling.
- SW rejects stale raw activation command and directly acquires origin-wide exclusive lock for explicit activation; no self-activation on install. Cache-first index must match versioned JS; old shell cache deliberately retained.
- SW `source.url` scope check is **not an origin security boundary** against compromised same-scope scripts. Hosting/dedicated HTTPS origin and live SW Web Locks support must be validated at the release gate.

**Tested SHA methodology:** the full source tree tested locally is the source subsequently uploaded to branch `gemini/20261115-09-pwa`. Final `Code SHA`/`Tested SHA`, remote blob parity and commit hash are recorded in the branch checkpoint after push. No claim that Node/unit mock PASS is a browser or integrated app PASS.
