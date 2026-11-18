import {AudioRPC} from './audio.mjs';
import {deleteAudioJournal} from './portable-storage.mjs';
const MAX_WAV_BYTES=2_000_000_000;
const MAX_DECODE_BYTES=32_000_000;
const MAX_DECODE_SECONDS=1800;
const MAX_WAV_SECONDS=3*3600;
const CHUNK_FRAMES=32768;
const HEADER_SCAN=1024*1024;
const fail=message=>{throw Error(message);};
const aborted=signal=>{if(signal?.aborted)fail('Đã hủy nhập file âm thanh');};
const ascii=(v,i,n)=>String.fromCharCode(...new Uint8Array(v.buffer,v.byteOffset+i,n));

export function inspectWavHeader(buffer,totalBytes){
  const v=new DataView(buffer),len=v.byteLength;
  if(len<44||ascii(v,0,4)!=='RIFF'||ascii(v,8,4)!=='WAVE')
    fail('File WAV không có header RIFF/WAVE hợp lệ');
  let fmt=null,data=null,offset=12;
  while(offset+8<=len){
    const id=ascii(v,offset,4),size=v.getUint32(offset+4,true);
    const payload=offset+8,end=payload+size;
    if(end>totalBytes)fail('Chunk WAV vượt kích thước file');
    if(id==='fmt '){
      if(size<16||end>len)fail('Không đọc được header fmt của WAV');
      fmt={format:v.getUint16(payload,true),channels:v.getUint16(payload+2,true),
        sampleRate:v.getUint32(payload+4,true),byteRate:v.getUint32(payload+8,true),
        align:v.getUint16(payload+12,true),bits:v.getUint16(payload+14,true)};
    }
    if(id==='data'){data={offset:payload,bytes:size};break;}
    offset=end+(size%2);
    if(offset>HEADER_SCAN)fail('Header WAV vượt 1 MB');
  }
  if(!fmt||!data)fail('Thiếu fmt hoặc data WAV');
  const {format,channels,sampleRate,bits,align}=fmt;
  if(![1,3].includes(format)||!([8,16,24,32].includes(bits)) ||
     (format===3&&bits!==32) ||channels<1||channels>2 ||
      sampleRate<8000||sampleRate>192000||align!==channels*bits/8)
    fail('WAV chỉ hỗ trợ PCM 8/16/24/32 bit hoặc float32, mono/stereo, 8–192 kHz');
  if(data.bytes%align!==0||data.bytes<align)fail('Dữ liệu WAV không nguyên frame');
  const frames=data.bytes/align;
  if(frames/sampleRate>MAX_WAV_SECONDS)fail('Chỉ hỗ trợ WAV tối đa 3 giờ');
  return {...fmt,...data,frames};
}
function readSample(dv,offset,format,bits){
  if(format===3){const n=dv.getFloat32(offset,true);if(!Number.isFinite(n))fail('WAV chứa mẫu không hợp lệ');return Math.max(-1,Math.min(1,n));}
  if(bits===8)return (dv.getUint8(offset)-128)/128;
  if(bits===16)return dv.getInt16(offset,true)/32768;
  if(bits===24){let n=dv.getUint8(offset)|(dv.getUint8(offset+1)<<8)|(dv.getUint8(offset+2)<<16);
    if(n&0x800000)n-=0x1000000;return n/8388608;}
  return dv.getInt32(offset,true)/2147483648;
}
export function toMonoPCM(raw,fmt){
  if(raw.byteLength%fmt.align)fail('PCM không nguyên frame');
  const v=new DataView(raw),frames=raw.byteLength/fmt.align;
  const out=new ArrayBuffer(frames*4),dst=new DataView(out);
  const bytes=fmt.bits/8;
  for(let i=0;i<frames;i++){
    let sample=0;
    for(let c=0;c<fmt.channels;c++)
      sample+=readSample(v,i*fmt.align+c*bytes,fmt.format,fmt.bits)/fmt.channels;
    dst.setFloat32(i*4,sample,true);
  }
  return out;
}
function toPCMFromAudioBuffer(decoded,offset,count){
  const dst=new ArrayBuffer(count*4),v=new DataView(dst);
  const channelCount=Math.min(2,decoded.numberOfChannels);
  if(channelCount<1)fail('Không có kênh âm thanh');
  const data=Array.from({length:channelCount},(_,c)=>decoded.getChannelData(c));
  for(let i=0;i<count;i++){
    let n=0;for(const ch of data)n+=ch[offset+i]/channelCount;
    if(!Number.isFinite(n))fail('Bộ giải mã trả mẫu không hợp lệ');
    v.setFloat32(i*4,Math.max(-1,Math.min(1,n)),true);
  }
  return dst;
}
export async function removeUnlinkedImportedAudio(recordingId){
  if(!/^rec-import-[0-9a-f-]{30,50}$/.test(recordingId))fail('Không được xóa dữ liệu không thuộc file nhập');
  try{
    const root=await navigator.storage.getDirectory();
    await root.removeEntry(recordingId,{recursive:true});
  }catch(e){if(e.name!=='NotFoundError')throw e;}
  await deleteAudioJournal(recordingId);
}
export async function importAudioFile(file,{recordingId,signal,onProgress=()=>{},RPC=AudioRPC}={}){
  if(!file||typeof file.slice!=='function'||!Number.isSafeInteger(file.size)||file.size<=44)
    fail('File âm thanh rỗng hoặc không hợp lệ');
  if(!/^rec-import-[0-9a-f-]{30,50}$/.test(recordingId??''))
    fail('Mã file nhập không hợp lệ');
  aborted(signal);
  let rpc,initialized=false,frames=0,rate=0,sequenceNo=0,source=null;
  try{
    const wav=/\.wav$/i.test(file.name??'')||
      /audio\/(wav|x-wav|wave)/i.test(file.type??'');
    if(wav){
      if(file.size>MAX_WAV_BYTES)fail('WAV vượt giới hạn 2 GB (cần tách file)');
      const scan=await file.slice(0,Math.min(file.size,HEADER_SCAN)).arrayBuffer();
      const info=inspectWavHeader(scan,file.size);
      frames=info.frames;rate=info.sampleRate;source={type:'wav',info};
    }else{
      if(file.size>MAX_DECODE_BYTES)fail('File nén quá 32 MB: cần bộ giải mã streaming riêng');
      if(!/\.(mp3|m4a|mp4|webm|ogg)$/i.test(file.name??''))
        fail('Chỉ hỗ trợ WAV, MP3, M4A, WebM hoặc OGG');
      const ctx=new AudioContext();
      try{
        const decoded=await ctx.decodeAudioData(await file.arrayBuffer());
        if(decoded.duration>MAX_DECODE_SECONDS || decoded.numberOfChannels>2 ||
           decoded.sampleRate<8000||decoded.sampleRate>192000)
          fail('File nén quá 30 phút hoặc có định dạng không hỗ trợ');
        frames=decoded.length;rate=decoded.sampleRate;source={type:'decoded',decoded};
      }finally{await ctx.close();}
    }
    aborted(signal);
    rpc=new RPC();
    await rpc.call('init',{recordingId,sampleRate:rate,channels:1,segmentSeconds:300});
    initialized=true;
    let frame=0;
    while(frame<frames){
      aborted(signal);
      const count=Math.min(CHUNK_FRAMES,frames-frame);
      let pcm;
      if(source.type==='wav'){
        const {offset,align}=source.info;
        const b=await file.slice(offset+frame*align,offset+(frame+count)*align).arrayBuffer();
        if(b.byteLength!==count*align)fail('WAV bị cắt trong khi nhập');
        pcm=toMonoPCM(b,source.info);
      }else pcm=toPCMFromAudioBuffer(source.decoded,frame,count);
      const chunk={format:'f32le',recordingId,sampleRate:rate,channels:1,
        sequenceNo:sequenceNo++,firstSample:frame,sampleCount:count,pcm};
      await rpc.call('append',chunk,[pcm],30000);
      frame+=count;
      if(sequenceNo%8===0||frame===frames){
        await rpc.call('flush',{},[],30000);
        onProgress({frames:frame,totalFrames:frames,sampleRate:rate});
      }
    }
    const manifest=await rpc.call('manifest');
    if(manifest?.recordingId!==recordingId||manifest?.sampleRate!==rate||
       manifest?.sampleRanges?.length!==1||
       manifest.sampleRanges[0].sampleStart!==0||
       manifest.sampleRanges[0].sampleEndExclusive!==frames)
      fail('OPFS chưa xác nhận đủ mẫu liên tục của file nhập');
    return {recordingId,sampleRate:rate,frames,durationMs:Math.round(frames*1000/rate)};
  }catch(error){
    if(initialized){
      try{await rpc?.dispose();rpc=null;await removeUnlinkedImportedAudio(recordingId);}
      catch(cleanupError){error.message+='; không thể dọn dữ liệu nhập dở: '+cleanupError.message;}
    }
    throw error;
  }finally{await rpc?.dispose();}
}
