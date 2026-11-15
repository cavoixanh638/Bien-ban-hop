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
