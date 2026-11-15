/** Timeline PoC: immutable anchors; half-open clock, meeting, sample and media ranges. */
export type IntervalKind = 'recorded' | 'paused' | 'gap' | 'unavailable';
export type State = 'valid' | 'pending' | 'missing' | 'gap' | 'unsupported' | 'unlinked';
export type Source = 'live_recording' | 'imported_playback' | 'playback_paused' | 'historical_edit' | 'paste' | 'unlinked';
export type CompletionState = 'complete' | 'pending' | 'missing' | 'corrupt' | 'unsupported';
export interface ClockPoint { inputMonoMs: number; sampleIndex: number }
export interface Segment {
  segmentId: string; filePath: string; mediaStartMs: number; mediaDurationMs: number;
  sampleStart: number; sampleCount: number; completionState: CompletionState;
}
export interface Interval {
  meetingStartMs: number; meetingEndMs: number; kind: IntervalKind;
  segmentRefs: string[]; mediaStartMs?: number; mediaEndMs?: number; reason?: string;
}
export interface Manifest {
  recordingId: string; sampleRate: number; mappingPoints: ClockPoint[];
  segments: Segment[]; intervals: Interval[];
}
export interface Anchor {
  anchorId: string; recordingId: string | null; audioOffsetMs: number | null;
  typedAt: number; source: Source; schemaVersion: 1;
}
export interface Resolution {
  status: State; reason: string; recordingId: string | null; audioOffsetMs: number | null;
  segmentId?: string; filePath?: string; localOffsetMs?: number;
}
export interface Position {
  status: State; reason: string; audioOffsetMs?: number; sampleIndex?: number;
}
export interface PlaybackTarget {
  resolution: Resolution;
  playStartMs?: number;
  preRollStatus?: 'applied' | 'clamped' | 'blocked';
  preRollReason?: string;
  preRollAppliedMs?: number;
}
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const nonnegative = (n: unknown): n is number => finite(n) && n >= 0;
const nonnegativeInteger = (n: unknown): n is number => nonnegative(n) && Number.isSafeInteger(n);
const positive = (n: unknown): n is number => finite(n) && n > 0;
const fail = (status: State, reason: string, recordingId: string | null = null, audioOffsetMs: number | null = null): Resolution => ({ status, reason, recordingId, audioOffsetMs });
const posFail = (status: State, reason: string): Position => ({ status, reason });
const segmentEnd = (s: Segment) => s.mediaStartMs + s.mediaDurationMs;
const inside = (value: number, start: number, end: number) => value >= start && value < end;

/** Structural guard: reject ambiguous intervals and sample ranges, not every missing audio section. */
export function validateManifest(m: Manifest): string[] {
  if (!m || typeof m.recordingId !== 'string' || !m.recordingId.trim() ||
      !nonnegativeInteger(m.sampleRate) || m.sampleRate === 0 ||
      !Array.isArray(m.mappingPoints) || !Array.isArray(m.segments) || !Array.isArray(m.intervals)) {
    return ['invalid recording metadata'];
  }
  const errors: string[] = [];
  const ids = new Set<string>();
  const states: CompletionState[] = ['complete', 'pending', 'missing', 'corrupt', 'unsupported'];
  const kinds: IntervalKind[] = ['recorded', 'paused', 'gap', 'unavailable'];
  for (const s of m.segments) {
    if (!s || typeof s.segmentId !== 'string' || !s.segmentId || ids.has(s.segmentId)) {
      errors.push('duplicate/empty segmentId');
      continue;
    }
    ids.add(s.segmentId);
    if (!nonnegative(s.mediaStartMs) || !positive(s.mediaDurationMs) ||
        !nonnegativeInteger(s.sampleStart) || !nonnegativeInteger(s.sampleCount) || s.sampleCount === 0 ||
        !Number.isSafeInteger(s.sampleStart + s.sampleCount) || !finite(segmentEnd(s))) {
      errors.push(`invalid segment ${s.segmentId}`);
      continue;
    }
    if (!states.includes(s.completionState)) errors.push(`invalid completionState ${s.segmentId}`);
    if (s.completionState === 'complete' && (typeof s.filePath !== 'string' || !s.filePath)) errors.push(`no file path ${s.segmentId}`);
    if (Math.abs(s.mediaDurationMs - s.sampleCount * 1000 / m.sampleRate) > 2) errors.push(`sample duration mismatch ${s.segmentId}`);
  }
  const segmentMedia = [...m.segments].filter(Boolean).sort((a, b) => a.mediaStartMs - b.mediaStartMs);
  const segmentSamples = [...m.segments].filter(Boolean).sort((a, b) => a.sampleStart - b.sampleStart);
  for (let i = 1; i < segmentMedia.length; i++) {
    if (segmentMedia[i].mediaStartMs < segmentEnd(segmentMedia[i - 1]) - 0.001) errors.push('overlapping segments');
    if (segmentSamples[i].sampleStart < segmentSamples[i - 1].sampleStart + segmentSamples[i - 1].sampleCount) errors.push('overlapping sample ranges');
  }
  const intervals = [...m.intervals].filter(Boolean).sort((a, b) => a.meetingStartMs - b.meetingStartMs);
  const mediaIntervals: Interval[] = [];
  for (let i = 0; i < intervals.length; i++) {
    const it = intervals[i];
    if (!nonnegative(it.meetingStartMs) || !positive(it.meetingEndMs - it.meetingStartMs) || !kinds.includes(it.kind) || !Array.isArray(it.segmentRefs)) {
      errors.push('invalid meeting interval');
      continue;
    }
    if (i && it.meetingStartMs < intervals[i - 1].meetingEndMs) errors.push('overlapping meeting intervals');
    if (it.segmentRefs.some(id => !ids.has(id))) errors.push('unknown segment reference');
    const hasStart = it.mediaStartMs !== undefined;
    const hasEnd = it.mediaEndMs !== undefined;
    if (hasStart !== hasEnd || (hasStart && (!nonnegative(it.mediaStartMs) || !positive(it.mediaEndMs! - it.mediaStartMs!) || !finite(it.mediaEndMs)))) {
      errors.push('invalid media interval');
    }
    if (it.kind === 'recorded' && (!hasStart || !hasEnd)) errors.push('recorded interval missing media range');
    if (it.kind === 'paused' && (hasStart || hasEnd || it.segmentRefs.length)) errors.push('pause must not consume media');
    if (hasStart && hasEnd) mediaIntervals.push(it);
  }
  mediaIntervals.sort((a, b) => a.mediaStartMs! - b.mediaStartMs!);
  for (let i = 1; i < mediaIntervals.length; i++) {
    if (mediaIntervals[i].mediaStartMs! < mediaIntervals[i - 1].mediaEndMs! - 0.001) errors.push('overlapping audio intervals');
  }
  for (let i = 0; i < m.mappingPoints.length; i++) {
    const pt = m.mappingPoints[i];
    if (!pt || !finite(pt.inputMonoMs) || !nonnegativeInteger(pt.sampleIndex)) { errors.push('invalid clock point'); continue; }
    if (i && m.mappingPoints[i - 1] &&
        (pt.inputMonoMs <= m.mappingPoints[i - 1].inputMonoMs || pt.sampleIndex < m.mappingPoints[i - 1].sampleIndex)) {
      errors.push('nonmonotonic clock points');
    }
    // Identical sampleIndex across increasing mono timestamps means a known paused clock plateau.
  }
  return [...new Set(errors)];
}

/** Interpolate measured monotonic clock↔PCM sample pairs. Never extrapolate or use Date.now(). */
export function inputToSample(m: Manifest, inputMonoMs: number, maxDriftPpm = 5000): Position {
  if (validateManifest(m).length) return posFail('unsupported', 'invalid manifest');
  if (!finite(inputMonoMs) || !nonnegative(maxDriftPpm)) return posFail('unsupported', 'invalid clock input / drift limit');
  const pts = m.mappingPoints;
  if (pts.length < 2) return posFail('pending', 'clock needs two calibration points');
  if (inputMonoMs < pts[0].inputMonoMs || inputMonoMs > pts[pts.length - 1].inputMonoMs) {
    return posFail('pending', 'outside calibrated clock coverage');
  }
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    // On a shared boundary use the interval to the right: pause/resume is half-open.
    if (inputMonoMs >= a.inputMonoMs && (inputMonoMs < b.inputMonoMs || (i === pts.length - 1 && inputMonoMs === b.inputMonoMs))) {
      const rate = (b.sampleIndex - a.sampleIndex) / (b.inputMonoMs - a.inputMonoMs);
      if (rate === 0) return posFail('gap', 'no sample progress: clock paused or interrupted');
      const ppm = Math.abs(rate / (m.sampleRate / 1000) - 1) * 1e6;
      if (ppm > maxDriftPpm) return posFail('unsupported', `clock drift ${Math.round(ppm)}ppm exceeds limit`);
      const sampleIndex = Math.floor(a.sampleIndex + (inputMonoMs - a.inputMonoMs) * rate);
      return { status: 'valid', reason: 'sample clock interpolation', sampleIndex };
    }
  }
  return posFail('unsupported', 'no clock pair at input time');
}

/** Converts counted frames to a media offset. Exact sampleStart is authoritative. */
export function sampleToMedia(m: Manifest, sampleIndex: number): Position {
  if (validateManifest(m).length) return posFail('unsupported', 'invalid manifest');
  if (!nonnegativeInteger(sampleIndex)) return posFail('unsupported', 'invalid sample index');
  const matches = m.segments.filter(s => inside(sampleIndex, s.sampleStart, s.sampleStart + s.sampleCount));
  if (matches.length !== 1) return posFail(matches.length ? 'unsupported' : 'pending', matches.length ? 'ambiguous samples' : 'sample not covered by segment');
  const s = matches[0];
  return { status: 'valid', reason: 'sample-count mapping', sampleIndex, audioOffsetMs: s.mediaStartMs + (sampleIndex - s.sampleStart) * 1000 / m.sampleRate };
}

/** Meeting time includes capture pauses/gaps; media time does not. */
export function meetingToMedia(m: Manifest, meetingMs: number): Position {
  if (validateManifest(m).length) return posFail('unsupported', 'invalid manifest');
  if (!nonnegative(meetingMs)) return posFail('unsupported', 'invalid meeting time');
  const matches = m.intervals.filter(it => inside(meetingMs, it.meetingStartMs, it.meetingEndMs));
  if (matches.length !== 1) return posFail(matches.length ? 'unsupported' : 'unlinked', matches.length ? 'ambiguous meeting interval' : 'outside meeting coverage');
  const it = matches[0];
  if (it.kind === 'paused') return posFail('unlinked', it.reason || 'capture deliberately paused');
  if (it.kind === 'gap') return posFail('gap', it.reason || 'audio capture gap');
  if (it.kind === 'unavailable') return posFail('missing', it.reason || 'audio unavailable');
  return { status: 'valid', reason: 'recorded meeting interval',
    audioOffsetMs: it.mediaStartMs! + (meetingMs - it.meetingStartMs) * (it.mediaEndMs! - it.mediaStartMs!) / (it.meetingEndMs - it.meetingStartMs) };
}

/** Only recorded media ranges authorize playback; segments alone are not sufficient. */
export function resolve(manifests: readonly Manifest[], recordingId: string | null, audioOffsetMs: number | null): Resolution {
  if (!recordingId || audioOffsetMs === null) return fail('unlinked', 'no audio anchor', recordingId, audioOffsetMs);
  if (!nonnegative(audioOffsetMs)) return fail('unsupported', 'invalid audio offset', recordingId, audioOffsetMs);
  if (!Array.isArray(manifests)) return fail('unsupported', 'invalid manifest collection', recordingId, audioOffsetMs);
  const matches = manifests.filter(m => m?.recordingId === recordingId);
  if (matches.length !== 1) return fail(matches.length ? 'unsupported' : 'missing', matches.length ? 'duplicate recordingId' : 'recordingId not available', recordingId, audioOffsetMs);
  const m = matches[0], errors = validateManifest(m);
  if (errors.length) return fail('unsupported', errors.join('; '), recordingId, audioOffsetMs);
  const covered = m.intervals.filter(it => it.mediaStartMs !== undefined && it.mediaEndMs !== undefined && inside(audioOffsetMs, it.mediaStartMs, it.mediaEndMs));
  if (covered.length > 1) return fail('unsupported', 'ambiguous media intervals', recordingId, audioOffsetMs);
  if (!covered.length) return fail('gap', 'media offset lacks recorded interval coverage', recordingId, audioOffsetMs);
  const it = covered[0];
  if (it.kind === 'gap') return fail('gap', it.reason || 'capture gap has no playable audio', recordingId, audioOffsetMs);
  if (it.kind === 'unavailable') return fail('missing', it.reason || 'audio unavailable', recordingId, audioOffsetMs);
  if (it.kind !== 'recorded') return fail('unsupported', 'non-recorded interval has media range', recordingId, audioOffsetMs);
  const segments = m.segments.filter(s => inside(audioOffsetMs, s.mediaStartMs, segmentEnd(s)));
  if (segments.length !== 1) return fail(segments.length ? 'unsupported' : 'gap', segments.length ? 'ambiguous segments' : 'recorded interval has no covering segment', recordingId, audioOffsetMs);
  const s = segments[0];
  if (!it.segmentRefs.includes(s.segmentId)) return fail('unsupported', 'interval references another segment', recordingId, audioOffsetMs);
  if (s.completionState === 'pending') return fail('pending', 'segment not durably completed', recordingId, audioOffsetMs);
  if (s.completionState === 'missing' || s.completionState === 'corrupt') return fail('missing', `segment ${s.completionState}`, recordingId, audioOffsetMs);
  if (s.completionState === 'unsupported') return fail('unsupported', 'segment codec unsupported', recordingId, audioOffsetMs);
  return { status: 'valid', reason: 'completed segment', recordingId, audioOffsetMs,
    segmentId: s.segmentId, filePath: s.filePath, localOffsetMs: audioOffsetMs - s.mediaStartMs };
}

export interface LiveContext {
  recordingId: string; inputMonoMs: number; sessionMonoOriginMs: number;
  meetingOriginMs: number; typedAt: number; anchorId: string;
}
export interface PlaybackContext {
  recordingId: string | null; currentMediaMs: number | null;
  paused: boolean; typedAt: number; anchorId: string;
}
export interface AnchoredResult { anchor: Anchor; resolution: Resolution }

/** Quantize the mandatory integer-ms Mark without jumping to a different segment.
 * A sample-accurate fractional boundary may have no integer in a very short segment. */
function quantizeInSource(m: Manifest, rawMs: number): number | null {
  if (!nonnegative(rawMs)) return null;
  const intervals = m.intervals.filter(it => it.mediaStartMs !== undefined &&
    it.mediaEndMs !== undefined && inside(rawMs, it.mediaStartMs, it.mediaEndMs));
  const segments = m.segments.filter(s => inside(rawMs, s.mediaStartMs, segmentEnd(s)));
  if (intervals.length !== 1 || segments.length > 1) return null;
  const [interval] = intervals;
  const segment = segments[0]; // May not exist yet while input is pending storage allocation.
  const candidates = [...new Set([Math.floor(rawMs), Math.ceil(rawMs)])]
    .filter(v => inside(v, interval.mediaStartMs!, interval.mediaEndMs!) &&
      (!segment || inside(v, segment.mediaStartMs, segmentEnd(segment))))
    .sort((a, b) => Math.abs(a - rawMs) - Math.abs(b - rawMs));
  return candidates[0] ?? null;
}

/** Uses observed sample position for live notes; meeting mapping cross-check prevents clock confusion. */
export function createLiveAnchor(m: Manifest, ctx: LiveContext): AnchoredResult {
  const anchor: Anchor = { anchorId: ctx.anchorId, recordingId: ctx.recordingId, audioOffsetMs: null,
    typedAt: ctx.typedAt, source: 'live_recording', schemaVersion: 1 };
  if (ctx.recordingId !== m?.recordingId) return { anchor, resolution: fail('unsupported', 'live recording source mismatch', ctx.recordingId) };
  if (![ctx.inputMonoMs, ctx.sessionMonoOriginMs, ctx.meetingOriginMs, ctx.typedAt].every(finite)) {
    return { anchor, resolution: fail('unsupported', 'invalid input clock / timestamp', ctx.recordingId) };
  }
  const meetingMs = ctx.meetingOriginMs + (ctx.inputMonoMs - ctx.sessionMonoOriginMs);
  const meeting = meetingToMedia(m, meetingMs);
  if (meeting.status !== 'valid') return { anchor, resolution: fail(meeting.status, meeting.reason, ctx.recordingId) };
  const clock = inputToSample(m, ctx.inputMonoMs);
  if (clock.status !== 'valid') return { anchor, resolution: fail(clock.status, clock.reason, ctx.recordingId) };
  const mapped = sampleToMedia(m, clock.sampleIndex!);
  if (mapped.status !== 'valid') {
    // The mapped audio range may be pending allocation, but a recorded interval gives
    // a provisional media coordinate. NEVER claim it is durably playable before flush.
    if (mapped.status === 'pending') {
      anchor.audioOffsetMs = quantizeInSource(m, meeting.audioOffsetMs!);
      if (anchor.audioOffsetMs === null) return { anchor, resolution: fail('unsupported', 'provisional media time cannot be represented in integer ms', ctx.recordingId) };
      return { anchor, resolution: fail('pending', 'sample not yet assigned to segment; provisional recorded media offset', ctx.recordingId, anchor.audioOffsetMs) };
    }
    return { anchor, resolution: fail(mapped.status, mapped.reason, ctx.recordingId) };
  }
  if (Math.abs(mapped.audioOffsetMs! - meeting.audioOffsetMs!) > 1000) {
    return { anchor, resolution: fail('unsupported', 'clock and meeting timeline differ by more than 1000ms', ctx.recordingId) };
  }
  anchor.audioOffsetMs = quantizeInSource(m, mapped.audioOffsetMs!);
  if (anchor.audioOffsetMs === null) return { anchor, resolution: fail('unsupported', 'sample media position has no safe integer-ms anchor in the source segment', ctx.recordingId) };
  return { anchor, resolution: resolve([m], ctx.recordingId, anchor.audioOffsetMs) };
}

/** Source selection/seek/pause is owned by the player fixture, not wall-clock time. */
export function createPlaybackAnchor(manifests: readonly Manifest[], ctx: PlaybackContext): AnchoredResult {
  const anchor: Anchor = { anchorId: ctx.anchorId, recordingId: ctx.recordingId,
    audioOffsetMs: nonnegative(ctx.currentMediaMs) ? Math.floor(ctx.currentMediaMs) : null,
    typedAt: ctx.typedAt, source: ctx.paused ? 'playback_paused' : 'imported_playback', schemaVersion: 1 };
  if (ctx.currentMediaMs !== null && !nonnegative(ctx.currentMediaMs)) {
    return { anchor, resolution: fail('unsupported', 'invalid playback position', ctx.recordingId) };
  }
  if (anchor.audioOffsetMs !== null && ctx.recordingId && Array.isArray(manifests)) {
    const known = manifests.filter(m => m?.recordingId === ctx.recordingId);
    if (known.length === 1 && validateManifest(known[0]).length === 0) {
      const raw = ctx.currentMediaMs!;
      const selected = quantizeInSource(known[0], raw);
      if (selected === null) {
        // Preserve a future-recoverable offset only if integer rounding does not change
        // its resolution state (e.g. no mounted media yet, or an incomplete recording).
        if (!Number.isInteger(raw) && resolve(manifests, ctx.recordingId, anchor.audioOffsetMs).status !== resolve(manifests, ctx.recordingId, raw).status) {
          anchor.audioOffsetMs = null;
          return { anchor, resolution: fail('unsupported', 'cannot quantize playback position without changing media source', ctx.recordingId) };
        }
      } else {
        anchor.audioOffsetMs = selected;
      }
    }
  }
  return { anchor, resolution: resolve(manifests, anchor.recordingId, anchor.audioOffsetMs) };
}

/** When time is compressed at a gap, do not skip unrecorded meeting content to reach old audio. */
function unsafeMeetingCrossing(m: Manifest, start: number, end: number): string | null {
  const recorded = m.intervals.filter(it => it.kind === 'recorded' &&
    it.mediaStartMs !== undefined && it.mediaEndMs !== undefined && it.mediaEndMs > start && it.mediaStartMs < end)
    .sort((a, b) => a.mediaStartMs! - b.mediaStartMs!);
  for (let i = 1; i < recorded.length; i++) {
    const left = recorded[i - 1], right = recorded[i];
    if (left.mediaEndMs! < right.mediaStartMs! - 0.001) return 'missing media between recorded intervals';
    if (right.meetingStartMs < left.meetingEndMs) return 'overlapping meeting intervals';
    const between = m.intervals.filter(it => it.meetingStartMs >= left.meetingEndMs && it.meetingEndMs <= right.meetingStartMs)
      .sort((a, b) => a.meetingStartMs - b.meetingStartMs);
    let cursor = left.meetingEndMs;
    for (const interval of between) {
      if (interval.meetingStartMs > cursor) return 'unexplained meeting-time hole';
      if (interval.kind !== 'paused') return interval.reason || `pre-roll crosses ${interval.kind}`;
      cursor = interval.meetingEndMs;
    }
    if (cursor < right.meetingStartMs) return 'unexplained meeting-time hole';
  }
  return null;
}

/** Check every interval boundary along the requested pre-roll, not just the endpoints. */
function preRollPath(manifests: readonly Manifest[], recordingId: string, start: number, end: number): string | null {
  const m = manifests.find(it => it.recordingId === recordingId)!;
  const boundaries = [start, end];
  for (const s of m.segments) boundaries.push(s.mediaStartMs, segmentEnd(s));
  for (const it of m.intervals) {
    if (it.mediaStartMs !== undefined) boundaries.push(it.mediaStartMs);
    if (it.mediaEndMs !== undefined) boundaries.push(it.mediaEndMs);
  }
  const values = [...new Set(boundaries.filter(t => t >= start && t <= end))].sort((a, b) => a - b);
  for (let i = 1; i < values.length; i++) {
    const sample = (values[i - 1] + values[i]) / 2;
    if (sample >= end || sample < start) continue;
    const result = resolve(manifests, recordingId, sample);
    if (result.status !== 'valid') return `${result.status}: ${result.reason}`;
  }
  return unsafeMeetingCrossing(m, start, end);
}

/** Pre-roll is a playback decision. Original anchor audioOffsetMs remains untouched. */
export function playbackTarget(manifests: readonly Manifest[], anchor: Pick<Anchor, 'recordingId' | 'audioOffsetMs'>, preRollMs = 5000): PlaybackTarget {
  const resolution = resolve(manifests, anchor.recordingId, anchor.audioOffsetMs);
  if (!nonnegative(preRollMs) || preRollMs > 30000) {
    return { resolution: fail('unsupported', 'preRollMs out of 0–30000 range', anchor.recordingId, anchor.audioOffsetMs) };
  }
  if (resolution.status !== 'valid') return { resolution };
  const desired = Math.max(0, anchor.audioOffsetMs! - preRollMs);
  const pathError = desired < anchor.audioOffsetMs! ? preRollPath(manifests, anchor.recordingId!, desired, anchor.audioOffsetMs!) : null;
  if (pathError) return { resolution, playStartMs: anchor.audioOffsetMs!, preRollAppliedMs: 0,
    preRollStatus: 'blocked', preRollReason: `pre-roll refused: ${pathError}` };
  return { resolution, playStartMs: desired,
    preRollAppliedMs: anchor.audioOffsetMs! - desired,
    preRollStatus: desired > anchor.audioOffsetMs! - preRollMs ? 'clamped' : 'applied',
    preRollReason: desired > anchor.audioOffsetMs! - preRollMs ? 'clamped at media start' : 'playable continuous audio' };
}
