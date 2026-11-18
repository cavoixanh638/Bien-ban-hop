import {locateMeetingPosition} from './meeting-timeline.mjs';
/** A/B is restricted to one verified contiguous committed range, never a gap. */
export function makeSafeLoop(timeline,a,b,{maxMs=120000}={}){
  if(!timeline||!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<0||b<=a)
    throw Error('Cần chọn mốc A trước mốc B');
  if(b-a<400||b-a>maxMs)throw Error('Đoạn lặp A–B phải từ 0,4 đến 120 giây');
  const start=locateMeetingPosition(timeline,a),last=locateMeetingPosition(timeline,b-1);
  if(start.status!=='valid'||last.status!=='valid'||start.recordingId!==last.recordingId)
    throw Error('Hai mốc phải nằm trong cùng một phiên có âm thanh');
  const band=timeline.bands.find(x=>x.type==='recorded'&&x.recordingId===start.recordingId&&
    a>=x.startMs&&b<=x.endMs);
  if(!band)throw Error('Đoạn lặp vượt vùng âm thanh đã lưu hoặc đi qua khoảng thiếu');
  return Object.freeze({recordingId:start.recordingId,startMs:start.localMs,
    endMs:start.localMs+(b-a),absoluteStart:a,absoluteEnd:b,durationMs:b-a});
}
export function jumpMeetingPosition(timeline,current,delta){
  if(!timeline||!Number.isFinite(current)||!Number.isFinite(delta))
    return {status:'invalid',reason:'Chưa có dòng thời gian hợp lệ'};
  const t=Math.max(0,Math.min(timeline.totalMs-1,Math.round(current+delta)));
  return locateMeetingPosition(timeline,t);
}
