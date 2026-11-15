import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLiveAnchor, createPlaybackAnchor, inputToSample, meetingToMedia,
  playbackTarget, resolve, sampleToMedia, validateManifest, type Manifest,
} from './timeline.ts';

function fixture(): Manifest {
  return {
    recordingId: 'session-1', sampleRate: 48000,
    mappingPoints: [{ inputMonoMs: 0, sampleIndex: 0 }, { inputMonoMs: 10000, sampleIndex: 480000 },
      { inputMonoMs: 12000, sampleIndex: 480000 }, { inputMonoMs: 22000, sampleIndex: 960000 }],
    segments: [
      { segmentId: 's1', filePath: 's1.wav', mediaStartMs: 0, mediaDurationMs: 10000, sampleStart: 0, sampleCount: 480000, completionState: 'complete' },
      { segmentId: 's2', filePath: 's2.wav', mediaStartMs: 10000, mediaDurationMs: 10000, sampleStart: 480000, sampleCount: 480000, completionState: 'complete' },
    ],
    intervals: [
      { kind: 'recorded', meetingStartMs: 0, meetingEndMs: 10000, mediaStartMs: 0, mediaEndMs: 10000, segmentRefs: ['s1'] },
      { kind: 'paused', meetingStartMs: 10000, meetingEndMs: 12000, segmentRefs: [], reason: 'intentional pause' },
      { kind: 'recorded', meetingStartMs: 12000, meetingEndMs: 22000, mediaStartMs: 10000, mediaEndMs: 20000, segmentRefs: ['s2'] },
    ],
  };
}
function live(m: Manifest, inputMonoMs: number) {
  return createLiveAnchor(m, { recordingId: m.recordingId, anchorId: 'note-1', typedAt: 1794740000000,
    inputMonoMs, sessionMonoOriginMs: 0, meetingOriginMs: 0 });
}

test('pause plateau is valid manifest, no sample advances, resume maps to second segment', () => {
  const m = fixture();
  assert.deepEqual(validateManifest(m), []);
  assert.equal(inputToSample(m, 10000).status, 'gap');
  assert.equal(inputToSample(m, 11000).status, 'gap');
  assert.equal(inputToSample(m, 12000).sampleIndex, 480000);
  assert.equal(meetingToMedia(m, 11000).status, 'unlinked');
  assert.equal(live(m, 11000).anchor.audioOffsetMs, null);
  const resumed = live(m, 13000);
  assert.equal(resumed.anchor.audioOffsetMs, 11000);
  assert.equal(resumed.resolution.status, 'valid');
  assert.equal(resumed.resolution.segmentId, 's2');
  assert.equal(resumed.resolution.localOffsetMs, 1000);
});

test('clock boundary does not advance one sample into after-pause source', () => {
  const m = fixture();
  const nearBoundary = live(m, 9999.995);
  assert.equal(nearBoundary.resolution.status, 'valid');
  assert.equal(nearBoundary.resolution.segmentId, 's1');
  assert.equal(nearBoundary.anchor.audioOffsetMs, 9999);
  assert.equal(inputToSample(m, 9999.995).sampleIndex, 479999);
});

test('gap meeting time with physically contiguous media blocks cross-gap pre-roll', () => {
  const m = fixture();
  m.intervals[1].kind = 'gap';
  m.intervals[1].reason = 'microphone unplugged';
  const original = { recordingId: 'session-1', audioOffsetMs: 12000 };
  assert.equal(resolve([m], original.recordingId, original.audioOffsetMs).status, 'valid');
  const t = playbackTarget([m], original, 5000);
  assert.equal(t.resolution.status, 'valid');
  assert.equal(t.preRollStatus, 'blocked');
  assert.equal(t.playStartMs, 12000);
  assert.equal(t.preRollAppliedMs, 0);
  assert.match(t.preRollReason!, /microphone unplugged/);
  assert.equal(original.audioOffsetMs, 12000);
  assert.equal(meetingToMedia(m, 11000).status, 'gap');
});

test('intentional pause compresses timeline but pre-roll remains legal across it', () => {
  const m = fixture();
  const t = playbackTarget([m], { recordingId: 'session-1', audioOffsetMs: 12000 }, 5000);
  assert.equal(t.preRollStatus, 'applied');
  assert.equal(t.playStartMs, 7000);
  assert.equal(t.preRollAppliedMs, 5000);
});

test('pre-roll checks all intermediate segments, not just valid start and end', () => {
  const m = fixture();
  m.segments = [
    { segmentId: 'a', filePath: 'a.wav', mediaStartMs: 0, mediaDurationMs: 5000, sampleStart: 0, sampleCount: 240000, completionState: 'complete' },
    { segmentId: 'b', filePath: 'b.wav', mediaStartMs: 5000, mediaDurationMs: 5000, sampleStart: 240000, sampleCount: 240000, completionState: 'corrupt' },
    { segmentId: 'c', filePath: 'c.wav', mediaStartMs: 10000, mediaDurationMs: 10000, sampleStart: 480000, sampleCount: 480000, completionState: 'complete' },
  ];
  m.intervals[0].segmentRefs = ['a', 'b'];
  m.intervals[2].segmentRefs = ['c'];
  assert.equal(resolve([m], 'session-1', 2000).status, 'valid');
  assert.equal(resolve([m], 'session-1', 12000).status, 'valid');
  assert.equal(resolve([m], 'session-1', 7500).status, 'missing');
  const t = playbackTarget([m], { recordingId: 'session-1', audioOffsetMs: 12000 }, 10000);
  assert.equal(t.preRollStatus, 'blocked');
  assert.equal(t.playStartMs, 12000);
  assert.match(t.preRollReason!, /missing|corrupt/);
});

test('pending segment in pre-roll refuses autoplay; pending-to-valid allows it without mark change', () => {
  const m = fixture();
  m.segments[0].completionState = 'pending';
  const anchor = { recordingId: 'session-1', audioOffsetMs: 12000 };
  assert.equal(playbackTarget([m], anchor, 5000).preRollStatus, 'blocked');
  m.segments[0].completionState = 'complete';
  assert.equal(playbackTarget([m], anchor, 5000).preRollStatus, 'applied');
  assert.equal(anchor.audioOffsetMs, 12000);
});

test('pre-roll clamp at zero and invalid range reported with unchanged source anchor', () => {
  const m = fixture(); const a = { recordingId: 'session-1', audioOffsetMs: 1200 };
  const t = playbackTarget([m], a, 5000);
  assert.equal(t.playStartMs, 0);
  assert.equal(t.preRollStatus, 'clamped');
  assert.equal(t.preRollAppliedMs, 1200);
  assert.equal(playbackTarget([m], a, -1).resolution.status, 'unsupported');
  assert.equal(a.audioOffsetMs, 1200);
});

test('no interval coverage even with a complete file never returns valid', () => {
  const m = fixture(); m.intervals = [];
  assert.equal(resolve([m], 'session-1', 5000).status, 'gap');
});

test('unavailable and gap with media ranges keep distinct status and original reason', () => {
  const m = fixture();
  m.intervals[2].kind = 'unavailable'; m.intervals[2].segmentRefs = [];
  m.intervals[2].reason = 'restore checksum mismatch';
  assert.equal(resolve([m], 'session-1', 12000).status, 'missing');
  assert.match(resolve([m], 'session-1', 12000).reason, /checksum/);
  m.intervals[2].kind = 'gap'; m.intervals[2].reason = 'capture underrun';
  assert.equal(resolve([m], 'session-1', 12000).status, 'gap');
  assert.match(resolve([m], 'session-1', 12000).reason, /underrun/);
});

test('reproduces G00 05 meeting-time vs media-offset confusion (media 1,805,000 is valid)', () => {
  const m: Manifest = {
    recordingId: 'long-session', sampleRate: 1000,
    mappingPoints: [{ inputMonoMs: 0, sampleIndex: 0 }, { inputMonoMs: 1810000, sampleIndex: 1810000 }],
    segments: [
      { segmentId: 'seg-005', filePath: '005.wav', mediaStartMs: 0, mediaDurationMs: 1800000, sampleStart: 0, sampleCount: 1800000, completionState: 'complete' },
      { segmentId: 'seg-006', filePath: '006.wav', mediaStartMs: 1800000, mediaDurationMs: 10000, sampleStart: 1800000, sampleCount: 10000, completionState: 'complete' },
    ],
    intervals: [
      { meetingStartMs: 0, meetingEndMs: 1800000, kind: 'recorded', mediaStartMs: 0, mediaEndMs: 1800000, segmentRefs: ['seg-005'] },
      { meetingStartMs: 1800000, meetingEndMs: 1820000, kind: 'paused', segmentRefs: [] },
      { meetingStartMs: 1820000, meetingEndMs: 1830000, kind: 'recorded', mediaStartMs: 1800000, mediaEndMs: 1810000, segmentRefs: ['seg-006'] },
    ],
  };
  assert.deepEqual(validateManifest(m), []);
  const result = resolve([m], 'long-session', 1805000);
  assert.equal(result.status, 'valid');
  assert.equal(result.segmentId, 'seg-006');
  assert.equal(result.localOffsetMs, 5000);
  assert.equal(meetingToMedia(m, 1805000).status, 'unlinked');
  assert.equal(meetingToMedia(m, 1825000).audioOffsetMs, 1805000);
});

test('sample overlap, media overlap, malformed completion, and bad pause are rejected', () => {
  const a = fixture(); a.segments[1].sampleStart = 400000;
  assert.ok(validateManifest(a).includes('overlapping sample ranges'));
  const b = fixture(); b.intervals[2].mediaStartMs = 9000;
  assert.ok(validateManifest(b).includes('overlapping audio intervals'));
  const c = fixture(); (c.segments[0] as {completionState:string}).completionState = 'ready';
  assert.ok(validateManifest(c).some(s => s.includes('completionState')));
  const d = fixture(); d.intervals[1].mediaStartMs = 10000; d.intervals[1].mediaEndMs = 12000;
  assert.ok(validateManifest(d).includes('pause must not consume media'));
  const e = fixture(); (e as unknown as {intervals:null}).intervals = null;
  assert.equal(resolve([e], 'session-1', 2000).status, 'unsupported');
});

test('clock rollback and invalid drift options are never interpreted as valid source', () => {
  const m = fixture(); m.mappingPoints[3].sampleIndex = 10;
  assert.ok(validateManifest(m).includes('nonmonotonic clock points'));
  assert.equal(inputToSample(m, 13000).status, 'unsupported');
  assert.equal(inputToSample(fixture(), 15000, Number.NaN).status, 'unsupported');
  assert.equal(sampleToMedia(fixture(), -1).status, 'unsupported');
});

test('live provisional pending anchor transitions to valid on segment publication', () => {
  const m = fixture(); m.segments.pop(); m.intervals[2].segmentRefs = [];
  const created = live(m, 15000);
  assert.equal(created.resolution.status, 'pending');
  assert.equal(created.anchor.audioOffsetMs, 13000);
  const stableAnchor = structuredClone(created.anchor);
  m.segments.push({ segmentId: 's2', filePath: 's2.wav', mediaStartMs: 10000, mediaDurationMs: 10000,
    sampleStart: 480000, sampleCount: 480000, completionState: 'complete' });
  m.intervals[2].segmentRefs = ['s2'];
  assert.equal(resolve([m], stableAnchor.recordingId, stableAnchor.audioOffsetMs).status, 'valid');
  assert.deepEqual(created.anchor, stableAnchor);
});

test('seek then type on selected import never resolves another recording at same offset', () => {
  const a = fixture(); const b = fixture(); b.recordingId = 'session-2';
  b.segments[1].completionState = 'missing';
  const created = createPlaybackAnchor([a, b], { recordingId: 'session-2', currentMediaMs: 12000.8,
    anchorId: 'p', typedAt: 1794740000000, paused: false });
  assert.equal(created.anchor.audioOffsetMs, 12000);
  assert.equal(created.anchor.recordingId, 'session-2');
  assert.equal(created.resolution.status, 'missing');
  const invalid = createPlaybackAnchor([a], { recordingId: 'session-1', currentMediaMs: -1, anchorId: 'q', typedAt: 1, paused: true });
  assert.equal(invalid.resolution.status, 'unsupported');
  assert.equal(invalid.anchor.audioOffsetMs, null);
});
