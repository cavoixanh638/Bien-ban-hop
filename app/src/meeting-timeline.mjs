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
/** Continue to the immediately following recording session only when:
 * 1) the current session ended at its final verified sample with no trailing
 *    gap, and 2) the next session begins with a verified sample at source zero.
 * Never jump across an uncommitted gap or invent the wall-clock pause between
 * independently recorded sessions.
 */
export function nextContiguousSession(timeline,recordingId,localEndMs){
  if(!timeline||!Number.isFinite(localEndMs)||localEndMs<0)return null;
  const index=timeline.sessions.findIndex(s=>s.recordingId===recordingId);
  if(index<0||index+1>=timeline.sessions.length)return null;
  const current=timeline.sessions[index],next=timeline.sessions[index+1];
  const last=current.ranges.at(-1),first=next.ranges[0];
  if(!last||!first||first.sampleStart!==0)return null;
  const endMs=last.sampleEndExclusive*1000/current.sampleRate;
  const tolerance=Math.max(.5,1000/current.sampleRate);
  if(Math.abs(localEndMs-endMs)>tolerance ||
    current.durationMs-endMs>tolerance ||
    next.firstPlayableMs!==next.startMs)return null;
  const at=locateMeetingPosition(timeline,next.startMs);
  if(at.status!=='valid'||at.recordingId!==next.recordingId)return null;
  return {recordingId:next.recordingId,absoluteMs:next.startMs,session:next.index};
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
