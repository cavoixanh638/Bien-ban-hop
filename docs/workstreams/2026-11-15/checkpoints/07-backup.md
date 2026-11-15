# Checkpoint · 07-backup

- Owner: Gemini 07-backup · branch: `gemini/20261115-07-backup`
- Baseline: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- Status: **IN_PROGRESS / PARTIAL_DELIVERABLE**, **NOT DONE**
- Current evidence commit: `6e7a0b7b2c356c25705e78979d8db00e07c49aa6`
- Code/test commit: `c77ffb0d2d9e06fad5ea2d690fa2edaf616f5e6b`
- Tested SHA of **local original reference script**: SHA256 `43386dd7da58c04867d7f0a6208bac3215a3449fb3dea4d3a91af2e3392bfff8`
- Exact committed GitHub `mochop.py` blob SHA: `ca36bc562a12ead5192a18fcc8fcc63b61637308` (not independently runtime-tested yet).
- Test status: **10/10 PASS locally on equivalent Python reference**; **NOT_RUN on exact committed revision, browsers or Windows**.
- Environment: Linux x86_64 kernel 6.18.57, Python 3.13.5; synthetic 512 MiB/2 GiB archive; no real meeting audio.
- Scope written: only `poc/07-backup/` and this checkpoint.

## Delivered

1. [Reference exporter/importer](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-07-backup/poc/07-backup/mochop.py): .mochop ZIP, schema/version/checksum, streaming 1 MiB chunks, ZIP64-capable entry headers; verify staging before publish, reject existing ID, optional missing-audio state.
2. [Tests](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-07-backup/poc/07-backup/test_mochop.py): round-trip, marks, optional missing audio, checksum, rollback, malicious paths, bomb, collision, schema and truncated archive.
3. [README and fixture commands](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-07-backup/poc/07-backup/README.md): self-contained Python 3 standard library implementation and provisional format.
4. [Measurements](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-07-backup/poc/07-backup/RESULTS.md): synthetic 512 MiB: export wall 2.13 s / peak RSS 98,568 KiB, import 1.36 s / 98,700 KiB; 2 GiB: export 3.72 s / 98,568 KiB, import 4.02 s / 98,568 KiB. Separate 65,536-entry ZIP64 EOCD verified (not import, because safety policy has 10k entry cap). These are local reference observations, not JavaScript/browser benchmarks.

## Acceptance

| Requirement | Status | Why |
|---|---|---|
| TC30 round-trip text/marks/audio/checksum | **PARTIAL** | Synthetic local reference works; browser DB/OPFS and cross-machine restore NOT_RUN |
| TC31 large 512 MiB and 2 GiB restore | **PARTIAL** | Local Python reference measured; pinned fflate/client-zip/zip.js comparisons, browser random-access/backpressure/JS heap, >4GiB interop NOT_RUN |
| TC38 missing audio preserves text | **PARTIAL** | Synthetic mock works with explicit allow_missing_audio; browser/UI not integrated |
| Malicious archive/rollback | **PARTIAL** | Local negative tests pass; exact committed SHA and real browser adapter NOT_RUN |

## Remaining (do not mark DONE until proven)

- Run test suite from a **clean clone of this exact GitHub branch**, record tested commit SHA, fix any drift between local and GitHub script.
- Implement three independent pinned JS candidate adapters; obtain npm access and run in Windows Chrome + Edge with actual streaming/OPFS, quota/backpressure and user-visible progress instrumentation. No npm registry access in this worker environment.
- Run 512 MiB, 2 GiB comparative benchmark for each candidate; separate ZIP64 interoperability and decompression limits; capture peak RAM and throughput both ways with run logs.
- Reopen .mochop on another actual device/browser; verify original text, marks, media mapping, missing-source and collision/rollback in IndexedDB/OPFS staging.
- Hand off final measured recommendation to commander to decide D13; do not alter shared tracker or status as worker.

Previous checkpoint said NOT_STARTED; this update is an explicit partial handoff. Local working originals were held in `/mnt/data/backup_poc/`, and committed Github scripts are a compact adaptation rather than byte-identical.

## WIP tiếp quản 15/11/2026 — trước benchmark dài

- Đọc TRACKER.md của G00: công việc 07 chưa qua 3 ứng viên ZIP JS/browser; code/tested SHA của bản GitHub cũ chưa có bằng chứng exact checkout.
- LOCAL_ONLY hiện tại: `/mnt/data/bien-ban-hop-07/poc/07-backup/` đang phát triển ZIP64 streaming JS/Web Streams, mock staging Node và adapter OPFS/IndexedDB. 13/13 Node tests PASS bản local WIP; benchmark 1 MiB Node PASS; chưa push nên chưa có Code SHA/Tested SHA mới.
- Chromium Playwright navigation `localhost`, `https` route, `file://` bị `ERR_BLOCKED_BY_ADMINISTRATOR`: browser/OPFS NOT_RUN. npm registry/GitHub DNS từ container không truy cập được: fflate/client-zip/zip.js thực tế NOT_RUN, adapter phải đánh dấu unverified.
- Chạy benchmark 512 MiB, 2 GiB/ZIP64 và kiểm đường dẫn âm tính trước khi push; giữ các PASS 10/10 Python reference cũ theo phạm vi cũ.
