import {capPlaybackEnd} from './voice-eq.mjs';

/** G00 conservative, bounded, read-only silence detection for focused replay.
 * This is energy-based VAD, NOT speech recognition or an RNNoise model.
 * Only scan one continuous, confirmed PCM range. Source timestamps stay in
 * samples, and the player may omit audible silence without editing any mark.
 */
export const SILENCE_MAX_FOCUS_MS=60000;
const MAX_BYTES=48*1024*1024;
export function planSilenceScan(check,rate,focusMs){
  if(!Number.isSafeInteger(rate)||rate<8000||rate>192000||
     !Number.isSafeInteger(focusMs)||focusMs<1000||focusMs>SILENCE_MAX_FOCUS_MS)
    throw Error('Để bỏ qua im lặng, hãy chọn Nghe tập trung 15/30/60 giây.');
  if(check?.status!=='valid'||!Number.isSafeInteger(check.startSample)||
    !Number.isSafeInteger(check.anchorSample)||check.startSample<0)
    throw Error('Không xác minh được mốc âm thanh');
  const endSample=capPlaybackEnd(check,rate,focusMs);
  const frames=endSample-check.startSample;
  if(!Number.isSafeInteger(frames)||frames<1||frames*4>MAX_BYTES)
    throw Error('Đoạn PCM quá lớn để phân tích im lặng');
  return {startSample:check.startSample,endSample,frames,rate};
}

export function buildSilenceRanges(plan,energies,{thresholdDb=-42,minSilenceMs=750,keepMs=160}={}){
  if(!plan||!Array.isArray(energies)||!Number.isFinite(thresholdDb)||thresholdDb<-90||
     thresholdDb>-15||!Number.isFinite(minSilenceMs)||minSilenceMs<250||
     !Number.isFinite(keepMs)||keepMs<0)
    throw Error('Dữ liệu phân tích im lặng không hợp lệ');
  const threshold=10**(thresholdDb/20);
  const minFrames=Math.ceil(minSilenceMs*plan.rate/1000);
  const keepFrames=Math.ceil(keepMs*plan.rate/1000);
  const ranges=[];let started=null,lastEnd=plan.startSample;
  const flush=end=>{
    if(started===null)return;
    if(end-started>=minFrames){
      const a=started+keepFrames,b=end-keepFrames;
      if(b>a)ranges.push({startSample:a,endSample:b});
    }
    started=null;
  };
  for(const e of energies){
    if(!Number.isSafeInteger(e.startSample)||!Number.isSafeInteger(e.endSample)||
       e.startSample<lastEnd||e.endSample>plan.endSample||e.endSample<=e.startSample||
       !Number.isFinite(e.rms)||e.rms<0)
      throw Error('Mẫu RMS im lặng bị lỗi hoặc không liền mạch');
    if(e.startSample>lastEnd)flush(lastEnd);
    if(e.rms<=threshold){
      if(started===null)started=e.startSample;
    }else flush(e.startSample);
    lastEnd=e.endSample;
  }
  flush(lastEnd);
  return ranges;
}

export async function scanVerifiedSilence(reader,check,rate,focusMs,
  {cancelled=()=>false,onProgress=()=>{}}={}){
  const plan=planSilenceScan(check,rate,focusMs),energies=[];
  const windowFrames=Math.max(1,Math.round(rate*.025));
  let sample=plan.startSample,energy=0,frames=0,binStart=sample;
  while(sample<plan.endSample){
    if(cancelled())return null;
    const count=Math.min(16384,plan.endSample-sample);
    const r=await reader.call('seek',{sample,count},[],20000);
    if(cancelled())return null;
    if(r?.status!=='valid'||!(r.pcm instanceof ArrayBuffer)||r.pcm.byteLength!==count*4)
      throw Error('Không đọc được PCM đã xác minh; không bỏ qua khoảng thiếu');
    const pcm=new Float32Array(r.pcm);
    for(let i=0;i<pcm.length;i++){
      const v=pcm[i];
      if(!Number.isFinite(v))throw Error('PCM không hữu hạn');
      energy+=v*v;frames++;
      if(frames===windowFrames){
        energies.push({startSample:binStart,endSample:sample+i+1,rms:Math.sqrt(energy/frames)});
        binStart=sample+i+1;frames=0;energy=0;
      }
    }
    sample+=count;
    onProgress({done:sample-plan.startSample,total:plan.frames});
  }
  if(frames)energies.push({startSample:binStart,endSample:plan.endSample,
    rms:Math.sqrt(energy/frames)});
  if(cancelled())return null;
  const ranges=buildSilenceRanges(plan,energies);
  return {ranges,scannedSamples:plan.frames,
    skippedMs:ranges.reduce((sum,x)=>sum+(x.endSample-x.startSample)*1000/rate,0)};
}
