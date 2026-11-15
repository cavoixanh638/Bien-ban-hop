# 09-PWA test evidence - 2026-11-15

Scope: local standalone PoC, synthetic notes and dummy OPFS bytes only. This file is NOT an acceptance certificate for the integrated V1.2 application.

| Check | Source/environment | Result | Evidence / limitation |
|---|---|---|---|
| TC32: exclusive meeting writer, second denied, takeover after release | Node 22.16.0, in-memory Web Locks adapter, `npm test` | PASS (unit mock) | `tests/lease.test.mjs` tests 1-3 |
| TC33: cache only scoped shell; offline navigation fallback | Node 22.16.0, Service Worker event/cache/fetch mocks | PASS (unit mock) | `tests/sw.test.mjs` offline and cache isolation; **not browser offline PASS** |
| TC34: waiting worker does not activate by itself; maintenance guard denies during writer | Node 22.16.0, mock SW and Web Locks | PASS (unit mock) | `tests/sw.test.mjs`, `tests/lease.test.mjs`; no browser lifecycle verified |
| TC35: v1-to-v2 fixture preserves timeSpan/recording IDs/revision; corrupt source fails | Node 22.16.0, pure migration planner | PASS (unit mock) | `tests/migration.test.mjs`; IndexedDB transaction integration NOT_RUN |
| Worker/OPFS ACK and negative short write | Node 22.16.0, mock OPFS sync file handles | PASS (unit mock) | `tests/worker.test.mjs`; real OPFS NOT_RUN |
| TC32 two tabs and tab close; renderer crash | Chromium Playwright suite against ephemeral localhost fixture | NOT_RUN (browser blocked) | Chromium 144.0.7559.96 policy `URLBlocklist=["*"]` prevents navigating to `127.0.0.1`; `Page.goto net::ERR_BLOCKED_BY_ADMINISTRATOR` |
| TC33 actual offline reload, OPFS and `crossOriginIsolated=false` | Chromium Playwright suite | NOT_RUN (browser blocked) | Same policy; fixture test is ready |
| TC34 SW v1 to v2 on active recording, explicit activation/reload | Chromium Playwright suite | NOT_RUN (browser blocked) | Same policy; fixture test is ready |
| TC35 real IndexedDB migration, atomic rollback, old-client write guard | Chromium Playwright suite | NOT_RUN (browser blocked) | Same policy; fixture test is ready |
| GitHub Pages HTTPS/base path/live headers | GitHub Pages live environment | NOT_RUN | No authorized Pages deployment or verified URL; do not claim PASS |
| Windows Chrome/Edge, long recording, crashes/quota | Real Windows device | NOT_RUN | Not available in this run; separate integration gate |

## Commands and measured output

```text
$ node --version
v22.16.0
$ npm test
# tests 10
# pass 10
# fail 0
# duration_ms 116.111073

$ CHROMIUM_PATH=/usr/bin/chromium python -m pytest -q tests/test_pwa.py --disable-warnings --maxfail=1
# FAIL before running scenario: Page.goto net::ERR_BLOCKED_BY_ADMINISTRATOR
# Policy: /etc/chromium/policies/managed/000_policy_merge.json -> URLBlocklist: ["*"]
```

The browser failure is an **environment constraint, not a software PASS or FAIL**. No command was used to bypass managed browser restrictions. The public npm registry was unreachable in this runtime (`EAI_AGAIN`); Node tests use no external dependencies.

Tested local source: the full `poc/09-pwa/` text tree delivered in the code commit. Commit SHA is recorded in the branch checkpoint. Before signing off TC32-TC35 on browsers, run the provided Playwright suite on an ordinary authorized Chrome/Edge instance, investigate any failures and attach traces/version; then separately measure a real GitHub Pages deployment (if authorized).
