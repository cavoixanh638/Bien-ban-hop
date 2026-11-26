/** G10 V2 archive OPFS/IndexedDB adapters. Only publish the meeting after all
 * WAVs and G03 audio journals are durable and independently verified.
 * Imported IDs are new; failure cleanup never touches pre-existing recordings.
 */
import {IDBJournal} from '../../poc/03-opfs/adapters.mjs';
import {checkHeader,HEADER_BYTES} from '../../poc/03-opfs/core.mjs';
import {checkAudioJournal} from './portable-model.mjs';
import {AudioRPC} from './audio.mjs';
const filePathParts=path=>{
  const parts=path.split('/');
  if(parts.length!==2||!/^rec-[A-Za-z0-9_-]{10,96}$/.test(parts[0])||!/^seg-[0-9]+\.wav$/.test(parts[1]))
    throw Error('Đường dẫn WAV không an toàn: '+path);
  return parts;
};
const fileHandle=async(root,path,create=false)=>{
  const [id,name]=filePathParts(path);
  const dir=await root.getDirectoryHandle(id,{create});
  return dir.getFileHandle(name,{create});
};
const hasDirectory=async(root,id)=>{try{await root.getDirectoryHandle(id);return true;}
  catch(e){if(e.name==='NotFoundError')return false;throw e;}};
export const deleteAudioJournal=async(id)=>{
  const db=await IDBJournal.open();
  try{
    await new Promise((resolve,reject)=>{
      const tx=db.db.transaction('audioManifest','readwrite');
      tx.objectStore('audioManifest').delete(id);
      tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error??Error('Audio IDB rollback aborted'));
      tx.onerror=()=>reject(tx.error??Error('Audio IDB rollback error'));
    });
  }finally{db.db.close();}
};
export async function loadPortableSource(store,meetingId){
  // One IDB read transaction gives an internally consistent note/meeting/history snapshot.
  const snapshot=await store.db.run(['meetings','notes','journals'],'readonly',async tx=>{
    const meeting=await tx.get('meetings',meetingId);
    if(!meeting)throw Error('Không tìm được cuộc họp');
    const note=await tx.get('notes',meeting.noteDocumentId);
    if(!note)throw Error('Không tìm được biên bản');
    const history=(await tx.all('journals')).filter(x=>x.noteDocumentId===note.noteDocumentId)
      .sort((a,b)=>a.revision-b.revision);
    return {meeting,note,history,
      pendingState:history.findLast(x=>x.revision===note.revision)?.pendingState??null};
  });
  const root=await navigator.storage.getDirectory(),db=await IDBJournal.open(),recordings=new Map();
  try{
    for(const id of snapshot.meeting.recordingIds??[]){
      const rpc=new AudioRPC();
      try{
        const init=await rpc.call('init',{recordingId:id,reopen:true});
        if(init.recovery?.unavailable?.length)
          throw Error('Bản ghi '+id+' có mẫu âm thanh mất hoặc lỗi; không tạo bản sao lưu giả đủ dữ liệu');
        const manifest=await rpc.call('manifest');
        if(manifest.recordingId!==id||manifest.segments.some(x=>x.completionState==='corrupt'||x.completionState==='recovery_needed'))
          throw Error('Bản ghi '+id+' chưa bảo đảm toàn vẹn');
      }finally{await rpc.dispose();}
      const raw=await db.load(id);
      checkAudioJournal(raw,id);
      for(const s of raw.segments){
        const file=await (await fileHandle(root,s.filePath)).getFile();
        if(file.size!==s.byteLength)throw Error('WAV thiếu hoặc sai kích thước: '+s.filePath);
        const header=new Uint8Array(await file.slice(0,HEADER_BYTES).arrayBuffer());
        if(!checkHeader(header,s.byteLength-HEADER_BYTES,raw.sampleRate,raw.channels))
          throw Error('WAV header không hợp lệ: '+s.filePath);
      }
      recordings.set(id,raw);
    }
  }finally{db.db.close();}
  return {...snapshot,recordings,openAudio:async path=>{
    const file=await (await fileHandle(root,path)).getFile();
    return file.stream();
  }};
}
export function createBrowserImportRepo(store,{verifyRecordings=true,adoptedDirs=new Set()}={}){
  return {
    async stage(bundle){
      const root=await navigator.storage.getDirectory();
      const ids=[...bundle.recordings.keys()],dirs=new Set(adoptedDirs),journals=new Set();
      let published=false,creating=false;
      // Random IDs already remapped; fail closed if collision in both stores.
      if(await store.getMeeting(bundle.meeting.meetingId))
        throw Error('Mã cuộc họp mới đã tồn tại, không được ghi đè');
      const audioDb=await IDBJournal.open();
      try{
        for(const id of ids){
          if(await audioDb.load(id) || (!adoptedDirs.has(id) && await hasDirectory(root,id)) ||
             (adoptedDirs.has(id) && !await hasDirectory(root,id)))
            throw Error('Mã phiên ghi mới đã tồn tại hoặc dữ liệu nhập dở không hợp lệ: '+id);
        }
      }finally{audioDb.db.close();}
      const api={
        async writeAudio(path,stream,size){
          if(published)throw Error('Đã nhập xong, không thể viết WAV');
          const [id,name]=filePathParts(path),j=bundle.recordings.get(id);
          const seg=j?.segments.find(x=>x.filePath===path);
          if(!seg||seg.byteLength!==size||!Number.isSafeInteger(size)||size<HEADER_BYTES)
            throw Error('WAV nhập không khớp metadata');
          if(!dirs.has(id)){
            await root.getDirectoryHandle(id,{create:true});dirs.add(id);
          }
          const h=await fileHandle(root,path,true),w=await h.createWritable();
          const reader=stream.getReader(),header=new Uint8Array(HEADER_BYTES);
          let count=0,headerCount=0;
          try{
            for(;;){
              const {done,value}=await reader.read();if(done)break;
              if(!(value instanceof Uint8Array)||count+value.byteLength>size)
                throw Error('WAV stream vượt kích thước cho phép');
              if(headerCount<HEADER_BYTES){
                const n=Math.min(HEADER_BYTES-headerCount,value.length);
                header.set(value.subarray(0,n),headerCount);headerCount+=n;
              }
              await w.write(value);count+=value.byteLength;
            }
            if(count!==size||!checkHeader(header,size-HEADER_BYTES,j.sampleRate,j.channels))
              throw Error('File WAV sai header hoặc bị cắt: '+path);
            await w.close();
          }catch(e){await w.abort(e).catch(()=>{});throw e;}
          finally{reader.releaseLock();}
        },
        async publish(mapped){
          if(published)throw Error('Cuộc họp đã được công bố');
          if(creating)throw Error('Đang lưu gói khác');
          creating=true;
          try{
            // Ensure all preloaded files exist and have valid WAV headers before
            // allowing journals to become visible (legacy adoption uses this gate).
            for(const [id,journal] of mapped.recordings)for(const segment of journal.segments){
              const file=await (await fileHandle(root,segment.filePath)).getFile();
              if(file.size!==segment.byteLength)throw Error('WAV đã nhập không đủ byte');
              const hdr=new Uint8Array(await file.slice(0,HEADER_BYTES).arrayBuffer());
              if(!checkHeader(hdr,file.size-HEADER_BYTES,journal.sampleRate,journal.channels))
                throw Error('Header WAV đã nhập không khớp');
            }
            const db=await IDBJournal.open();
            try{
              for(const [id,journal] of mapped.recordings){
                checkAudioJournal(journal,id);
                await db.create(id,journal);journals.add(id);
              }
            }finally{db.db.close();}
            if(verifyRecordings){
              for(const id of ids){
                const rpc=new AudioRPC();
                try{
                  const ready=await rpc.call('init',{recordingId:id,reopen:true},[],120000);
                  if(ready.recovery?.unavailable?.length ||
                     ready.recovery?.repairedHeaders?.length ||
                     ready.recovery?.truncatedBytes)
                    throw Error('WAV không khớp nhật ký mẫu hoặc checksum: '+id);
                  const manifest=await rpc.call('manifest');
                  if(manifest.recordingId!==id)
                    throw Error('Không đọc được nhật ký khôi phục '+id);
                }finally{await rpc.dispose();}
              }
            }
            // Single G06 transaction: meeting invisible before this commits.
            const {meeting,note,history}=mapped;
            await store.db.run(['meetings','notes','journals'],'readwrite',async tx=>{
              if(await tx.get('meetings',meeting.meetingId)||
                 await tx.get('notes',note.noteDocumentId))
                throw Error('Mã cuộc họp hoặc ghi chú đã tồn tại');
              await tx.put('notes',note);
              for(const item of history)await tx.put('journals',item);
              await tx.put('meetings',meeting);
            });
            published=true;
            return {meetingId:meeting.meetingId,recordingIds:[...ids],noteId:note.noteDocumentId};
          }finally{creating=false;}
        },
        async discard(){
          if(published)return;
          const errors=[];
          // Roll back only IDs generated for this import, never existing data.
          for(const id of journals)try{await deleteAudioJournal(id);}
          catch(e){errors.push(e);}
          for(const id of dirs)try{await root.removeEntry(id,{recursive:true});}
          catch(e){errors.push(e);}
          if(errors.length)console.warn('Có dữ liệu nhập dở chưa dọn được; không hiển thị thành cuộc họp',errors);
        }
      };
      return api;
    }
  };
}
