import {AudioRPC} from './audio.mjs';

const ENDPOINT='/__moc_hop_local_recording/';
const HEADERS={'X-MocHop-Local':'recording-v1'};
const VALID_ID=/^rec-[a-zA-Z0-9_-]{10,96}$/;
const VALID_SEGMENT=/^seg-\d+\.wav$/;

/** Optional desktop companion. Only Vite localhost dev exposes it.
 * Browser-only/PWA never pretends Windows files were saved; OPFS remains intact.
 */
export async function localRecordingStatus(){
  try{
    const response=await fetch(ENDPOINT+'status',{headers:HEADERS,cache:'no-store'});
    if(!response.ok)return {available:false,reason:'Chưa có dịch vụ lưu WAV trong thư mục ứng dụng'};
    return await response.json();
  }catch{return {available:false,reason:'Không thể truy cập thư mục Recording cục bộ'};}
}
async function getExistingBytes(url){
  const r=await fetch(url,{method:'HEAD',headers:HEADERS,cache:'no-store'});
  if(r.status===404)return null;
  if(!r.ok)throw Error('Không đọc được trạng thái WAV cục bộ: '+r.status);
  const n=Number(r.headers.get('X-Recording-Bytes'));
  if(!Number.isSafeInteger(n)||n<44)throw Error('File WAV trong Recording không hợp lệ');
  return n;
}
async function getRecordingFile(root,path){
  const parts=path.split('/');
  if(parts.length!==2||!VALID_ID.test(parts[0])||!VALID_SEGMENT.test(parts[1]))
    throw Error('Đường dẫn OPFS không hợp lệ');
  const dir=await root.getDirectoryHandle(parts[0]);
  return (await dir.getFileHandle(parts[1])).getFile();
}
export async function mirrorRecordingToLocalFolder(recordingId,{onProgress=()=>{}}={}){
  if(!VALID_ID.test(recordingId))throw Error('Mã bản ghi âm không hợp lệ');
  const availability=await localRecordingStatus();
  if(!availability.available)return {status:'unavailable',reason:availability.reason};
  const rpc=new AudioRPC();
  let manifest;
  try{
    await rpc.call('init',{recordingId,reopen:true});
    manifest=await rpc.call('manifest');
  }finally{await rpc.dispose();}
  if(manifest.recordingId!==recordingId)throw Error('Manifest không khớp bản ghi');
  const segments=manifest.segments.filter(s=>s.sampleCount>0 &&
    ['checkpointed','finalized','complete'].includes(s.completionState));
  if(!segments.length)throw Error('Không có đoạn WAV đã lưu để xuất');
  const root=await navigator.storage.getDirectory();
  let copied=0,existing=0,bytes=0;
  for(const segment of segments){
    const path=segment.filePath,parts=path.split('/');
    if(parts[0]!==recordingId||!VALID_SEGMENT.test(parts[1]))
      throw Error('Đường dẫn WAV không khớp bản ghi');
    const file=await getRecordingFile(root,path);
    if(file.size<44)throw Error('File WAV rỗng: '+path);
    const url=ENDPOINT+encodeURIComponent(recordingId)+'/'+encodeURIComponent(parts[1]);
    const size=await getExistingBytes(url);
    if(size!==null){
      if(size!==file.size)throw Error('WAV cục bộ khác kích thước: '+parts[1]+'; không ghi đè dữ liệu cũ');
      existing++;bytes+=file.size;onProgress({copied,existing,total:segments.length,bytes});
      continue;
    }
    // Sending the OPFS-backed File allows Chromium to stream without buffering
    // hours of Float32 PCM in JS memory.
    const response=await fetch(url,{method:'PUT',headers:{...HEADERS,'Content-Type':'audio/wav'},body:file});
    if(!response.ok){
      const detail=await response.json().catch(()=>({error:'HTTP '+response.status}));
      if(response.status===409 && await getExistingBytes(url)===file.size)existing++;
      else throw Error('Lưu WAV '+parts[1]+' thất bại: '+(detail.error??response.status));
    }else copied++;
    bytes+=file.size;onProgress({copied,existing,total:segments.length,bytes});
  }
  return {status:'saved',copied,existing,segments:segments.length,bytes,
    relativeFolder:'app/Recording/'+recordingId};
}
