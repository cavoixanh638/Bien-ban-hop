import { mkdirSync, writeFileSync } from 'node:fs';
import { createLiveAnchor, resolve, validateManifest, meetingToMedia } from './timeline.ts';

const R = 20000; // 20s recorded, a real 3000ms pause, then 20s recorded
const PAUSE = 3000;
const TARGET_MS = 1000;
function runScenario(sampleRate, driftPpm) {
  const count = Math.round(sampleRate * (R / 1000) * (1 + driftPpm / 1e6));
  const duration = count * 1000 / sampleRate;
  const half = Math.round(count / 2);
  const m = {
    recordingId: `synthetic-${sampleRate}-${driftPpm}`,
    sampleRate,
    mappingPoints: [
      { inputMonoMs: 0, sampleIndex: 0 },
      { inputMonoMs: R / 2, sampleIndex: half },
      { inputMonoMs: R, sampleIndex: count },
      { inputMonoMs: R + PAUSE, sampleIndex: count },
      { inputMonoMs: R + PAUSE + R / 2, sampleIndex: count + half },
      { inputMonoMs: 2 * R + PAUSE, sampleIndex: 2 * count },
    ],
    segments: [
      { segmentId: 'first', filePath: 'first.synthetic.wav', mediaStartMs: 0, mediaDurationMs: duration,
        sampleStart: 0, sampleCount: count, completionState: 'complete' },
      { segmentId: 'second', filePath: 'second.synthetic.wav', mediaStartMs: duration, mediaDurationMs: duration,
        sampleStart: count, sampleCount: count, completionState: 'complete' },
    ],
    intervals: [
      { kind: 'recorded', meetingStartMs: 0, meetingEndMs: R, mediaStartMs: 0, mediaEndMs: duration, segmentRefs: ['first'] },
      { kind: 'paused', meetingStartMs: R, meetingEndMs: R + PAUSE, segmentRefs: [], reason: 'synthetic pause' },
      { kind: 'recorded', meetingStartMs: R + PAUSE, meetingEndMs: 2 * R + PAUSE,
        mediaStartMs: duration, mediaEndMs: 2 * duration, segmentRefs: ['second'] },
    ],
  };
  const valid = validateManifest(m);
  if (valid.length) throw Error(`invalid fixture: ${valid.join('; ')}`);
  const errors = [], cases = [];
  let countValid = 0;
  function check(t) {
    const expected = t < R ? t * duration / R : duration + (t - R - PAUSE) * duration / R;
    const { anchor, resolution } = createLiveAnchor(m, { anchorId: `impulse-${t}`, recordingId: m.recordingId,
      typedAt: 1794740000000 + t, inputMonoMs: t, sessionMonoOriginMs: 0, meetingOriginMs: 0 });
    if (resolution.status !== 'valid') throw Error(`nonplayable impulse t=${t}, status=${resolution.status}: ${resolution.reason}`);
    if (anchor.audioOffsetMs !== null && !Number.isInteger(anchor.audioOffsetMs)) throw Error('non-integer anchor');
    if (resolution.segmentId !== (t < R ? 'first' : 'second')) throw Error(`wrong source segment t=${t}: ${resolution.segmentId}`);
    if (anchor.audioOffsetMs === null || resolve([m], m.recordingId, anchor.audioOffsetMs).status !== 'valid') {
      throw Error(`anchor cannot resolve t=${t}`);
    }
    const actual = anchor.audioOffsetMs;
    const absoluteErrorMs = Math.abs(actual - expected);
    errors.push(absoluteErrorMs);
    countValid += 1;
    if (cases.length < 5 || t === R + PAUSE || t >= 2 * R + PAUSE - 100) {
      cases.push({ inputMonoMs: t, expectedAudioOffsetMs: Number(expected.toFixed(6)),
        actualAudioOffsetMs: actual, absoluteErrorMs: Number(absoluteErrorMs.toFixed(6)),
        expectedStatus: 'valid', actualStatus: resolution.status, segmentId: resolution.segmentId });
    }
  }
  for (let t = 0; t < R; t += 37) check(t);
  for (let t = R + PAUSE; t < 2 * R + PAUSE; t += 37) check(t);
  // Exact half-open boundaries and pause are expected non-playable without fake offsets.
  const pauseActual = meetingToMedia(m, R + 100).status;
  if (pauseActual !== 'unlinked') throw Error(`pause status ${pauseActual}`);
  errors.sort((a, b) => a - b);
  const maxErrorMs = errors.at(-1);
  const p95ErrorMs = errors[Math.ceil(errors.length * 0.95) - 1];
  if (maxErrorMs > TARGET_MS) throw Error(`max error ${maxErrorMs} > ${TARGET_MS}`);
  return { sampleRate, injectedClockDriftPpm: driftPpm, recordedDurationMs: R,
    pauseDurationMs: PAUSE, mediaDurationMsPerSegment: Number(duration.toFixed(6)),
    impulseCount: countValid, sampleCountPerSegment: count,
    targetMaxErrorMs: TARGET_MS, maxAbsErrorMs: Number(maxErrorMs.toFixed(6)),
    p95AbsErrorMs: Number(p95ErrorMs.toFixed(6)), result: 'PASS',
    nonplayableCase: { inputMonoMs: R + 100, expectedStatus: 'unlinked', actualStatus: pauseActual },
    expectedActualCases: cases };
}
const report = {
  kind: 'synthetic_silence_impulse_clock_sample_mapping',
  schemaVersion: 1,
  note: 'Math/fixture sample-clock model, not physical microphone or browser decoder measurements.',
  timeBasis: 'monotonic ms (not wall-clock UTC); pause retains meeting time but consumes no media',
  scenarios: [runScenario(48000, 100), runScenario(44100, -80)],
};
mkdirSync(new URL('./evidence/', import.meta.url), { recursive: true });
writeFileSync(new URL('./evidence/synthetic-measurement.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
for (const s of report.scenarios) {
  console.log(`SYNTHETIC ${s.sampleRate}Hz drift=${s.injectedClockDriftPpm}ppm: ${s.impulseCount} impulses, max=${s.maxAbsErrorMs}ms, P95=${s.p95AbsErrorMs}ms <=${TARGET_MS}ms PASS`);
}
