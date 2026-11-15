# PoC 07 — .mochop streaming ZIP/restore (reference oracle)

This folder is self-contained. `mochop.py` is a **Python 3 stdlib reference/fixture adapter**, not a browser production implementation. It uses a 1 MiB streaming read/write buffer, ZIP Central Directory reading via `zipfile`, ZIP64-aware writes and SHA-256. It does **not** compare/benchmark JavaScript libraries or demonstrate actual OPFS/IndexedDB integration.

## Commands

```bash
cd poc/07-backup
python3 -m unittest -v test_mochop.py
python3 mochop.py fixture /tmp/meeting-fixture --bytes 536870912
python3 mochop.py export /tmp/meeting-fixture /tmp/meeting-512.mochop
python3 mochop.py import /tmp/meeting-512.mochop /tmp/restored-meetings
# 2 GiB (create in separate clean directories):
python3 mochop.py fixture /tmp/meeting-2g --bytes 2147483648
python3 mochop.py export /tmp/meeting-2g /tmp/meeting-2g.mochop
python3 mochop.py import /tmp/meeting-2g.mochop /tmp/restore-2g
# Linux memory measurement:
 /usr/bin/time -f 'peak_kb=%M wall=%e' python3 mochop.py export /tmp/meeting-2g /tmp/bench.mochop
```

The fixture uses deterministic **synthetic bytes**, not valid recorded PCM. The source files represent a common fixture contract, including ProseMirror JSON and `timeSpan` marks, one Meeting, one Recording Manifest, and one segment. Do not interpret audio length/sample metadata as actual audio for the generated volume.

## Format .mochop v1 (provisional)

| ZIP entry | Semantics |
|---|---|
| `manifest.json` | `format:mochop`, `formatVersion:1`, `schemaVersion:1`, `appVersion`, `meetingIds`, `files[{path,size,sha256}]` |
| `meeting.json` | Meeting fixture: ID, title, note ID, recording IDs |
| `note.json` | NoteDocument fixture with original ProseMirror content/marks and revision |
| `audio-manifest.json` | Recording ID, mappingPoints, segments, timeline intervals |
| `audio/<segment>.pcm` | Audio bytes referenced by relative `filePath` |

Export places `manifest.json` last after streaming and hashing all other entries. Import opens Central Directory, validates all declared files including sizes and SHA-256 in a private staging directory, validates meeting/note/audio relationships, and publishes a new meeting directory only after successful validation. Import collision is rejected, never overwritten. Optional missing audio is permitted **only** with explicit `--allow-missing-audio`; segment status becomes `missing` with an explanatory reason, while original note marks remain unchanged.

Safety controls: reject absolute/drive/traversal/noncanonical paths, symlinks, duplicate/casefold names, unlisted files, unsupported schema, invalid sha, missing required metadata, compression ratio >200, >10000 entries, aggregate uncompressed bytes >8 GiB, and oversized manifest. They are conservative PoC limits and require browser product threat modeling. Staging directory is discarded on failure. `os.replace` publication assumes same-filesystem atomic rename; a browser IndexedDB/OPFS adapter requires its own transaction+journal semantics.

## Candidate libraries: design comparison, **not benchmarked**

| Candidate | Export | Import | ZIP64 and bounded memory | Status |
|---|---|---|---|---|
| `fflate` | streaming ZIP writer APIs | incremental unzip APIs | ZIP64 support/queue behavior **must be verified with exact API/version** | NOT_RUN |
| `client-zip` | browser-friendly streaming ZIP export | no matching established import pipeline in this PoC | ZIP64 and backpressure **must be measured**, not inferred | NOT_RUN |
| `zip.js` | stream readers/writers and ZIP entry APIs | Central Directory/random-access ZIP reader | ZIP64/limits to be benchmarked on Chrome/Edge | NOT_RUN |
| Python stdlib `zipfile` | streaming files, ZIP64-aware | Central Directory seek and streaming individual entries | measured only on Linux reference fixture | PARTIAL PASS |

**Do not select a production JS library from this comparison.** The next runnable experiment must pin package versions and benchmark the same 512 MiB / 2 GiB datasets in Chrome/Edge Windows, using actual OPFS input/output and a separate target environment for cross-machine round-trip. In particular, bounded 1 MiB `read()` chunks do not prove total RAM bounded for every library. Validate native ZIP64 by 4+ GiB entry or 65536+ entries; `force_zip64=True` in the Python reference writes ZIP64-capable entry headers but is not a full multi-library interoperability test.

## Evidence and limitations

See `RESULTS.md` for observed numbers. Tests are standalone-reference **TC30/TC38 subcases**; TC31 browser comparison, Windows runtime, actual two-machine restore and production storage remain **NOT_RUN**. The source is an adapter starting point; there is no existing app to integrate on this branch. Do not claim Gói 1.5 PASS on these results.
