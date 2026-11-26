/** G00: bounded, read-only PCM waveform preview.
 * This is a sampled energy profile, NOT a full peak-envelope scan of multi-hour
 * audio. Never infer available samples from time or synthesize missing audio.
 */
import {locateMeetingPosition} from './meeting-timeline.mjs';

export const WAVEFORM_MAX_BINS=256;
export const WAVEFORM_MAX_FRAMES=2048;
const validSize=(n,max)=>Number.isSafeInteger(n)&&n>0&&n<=max;
const cancelled=()=>{const e=new Error('Đã hủy đọc dạng sóng');e.name='AbortError';return e;};

export function planWaveformProbes(timeline,{bins=192,frames=1024}={}){
  if(!validSize(bins,WAVEFORM_MAX_BINS)||!validSize(frames,WAVEFORM_MAX_FRAMES))
    throw Error('Giới hạn lấy mẫu dạng sóng không hợp lệ');
  if(!timeline||!Number.isSafeInteger(timeline.totalMs)||timeline.totalMs<=0)
    return {bins,probes:[]};
  const probes=[];
  for(let bin=0;bin<bins;bin++){
    const absoluteMs=Math.min(timeline.totalMs-1,Math.floor((bin+0.5)*timeline.totalMs/bins));
    const target=locateMeetingPosition(timeline,absoluteMs);
    if(target.status!=='valid')continue; // GAP: never draw guessed amplitude.
    const session=timeline.sessions.find(s=>s.recordingId===target.recordingId);
    if(!session)throw Error('Không khớp phiên ghi với vị trí lấy mẫu');
    const sample=Math.round(target.localMs*session.sampleRate/1000);
    const range=session.ranges.find(r=>sample>=r.sampleStart&&sample<r.sampleEndExclusive);
    if(!range)continue;
    const count=Math.min(frames,range.sampleEndExclusive-sample);
    if(count>0)probes.push({bin,recordingId:session.recordingId,sample,count});
  }
  return {bins,probes};
}

export function pcmEnergy(pcm,expectedLength){
  if(!(pcm instanceof Float32Array)||pcm.length!==expectedLength||!validSize(expectedLength,WAVEFORM_MAX_FRAMES))
    throw Error('Dữ liệu PCM để vẽ dạng sóng không đúng độ dài');
  let sum=0,peak=0;
  for(let i=0;i<pcm.length;i++){
    const value=pcm[i];
    if(!Number.isFinite(value))throw Error('Mẫu PCM dạng sóng không hữu hạn');
    const amplitude=Math.abs(value);
    peak=Math.max(peak,amplitude);
    sum+=value*value;
  }
  return {peak:Math.min(1,peak),rms:Math.min(1,Math.sqrt(sum/pcm.length))};
}

/** Pure presentation scale: gaps remain null, silence remains a short
 * baseline, quieter real voices gain visibility relative to the sampled RMS.
 * A 0.002 RMS floor prevents near-zero microphone noise being drawn as speech.
 * NEVER change recorded sample values or timing.
 */
export function waveformDisplayHeights(levels){
  if(!Array.isArray(levels))throw TypeError('Thiếu các mức PCM của dạng sóng');
  const valid=levels.filter(v=>v!==null);
  if(valid.some(v=>!Number.isFinite(v?.rms)||v.rms<0||v.rms>1))
    throw Error('Biên độ PCM để hiển thị không hợp lệ');
  const observedMax=valid.reduce((max,v)=>Math.max(max,v.rms),0);
  const ceiling=Math.max(.002,observedMax);
  return {
    observedMax,
    heights:levels.map(v=>v===null?null:Math.min(100,Math.max(15,
      Math.round(100*Math.sqrt(v.rms/ceiling)))))
  };
}

export async function readWaveformEnvelope(timeline,read,{bins=192,frames=1024,signal}={}){
  if(typeof read!=='function')throw TypeError('Thiếu bộ đọc PCM');
  const plan=planWaveformProbes(timeline,{bins,frames});
  const levels=Array(plan.bins).fill(null);
  for(const probe of plan.probes){
    if(signal?.aborted)throw cancelled();
    const result=await read(probe);
    if(signal?.aborted)throw cancelled();
    if(result?.status!=='valid'||!result.pcm)
      throw Error('Không thể xác minh PCM tại mẫu '+probe.sample);
    const pcm=result.pcm instanceof Float32Array?result.pcm:new Float32Array(result.pcm);
    levels[probe.bin]=pcmEnergy(pcm,probe.count);
  }
  return {levels,probesRead:plan.probes.length,samplesRead:plan.probes.reduce((n,p)=>n+p.count,0),
    approximate:true};
}
