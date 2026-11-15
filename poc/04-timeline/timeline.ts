/** Pure timeline PoC. Half-open intervals, millisecond media offsets, no side effects. */
export type IntervalKind = 'recorded' | 'paused' | 'gap' | 'unavailable';
export type State = 'valid' | 'pending' | 'missing' | 'gap' | 'unsupported' | 'unlinked';
export type Source = 'live_recording' | 'imported_playback' | 'playback_paused' | 'historical_edit' | 'paste' | 'unlinked';
export interface ClockPoint { inputMonoMs: number; sampleIndex: number }
export interface Segment { segmentId: string; filePath: string; mediaStartMs: number; mediaDurationMs: number; sampleStart: number; sampleCount: number; completionState: 'complete'|'pending'|'missing'|'corrupt'|'unsupported' }
export interface Interval { meetingStartMs: number; meetingEndMs: number; kind: IntervalKind; segmentRefs: string[]; mediaStartMs?: number; mediaEndMs?: number; reason?: string }
export interface Manifest { recordingId: string; sampleRate: number; mappingPoints: ClockPoint[]; segments: Segment[]; intervals: Interval[] }
export interface Anchor { anchorId: string; recordingId: string|null; audioOffsetMs: number|null; typedAt: number; source: Source; schemaVersion: 1 }
export type Resolution = { status: State; reason: string; recordingId: string|null; audioOffsetMs: number|null; segmentId?: string; filePath?: string; localOffsetMs?: number };
export type Position = { status: State; reason: string; audioOffsetMs?: number; sampleIndex?: number };
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const validNumber = (n: unknown) => finite(n) && n >= 0;
const fail = (status: State, reason: string, recordingId: string|null = null, audioOffsetMs: number|null = null): Resolution => ({status, reason, recordingId, audioOffsetMs});
const posFail = (status: State, reason: string): Position => ({status, reason});

/** Checks unsafe ambiguities instead of selecting an arbitrary segment. */
export function validateManifest(m: Manifest): string[] {
  const errors: string[] = [];
  if (!m || !m.recordingId || !finite(m.sampleRate) || m.sampleRate <= 0) return ['invalid recording metadata'];
  const ids = new Set<string>();
  for (const s of m.segments) {
    if (!s.segmentId || ids.has(s.segmentId)) errors.push('duplicate/empty segmentId');
    ids.add(s.segmentId);
    if (![s.mediaStartMs,s.mediaDurationMs,s.sampleStart,s.sampleCount].every(validNumber) || !Number.isInteger(s.sampleStart) || !Number.isInteger(s.sampleCount) || s.mediaDurationMs <= 0 || s.sampleCount <= 0) errors.push(`invalid segment ${s.segmentId}`);
    if (s.completionState === 'complete' && !s.filePath) errors.push(`no file path ${s.segmentId}`);
    if (Math.abs(s.mediaDurationMs - s.sampleCount * 1000 / m.sampleRate) > 2) errors.push(`sample duration mismatch ${s.segmentId}`);
  }
  const sorted = [...m.segments].sort((a,b) => a.mediaStartMs-b.mediaStartMs);
  for (let i=1;i<sorted.length;i++) if (sorted[i].mediaStartMs < sorted[i-1].mediaStartMs + sorted[i-1].mediaDurationMs - 0.001) errors.push('overlapping segments');
  const intervals = [...m.intervals].sort((a,b) => a.meetingStartMs-b.meetingStartMs);
  for (let i=0;i<intervals.length;i++) {
    const it=intervals[i];
    if (![it.meetingStartMs,it.meetingEndMs].every(validNumber) || it.meetingEndMs <= it.meetingStartMs) errors.push('invalid meeting interval');
    if (i && it.meetingStartMs < intervals[i-1].meetingEndMs) errors.push('overlapping meeting intervals');
    if (it.kind === 'recorded' && (!validNumber(it.mediaStartMs) || !validNumber(it.mediaEndMs) || it.mediaEndMs! <= it.mediaStartMs!)) errors.push('recorded interval missing media range');
    if (it.segmentRefs.some(id=>!ids.has(id))) errors.push('unknown segment reference');
  }
  const pts=m.mappingPoints;
  for (let i=0;i<pts.length;i++) {
    if (!finite(pts[i].inputMonoMs) || !validNumber(pts[i].sampleIndex)) errors.push('invalid clock point');
    if (i && (pts[i].inputMonoMs <= pts[i-1].inputMonoMs || pts[i].sampleIndex <= pts[i-1].sampleIndex)) errors.push('nonmonotonic clock points');
  }
  return [...new Set(errors)];
}

/** Interpolation follows actual counted samples (drift-aware), never Date.now().
 * Do not extrapolate beyond calibrated points, or through unobserved gaps. */
export function inputToSample(m: Manifest, inputMonoMs: number, maxDriftPpm=5000): Position {
  if (validateManifest(m).length) return posFail('unsupported','invalid manifest');
  if (!finite(inputMonoMs)) return posFail('unsupported','invalid input clock');
  const pts=m.mappingPoints;
  if (pts.length<2) return posFail('pending','clock needs two calibration points');
  if (inputMonoMs<pts[0].inputMonoMs || inputMonoMs>pts[pts.length-1].inputMonoMs) return posFail('pending','outside calibrated clock coverage');
  for(let i=1;i<pts.length;i++) {
    const a=pts[i-1],b=pts[i];
    if (inputMonoMs>=a.inputMonoMs && inputMonoMs<=b.inputMonoMs) {
      const rate=(b.sampleIndex-a.sampleIndex)/(b.inputMonoMs-a.inputMonoMs);
      const ppm=Math.abs(rate/(m.sampleRate/1000)-1)*1e6;
      if(ppm>maxDriftPpm) return posFail('unsupported',`clock drift ${Math.round(ppm)}ppm exceeds limit`);
      return {status:'valid',reason:'sample clock interpolation',sampleIndex:Math.round(a.sampleIndex+(inputMonoMs-a.inputMonoMs)*rate)};
    }
  }
  return posFail('unsupported','unreachable clock interval');
}

/** Sample index is mapped using a real segment sampleStart rather than wall-clock duration. */
export function sampleToMedia(m: Manifest, sampleIndex: number): Position {
  if(!validNumber(sampleIndex)) return posFail('unsupported','invalid sample index');
  const matches=m.segments.filter(s=>sampleIndex>=s.sampleStart && sampleIndex<s.sampleStart+s.sampleCount);
  if(matches.length!==1) return posFail(matches.length?'unsupported':'pending', matches.length?'ambiguous samples':'sample not covered by segment');
  const s=matches[0];
  return {status:'valid',reason:'sample-count mapping',sampleIndex,audioOffsetMs:s.mediaStartMs+(sampleIndex-s.sampleStart)*1000/m.sampleRate};
}

export function meetingToMedia(m: Manifest, meetingMs: number): Position {
  if(validateManifest(m).length) return posFail('unsupported','invalid manifest');
  if(!validNumber(meetingMs)) return posFail('unsupported','invalid meeting time');
  const hits=m.intervals.filter(i=>meetingMs>=i.meetingStartMs && meetingMs<i.meetingEndMs);
  if(hits.length!==1) return posFail(hits.length?'unsupported':'unlinked',hits.length?'ambiguous meeting interval':'outside meeting coverage');
  const it=hits[0];
  if(it.kind==='paused') return posFail('unlinked',it.reason||'capture deliberately paused');
  if(it.kind==='gap') return posFail('gap',it.reason||'audio capture gap');
  if(it.kind==='unavailable') return posFail('missing',it.reason||'audio unavailable');
  const start=it.mediaStartMs!,end=it.mediaEndMs!;
  return {status:'valid',reason:'recorded meeting interval',audioOffsetMs:start+(meetingMs-it.meetingStartMs)*(end-start)/(it.meetingEndMs-it.meetingStartMs)};
}

/** Resolve an immutable anchor against CURRENT storage state. No nearby-file fallback. */
export function resolve(manifests: readonly Manifest[], recordingId: string|null, audioOffsetMs: number|null): Resolution {
  if(!recordingId || audioOffsetMs===null) return fail('unlinked','no audio anchor',recordingId,audioOffsetMs);
  if(!validNumber(audioOffsetMs)) return fail('unsupported','invalid audio offset',recordingId,audioOffsetMs);
  const matches=manifests.filter(m=>m.recordingId===recordingId);
  if(matches.length!==1) return fail(matches.length?'unsupported':'missing',matches.length?'duplicate recordingId':'recordingId not available',recordingId,audioOffsetMs);
  const m=matches[0],errors=validateManifest(m);
  if(errors.length) return fail('unsupported',errors.join('; '),recordingId,audioOffsetMs);
  const meetingHits=m.intervals.filter(i=>i.mediaStartMs!==undefined && i.mediaEndMs!==undefined && audioOffsetMs>=i.mediaStartMs && audioOffsetMs<i.mediaEndMs);
  if(meetingHits.length>1) return fail('unsupported','ambiguous audio interval',recordingId,audioOffsetMs);
  if(m.intervals.length && !meetingHits.length) return fail('gap','audio offset outside recorded meeting intervals',recordingId,audioOffsetMs);
  if(meetingHits.length && meetingHits[0].kind!=='recorded') return fail('gap',meetingHits[0].reason||'not recorded',recordingId,audioOffsetMs);
  const segments=m.segments.filter(s=>audioOffsetMs>=s.mediaStartMs && audioOffsetMs<s.mediaStartMs+s.mediaDurationMs);
  if(segments.length!==1) return fail(segments.length?'unsupported':'gap',segments.length?'ambiguous segment':'no segment at media offset',recordingId,audioOffsetMs);
  const s=segments[0];
  if(meetingHits.length && !meetingHits[0].segmentRefs.includes(s.segmentId)) return fail('unsupported','interval references another segment',recordingId,audioOffsetMs);
  if(s.completionState==='pending') return fail('pending','segment not durably completed',recordingId,audioOffsetMs);
  if(s.completionState==='missing' || s.completionState==='corrupt') return fail('missing',`segment ${s.completionState}`,recordingId,audioOffsetMs);
  if(s.completionState==='unsupported') return fail('unsupported','segment codec unsupported',recordingId,audioOffsetMs);
  return {status:'valid',reason:'completed segment',recordingId,audioOffsetMs,segmentId:s.segmentId,filePath:s.filePath,localOffsetMs:audioOffsetMs-s.mediaStartMs};
}

export interface LiveContext { recordingId: string; inputMonoMs: number; sessionMonoOriginMs: number; meetingOriginMs: number; typedAt: number; anchorId: string }
export interface PlaybackContext { recordingId: string|null; currentMediaMs: number|null; paused: boolean; typedAt: number; anchorId: string }
export function createLiveAnchor(m: Manifest, ctx: LiveContext): {anchor: Anchor; resolution: Resolution} {
  const anchor: Anchor={anchorId:ctx.anchorId,recordingId:ctx.recordingId,audioOffsetMs:null,typedAt:ctx.typedAt,source:'live_recording',schemaVersion:1};
  if(ctx.recordingId!==m.recordingId) return {anchor,resolution:fail('unsupported','live recording source mismatch',ctx.recordingId)};
  const meeting=meetingToMedia(m,ctx.meetingOriginMs+(ctx.inputMonoMs-ctx.sessionMonoOriginMs));
  if(meeting.status!=='valid') return {anchor,resolution:fail(meeting.status,meeting.reason,ctx.recordingId)};
  const clock=inputToSample(m,ctx.inputMonoMs);
  if(clock.status!=='valid') return {anchor,resolution:fail(clock.status,clock.reason,ctx.recordingId)};
  const sample=sampleToMedia(m,clock.sampleIndex!);
  if(sample.status!=='valid') return {anchor,resolution:fail(sample.status,sample.reason,ctx.recordingId)};
  // Cross-check both independent measurements: divergence is a warning/error, not silent source substitution.
  if(Math.abs(sample.audioOffsetMs!-meeting.audioOffsetMs!)>1000) return {anchor,resolution:fail('unsupported','clock and meeting timeline differ by more than 1000ms',ctx.recordingId)};
  anchor.audioOffsetMs=Math.round(sample.audioOffsetMs!);
  return {anchor,resolution:resolve([m],anchor.recordingId,anchor.audioOffsetMs)};
}
export function createPlaybackAnchor(manifests: readonly Manifest[], ctx: PlaybackContext): {anchor: Anchor; resolution: Resolution} {
  const anchor: Anchor={anchorId:ctx.anchorId,recordingId:ctx.recordingId,audioOffsetMs:validNumber(ctx.currentMediaMs)?Math.round(ctx.currentMediaMs):null,typedAt:ctx.typedAt,source:ctx.paused?'playback_paused':'imported_playback',schemaVersion:1};
  return {anchor,resolution:resolve(manifests,anchor.recordingId,anchor.audioOffsetMs)};
}
export function playbackTarget(manifests: readonly Manifest[], anchor: Pick<Anchor,'recordingId'|'audioOffsetMs'>, preRollMs=5000): {resolution: Resolution; playStartMs?: number} {
  const resolution=resolve(manifests,anchor.recordingId,anchor.audioOffsetMs);
  if(!validNumber(preRollMs) || preRollMs>30000) return {resolution:fail('unsupported','preRollMs out of 0–30000 range',anchor.recordingId,anchor.audioOffsetMs)};
  if(resolution.status!=='valid') return {resolution};
  const playStartMs=Math.max(0,anchor.audioOffsetMs!-preRollMs);
  const start=resolve(manifests,anchor.recordingId,playStartMs);
  // A pre-roll path may cross a genuine gap. Play from anchor rather than silently seek to another region.
  return {resolution,playStartMs:start.status==='valid'?playStartMs:anchor.audioOffsetMs!};
}
