/** Start at the requested anchor only when that exact recording/sample is valid.
 * If a configured pre-roll crosses missing audio, never jump to an arbitrary
 * neighbor. Tell the UI and start from the original verified anchor.
 */
export function resolvePlaybackStart(manifest, recordingId, offsetMs, preRollMs, resolveMedia, choosePreRoll) {
  if (!Number.isSafeInteger(offsetMs) || offsetMs < 0 ||
      !Number.isSafeInteger(preRollMs) || preRollMs < 0 || preRollMs > 30000)
    return {status:'unsupported',reason:'invalid anchor/pre-roll'};
  const target = resolveMedia(manifest, recordingId, offsetMs);
  if (target.status !== 'valid') return {...target,originalMs:offsetMs};
  const pre = choosePreRoll(manifest, {recordingId,audioOffsetMs:offsetMs}, preRollMs/1000);
  if (pre.status === 'valid') return {status:'valid',startMs:pre.startMs,originalMs:offsetMs,preRollLimited:false};
  if (pre.status === 'blocked')
    return {status:'valid',startMs:offsetMs,originalMs:offsetMs,preRollLimited:true,
      reason:pre.reason,failedAtMs:pre.failedAtMs};
  return {...pre,originalMs:offsetMs};
}

/** G10 playback selects actual committed samples, NOT millisecond-rounded G05
 * display intervals. In particular, reaching sampleEndExclusive is natural EOF.
 * Never skip a gap, substitute a nearby recording, or seek beyond committed PCM.
 */
export function selectCommittedPlayback(manifest,recordingId,offsetMs,preRollMs=0){
  if(!manifest || recordingId!==manifest.recordingId)
    return {status:'unsupported',reason:'Bản ghi không khớp mốc'};
  const rate=manifest.sampleRate;
  if(!Number.isSafeInteger(rate)||rate<8000||rate>192000 ||
    !Number.isSafeInteger(offsetMs)||offsetMs<0 ||
    !Number.isSafeInteger(preRollMs)||preRollMs<0||preRollMs>30000)
    return {status:'unsupported',reason:'Thời điểm ghi âm không hợp lệ'};
  const ranges=manifest.sampleRanges;
  if(!Array.isArray(ranges)||!ranges.length)
    return {status:'missing',reason:'Chưa có mẫu âm thanh đã lưu để phát'};
  const sample=Math.round(offsetMs*rate/1000);
  let selected=ranges.find(r=>Number.isSafeInteger(r.sampleStart)&&Number.isSafeInteger(r.sampleEndExclusive)&&
    r.sampleStart>=0&&r.sampleEndExclusive>r.sampleStart&&
    sample>=r.sampleStart&&sample<r.sampleEndExclusive);
  let anchorSample=sample;
  if(!selected){
    // Note timestamps use INTEGER milliseconds. Rounding to a millisecond may
    // hit exactly the final exclusive sample. Accept at most 0.5ms rounding
    // error at the END of the final contiguous range, never a distant anchor.
    const last=ranges.at(-1),tolerance=Math.max(1,Math.floor(rate/2000));
    if(last && sample>=last.sampleEndExclusive &&
       sample-last.sampleEndExclusive<=tolerance &&
       Number.isSafeInteger(last.sampleEndExclusive)&&last.sampleEndExclusive>last.sampleStart){
      selected=last;anchorSample=last.sampleEndExclusive-1;
    }
  }
  if(!selected) return {status:'missing',reason:'Mốc nằm ngoài vùng âm thanh đã ghi và xác nhận'};
  const before=Math.round(preRollMs*rate/1000);
  const startSample=Math.max(selected.sampleStart,anchorSample-before);
  const startMs=startSample*1000/rate;
  return {status:'valid',startSample,anchorSample,
    endSampleExclusive:selected.sampleEndExclusive,startMs,
    preRollLimited:startSample>anchorSample-before,
    requestedPreRollMs:preRollMs,actualPreRollMs:(anchorSample-startSample)*1000/rate};
}
