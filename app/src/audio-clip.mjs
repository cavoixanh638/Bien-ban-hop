import {AudioRPC} from './audio.mjs';
import {wavHeader} from '../../poc/03-opfs/core.mjs';

/** Clip export always selects one truly committed contiguous PCM range.
 * Output is float32 WAV, matching existing G03 recordings; source is read-only.
 */
export function planVerifiedWavClip(manifest,startMs,endMs,{maxDurationMs=120000}={}){
  const rate=manifest?.sampleRate;
  if(!Number.isSafeInteger(rate)||rate<8000||rate>192000||
     !Number.isFinite(startMs)||!Number.isFinite(endMs)||endMs<=startMs||startMs<0)
    throw Error('Vùng WAV để xuất không hợp lệ');
  const startSample=Math.ceil(startMs*rate/1000);
  const endSample=Math.floor(endMs*rate/1000);
  const count=endSample-startSample;
  if(count<Math.ceil(rate*.4)||count>Math.floor(rate*maxDurationMs/1000))
    throw Error('Chỉ xuất đoạn WAV dài 0,4–120 giây');
  if(!manifest.sampleRanges?.some(x=>startSample>=x.sampleStart&&endSample<=x.sampleEndExclusive))
    throw Error('Không được xuất qua vùng thiếu âm thanh hoặc khác phiên ghi');
  return {recordingId:manifest.recordingId,rate,startSample,endSample,count};
}
export async function exportVerifiedWavClip(recordingId,startMs,endMs,
  {rpcFactory=()=>new AudioRPC(),signal,onProgress=()=>{}}={}){
  const rpc=rpcFactory();
  try{
    if(signal?.aborted)throw Error('Đã hủy xuất WAV');
    await rpc.call('init',{recordingId,reopen:true});
    const manifest=await rpc.call('manifest');
    if(manifest?.recordingId!==recordingId)throw Error('Sai nguồn ghi âm');
    const plan=planVerifiedWavClip(manifest,startMs,endMs);
    const parts=[wavHeader(plan.count*4,plan.rate,1)];
    let sample=plan.startSample;
    while(sample<plan.endSample){
      if(signal?.aborted)throw Error('Đã hủy xuất WAV');
      const count=Math.min(16384,plan.endSample-sample);
      const read=await rpc.call('seek',{sample,count},[],15000);
      if(read?.status!=='valid'||!(read.pcm instanceof ArrayBuffer)||
         read.pcm.byteLength!==count*4)
        throw Error('Không đọc được đủ mẫu WAV; không xuất đoạn thiếu');
      parts.push(read.pcm);sample+=count;
      onProgress({done:sample-plan.startSample,total:plan.count});
    }
    return {blob:new Blob(parts,{type:'audio/wav'}),samples:plan.count,
      durationMs:plan.count*1000/plan.rate};
  }finally{await rpc.dispose();}
}
