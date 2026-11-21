import {wavHeader} from '../../poc/03-opfs/core.mjs';
import {capPlaybackEnd} from './voice-eq.mjs';

/** Browser HTMLMediaElement uses preservesPitch when changing playbackRate.
 * To avoid loading multi-hour PCM into memory, this adapter is deliberately
 * limited to a focused window <=60s / <=48MiB. No implicit fallback to a
 * pitch-shifting Web Audio source when the user requested preservation.
 */
export const PITCH_MAX_FOCUS_MS=60000;
export const PITCH_MAX_BYTES=48*1024*1024;
export function planPitchWindow(check,sampleRate,focusMs){
  if(!Number.isSafeInteger(sampleRate)||sampleRate<8000||sampleRate>192000||
     !Number.isSafeInteger(focusMs)||focusMs<1000||focusMs>PITCH_MAX_FOCUS_MS)
    throw Error('Để giữ cao độ, hãy chọn Nghe tập trung 15, 30 hoặc 60 giây (không dùng Liên tục).');
  if(check?.status!=='valid'||!Number.isSafeInteger(check.startSample)||check.startSample<0)
    throw Error('Không có vùng PCM đã xác minh để giữ cao độ');
  const endSample=capPlaybackEnd(check,sampleRate,focusMs);
  const frames=endSample-check.startSample;
  const bytes=frames*4;
  if(!Number.isSafeInteger(frames)||frames<1||bytes>PITCH_MAX_BYTES||bytes>0xffffffff-44)
    throw Error('Đoạn ghi âm quá lớn cho chế độ giữ cao độ; hãy chọn 15 hoặc 30 giây.');
  return {startSample:check.startSample,endSample,frames,rate:sampleRate,bytes};
}
export async function readPitchWav(reader,plan,{cancelled=()=>false}={}){
  if(!reader||typeof reader.call!=='function'||!plan||!Number.isSafeInteger(plan.frames)||
     plan.frames<1||plan.bytes!==plan.frames*4||plan.bytes>PITCH_MAX_BYTES)
    throw Error('Không thể đọc đoạn WAV giữ cao độ');
  const parts=[wavHeader(plan.bytes,plan.rate,1)];
  for(let sample=plan.startSample;sample<plan.endSample;){
    if(cancelled())return null;
    const count=Math.min(16384,plan.endSample-sample);
    const result=await reader.call('seek',{sample,count},[],20000);
    if(cancelled())return null;
    if(result?.status!=='valid'||!(result.pcm instanceof ArrayBuffer)||
       result.pcm.byteLength!==count*4)
      throw Error('Dữ liệu âm thanh bị thiếu hoặc hỏng; không phát qua vùng chưa xác minh');
    parts.push(result.pcm);
    sample+=count;
  }
  if(cancelled())return null;
  return new Blob(parts,{type:'audio/wav'});
}
