import {AudioRPC} from './audio.mjs';
import {Sha256} from '../../poc/07-backup/zip-stream.mjs';

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
async function getExistingCopy(url){
  const r=await fetch(url,{method:'HEAD',headers:HEADERS,cache:'no-store'});
  if(r.status===404)return null;
  if(!r.ok)throw Error('Không đọc được trạng thái WAV cục bộ: '+r.status);
  const bytes=Number(r.headers.get('X-Recording-Bytes'));
  const sha256=r.headers.get('X-Recording-Sha256');
  if(!Number.isSafeInteger(bytes)||bytes<44||!/^[0-9a-f]{64}$/.test(sha256??''))
    throw Error('File WAV trong Recording thiếu kích thước/SHA256 hợp lệ');
  return {bytes,sha256};
}
/** Existing same-size WAVs may be corrupted. Fail closed without overwriting
 * them, hashing OPFS in bounded chunks instead of loading a whole WAV into RAM. */
export async function verifyExistingLocalWav(url,file){
  const existing=await getExistingCopy(url);
  if(existing===null)return false;
  if(existing.bytes!==file.size)throw Error('WAV cục bộ khác kích thước; không ghi đè dữ liệu cũ');
  const sha=new Sha256(),reader=file.stream().getReader();
  try{
    for(;;){
      const {value,done}=await reader.read();
      if(done)break;
      if(!(value instanceof Uint8Array))throw Error('Stream WAV không hợp lệ');
      sha.update(value);
    }
  }finally{reader.releaseLock();}
  if(sha.digestHex()!==existing.sha256)
    throw Error('WAV cục bộ khác SHA256 dù cùng dung lượng; không ghi đè dữ liệu cũ');
  return true;
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
    if(await verifyExistingLocalWav(url,file)){
      existing++;bytes+=file.size;onProgress({copied,existing,total:segments.length,bytes});
      continue;
    }
    // Sending the OPFS-backed File allows Chromium to stream without buffering
    // hours of Float32 PCM in JS memory.
    const response=await fetch(url,{method:'PUT',headers:{...HEADERS,'Content-Type':'audio/wav'},body:file});
    if(!response.ok){
      const detail=await response.json().catch(()=>({error:'HTTP '+response.status}));
      if(response.status===409 && await verifyExistingLocalWav(url,file))existing++;
      else throw Error('Lưu WAV '+parts[1]+' thất bại: '+(detail.error??response.status));
    }else copied++;
    bytes+=file.size;onProgress({copied,existing,total:segments.length,bytes});
  }
  return {status:'saved',copied,existing,segments:segments.length,bytes,
    relativeFolder:'app/Recording/'+recordingId};
}
