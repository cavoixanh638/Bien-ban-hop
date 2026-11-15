# G04 · Fixture verification receipt · 2026-11-15

**Scope:** independent TypeScript Timeline resolver, not integrated Windows/browser capture or player. **Result:** fixture PoC PASS; integrated V1.2 package NOT_RUN.

## Exact source identity and test command

- Repository: `cavoixanh638/Bien-ban-hop`, branch `gemini/20261115-04-timeline`
- GitHub HEAD at source-tree verification: `dca5f58b97a6d340541bafede671d42add9e3498`
- GitHub `poc/04-timeline/` Git tree SHA: `b970ff7565563f4f6aeedbda87cc6602abe1b0cc`
- Local `git write-tree` of the seven source/report files: `b970ff7565563f4f6aeedbda87cc6602abe1b0cc` (exact match)
- Source blob SHA: `timeline.ts=e1d4f2e787c868cbb2a7f1b8820b2a63d2585d29`
- Test blobs: `timeline.test.ts=448dd1e99ae3875c1776086d2f8fb06ad5ba163f` and `timeline.extended.test.ts=796d9787b33797d17e1cdd219c8556be9bd7bd44`
- Fixture generator blob: `measure-fixture.mjs=ec921cb95eaff3efaf27b4402b600c809689fa45`
- Runner blob: `package.json=d75ff6dd9cf3153c957bd97297286a9c5c8f428a`
- Operating environment: Linux x86_64; Node.js `v22.16.0`; npm `10.9.2`; TypeScript CLI `5.8.3`
- Materialization method: clean directory from locally reconstructed Git tree, where each blob and tree SHA were matched against the live GitHub API. Full `git clone` through `github.com` was unavailable because DNS resolution failed; do not call this a full-repository network clone.
- Commands from fresh subtree: `npm run verify` and `tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext timeline.ts`

## Actual output excerpt (clean materialized source)

```text
TAP version 13
# tests 33
# pass 33
# fail 0
# duration_ms 345.124781
SYNTHETIC 48000Hz drift=100ppm: 1082 impulses, max=0.5207ms, P95=0.4746ms <=1000ms PASS
SYNTHETIC 44100Hz drift=-80ppm: 1082 impulses, max=0.609977ms, P95=0.473575ms <=1000ms PASS
TypeScript (tsc 5.8.3): exit 0
```

**Case coverage:** unchanged original 16/16 PASS, additional 17/17 PASS. Additional cases include a plateau in `inputMonoMs↔sampleIndex` during pause, resumed live anchor, source-identity pre-roll, missing/corrupt/pending transitions, `G00/05` false-gap reproducer (`resolve(audioOffsetMs=1805000)` valid while `meetingMs=1805000` is paused), imported seek, wrong recording, fractional segment start 44.1kHz, unrepresentable sub-millisecond segment and 3-hour virtual 36-segment addressing. Report contains explicit assertions expected=actual for statuses, offsets and `segmentId`.

**Synthetic error:** target ≤1000 ms. 48 kHz/+100 ppm maximum `0.5207 ms`, P95 `0.4746 ms`; 44.1 kHz/−80 ppm maximum `0.609977 ms`, P95 `0.473575 ms`; fixture PASS. The 1082 input instants per scenario span two 20-second recorded portions and an excluded 3-second pause. All 1082 points per scenario were asserted to the correct segment; exact sample expected/actual positions and gap status are saved in `synthetic-measurement.json` (SHA `67286b0ac23a525ffe1dd84317a7dd70a66546cb`). A separate original 271-point clock check remains in the unchanged 16-test suite.

## Separate unexecuted gates

- `NOT_RUN`: Windows 10/11 Chrome/Edge microphone `inputMonoMs` ↔ physical sample clock; actual device latency or drift after sleep/wake.
- `NOT_RUN`: real PCM capture, OPFS committed ACK + crash/quota, decode/seek and media playback with measured sound; G02/G03/G05 adapter integration.
- `NOT_RUN`: integrated TC13–TC18/22/24/27/28 and product release. A 3-hour **virtual index test** is not a 3-hour microphone/audio durability test.
- No PASS asserted for real media, CPU/RAM, browser behavior, or integrated functionality. Production storage must supply correct durable segment completion state before resolver can return `valid`.
