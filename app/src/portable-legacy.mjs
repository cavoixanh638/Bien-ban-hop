/** Backward-compatible .mochop v1 reader for archives produced by early G10.
 * G07 validates every SHA/CRC before publish; existing WAV files are adopted
 * into new recording IDs without storing multi-gigabyte archives in memory.
 * Old v1 contained only the latest note and ONE session; deleted note history
 * not present in the file cannot be fabricated.
 */
import {importMochop,openBlobArchive} from '../../poc/07-backup/mochop-web.mjs';
import {wavHeader,checkHeader,crc32,HEADER_BYTES} from '../../poc/03-opfs/core.mjs';
import {remapBundle,checkAudioJournal,VALID_RECORDING} from './portable-model.mjs';
import {createBrowserImportRepo} from './portable-storage.mjs';

const utf8=new TextDecoder('utf-8',{fatal:true});
const isSafe=x=>Number.isSafeInteger(x)&&x>=0;
const fail=s=>{throw Error('File .mochop đời cũ không thể khôi phục: '+s);};
const wavPath=/^audio\/(rec-[A-Za-z0-9_-]{10,96})\/(seg-[0-9]+)\.wav$/;
export async function importLegacyMochop(blob,store,{signal,onProgress}={}){
  const newId='rec-'+crypto.randomUUID(),newMeetingId=crypto.randomUUID(),newNoteId=crypto.randomUUID();
  const root=await navigator.storage.getDirectory();
  let adopted=false,result=null,sourceAudioId=null;
  const metadata=new Map(),parts=new Map();let metadataBytes=0,writtenPaths=new Set();
  const repo={async stage(){
    // Never accidentally adopt/overwrite files already present in this browser.
    try{await root.getDirectoryHandle(newId);
      fail('mã ghi âm nhập mới đã có sẵn trong OPFS');}
    catch(e){if(e.name!=='NotFoundError')throw e;}
    return {
      async create(name){
        if(name.startsWith('audio/')){
          const match=name.match(wavPath);
          if(!match)fail('đường dẫn WAV không tương thích');
          if(sourceAudioId&&sourceAudioId!==match[1])fail('archive v1 có nhiều mã ghi âm');
          sourceAudioId=match[1];
          const dir=await root.getDirectoryHandle(newId,{create:true});adopted=true;
          const filename=match[2]+'.wav';
          if(writtenPaths.has(filename))fail('tệp WAV trùng');writtenPaths.add(filename);
          const file=await dir.getFileHandle(filename,{create:true}),w=await file.createWritable();
          let closed=false;
          return {async write(chunk){if(closed)throw Error('WAV stream closed');await w.write(chunk);},
            async close(){closed=true;await w.close();},
            async abort(e){if(!closed){closed=true;await w.abort(e);}}};
        }
        if(!['meeting.json','note.json','audio-manifest.json'].includes(name))
          fail('metadata không nhận diện: '+name);
        const chunks=[];let length=0,closed=false;
        parts.set(name,chunks);
        return {async write(chunk){
          if(closed)throw Error('metadata stream closed');
          length+=chunk.length;metadataBytes+=chunk.length;
          if(metadataBytes>64*1024**2)fail('metadata vượt giới hạn');
          chunks.push(new Uint8Array(chunk));
        },async close(){
          closed=true;const data=new Uint8Array(length);let at=0;
          for(const c of chunks){data.set(c,at);at+=c.length;}
          metadata.set(name,data);
        },async abort(){closed=true;parts.delete(name);}};
      },
      async readJSON(name){
        const data=metadata.get(name);
        if(!data)fail('metadata bị thiếu: '+name);
        return JSON.parse(utf8.decode(data));
      },
      async writeJSON(name,obj){metadata.set(name,new TextEncoder().encode(JSON.stringify(obj)));},
      async publish(_meetingId){
        const meeting=JSON.parse(utf8.decode(metadata.get('meeting.json')));
        const note=JSON.parse(utf8.decode(metadata.get('note.json')));
        const audio=JSON.parse(utf8.decode(metadata.get('audio-manifest.json')));
        if(!Array.isArray(meeting.recordingIds)||meeting.recordingIds.length!==1 ||
          !VALID_RECORDING.test(audio.recordingId)||meeting.recordingIds[0]!==audio.recordingId ||
          !isSafe(audio.sampleRate)||audio.sampleRate<8000||audio.sampleRate>192000||
          !Array.isArray(audio.segments)||!Array.isArray(audio.intervals))
          fail('cuộc họp/audio không khớp');
        if(sourceAudioId&&sourceAudioId!==audio.recordingId)
          fail('WAV không thuộc bản ghi có trong biên bản');
        if(!adopted&&audio.segments.length)fail('không có file WAV trong gói');
        const segments=[],chunks=[];let sequenceNo=0,lastEnd=0;
        const ordered=[...audio.segments].sort((a,b)=>a.sampleStart-b.sampleStart);
        for(const segment of ordered){
          if(!/^seg-[0-9]+$/.test(segment?.segmentId??'') ||
            segment.filePath!=='audio/'+audio.recordingId+'/'+segment.segmentId+'.wav' ||
            !isSafe(segment.sampleStart)||!isSafe(segment.sampleCount)||segment.sampleCount<1 ||
            segment.sampleStart<lastEnd ||
            !['complete','finalized','checkpointed'].includes(segment.completionState))
            fail('mẫu hoặc thứ tự đoạn WAV bị sai');
          const file=await (await (await root.getDirectoryHandle(newId))
            .getFileHandle(segment.segmentId+'.wav')).getFile();
          if(file.size!==44+segment.sampleCount*4)fail('WAV không đủ byte: '+segment.segmentId);
          const hdr=new Uint8Array(await file.slice(0,HEADER_BYTES).arrayBuffer());
          if(!checkHeader(hdr,file.size-HEADER_BYTES,audio.sampleRate,1))
            fail('WAV thiếu header Float32: '+segment.segmentId);
          for(let offset=0;offset<segment.sampleCount;offset+=8192){
            const n=Math.min(8192,segment.sampleCount-offset),byteOffset=44+offset*4;
            const bytes=new Uint8Array(await file.slice(byteOffset,byteOffset+n*4).arrayBuffer());
            if(bytes.length!==n*4)fail('WAV bị cắt khi xác định CRC');
            chunks.push({segmentId:segment.segmentId,filePath:newId+'/'+segment.segmentId+'.wav',
              sequenceNo:sequenceNo++,firstSample:segment.sampleStart+offset,sampleCount:n,
              byteOffset,byteLength:n*4,crc32:crc32(bytes)});
          }
          segments.push({segmentId:segment.segmentId,filePath:newId+'/'+segment.segmentId+'.wav',
            sampleStart:segment.sampleStart,sampleCount:segment.sampleCount,byteLength:file.size,
            completionState:'checkpointed'});
          lastEnd=segment.sampleStart+segment.sampleCount;
        }
        if(writtenPaths.size!==segments.length)fail('WAV khai báo thừa hoặc bị thiếu');
        const gaps=[];
        for(const interval of audio.intervals){
          if(interval.kind==='unavailable'||interval.kind==='missing')
            fail('v1 có đoạn ghi âm không còn truy cập được');
          if(interval.kind!=='gap')continue;
          const start=Math.round(interval.meetingStartMs*audio.sampleRate/1000);
          const end=Math.round(interval.meetingEndMs*audio.sampleRate/1000);
          if(!isSafe(start)||!isSafe(end)||end<start)fail('khoảng không ghi sai');
          gaps.push({kind:'gap',sampleStart:start,sampleEndExclusive:end,reason:interval.reason??'legacy_gap'});
        }
        const journal={schemaVersion:1,recordingId:audio.recordingId,sampleRate:audio.sampleRate,
          channels:1,format:'f32le',revision:chunks.length?1:0,
          segments:segments.map(x=>({...x,filePath:audio.recordingId+'/'+x.segmentId+'.wav'})),
          chunks:chunks.map(x=>({...x,filePath:audio.recordingId+'/'+x.segmentId+'.wav'})),
          intervals:gaps,nextSequenceNo:chunks.length,
          acceptedThroughSampleExclusive:lastEnd,committedThroughSampleExclusive:lastEnd};
        checkAudioJournal(journal,audio.recordingId);
        const history=[{journalId:note.noteDocumentId+':'+note.revision,
          noteDocumentId:note.noteDocumentId,revision:note.revision,
          previousRevision:Math.max(0,note.revision-1),committedAt:Date.now(),
          kind:'snapshot',content:note.content}];
        const values=[newId.slice(4),newMeetingId,newNoteId];
        const mapped=remapBundle({meeting,note,history,pendingState:null,
          recordings:new Map([[audio.recordingId,journal]])},()=>values.shift());
        const inner=await createBrowserImportRepo(store,{adoptedDirs:adopted?new Set([newId]):new Set()}).stage(mapped);
        try{
          result=await inner.publish(mapped);
        }catch(e){await inner.discard();throw e;}
      },
      async discard(){
        if(result)return;
        if(adopted)try{await root.removeEntry(newId,{recursive:true});}
        catch(e){if(e.name!=='NotFoundError')console.warn('Không dọn được WAV nhập dở',e);}
      }
    };
  }};
  const imported=await importMochop(openBlobArchive(blob),repo,{abortSignal:signal,onProgress});
  if(!result)fail('không tìm thấy cuộc họp đã công bố');
  return {...result,recordings:1,sourceMeetingId:imported.meetingId,legacy:true};
}
