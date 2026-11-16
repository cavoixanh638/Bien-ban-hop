/** G10 meeting-wide recording timeline.
 * This is the concatenation of the recorded SESSION clocks, not an invented
 * wall-clock across stopped sessions. Within each session, sample gaps stay
 * unplayable and are shown explicitly.
 */
const safeInt=value=>Number.isSafeInteger(value)&&value>=0;
const fail=reason=>{throw Error('Dòng thời gian âm thanh không hợp lệ: '+reason);};
export function buildMeetingTimeline(recordingIds,manifests){
  if(!Array.isArray(recordingIds)||new Set(recordingIds).size!==recordingIds.length)
    fail('danh sách phiên ghi âm');
  const byId=manifests instanceof Map?manifests:new Map((manifests??[]).map(m=>[m.recordingId,m]));
  const sessions=[],bands=[];let totalMs=0,unavailableCount=0;
  for(const [index,id] of recordingIds.entries()){
    const manifest=byId.get(id),rate=manifest?.sampleRate,ranges=manifest?.sampleRanges;
    if(!manifest||manifest.recordingId!==id||!safeInt(rate)||rate<8000||rate>192000||!Array.isArray(ranges))
      fail('thiếu manifest của phiên '+(index+1));
    let previous=0;
    const verified=[];
    for(const r of ranges){
      if(!safeInt(r.sampleStart)||!safeInt(r.sampleEndExclusive)||
        r.sampleEndExclusive<=r.sampleStart||r.sampleStart<previous)
        fail('vùng mẫu chồng lấn hoặc ngoài giới hạn của phiên '+(index+1));
      verified.push({sampleStart:r.sampleStart,sampleEndExclusive:r.sampleEndExclusive});
      previous=r.sampleEndExclusive;
    }
    const rawEndMs=verified.length?previous*1000/rate:0;
    let durationMs=Math.ceil(rawEndMs);
    // G03 also records lost samples in "gap" intervals. Preserve a trailing
    // gap even when no later WAV samples are available.
    for(const interval of manifest.intervals??[]){
      const end=interval?.meetingEndMs;
      if((interval.kind==='gap'||interval.kind==='unavailable')&&Number.isFinite(end)&&end>=0)
        durationMs=Math.max(durationMs,Math.ceil(end));
    }
    if(!safeInt(durationMs)||!safeInt(totalMs+durationMs))
      fail('độ dài phiên ghi vượt giới hạn thời gian');
    const session={recordingId:id,index:index+1,startMs:totalMs,durationMs,endMs:totalMs+durationMs,
      sampleRate:rate,ranges:verified,firstPlayableMs:null};
    let cursor=0;
    for(const r of verified){
      const localStart=r.sampleStart*1000/rate,localEnd=r.sampleEndExclusive*1000/rate;
      if(localStart>cursor){
        bands.push({type:'gap',session:index+1,startMs:totalMs+cursor,endMs:totalMs+localStart});
        unavailableCount++;
      }
      bands.push({type:'recorded',session:index+1,startMs:totalMs+localStart,endMs:totalMs+localEnd,
        recordingId:id});
      if(session.firstPlayableMs===null)session.firstPlayableMs=totalMs+Math.ceil(localStart);
      cursor=localEnd;
    }
    if(durationMs>cursor){
      bands.push({type:'gap',session:index+1,startMs:totalMs+cursor,endMs:totalMs+durationMs});
      unavailableCount++;
    }
    sessions.push(session);
    totalMs+=durationMs;
  }
  return {sessions,bands,totalMs,unavailableCount,recordingCount:recordingIds.length,
    playableCount:bands.filter(x=>x.type==='recorded').length};
}
export function locateMeetingPosition(timeline,absoluteMs){
  if(!timeline||!safeInt(absoluteMs)||absoluteMs>timeline.totalMs)
    return {status:'invalid',reason:'Thời điểm tua không hợp lệ'};
  if(absoluteMs===timeline.totalMs)
    return {status:'end',reason:'Đã đến cuối các phiên ghi âm'};
  const session=timeline.sessions.find(x=>absoluteMs>=x.startMs&&absoluteMs<x.endMs);
  if(!session)return {status:'gap',reason:'Không có âm thanh ở khoảng thời gian này'};
  const localMs=absoluteMs-session.startMs;
  const sample=Math.round(localMs*session.sampleRate/1000);
  if(!session.ranges.some(r=>sample>=r.sampleStart&&sample<r.sampleEndExclusive))
    return {status:'gap',reason:'Đây là đoạn thiếu hoặc không ghi được âm thanh'};
  return {status:'valid',recordingId:session.recordingId,session:session.index,
    localMs,absoluteMs,segmentEndMs:session.endMs};
}
export function meetingPositionFor(timeline,recordingId,localMs){
  if(!timeline||!Number.isFinite(localMs)||localMs<0)return null;
  const session=timeline.sessions.find(x=>x.recordingId===recordingId);
  if(!session)return null;
  return Math.max(session.startMs,Math.min(session.endMs,Math.round(session.startMs+localMs)));
}
export function firstPlayablePosition(timeline){
  if(!timeline)return null;
  for(const session of timeline.sessions){
    if(session.firstPlayableMs!==null){
      const pos=Math.min(session.endMs-1,session.firstPlayableMs);
      if(locateMeetingPosition(timeline,pos).status==='valid')return pos;
    }
  }
  return null;
}
