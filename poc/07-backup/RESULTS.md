# PoC 07 — evidence (15 Nov 2026)

## What actually ran

Environment: Linux x86_64 kernel 6.18.57, Python 3.13.5, local overlay filesystem (32 GiB), approximately 5.8 GiB total RAM. No actual Windows Chrome/Edge or user device involved. These runs used a local reference prototype equivalent in design to the committed `mochop.py`; **the exact committed source SHA has not been independently executed after GitHub write**.

Local source SHA-256: `43386dd7da58c04867d7f0a6208bac3215a3449fb3dea4d3a91af2e3392bfff8`. Tests SHA-256: `d0bc343d6a5ae6843ff7a108b62d3365633864f9902a53c11f70eb1ef1a98623`. Files committed to GitHub are the compacted reference implementation and its own equivalent tests; rerun from fresh GitHub checkout required before attributing local results to GitHub revision.

Local command: `python3 -m unittest -q test_mochop`. Actual: **10 tests, 10 PASS, 0 FAIL** after correcting a test-only expectation for a pre-existing meeting collision.

Covered: full text/mark/audio exact round-trip; missing audio strict reject; missing audio optionally publish with original text/Mark untouched and audio=missing; bad checksum rollback; unsupported schema; path traversal; ZIP bomb ratio; casefold name collision; truncated archive; invalid manifest mapping; duplicate meeting ID no overwrite. Test corpus: synthetic 2 MiB audio.

## Streaming reference throughput

Numbers are directly observed values for local synthetic data with a 1 MiB read buffer, no encryption, ZIP_STORED (no compression), local warm filesystem caches. **Not universal performance estimates.**

| Fixture audio | ZIP bytes | Export wall | Export peak RSS | Restore wall | Restore peak RSS | Result |
|---|---:|---:|---:|---:|---:|---|
| 512 MiB (536,870,912 B) | 536,873,024 B | 2.13 s | 98,568 KiB | 1.36 s | 98,700 KiB | PASS in local prototype |
| 2 GiB (2,147,483,648 B) | 2,147,485,869 B | 3.72 s | 98,568 KiB | 4.02 s | 98,568 KiB | PASS in local prototype |

Large-file content / SHA256 validated by streaming; exported manifest preserves ProseMirror JSON, original timeSpan, recording and segment mapping. Per-process peak RSS obtained from GNU `/usr/bin/time -f %M`, not JS heap. Wall time includes startup and ZIP I/O; values may be dominated by OS page cache and sparse/duplicated synthetic patterns.

ZIP64 separate fixture: Python `zipfile` wrote **65,536 zero-byte entries** to a 6,946,914-byte ZIP; read back exactly 65,536 entries; ZIP64 EOCD signature `PK\\x06\\x06` detected. 0.512 and 2 GiB fixtures alone do not force a >4 GiB ZIP entry. The PoC restore policy intentionally rejects >10,000 entries (anti-bomb), so the 65,536-entry test validates the ZIP64 writer/reader format only, **not successful restore**.

## Acceptance disposition

| TC | Result | Reason |
|---|---|---|
| TC30 | PARTIAL / NOT_RUN for product | Local reference fixture round-trip validated; no browser storage adapter or cross-environment restore |
| TC31 | NOT_RUN for required comparison | Python reference measured; fflate/client-zip/zip.js on Windows Chrome/Edge not benchmarked; backpressure/JS peak heap not evidenced |
| TC38 | PARTIAL / NOT_RUN for product | Local reference fixture preserves text and marks when audio missing; product resolver/UI not connected |

To reach DONE: run checked-in code/tests from fresh checkout; port to browser streaming APIs; compare 3 pinned JS versions using identical 512 MiB / 2 GiB fixture; measure user-visible progress, worker queue backpressure, ZIP64 interoperability, RAM and quota; validate staging in IndexedDB/OPFS, Windows Chrome and Edge, and genuine cross-machine restore. Do not treat this evidence as release approval.
