/** G10 adapter: keep meeting/recording/generation/interval provenance across G01, G02 and G04.
 * Never infer sample-to-media mapping from wall time alone. Never store pending status in timeSpan.
 */
export function intervalFor(mapper, inputMonoMs) {
  if (!Number.isFinite(inputMonoMs)) return null;
  const list = [...mapper.intervals, ...(mapper.active ? [mapper.active] : [])];
  return list.find(x => x.kind === 'recorded' && inputMonoMs >= x.inputMonoStartMs &&
    inputMonoMs < (x === mapper.active ? Infinity : x.inputMonoEndMs)) ?? null;
}
export function intervalId(generation, interval) {
  return interval ? String(generation) + ':sample-' + interval.sampleStart +
    ':mono-' + Math.round(interval.inputMonoStartMs) : null;
}
export function contextFor(mapper, {meetingId, recordingId, generation, sampleRate}, monoMs) {
  if (!mapper || !recordingId || !Number.isFinite(monoMs)) return {source:'unlinked',coverage:'unlinked'};
  const interval = intervalFor(mapper, monoMs);
  if (!interval) return {source:'unlinked',coverage:'gap'};
  const base = {meetingId, recordingId, generation,
    intervalId: intervalId(generation, interval), inputMonoMs: monoMs,
    source: 'live_recording', epoch: Math.round(interval.inputMonoStartMs)};
  const mapped = mapper.resolveInput(monoMs);
  if (mapped.status === 'pending') return {...base,coverage:'pending',audioOffsetMs:null};
  if (mapped.status !== 'valid' || !Number.isSafeInteger(mapped.sampleIndex)) return {source:'unlinked',coverage:mapped.status};
  return {...base,coverage:'valid',audioOffsetMs:Math.round(mapped.sampleIndex * 1000 / sampleRate)};
}
export function resolvePending(mapper, entry, {meetingId, recordingId, generation, sampleRate, committedSampleExclusive}) {
  if (!entry || entry.meetingId !== meetingId || entry.recordingId !== recordingId ||
      entry.generation !== generation || entry.source !== 'live_recording') return {status:'unlinked'};
  const interval = intervalFor(mapper, entry.inputMonoMs);
  if (!interval || intervalId(generation, interval) !== entry.intervalId) return {status:'unlinked'};
  const mapped = mapper.resolveInput(entry.inputMonoMs);
  if (mapped.status === 'pending') return {status:'pending'};
  if (mapped.status !== 'valid') return {status:mapped.status || 'unlinked'};
  if (!Number.isSafeInteger(mapped.sampleIndex) || mapped.sampleIndex < 0 ||
      mapped.sampleIndex >= committedSampleExclusive) return {status:'pending'};
  return {status:'valid',coverage:'valid',meetingId,recordingId,source:'live_recording',
    generation,intervalId:entry.intervalId,inputMonoMs:entry.inputMonoMs,
    audioOffsetMs:Math.round(mapped.sampleIndex * 1000 / sampleRate)};
}
