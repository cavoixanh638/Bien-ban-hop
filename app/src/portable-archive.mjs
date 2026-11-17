/** Portable Biên bản họp v2 ZIP64 export/import. Stream WAVs end-to-end.
 * G07 ZIP primitives, but complete multi-session G03 journals and G06 history.
 * Metadata is bounded; audio is never fully buffered in JS.
 */
import {ZipStoreWriter,ZipStoreReader,blobSource,Crc32,Sha256,jsonBytes,fileName} from '../../poc/07-backup/zip-stream.mjs';
import {PORTABLE_VERSION,LIMITS,checkBundle,remapBundle} from './portable-model.mjs';
const decoder=new TextDecoder('utf-8',{fatal:true});
const isSafe=x=>Number.isSafeInteger(x)&&x>=0;
const fail=s=>{throw Error('Lỗi sao lưu/khôi phục: '+s);};
const metaPaths=['meeting.json','note.json','history.json','pending.json','recordings/index.json'];
const journalPath=id=>'recordings/'+id+'/journal.json';
const audioPath=(id,segmentId)=>'audio/'+id+'/'+segmentId+'.wav';
const bytesJSON=value=>{const b=jsonBytes(value);if(b.byteLength>LIMITS.maxJson)fail('metadata vượt giới hạn');return b;};
const recordIds=meeting=>meeting.recordingIds??[];
export async function exportMochopV2(source,sink,{signal,onProgress}={}){
  checkBundle(source.meeting,source.note,source.history,source.pendingState,source.recordings);
  if(!source.openAudio||typeof source.openAudio!=='function')fail('thiếu nguồn WAV');
  const writer=new ZipStoreWriter(sink,{signal,onProgress}),files=[];
  const meta=[
    ['meeting.json',source.meeting],['note.json',source.note],['history.json',source.history],
    ['pending.json',source.pendingState??null],['recordings/index.json',{recordingIds:recordIds(source.meeting)}]
  ];
  for(const id of recordIds(source.meeting))meta.push([journalPath(id),source.recordings.get(id)]);
  try{
    for(const [name,value] of meta){
      const blob=new Blob([bytesJSON(value)]);
      files.push(await writer.add(name,blob.stream()));
    }
    for(const id of recordIds(source.meeting)){
      const journal=source.recordings.get(id);
      for(const segment of journal.segments){
        const name=audioPath(id,segment.segmentId);
        const stream=await source.openAudio(segment.filePath);
        if(!stream||typeof stream.getReader!=='function')fail('không đọc được WAV '+name);
        const saved=await writer.add(name,stream);
        if(saved.size!==segment.byteLength)fail('WAV sai kích thước: '+name);
        files.push(saved);
      }
    }
    const manifest={format:'mochop',formatVersion:PORTABLE_VERSION,schemaVersion:1,
      appVersion:'g10-portable',meetingIds:[source.meeting.meetingId],recordingIds:recordIds(source.meeting),
      files,createdAt:new Date().toISOString()};
    if(jsonBytes(manifest).byteLength>LIMITS.maxManifest)fail('quá nhiều file trong manifest');
    await writer.add('manifest.json',new Blob([jsonBytes(manifest)]).stream());
    const archive=await writer.close();
    return {manifest,archive};
  }catch(error){await writer.abort(error);throw error;}
}
async function verifiedStream(reader,entry,record,limit=Infinity,signal){
  let consumed=false;
  const upstream=(await reader.open(entry)).getReader(),sha=new Sha256(),crc=new Crc32();
  let size=0;
  return new ReadableStream({
    async pull(controller){
      if(signal?.aborted)throw Error('Nhập liệu đã bị hủy');
      const {done,value}=await upstream.read();
      if(done){
        if(size!==record.size||size!==entry.size||
          sha.digestHex()!==record.sha256||crc.digest()!==entry.crc32)
          throw Error('File sai SHA256/CRC: '+entry.name);
        consumed=true;controller.close();return;
      }
      if(!(value instanceof Uint8Array))throw Error('Dữ liệu ZIP không đúng kiểu');
      size+=value.byteLength;
      if(size>limit||size>record.size)throw Error('ZIP vượt giới hạn file '+entry.name);
      sha.update(value);crc.update(value);controller.enqueue(value);
    },
    async cancel(reason){if(!consumed)await upstream.cancel(reason).catch(()=>{});}
  },{highWaterMark:1});
}
async function loadJson(reader,entry,declared,signal){
  const stream=await verifiedStream(reader,entry,declared,LIMITS.maxJson,signal);
  const r=stream.getReader(),chunks=[];let total=0;
  try{
    for(;;){const {value,done}=await r.read();if(done)break;chunks.push(value);total+=value.length;}
  }finally{r.releaseLock();}
  const data=new Uint8Array(total);let at=0;
  for(const c of chunks){data.set(c,at);at+=c.byteLength;}
  try{return JSON.parse(decoder.decode(data));}catch(e){fail('JSON '+entry.name+': '+e.message);}
}
export async function importMochopV2(blob,repo,{signal,onProgress,makeId,now}={}){
  if(!blob||!Number.isSafeInteger(blob.size)||blob.size<22)fail('file không phải ZIP hợp lệ');
  const reader=new ZipStoreReader(blobSource(blob),{maxEntries:LIMITS.maxEntries});
  const entries=await reader.entries(),files=new Map(),folded=new Set();
  let total=0;
  for(const entry of entries){
    fileName(entry.name);
    const k=entry.name.toLowerCase();
    if(folded.has(k))fail('đường dẫn trùng trong ZIP: '+entry.name);
    folded.add(k);
    if(!isSafe(entry.size)||!isSafe(entry.compressedSize)||
       entry.size>Math.max(1,entry.compressedSize)*200)fail('ZIP bomb hoặc kích thước không hợp lệ');
    total+=entry.size;
    if(total>LIMITS.maxTotal)fail('ZIP vượt quá dung lượng cho phép');
    files.set(entry.name,entry);
  }
  const m=files.get('manifest.json');
  if(!m||m.size>LIMITS.maxManifest)fail('thiếu manifest.json');
  // ZIP central CRC for manifest; it does not have a self-referential SHA.
  const header=await loadJson(reader,m,{size:m.size,sha256:(await hashEntry(reader,m)),
    path:'manifest.json'},signal);
  if(header?.format!=='mochop'||header.formatVersion!==2||
     header.schemaVersion!==1||!Array.isArray(header.files)||
     !Array.isArray(header.recordingIds)||!Array.isArray(header.meetingIds)||
     header.meetingIds.length!==1)fail('định dạng tệp sao lưu chưa được hỗ trợ');
  const declarations=new Map(),known=new Set(metaPaths);
  for(const id of header.recordingIds){
    if(typeof id!=='string'||!/^[A-Za-z0-9_-]+$/.test(id))fail('mã bản ghi ZIP');
    known.add(journalPath(id));
  }
  for(const item of header.files){
    if(!item||typeof item.path!=='string'||!isSafe(item.size)||
      !/^[a-f0-9]{64}$/.test(item.sha256??''))fail('manifest file sai cấu trúc');
    fileName(item.path);
    if(declarations.has(item.path))fail('file bị lặp trong manifest');
    declarations.set(item.path,item);
  }
  for(const name of metaPaths)if(!declarations.has(name))fail('thiếu metadata '+name);
  for(const name of files.keys())if(name!=='manifest.json'&&!declarations.has(name))fail('file ZIP không khai báo: '+name);
  for(const [path,item] of declarations){
    const e=files.get(path);
    if(!e||e.size!==item.size)fail('file ZIP thiếu/sai kích thước: '+path);
    if(!(known.has(path)||/^audio\/rec-[A-Za-z0-9_-]+\/seg-[0-9]+\.wav$/.test(path)))
      fail('đường dẫn không thuộc dữ liệu cuộc họp: '+path);
  }
  const metaTotal=[...declarations].filter(([name])=>!name.startsWith('audio/'))
    .reduce((acc,[,row])=>acc+row.size,0);
  if(metaTotal>LIMITS.maxJson)fail('metadata vượt giới hạn tổng');
  const read=name=>loadJson(reader,files.get(name),declarations.get(name),signal);
  const [meeting,note,history,pending,index]=await Promise.all(metaPaths.map(read));
  if(JSON.stringify(header.meetingIds)!==JSON.stringify([meeting?.meetingId]) ||
     JSON.stringify(header.recordingIds)!==JSON.stringify(meeting?.recordingIds)||
     JSON.stringify(index?.recordingIds)!==JSON.stringify(meeting?.recordingIds))
    fail('danh sách phiên ghi không khớp');
  const raw=new Map();
  for(const id of meeting.recordingIds){
    if(!declarations.has(journalPath(id)))fail('nhật ký phiên thu bị thiếu');
    raw.set(id,await read(journalPath(id)));
  }
  checkBundle(meeting,note,history,pending,raw);
  const audioFiles=new Map();
  for(const [id,journal] of raw){
    for(const seg of journal.segments){
      const key=audioPath(id,seg.segmentId);
      if(!declarations.has(key)||declarations.get(key).size!==seg.byteLength)
        fail('WAV thiếu hoặc không khớp nhật ký: '+key);
      audioFiles.set(key,{id,seg});
    }
  }
  for(const name of declarations.keys())
    if(name.startsWith('audio/')&&!audioFiles.has(name))
      fail('file WAV không được tham chiếu: '+name);
  const mapped=remapBundle({meeting,note,history,pendingState:pending,recordings:raw},makeId,now);
  // start staging only after all metadata, relationships and declared files have passed validation
  const stage=await repo.stage(mapped);
  let published=false;
  try{
    let done=0;
    for(const [name,{id,seg}] of audioFiles){
      if(signal?.aborted)throw Error('Đã hủy nhập liệu');
      const entry=files.get(name),verified=await verifiedStream(reader,entry,declarations.get(name),seg.byteLength,signal);
      const newId=mapped.idMap.get(id);
      await stage.writeAudio(newId+'/'+seg.segmentId+'.wav',verified,seg.byteLength);
      done++;
      onProgress?.({phase:'audio',done,total:audioFiles.size,path:name});
    }
    const result=await stage.publish(mapped);
    published=true;
    return {...result,files:declarations.size,sourceMeetingId:meeting.meetingId,recordings:raw.size};
  }finally{if(!published)await stage.discard();}
}
// Used only for small manifest.json. Read twice to validate both ZIP CRC and JSON SHA
// without accepting a forged checksum from untrusted archive metadata.
async function hashEntry(reader,entry){
  if(entry.size>LIMITS.maxManifest)fail('manifest quá lớn');
  const r=(await reader.open(entry)).getReader(),sha=new Sha256(),crc=new Crc32();let size=0;
  try{for(;;){const {done,value}=await r.read();if(done)break;size+=value.length;
    if(size>LIMITS.maxManifest)fail('manifest quá lớn');sha.update(value);crc.update(value);}}
  finally{r.releaseLock();}
  if(size!==entry.size||crc.digest()!==entry.crc32)fail('manifest CRC không khớp');
  return sha.digestHex();
}

/** Inspect only the bounded, CRC-validated manifest to route older exports.
 * Each actual importer independently revalidates the complete ZIP again.
 */
export async function probeMochopVersion(blob){
  const reader=new ZipStoreReader(blobSource(blob),{maxEntries:LIMITS.maxEntries});
  const entries=await reader.entries();
  const m=entries.find(e=>e.name==='manifest.json');
  if(!m||m.size>LIMITS.maxManifest)fail('file không chứa manifest hợp lệ');
  const digest=await hashEntry(reader,m);
  const manifest=await loadJson(reader,m,{path:m.name,size:m.size,sha256:digest});
  if(manifest?.format!=='mochop'||![1,2].includes(manifest.formatVersion))
    fail('định dạng tệp sao lưu không được hỗ trợ');
  return manifest.formatVersion;
}
