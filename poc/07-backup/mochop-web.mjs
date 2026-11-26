/** Browser-compatible .mochop pack/restore core; no filesystem or npm dependency. */
import {ZipStoreWriter,ZipStoreReader,Crc32,Sha256,fileName,jsonBytes} from './zip-stream.mjs';
const textDecoder=new TextDecoder('utf-8',{fatal:true});
export const LIMITS=Object.freeze({entries:10000,total:8*1024**3,ratio:200,manifestBytes:1024*1024,metadataBytes:64*1024*1024});
export class BackupError extends Error {constructor(message){super(message);this.name='BackupError';}}
const fail=msg=>{throw new BackupError(msg);};
export const readJson=(bytes)=>JSON.parse(textDecoder.decode(bytes));
function validPath(name){try{fileName(name)}catch{fail('unsafe path: '+String(name))}return name;}
function strictId(id){if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(id))fail('invalid meetingId');return id;}
export function validateContract(meeting,note,audio){
  if(!meeting||!note||!audio||[meeting,note,audio].some(x=>typeof x!=='object'||Array.isArray(x)))fail('invalid contract JSON');
  strictId(meeting.meetingId);
  if(meeting.schemaVersion!==1||note.schemaVersion!==1||audio.schemaVersion!==undefined&&audio.schemaVersion!==1)fail('unsupported schema');
  if(typeof meeting.noteDocumentId!=='string'||meeting.noteDocumentId!==note.noteDocumentId||note.content?.type!=='doc'||!Array.isArray(note.content.content))fail('NoteDocument mismatch');
  if(typeof audio.recordingId!=='string'||!Array.isArray(meeting.recordingIds)||!meeting.recordingIds.includes(audio.recordingId))fail('recording mismatch');
  if(!Array.isArray(audio.segments)||!Array.isArray(audio.intervals))fail('audio manifest shape');
  const segmentIds=new Set(),pathSet=new Set();
  for(const s of audio.segments){
    if(!s||typeof s.segmentId!=='string'||segmentIds.has(s.segmentId))fail('duplicate/invalid segment');
    segmentIds.add(s.segmentId);validPath(s.filePath);
    if(!s.filePath.startsWith('audio/')||pathSet.has(s.filePath.toLowerCase()))fail('segment path collision/outside audio');
    pathSet.add(s.filePath.toLowerCase());
  }
  return true;
}
/** source = {meeting,note,audio, openAudio(path)-> ReadableStream<Uint8Array>} */
export async function exportMochop(source,sink,{writerFactory=stream=>new ZipStoreWriter(stream)}={}){
  validateContract(source.meeting,source.note,source.audio);
  const w=writerFactory(sink),files=[];
  const metadata=[['meeting.json',source.meeting],['note.json',source.note],['audio-manifest.json',source.audio]];
  try {
    for(const [name,value] of metadata) files.push(await w.add(name,new Blob([jsonBytes(value)]).stream()));
    for(const seg of source.audio.segments){
      const stream=await source.openAudio(seg.filePath);
      if(!stream||typeof stream.getReader!=='function')fail('audio source unreadable: '+seg.filePath);
      files.push(await w.add(seg.filePath,stream));
    }
    const manifest={format:'mochop',formatVersion:1,schemaVersion:1,appVersion:'poc-07-web',meetingIds:[source.meeting.meetingId],files};
    const manifestBytes=jsonBytes(manifest);
    if(manifestBytes.byteLength>LIMITS.manifestBytes)fail('manifest size limit');
    await w.add('manifest.json',new Blob([manifestBytes]).stream());
    const result=await w.close();
    return {manifest,archive:result};
  } catch(error){await w.abort?.(error);throw error;}
}
/**
 * archive = {entries()->Promise<[{name,size,compressedSize,crc32,...}]>, open(entry)->ReadableStream}
 * repo = {stage()->Promise<{create(name)->Promise<writer>, readJSON(name),writeJSON(name,obj),publish(meetingId),discard()}>}
 * publish must use exclusive new-ID semantics and durable transaction/atomic pointer.
 */
export async function importMochop(archive,repo,{allowMissingAudio=false,limits=LIMITS,abortSignal,onProgress}={}){
  const entries=await archive.entries();
  if(entries.length>limits.entries)fail('ZIP entry count limit');
  let total=0;
  const fileMap=new Map(),names=new Set();
  for(const entry of entries){
    const name=validPath(entry.name);
    if(entry.directory||entry.symlink||entry.encrypted||entry.method!==undefined&&![0,8].includes(entry.method))fail('unsafe/unsupported ZIP entry type');
    if(!Number.isInteger(entry.crc32)||entry.crc32<0||entry.crc32>0xffffffff)fail('missing/invalid ZIP CRC');
    const normalized=name.normalize('NFC').toLowerCase();
    if(names.has(normalized))fail('ZIP duplicate/casefold collision');names.add(normalized);
    if(!Number.isSafeInteger(entry.size)||entry.size<0||!Number.isSafeInteger(entry.compressedSize)||entry.compressedSize<0)fail('invalid ZIP size');
    if(entry.size>Math.max(1,entry.compressedSize)*limits.ratio)fail('ZIP bomb ratio');
    total+=entry.size;if(total>limits.total)fail('ZIP cumulative bytes limit');
    fileMap.set(name,entry);
  }
  const m=fileMap.get('manifest.json');
  if(!m||m.size>limits.manifestBytes)fail('manifest missing/oversize');
  const manifest=readJson(await readLimited(await archive.open(m),limits.manifestBytes,abortSignal,{size:m.size,crc32:m.crc32}));
  if(manifest?.format!=='mochop'||manifest.formatVersion!==1||manifest.schemaVersion!==1||!Array.isArray(manifest.files))fail('unsupported format/version');
  const declared=new Map(),lower=new Set();
  for(const record of manifest.files){
    if(!record||typeof record!=='object')fail('invalid declared file');
    const name=validPath(record.path),k=name.normalize('NFC').toLowerCase();
    if(name==='manifest.json'||declared.has(name)||lower.has(k))fail('manifest duplicate/path collision');
    lower.add(k);
    if(!Number.isSafeInteger(record.size)||record.size<0||!/^[0-9a-f]{64}$/.test(record.sha256??''))fail('manifest size/SHA invalid');
    if(name==='meeting.json'||name==='note.json'||name==='audio-manifest.json'||name.startsWith('audio/'))declared.set(name,record);
    else fail('unknown file path: '+name);
  }
  for(const name of ['meeting.json','note.json','audio-manifest.json']){
    if(!declared.has(name)||!fileMap.has(name))fail('required metadata missing');
    if(declared.get(name).size>limits.metadataBytes)fail('metadata JSON size limit');
  }
  for(const name of fileMap.keys())if(name!=='manifest.json'&&!declared.has(name))fail('unlisted ZIP entry: '+name);
  const missing=[];
  for(const [name,item] of declared){
    if(!fileMap.has(name)){
      if(!allowMissingAudio||!name.startsWith('audio/'))fail('missing ZIP entry: '+name);
      missing.push(name);
    } else if(fileMap.get(name).size!==item.size)fail('declared ZIP size mismatch');
  }
  const stage=await repo.stage();let published=false,processed=0;
  try{
    for(const [name,item] of declared){
      if(missing.includes(name))continue;
      if(abortSignal?.aborted)fail('aborted before write');
      const entry=fileMap.get(name),crc=new Crc32(),sha=new Sha256(),writer=await stage.create(name);
      let size=0;
      try {
        const input=await archive.open(entry),reader=input.getReader();
        try{
          for(;;){
            if(abortSignal?.aborted)fail('aborted while streaming');
            const {value,done}=await reader.read();if(done)break;
            if(!(value instanceof Uint8Array))fail('archive stream chunk invalid');
            size+=value.length;
            if(size>item.size)fail('decompressed bytes exceed manifest size');
            crc.update(value);sha.update(value);await writer.write(value);processed+=value.length;onProgress?.({path:name,processed,total});
          }
        } finally {reader.releaseLock();}
        if(size!==item.size||sha.digestHex()!==item.sha256||crc.digest()!==entry.crc32)fail('checksum/CRC mismatch: '+name);
        await writer.close();
      } catch(error){try{await writer.abort?.(error)}catch{}throw error;}
    }
    const meeting=await stage.readJSON('meeting.json'),note=await stage.readJSON('note.json'),audio=await stage.readJSON('audio-manifest.json');
    validateContract(meeting,note,audio);
    if(JSON.stringify(manifest.meetingIds)!==JSON.stringify([meeting.meetingId]))fail('meeting IDs mismatch');
    const actual=new Set(audio.segments.map(s=>s.filePath));
    for(const name of actual)if(!declared.has(name))fail('audio segment not declared');
    for(const name of declared.keys())if(name.startsWith('audio/')&&!actual.has(name))fail('orphan audio declaration');
    if(missing.length){
      for(const seg of audio.segments)if(missing.includes(seg.filePath)){seg.completionState='missing';seg.missingReason='restore_source_missing';}
      await stage.writeJSON('audio-manifest.json',audio);
    }
    await stage.publish(meeting.meetingId);published=true;
    return {meetingId:meeting.meetingId,missingAudio:missing,files:declared.size};
  } finally { if(!published)await stage.discard(); }
}
async function readLimited(stream,max,signal,integrity){
  const chunks=[];let size=0;const crc=new Crc32(),reader=stream.getReader();
  try{
    for(;;){if(signal?.aborted)fail('aborted');const {done,value}=await reader.read();if(done)break;
      if(!(value instanceof Uint8Array))fail('JSON stream chunk invalid');
      size+=value.byteLength;if(size>max||integrity&&size>integrity.size)fail('JSON entry exceeds declared size/limit');
      crc.update(value);chunks.push(value);
    }
  }finally{reader.releaseLock();}
  if(integrity&&(size!==integrity.size||crc.digest()!==integrity.crc32))fail('manifest checksum/CRC mismatch');
  const out=new Uint8Array(size);let offset=0;for(const c of chunks){out.set(c,offset);offset+=c.length;}return out;
}
export const openBlobArchive=blob=>new ZipStoreReader({size:blob.size,async readAt(offset,length){return new Uint8Array(await blob.slice(offset,offset+length).arrayBuffer());}});
export function syntheticSource(audioBytes=1024*1024){
  if(!Number.isSafeInteger(audioBytes)||audioBytes<0)throw Error('invalid fixture size');
  const id='meeting-demo';
  const meeting={meetingId:id,title:'Cuộc họp tổng hợp – tiếng Việt',noteDocumentId:'note-demo',recordingIds:['rec-demo'],schemaVersion:1};
  const mark={type:'timeSpan',attrs:{anchorId:'anchor-1',recordingId:'rec-demo',audioOffsetMs:12345,typedAt:1794740000000,source:'live_recording',schemaVersion:1}};
  const note={noteDocumentId:'note-demo',revision:3,schemaVersion:1,content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Quyết nghị kỳ họp, tiếng Việt.',marks:[mark]}]}]}};
  const audio={recordingId:'rec-demo',sampleRate:48000,mappingPoints:[],segments:[{segmentId:'seg-1',filePath:'audio/seg-1.pcm',mediaStartMs:0,mediaDurationMs:60000,sampleStart:0,sampleCount:2880000,completionState:'complete'}],intervals:[{meetingStartMs:0,meetingEndMs:60000,kind:'recorded',segmentRefs:['seg-1'],mediaStartMs:0,mediaEndMs:60000}]};
  const buffer=new Uint8Array(256*1024);let x=0xa1b2c3d4;for(let i=0;i<buffer.length;i++){x^=x<<13;x^=x>>>17;x^=x<<5;buffer[i]=x&255;}
  return {meeting,note,audio,openAudio:async()=>{
    let sent=0;
    return new ReadableStream({pull(controller){if(sent===audioBytes){controller.close();return;}const n=Math.min(buffer.length,audioBytes-sent);controller.enqueue(buffer.subarray(0,n));sent+=n;}},{highWaterMark:1});
  }};
}
