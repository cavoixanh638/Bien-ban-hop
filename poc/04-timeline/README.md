# 04 — Timeline and anchor resolver PoC

Standalone TypeScript fixture PoC for **Gói 1.3** (not integrated product evidence).

## Run from a clean checkout

```sh
cd poc/04-timeline
npm test
```

Uses Node >=22.6 (verified locally on Node 22.16.0), no dependencies; tests run via Node's experimental type-stripping. `npm install` is not necessary. Synthetic fixtures are generated inside `timeline.test.ts`.

## API and contract

- `validateManifest(m)`: reject ambiguous/invalid source timeline.
- `inputToSample(m, inputMonoMs)`: interpolation between measured monotonic-clock↔sample points; no wall clock extrapolation; configurable drift ceiling (default 5000ppm).
- `sampleToMedia(m, sampleIndex)`: media offset from segment's counted samples.
- `meetingToMedia(m, meetingMs)`: mapping via half-open recorded intervals; explicit paused/unavailable/gap statuses.
- `resolve(manifests, recordingId, audioOffsetMs)`: `valid` with `segmentId`, `filePath`, `localOffsetMs`, or `pending|missing|gap|unsupported|unlinked` with explanation. **No fallback to adjacent media or another recording**.
- `createLiveAnchor`: independent meeting/sample-clock cross-check and original typedAt/source; failure leaves `audioOffsetMs=null`.
- `createPlaybackAnchor`: use selected recording's current player position, including paused or post-seek; never Date.now for media mapping.
- `playbackTarget`: pre-roll only at play time, never change original anchor.

The committed fixture follows COMMON.md manifest/Mark fields and adds segment completion states for fake storage. Sample/segment state is synthetic, not proof of audio commit. Production storage must supply actual durable committed boundaries and metadata.

## Test evidence

Local command `npm test`, Node 22.16.0 Linux, 16/16 PASS, 0 FAIL. Tests cover first/end boundaries, pause/gap, bad segment, multiple sources, playback seek/pause, drift and out-of-calibration, pending→valid, wrong-source rejection, manifest conflicts, orphan-segment-without-recorded-interval rejection, immutable pre-roll.

Synthetic impulse **clock calculation**: 271 deterministic positions at 37ms steps with synthetic +100ppm clock drift and 48kHz sample counter; expected≤1000ms, observed **maximum 0.508ms** (rounded millisecond output). This measures numerical mapping only, **not real microphone/input event/audio device latency**.

Reproduce on real capture during integration: inject timestamped sample impulses at known monotonic instants, collect `inputMonoMs` and committed `sampleIndex`, verify WAV/segment sample boundaries and media decoder positions; compute absolute (resolved offset - ground-truth impulse offset), max/P95 and any missing sample intervals. Record Windows build, Chrome/Edge version, audio device/sample rate, clock source, exact commit SHA and logs. Real-device measurement is **NOT_RUN**.

## Integration limitations

PoC has no live capture, OPFS, media decoding, Windows browser traces or integration with editor/player. The current fixture models a single monotonic epoch and assumes exact meeting-origin mapping; deliberate clock reset or suspend requires separate clock epochs and explicit gap metadata. The dynamic storage manifest must be refreshed to transition pending→valid. This package is not a claim that TC13–TC18 or Gói 1.3 has passed on the integrated application.
