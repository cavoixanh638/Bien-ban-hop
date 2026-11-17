/** Local-only Vite development companion.
 * Browser sandbox cannot write arbitrary Windows folders. This creates
 * app/Recording/<recordingId>/seg-<sample>.wav safely on localhost, while
 * OPFS + IndexedDB remain the authoritative crash-resistant recorder.
 * Production PWA does NOT expose this endpoint.
 */
import {createWriteStream,createReadStream} from 'node:fs';
import {mkdir,open,stat,link,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {randomUUID,createHash} from 'node:crypto';

const LIMIT_BYTES=256*1024*1024; // one 5-minute 192kHz mono f32 segment fits
const RECORD=/^rec-[a-zA-Z0-9_-]{10,96}$/;
const FILE=/^seg-\d+\.wav$/;
const PREFIX='/__moc_hop_local_recording/';
const HEADER='recording-v1';

function answer(res,code,data){
  res.statusCode=code;res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));
}
function validWaveHeader(buffer,size){
  if(buffer.length<44 || size<44) return false;
  return buffer.toString('ascii',0,4)==='RIFF' &&
    buffer.toString('ascii',8,12)==='WAVE' &&
    buffer.toString('ascii',12,16)==='fmt ' &&
    buffer.toString('ascii',36,40)==='data' &&
    buffer.readUInt32LE(4)===size-8 &&
    buffer.readUInt16LE(20)===3 && buffer.readUInt16LE(22)===1 &&
    buffer.readUInt16LE(34)===32 &&
    buffer.readUInt32LE(40)===size-44 &&
    buffer.readUInt32LE(24)>=8000 && buffer.readUInt32LE(24)<=192000;
}
async function sha256OnDisk(filePath){
  const hash=createHash('sha256');
  for await(const chunk of createReadStream(filePath))hash.update(chunk);
  return hash.digest('hex');
}
export function createLocalRecordingMiddleware(appRoot,{origin='http://127.0.0.1:5173'}={}){
  const base=resolve(appRoot,'Recording');
  return async (req,res,next)=>{
    const raw=req.url?.split('?')[0]??'';
    if(!raw.startsWith(PREFIX))return next();
    const relative=raw.slice(PREFIX.length);
    // Keep the companion bound to the local development origin only.
    if(req.headers['x-mochop-local']!==HEADER ||
       (req.headers.origin && req.headers.origin!==origin) ||
       req.headers.host!==new URL(origin).host){
      answer(res,403,{error:'Chỉ ứng dụng Mốc Họp chạy cục bộ được ghi WAV'});return;
    }
    if(relative==='status' && req.method==='GET'){
      answer(res,200,{available:true,folder:'app/Recording',limitBytes:LIMIT_BYTES});return;
    }
    const parts=relative.split('/');
    if(parts.length!==2||!RECORD.test(parts[0])||!FILE.test(parts[1])){
      answer(res,400,{error:'Tên bản ghi hoặc segment không hợp lệ'});return;
    }
    const [recordingId,filename]=parts,dir=join(base,recordingId),dest=join(dir,filename);
    if(req.method==='HEAD'){
      try{
        const st=await stat(dest);
        if(!st.isFile())throw Error('WAV cục bộ không phải tệp thường');
        const sha256=await sha256OnDisk(dest);
        res.statusCode=200;res.setHeader('X-Recording-Bytes',String(st.size));
        res.setHeader('X-Recording-Sha256',sha256);
      }catch(e){res.statusCode=e.code==='ENOENT'?404:500;}
      res.setHeader('Cache-Control','no-store');res.end();return;
    }
    if(req.method!=='PUT'){answer(res,405,{error:'Chỉ cho phép PUT hoặc HEAD'});return;}
    let tmp='';
    try{
      await mkdir(dir,{recursive:true});
      try{await stat(dest);answer(res,409,{error:'Segment đã tồn tại; không ghi đè'});return;}
      catch(e){if(e.code!=='ENOENT')throw e;}
      tmp=join(dir,'.'+filename+'.'+randomUUID()+'.part');
      let size=0;const hash=createHash('sha256');
      const check=new Transform({transform(chunk,_encoding,callback){
        size+=chunk.length;
        if(size>LIMIT_BYTES){callback(Error('WAV segment vượt giới hạn dung lượng'));return;}
        hash.update(chunk);callback(null,chunk);
      }});
      await pipeline(req,check,createWriteStream(tmp,{flags:'wx'}));
      const handle=await open(tmp,'r');
      const header=Buffer.alloc(44);
      try{await handle.read(header,0,44,0);}finally{await handle.close();}
      if(!validWaveHeader(header,size))throw Error('Header WAV Float32 không hợp lệ hoặc chưa hoàn chỉnh');
      await link(tmp,dest); // no-clobber atomic publish, including concurrent uploads
      await unlink(tmp);tmp='';
      answer(res,201,{saved:true,recordingId,filename,bytes:size,sha256:hash.digest('hex'),
        relativePath:'Recording/'+recordingId+'/'+filename});
    }catch(e){
      if(tmp)try{await unlink(tmp);}catch{}
      answer(res,e.code==='EEXIST'?409:e.message.includes('giới hạn')?413:422,{error:e.message});
    }
  };
}
