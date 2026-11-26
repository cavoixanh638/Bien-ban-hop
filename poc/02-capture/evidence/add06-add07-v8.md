# G02-ADD-06/07 · Deterministic source-blob regression record

**Observed 15 November 2026 · executor: Code Mode V8 isolate, JavaScript-native deterministic mocks.** This is NOT a `node --test`/clean Git checkout, NOT an actual audio browser, and NOT Windows mic/device evidence. This record refers to source blobs whose contents are committed in the next G02 branch revision. No external network service or other worker source was imported.

## Exact code and regression blobs

| Component | Tested Git blob SHA |
|---|---|
| `src/clock-mapper.mjs` | `8c4cef681c89e1cc3f7d03856a11ce5ad9c1259b` |
| `src/controller.mjs` | `56bd9e9887666c17f08abd68c24ac8a704244fd2` |
| `src/media-recorder.mjs` (existing, unchanged) | `f405811bf9f63da691cb23e11d0fdb407006ca92` |
| `src/stream-spool.mjs` (existing, unchanged) | `7ef9d64d2e95831bc03671ad744d82acf29e1021` |
| `tests/clock-mapper.test.mjs` | `795b676da415c4d3571215b6e8333cc00bd976b4` |
| `tests/lifecycle.test.mjs` | `9653bb637b97168c64b38c61da679f11d4f56eca` |

The V8 test harness evaluated **exact fetched Git blobs**, stripping only module import/export syntax to inject the same modules, Node assertion/test functions, and deterministic browser/MediaRecorder/EventTarget fakes. A first run accidentally used an outdated MediaRecorder blob, yielding an invalid false regression. That run was discarded; the final run used exactly `f405811...` (current branch's MediaRecorder). No new engine code was changed in response to the false regression.

## Final V8 test execution

- Result **24 PASS / 0 FAIL**; 9 mapper cases + 15 lifecycle cases. The eight new G02-ADD-06/07 cases all PASS.
- Exact names as executed:

1. **PASS** — START ACK + periodic + stop map sample points independent of 3-second message delivery delay
2. **PASS** — paused ten seconds yields a paused interval without adding ten seconds of media samples
3. **PASS** — explicit pool gap and sink queue loss must NOT be interpolated as valid audio
4. **PASS** — unavailable source remains unavailable and never maps notes to old sampleIndex
5. **PASS** — zero output timestamp is uncalibrated; later valid context/output pair retrospectively anchors exact Worklet events
6. **PASS** — G02-ADD-06 exact final clock point is valid and 1500ms stays pending until next progress
7. **PASS** — G02-ADD-06 pause/stop/unavailable never reconcile a future note to stale samples
8. **PASS** — G02-ADD-06 pool/sink gaps and bounded pending queue fail closed
9. **PASS** — G02-ADD-06 stopped single-point interval drains pending instead of leaving it forever
10. **PASS** — deferred mic grant: Stop before permission cancels future Start and closes late track
11. **PASS** — double-click Start during prompt is rejected, only one recorder/context can start
12. **PASS** — permission denied/setup failure leaves no live capture resources, and no auto-retry
13. **PASS** — MediaRecorder.stop throwing still releases live tracks/context exactly once; stop idempotent
14. **PASS** — MediaRecorder never acknowledging stop times out without leaving live microphone/context
15. **PASS** — track-ended concurrent with Stop cannot double-stop, and no recording remains
16. **PASS** — Stop at idle is idempotent, and public invalid config is rejected before creation
17. **PASS** — Worker final reject/timeout after stop always terminates worker and closes context
18. **PASS** — Stop during await AudioContext.resume closes the context even after slow setup resolves
19. **PASS** — a pending worker final never resolves: Stop reports timeout and still terminates worker
20. **PASS** — display share with video but no audio track closes granted screen track and never claims TC21 PASS
21. **PASS** — G02-ADD-07 Stop returns while mic permission never settles and reports pending cleanup
22. **PASS** — G02-ADD-07 late grant stops original track once and then permits a new session
23. **PASS** — G02-ADD-07 late rejection and repeated stop are safe while display grant is unresolved
24. **PASS** — G02-ADD-07 late display grant releases both audio and video tracks exactly once

## Explicit status boundaries

| Requirement | Result | Source/method |
|---|---|---|
| ADD-06: t=1000 exact -> 48,000; t=1500 -> pending then 72,000 after t=2000 | **PASS** | exact mapper blob V8 |
| ADD-06: stop/pause/gap/track-ended + one-point closure fail closed | **PASS** | V8 synthetic timestamps and queue |
| ADD-07: Stop while permission promise never settles | **PASS** | V8 deferred promise; no live track granted |
| ADD-07: grant late, deny late, double Start, release display audio+video once | **PASS** | V8 fake MediaStreamTracks |
| Existing lifecycle/mapper compatibility | **PASS 16/16** | V8 as above |
| Whole suite `npm test` on **new** Code SHA | **NOT_RUN** | private repo cannot be cloned/downloaded into current container to execute Node on exact SHA |
| Browser AudioWorklet/MediaRecorder/micro/permission prompt | **NOT_RUN** | managed Chromium URLBlocklist + no usable real mic |
| 3-hour wall-clock capture, Chrome/Edge Windows, online track TC21 | **NOT_RUN** | no Windows/physical device and wall-clock trial |
| G03 durability flush/journal | **NOT_RUN in G02** | outside G02 ownership, ACK buffer reuse ≠ committed ACK |

Prior unchanged PoC on Code SHA `0083a670e5537952899afb247949bc71442b46b8` had **36/36 Node PASS**. This is historical evidence, **not 44/44 Node PASS on the newly changed SHA**. The new suite contains 44 test declarations (36 original + 8 new); it must be run as `cd poc/02-capture && npm test` on a byte-exact checkout with Node >=22, and the resulting stdout + tested SHA recorded before any statement that all 44 pass.

**Known limitations**: pending anchor queue is in-memory and bounded to 1,024; editor revision journal/reconciliation is a future integration adapter, not a change to COMMON or a new timeSpan Mark field. Permission prompts have no reliable AbortSignal; pending resource state is intentionally not reported as released until the OS promise settles. When a prompt never settles, a new recording is blocked in this page to prevent duplicate ownership. Chromium headless inability is environmental, not a PASS for production UX.
