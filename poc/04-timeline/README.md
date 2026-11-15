# G04 · Timeline and immutable anchor resolver (Gói 1.3 fixture PoC)

Self-contained TypeScript with Node 22+ (no package install, external worker, browser or fixtures required). This is an independently tested **math/contract PoC**, not an integrated or released app.

## Reproduce

```sh
cd poc/04-timeline
npm run verify
```

`verify` runs 33 unit/regression cases via `node --experimental-strip-types --test timeline.test.ts timeline.extended.test.ts`, then writes `evidence/synthetic-measurement.json` with exact expected/actual positions. Re-running the generator replaces that deterministic JSON. `npm test` only runs cases; `npm run measure` only generates 2 synthetic clock traces. Type check in an environment with TypeScript installed: `tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext timeline.ts`.

## Handoff API

- `validateManifest(m)` detects invalid/ambiguous segments, media/meeting interval overlaps, sample-range overlaps, wrong references and invalid clock metadata. Paused clocks may have *identical* sample counters across successive monotonic points, but timestamps must increase.
- `inputToSample(m, inputMonoMs)` maps between measured clock→sample calibration points (not `Date.now()`). If outside coverage: `pending`; no sample progress: `gap`; absurd drift or broken manifest: `unsupported`.
- `sampleToMedia(m, sampleIndex)` uses `sampleStart`, `sampleCount`, and `sampleRate` rather than a wall-time guess. All intervals are half-open `[start,end)`.
- `meetingToMedia(m, meetingMs)` explicitly treats `paused`, `gap` and `unavailable`. **Never** pass `audioOffsetMs` to this function: meeting timeline and media timeline are different coordinates.
- `resolve(manifests, recordingId, audioOffsetMs)` requires a matching *recorded media interval* with the right `segmentRefs` and a uniquely covered segment. `valid` returns `segmentId`, `filePath`, `localOffsetMs`, and stable source metadata. Otherwise `pending|missing|gap|unsupported|unlinked` includes a human-readable reason. No nearby-file/other-source fallback, and a complete orphan segment alone is not playable.
- `createLiveAnchor` derives an integer-ms `timeSpan` Mark from clock samples and checks it against meeting time; a not-yet-allocated segment may yield a provisional **pending** media offset, never `valid`. A later manifest can change resolver status without changing the Mark.
- `createPlaybackAnchor` uses the currently selected recording + player head (including pause/seek); no wall-time estimation. Quantization to integer milliseconds selects an offset **inside the same physical source interval and segment**. Extremely short segments with no representable integer-ms point yield `unsupported` rather than pointing to a neighbor.
- `playbackTarget` leaves the original Mark unchanged and returns `playStartMs`, `preRollStatus`, `preRollReason`, `preRollAppliedMs`. Pre-roll crossing unavailable/pending/corrupt media or a meeting gap refuses to jump over the hole; `blocked` starts at the original anchor with a reason. An intentional pause may be crossed when media remains contiguous. Range: 0–30000ms.

## Measured scope

**Fixture results (Linux, Node v22.16.0):** 33 PASS / 0 FAIL. Original 16 tests unchanged and kept passing. 17 additions cover post-pause sample-clock plateau, pre-roll through gaps or an internally corrupt/pending segment, wrong-source cases, missing interval authorization, pending→valid, cross-source imports, 05-player false-gap reproducer (`audioOffsetMs=1805000` valid while the same number as `meetingMs` lies in pause), fractional 44.1kHz boundary, sub-ms impossible Mark, and a 3-hour **virtual-only** 36-segment index.

Synthetic sample-clock measurement (no real waveform/decoder): two separate 20s recorded spans, 3s pause, 1,082 impulses each, two sample rates and injected drift. Target max offset error ≤1000ms; observed:

| Hz / synthetic drift | Max absolute error | P95 absolute error | Result |
|---|---:|---:|---|
| 48,000 / +100 ppm | 0.5207 ms | 0.4746 ms | PASS fixture |
| 44,100 / -80 ppm | 0.609977 ms | 0.473575 ms | PASS fixture |

Committed evidence: [`evidence/synthetic-measurement.json`](evidence/synthetic-measurement.json) (expected/actual sample points, segment IDs, error distributions) and [`evidence/TEST_LOG.md`](evidence/TEST_LOG.md) (commands, environment, SHA, PASS/NOT_RUN).

## Live adapter reproduction (NOT_RUN in this PoC)

On actual Windows Chrome/Edge and the intended microphone, collect `(inputMonoMs, sampleIndex)` in one monotonic clock epoch, inject/observe time-stamped impulses or claps with separately calibrated ground truth, log actual `sampleRate`, captured frame counts, `firstSample` / `sampleCount` / sample discontinuities, pause and stop/resume. Build a manifest only from **durably committed** sink ACK + journal state (a transferred or queued PCM buffer is not saved audio); include missing/undecodable intervals, segment file paths and per-recording IDs. Seek/open the actual decoder at first, last and post-gap positions and compare marked offset with known impulse position; report maximum and P95 error, sample loss, OS/browser versions, microphone/latency setup and tested commit SHA. Exercise disconnect/quota/crash and never treat missing audio as `valid`.

**NOT_RUN:** physical capture, Windows IME/editor, OPFS durable flush and crash, real decoder seek, audio-device clock drift under suspend, and integrated TC13–TC18/22/24/27/28. Those belong to integration and cannot be inferred from fixture math. This PoC should be reviewed before wiring 02-capture/03-opfs/05-player; it neither imports nor waits for their code. No COMMON.md changes, merge or deployment.
