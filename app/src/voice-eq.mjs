/** Browser-only playback signal processing: dry by default, never touches PCM
 * in OPFS, written WAV or the provenance audioOffsetMs.
 * Light EQ is NOT speech separation or a substitute for microphone checks.
 */
export const VOICE_PRESETS=Object.freeze({
  off:{highpass:85,presence:0,threshold:-24,wet:0},
  clear:{highpass:105,presence:2.5,threshold:-29,wet:1},
  stronger:{highpass:125,presence:4.5,threshold:-31,wet:1}
});
export function capPlaybackEnd(check,rate,maxDurationMs=0){
  if(!maxDurationMs)return check.endSampleExclusive;
  if(!Number.isSafeInteger(maxDurationMs)||maxDurationMs<1000||maxDurationMs>120000)
    throw Error('Thời lượng nghe tập trung không hợp lệ');
  return Math.min(check.endSampleExclusive,check.anchorSample+
    Math.max(1,Math.round(maxDurationMs*rate/1000)));
}
export function createVoiceEQ(ctx){
  const input=ctx.createGain(),dry=ctx.createGain(),wet=ctx.createGain();
  const highpass=ctx.createBiquadFilter(),presence=ctx.createBiquadFilter();
  const limiter=ctx.createDynamicsCompressor();
  highpass.type='highpass';presence.type='peaking';presence.frequency.value=2800;presence.Q.value=1;
  limiter.ratio.value=2.2;limiter.attack.value=.01;limiter.release.value=.18;
  input.connect(dry);dry.connect(ctx.destination);
  input.connect(highpass);highpass.connect(presence);presence.connect(limiter);
  limiter.connect(wet);wet.connect(ctx.destination);
  return {input,dry,wet,highpass,presence,limiter,ctx};
}
export function setVoiceEQ(chain,mode='off'){
  const preset=VOICE_PRESETS[mode];
  if(!preset)throw Error('Chế độ làm rõ giọng nói không hợp lệ');
  if(!chain)return;
  const at=chain.ctx.currentTime;
  const set=(param,value)=>{
    if(param.setTargetAtTime)param.setTargetAtTime(value,at,.025);
    else param.value=value;
  };
  set(chain.highpass.frequency,preset.highpass);
  set(chain.presence.gain,preset.presence);
  set(chain.limiter.threshold,preset.threshold);
  set(chain.dry.gain,1-preset.wet);
  set(chain.wet.gain,preset.wet);
}
