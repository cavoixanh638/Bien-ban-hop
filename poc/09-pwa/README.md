# MOC HOP / 09-PWA - self-contained proof of concept

This directory is an isolated **fixture-based PoC**, not the integrated meeting application or real microphone recording. Nothing in this directory imports files from any other workstream. The app has no backend and never sends meeting data to a server. Synthetic bytes stand in for audio.

## What is implemented

- **TC32**: origin-wide `navigator.locks` exclusive lease `mochop:poc09:meeting-writer:<meetingId>`, or immediate read-only (`null`) when busy. An additional shared `mochop:poc09:maintenance` lock is held for the entire writer session; activation and schema migration need the exclusive maintenance lock. Browser releases locks when a tab closes/crashes. `BroadcastChannel` only signals changes, never authorizes writes.
- **TC33**: a scoped service worker caches only versioned static shell resources. All URLs are relative to `self.registration.scope` and work under `/Bien-ban-hop/poc/09-pwa/`. IndexedDB and OPFS never enter CacheStorage. After the initial SW install/controller attachment, the shell can reload offline and still edit / append synthetic bytes to OPFS via a dedicated Worker.
- **TC34**: the installing SW **does not** call `skipWaiting()`. The user can check for an update, and only after the maintenance lock is exclusively available will the app request activation. There is no automatic `location.reload()`. The explicit reload control blocks while this tab is writing or simulating recording.
- **TC35**: `v1` fixture to `v2` schema migration, using one atomic IndexedDB transaction that stores an intact v1 snapshot and updates Meeting and NoteDocument. All ProseMirror JSON/timeSpan mark attrs, recording IDs, note text, and note revision are retained. A corrupt old schema or dangling recording link aborts without partial upgrade. An old app refuses to write v2 data.
- Worker writes a **64-byte dummy payload** per tick to OPFS, using `FileSystemSyncAccessHandle` where available. Bytes are counted as committed only after write + flush and worker ACK (or async close on fallback). This is not a real audio durability benchmark. Runs at `crossOriginIsolated=false` without SAB.
- Text changes to the second fixture paragraph autosave via an IndexedDB revision compare-and-swap. A status never claims `Saved` until transaction completion; the first paragraph retains its seeded timeSpan mark.

## Run (without dependencies)

From the repository root, run:

```sh
python -m http.server 8000
```

Open `http://localhost:8000/poc/09-pwa/` in current Chrome or Edge. To emulate the repo-base deployment, serve this directory at `http://localhost:8000/Bien-ban-hop/poc/09-pwa/` or any other prefix. Open two tabs on the **same origin and same meeting ID** to compete for writer access. Use `?meeting=meeting-002` to test a second independent meeting. Install/refresh once while online before trying offline mode.

`file://` is unsupported. `localhost` is a secure context exception for development; use **HTTPS** for real hosting. Browsers can clear OPFS / IndexedDB under quota pressure or when site data is removed. This PoC does not replace an external `.mochop` backup.

## Tests

Runtime-independent deterministic tests (no npm packages to download):

```sh
cd poc/09-pwa
npm test
```

Full real-Chromium tests (requires an ordinary browser without administrator URL blocklists):

```sh
python -m pip install -r poc/09-pwa/requirements-test.txt
python -m playwright install chromium
python -m pytest -q poc/09-pwa/tests/test_pwa.py
```

The Python suite starts a **localhost-only** temporary server at an ephemeral port and copies the fixture into a nested `Bien-ban-hop/poc/09-pwa/` path. The update test patches `const VERSION = 'v1'` and `const APP_VERSION = 'v1'` to `v2` in that **temporary copy only**: old/new app shell, waiting worker, active writer, activation, deliberate reload, migration and persistence are checked end-to-end. It neither edits the repository nor deploys to GitHub Pages. Run the exact same suite on Windows Chrome/Edge before claiming the acceptance tests completed on target hardware.

Current run result, environment blocker and case-by-case evidence: [`tests/RESULTS.md`](tests/RESULTS.md).

## Integration contract / hand-off

- `new MeetingLease(onChange).acquire(meetingId)` returns async `release()` or `null` when already locked; never block forever or invent a fallback IDB lease. Treat an unavailable Web Locks API as a hard read-only error.
- `isRecording()` in the demo reflects simulated capture; inject the real capture-session predicate in the integrated app. The shared maintenance lock must be held for every **future** writer path that modifies schema-bound storage, including future capture/OPFS adapters. The caller must hold it until schema migration/SW activation is complete. A read-only tab may inspect metadata and listen on `BroadcastChannel` but must not write.
- `withMaintenanceLock(work)` returns `{acquired:false}` when any writer is active. It is **not** a proof a microphone can continue after process crash; only committed OPFS bytes and confirmed document transactions are guaranteed.
- Replace `isRecording()` demo state with the real capture-session status when integrating the audio engine. Never auto reload during capture; Web Locks alone do not replace recovery reconciliation of audio journal/manifest. A production migration must include rollback validation, larger fixtures and external backup.
- **Do not deploy this PoC for sensitive notes on the shared `*.github.io` origin.** Paths and SW scopes separate shell routing, but IndexedDB/OPFS and Web Locks are **origin-scoped**, not path-isolated. Use a dedicated HTTPS origin/subdomain (DNS + TLS verification), and export/restore when changing origin. HTTPS/dedicated origin does **not** imply COOP/COEP or `crossOriginIsolated=true`; this implementation intentionally needs neither.
- Cache retention is conservative: old shell versions stay cached so a still-open old client is not deprived of assets. A future production cache garbage collector must delete old versions only after proving no old clients need them; do not clear storage blindly.
- No GitHub Pages deploy, branch merge, DNS change, public release, or user data upload is performed by this workstream.

### Explicit limits

The fixture tests do **not** prove Windows IME behavior, 3-hour microphone recordings, bounded audio file size, browser crash durability, quota eviction, or real GitHub Pages headers. Test results on Node mocks must never be misreported as browser PASS. A CSP/security audit and client-version protocol for future lazy-loaded chunks are required at integration.
