/** G10 portable .bbhop v2 contracts with .mochop legacy support. No browser-dependent code.
 * Preserve all note/history and G03 sample journals; remap IDs on import.
 */
export const PORTABLE_VERSION=2;
export const LIMITS={maxEntries:10000,maxTotal:8*1024**3,maxJson:64*1024**2,maxManifest:1024**2,maxRecordings:1000};
export const VALID_RECORDING=/^rec-[A-Za-z0-9_-]{10,96}$/;
const isInt=x=>Number.isSafeInteger(x)&&x>=0;
const copy=o=>structuredClone(o);
const requireValid=(ok,why)=>{if(!ok)throw Error('Gói cuộc họp không hợp lệ: '+why);};
export function checkAudioJournal(journal,recordingId){
  requireValid(journal && typeof journal==='object' && !Array.isArray(journal),'nhật ký âm thanh thiếu');
  requireValid(VALID_RECORDING.test(recordingId)&&journal.recordingId===recordingId,'mã bản ghi âm');
  requireValid(journal.schemaVersion===1 && journal.format==='f32le' &&
    journal.channels===1 && isInt(journal.sampleRate) &&
    journal.sampleRate>=8000 && journal.sampleRate<=192000,'định dạng PCM');
  requireValid(Array.isArray(journal.segments)&&Array.isArray(journal.chunks)&&
    Array.isArray(journal.intervals),'cấu trúc nhật ký âm thanh');
  requireValid(isInt(journal.revision)&&isInt(journal.nextSequenceNo)&&
    isInt(journal.committedThroughSampleExclusive),'phiên bản/chỉ số mẫu');
  const segments=new Map(),paths=new Set();
  for(const segment of journal.segments){
    requireValid(segment&&/^seg-[0-9]+$/.test(segment.segmentId??'')&&
      segment.filePath===recordingId+'/'+segment.segmentId+'.wav' &&
      isInt(segment.sampleStart)&&isInt(segment.sampleCount)&&
      segment.sampleCount>0&&isInt(segment.byteLength)&&
      segment.byteLength===44+segment.sampleCount*4 &&
      ['writing','checkpointed','finalized','complete'].includes(segment.completionState),
      'đoạn WAV hoặc kích thước sai');
    requireValid(!segments.has(segment.segmentId)&&!paths.has(segment.filePath),'trùng đoạn WAV');
    segments.set(segment.segmentId,segment);paths.add(segment.filePath);
  }
  const counters=new Map(),seq=new Set();let maxSample=0;
  for(const chunk of journal.chunks){
    const segment=segments.get(chunk?.segmentId);
    requireValid(segment && chunk.filePath===segment.filePath &&
      isInt(chunk.sequenceNo)&&isInt(chunk.firstSample)&&
      isInt(chunk.sampleCount)&&chunk.sampleCount>0 &&
      isInt(chunk.byteOffset)&&chunk.byteOffset>=44 &&
      isInt(chunk.byteLength)&&chunk.byteLength===chunk.sampleCount*4 &&
      chunk.byteOffset+chunk.byteLength<=segment.byteLength &&
      isInt(chunk.crc32)&&chunk.crc32<=0xffffffff,'CRC/offset của mẫu âm thanh');
    let p=counters.get(segment.segmentId)||{bytes:0,samples:0};
    p.bytes+=chunk.byteLength;p.samples+=chunk.sampleCount;counters.set(segment.segmentId,p);
    maxSample=Math.max(maxSample,chunk.firstSample+chunk.sampleCount);
  }
  for(const segment of segments.values()){
    const sum=counters.get(segment.segmentId);
    requireValid(sum&&sum.bytes===segment.byteLength-44&&sum.samples===segment.sampleCount,
      'mẫu âm thanh thiếu hoặc không khớp WAV');
  }
  requireValid(maxSample===journal.committedThroughSampleExclusive &&
    journal.acceptedThroughSampleExclusive>=maxSample,'watermark của dữ liệu');
  return true;
}
export function checkBundle(meeting,note,history,pendingState,recordings){
  requireValid(meeting&&note&&typeof meeting.meetingId==='string' &&
    meeting.meetingId.length>0&&meeting.schemaVersion===1 &&
    meeting.noteDocumentId===note.noteDocumentId,'cuộc họp và ID ghi chú');
  requireValid(Array.isArray(meeting.recordingIds)&&meeting.recordingIds.length<=LIMITS.maxRecordings &&
    new Set(meeting.recordingIds).size===meeting.recordingIds.length &&
    meeting.recordingIds.every(x=>VALID_RECORDING.test(x)),'danh sách phiên thu');
  requireValid(note.schemaVersion===1&&isInt(note.revision)&&
    note.content?.type==='doc'&&Array.isArray(note.content.content),'nội dung biên bản');
  requireValid(Array.isArray(history)&&history.length<=100000&&recordings&&
    recordings.size===meeting.recordingIds.length,'lịch sử hoặc số bản ghi');
  requireValid(pendingState===null||pendingState===undefined||
    pendingState.schemaVersion===1&&pendingState.meetingId===meeting.meetingId&&
    Array.isArray(pendingState.records),'thông tin mốc đang chờ');
  for(const rec of meeting.recordingIds) checkAudioJournal(recordings.get(rec),rec);
  const allow=new Set(meeting.recordingIds);
  const validateMarks=doc=>{
    const visit=node=>{
      if(!node||typeof node!=='object')return;
      for(const m of node.marks??[]){
        if(m.type!=='timeSpan')continue;
        const id=m.attrs?.recordingId;
        requireValid(id===null||id===undefined||allow.has(id),'mốc chữ trỏ tới file ngoài cuộc họp');
      }
      if(Array.isArray(node.content))node.content.forEach(visit);
    };
    visit(doc);
  };
  validateMarks(note.content);
  for(const item of history){
    requireValid(item && item.noteDocumentId===note.noteDocumentId &&
      isInt(item.revision)&&item.revision<=note.revision&&
      item.content?.type==='doc','lịch sử chỉnh sửa');
    validateMarks(item.content);
  }
  return true;
}
export function remapBundle({meeting,note,history,pendingState,recordings},makeId=()=>crypto.randomUUID(),now=Date.now()){
  checkBundle(meeting,note,history,pendingState,recordings);
  const mapping=new Map(meeting.recordingIds.map(old=>[old,'rec-'+makeId()]));
  requireValid(new Set(mapping.values()).size===mapping.size,'mã bản ghi mới trùng nhau');
  const newMeetingId=makeId(),noteDocumentId=makeId();
  const newMeeting={...copy(meeting),meetingId:newMeetingId,noteDocumentId,
    title:meeting.title+' (đã nhập)',recordingIds:meeting.recordingIds.map(id=>mapping.get(id)),
    createdAt:now,updatedAt:now,importedFrom:meeting.meetingId,importedAt:now};
  const remapText=doc=>{
    const result=copy(doc);
    const walk=node=>{
      for(const mark of node.marks??[]){
        if(mark.type==='timeSpan' && mark.attrs?.recordingId){
          const mapped=mapping.get(mark.attrs.recordingId);
          requireValid(mapped,'mốc tham chiếu bản ghi không tồn tại');
          mark.attrs.recordingId=mapped;
        }
      }
      for(const child of node.content??[])walk(child);
    };
    walk(result);return result;
  };
  const newNote={...copy(note),noteDocumentId,content:remapText(note.content)};
  const newPending={schemaVersion:1,meetingId:newMeetingId,records:[]};
  // The original clock/provenance is useful for audit but cannot be resumed
  // on another computer. Preserve it OUT OF BAND in historical journal rows,
  // while the active pending journal is empty and safe.
  const originalPending=copy(pendingState??null);
  const newHistory=history.map(row=>{
    const previous=row.archivedPendingState??row.pendingState??
      (row.revision===note.revision?originalPending:null);
    return {...copy(row),journalId:noteDocumentId+':'+row.revision,
      noteDocumentId,content:remapText(row.content),
      ...(previous?{archivedPendingState:copy(previous)}:{}),
      pendingState:row.revision===note.revision?newPending:null};
  });
  if(!newHistory.some(row=>row.revision===note.revision)){
    newHistory.push({journalId:noteDocumentId+':'+note.revision,noteDocumentId,
      revision:note.revision,previousRevision:Math.max(0,note.revision-1),committedAt:now,
      kind:'snapshot',content:copy(newNote.content),pendingState:newPending,
      ...(originalPending?{archivedPendingState:copy(originalPending)}:{})});
  }
  const outRecordings=new Map();
  for(const [original,journal] of recordings){
    const id=mapping.get(original),cloned=copy(journal);
    cloned.recordingId=id;
    for(const segment of cloned.segments)segment.filePath=id+'/'+segment.segmentId+'.wav';
    for(const chunk of cloned.chunks)chunk.filePath=id+'/'+chunk.segmentId+'.wav';
    outRecordings.set(id,cloned);
    checkAudioJournal(cloned,id);
  }
  return {meeting:newMeeting,note:newNote,history:newHistory,pendingState:newPending,
    archivedPendingState:copy(pendingState??null),recordings:outRecordings,
    idMap:mapping,sourceMeetingId:meeting.meetingId};
}
