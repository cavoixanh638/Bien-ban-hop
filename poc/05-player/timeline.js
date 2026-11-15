// Independent, pure playback adapter: all audioOffsetMs values are MEDIA timeline.
// Meeting timestamps only enter via meetingToMedia(); no nearest-segment fallback.
const validNumber = n => Number.isSafeInteger(n) && n >= 0;
const status = (name, reason, extra={}) => ({status:name, reason, ...extra});
export function validateManifest(m){
 const errors=[];
 if(!m || !m.recordingId || !Number.isInteger(m.sampleRate) || m.sampleRate<=0)errors.push('invalid recordingId/sampleRate');
 const segments=m?.segments||[], intervals=m?.intervals||[];
 if(!segments.length || !intervals.length)errors.push('empty segments/intervals');
 const ids=new Set();let end=-1, sampleEnd=-1;
 for(const s of segments){
  if(ids.has(s.segmentId))errors.push('duplicate segmentId: '+s.segmentId);ids.add(s.segmentId);
  if(!validNumber(s.mediaStartMs)||!validNumber(s.mediaDurationMs)||s.mediaDurationMs===0||s.mediaStartMs<end)errors.push('segment range overlap/invalid: '+s.segmentId);
  if(!validNumber(s.sampleStart)||!validNumber(s.sampleCount)||s.sampleCount===0||s.sampleStart<sampleEnd)errors.push('sample range overlap/invalid: '+s.segmentId);
  if(Math.abs(s.sampleCount-s.mediaDurationMs*m.sampleRate/1000)>1)errors.push('sampleCount mismatch: '+s.segmentId);
  if(!['complete','pending','missing','unavailable'].includes(s.completionState))errors.push('unknown completion: '+s.segmentId);
  end=s.mediaStartMs+s.mediaDurationMs;sampleEnd=s.sampleStart+s.sampleCount;
 }
 let previousMeetingEnd=0;const occupiedMedia=[];
 for(const x of intervals){
  if(!validNumber(x.meetingStartMs)||!validNumber(x.meetingEndMs)||x.meetingEndMs<=x.meetingStartMs || x.meetingStartMs!==previousMeetingEnd)errors.push('meeting intervals not contiguous');
  previousMeetingEnd=x.meetingEndMs;
  if(!['recorded','paused','gap','unavailable'].includes(x.kind))errors.push('unknown interval kind');
  if(!Array.isArray(x.segmentRefs))errors.push('missing segmentRefs');
  const mediaGiven=x.mediaStartMs!==undefined || x.mediaEndMs!==undefined;
  if(x.kind==='recorded' && !mediaGiven)errors.push('recorded interval has no media range');
  if(mediaGiven){
   if(!validNumber(x.mediaStartMs)||!validNumber(x.mediaEndMs)||x.mediaEndMs<=x.mediaStartMs)errors.push('bad media interval');
   if(x.kind==='recorded' && x.mediaEndMs-x.mediaStartMs!==x.meetingEndMs-x.meetingStartMs)errors.push('recorded media/meeting duration mismatch');
   occupiedMedia.push(x);
  }
  if(x.kind==='recorded'){
   const actual=segments.filter(s=>s.mediaStartMs<x.mediaEndMs&&s.mediaStartMs+s.mediaDurationMs>x.mediaStartMs).map(s=>s.segmentId);
   if(JSON.stringify(x.segmentRefs)!==JSON.stringify(actual))errors.push('wrong/missing segmentRefs at meeting '+x.meetingStartMs);
  }else if(x.segmentRefs?.length)errors.push('non-recorded interval includes segmentRefs');
 }
 occupiedMedia.sort((a,b)=>a.mediaStartMs-b.mediaStartMs);
 for(let i=1;i<occupiedMedia.length;i++)if(occupiedMedia[i].mediaStartMs<occupiedMedia[i-1].mediaEndMs)errors.push('overlapping media intervals');
 return {valid:errors.length===0,errors};
}
export function resolveMedia(m, recordingId, audioOffsetMs){
 if(recordingId==null||audioOffsetMs==null)return status('unlinked','no linked recording/time');
 if(recordingId!==m.recordingId||!validNumber(audioOffsetMs))return status('unsupported','wrong recording or invalid audio offset');
 const maxEnd=Math.max(...m.segments.map(s=>s.mediaStartMs+s.mediaDurationMs));
 if(audioOffsetMs>=maxEnd)return status('unsupported','audioOffsetMs outside media');
 const interval=m.intervals.find(x=>x.mediaStartMs!==undefined && x.mediaStartMs<=audioOffsetMs && audioOffsetMs<x.mediaEndMs);
 if(!interval)return status('gap','no media coverage at offset');
 if(interval.kind!=='recorded')return status(interval.kind==='unavailable'?'missing':'gap',interval.reason||interval.kind,{intervalKind:interval.kind});
 const s=m.segments.find(s=>s.mediaStartMs<=audioOffsetMs&&audioOffsetMs<s.mediaStartMs+s.mediaDurationMs);
 if(!s || !interval.segmentRefs.includes(s.segmentId))return status('missing','recorded interval lacks segment reference');
 if(s.completionState==='pending')return status('pending','segment not yet committed',{segmentId:s.segmentId});
 if(s.completionState==='missing'||s.completionState==='unavailable')return status('missing','segment not available',{segmentId:s.segmentId});
 if(s.completionState!=='complete')return status('unsupported','unsupported segment state');
 return {status:'valid',segmentId:s.segmentId,localOffsetMs:audioOffsetMs-s.mediaStartMs,
  intervalStartMs:interval.mediaStartMs,intervalEndMs:interval.mediaEndMs,
  clipStartMs:Math.max(s.mediaStartMs,interval.mediaStartMs),clipEndMs:Math.min(s.mediaStartMs+s.mediaDurationMs,interval.mediaEndMs)};
}
export function meetingToMedia(m,recordingId,meetingMs){
 if(recordingId==null||meetingMs==null)return status('unlinked','no time');
 if(recordingId!==m.recordingId||!validNumber(meetingMs))return status('unsupported','wrong recording or invalid meeting time');
 const x=m.intervals.find(x=>x.meetingStartMs<=meetingMs&&meetingMs<x.meetingEndMs);
 if(!x)return status('unsupported','meeting time outside timeline');
 if(x.kind!=='recorded')return status(x.kind==='unavailable'?'missing':'gap',x.reason||x.kind,{intervalKind:x.kind});
 const audioOffsetMs=x.mediaStartMs+(meetingMs-x.meetingStartMs);
 const resolved=resolveMedia(m,recordingId,audioOffsetMs);
 return resolved.status==='valid'?{...resolved,audioOffsetMs,meetingMs}:resolved;
}
export function mediaToMeeting(m,recordingId,audioOffsetMs){
 const r=resolveMedia(m,recordingId,audioOffsetMs);
 if(r.status!=='valid')return r;
 const x=m.intervals.find(x=>x.kind==='recorded'&&x.mediaStartMs<=audioOffsetMs&&audioOffsetMs<x.mediaEndMs);
 return {...r,meetingMs:x.meetingStartMs+(audioOffsetMs-x.mediaStartMs)};
}
export function choosePreRoll(m,mark,seconds){
 if(!mark||!Number.isFinite(seconds)||seconds<0||seconds>30)return status('unsupported','invalid anchor/pre-roll');
 const originalMs=mark.audioOffsetMs, startMs=Math.max(0,originalMs-Math.round(seconds*1000));
 let cursor=startMs;
 while(cursor<=originalMs){
  const r=resolveMedia(m,mark.recordingId,cursor);
  if(r.status!=='valid')return {status:'blocked',reason:'pre-roll crosses invalid audio',originalMs,startMs,failedAtMs:cursor,cause:r.status};
  if(r.clipEndMs>originalMs)break;
  if(r.clipEndMs<=cursor)return {status:'blocked',reason:'non-progressing clip',originalMs,startMs};
  cursor=r.clipEndMs;
 }
 return {status:'valid',originalMs,startMs};
}
