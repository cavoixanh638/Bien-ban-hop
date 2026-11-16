/** UI for a meeting-wide timeline with sample-safe seeking.
 * Playback is always read from the selected recording's verified G03 journal.
 * The displayed total is concatenated session CLOCK TIME, not elapsed
 * wall-clock between Stop and a later new recording.
 */
import {AudioRPC} from './audio.mjs';
import {buildMeetingTimeline,locateMeetingPosition,meetingPositionFor,firstPlayablePosition}
  from './meeting-timeline.mjs';

const $=id=>document.getElementById(id);
const fmt=ms=>{
  const n=Math.max(0,Math.floor((Number.isFinite(ms)?ms:0)/1000));
  return [Math.floor(n/3600),Math.floor(n%3600/60),n%60].map(x=>String(x).padStart(2,'0')).join(':');
};
export class MeetingTimelineUI {
  constructor({player,getRun,onError=()=>{}}){
    this.player=player;this.getRun=getRun;this.onError=onError;
    this.epoch=0;this.model=null;this.selectedMs=0;this.scrubbing=false;this.busy=false;
  }
  bind(){
    $('timeline-play').onclick=()=>this.toggle().catch(e=>this.onError('Không thể phát: '+e.message));
    $('timeline-seek').addEventListener('input',event=>{
      this.scrubbing=true;
      const ms=Math.round(Number(event.target.value));
      $('timeline-current').textContent=fmt(ms);
      const target=locateMeetingPosition(this.model,ms);
      $('timeline-notice').textContent=target.status==='valid'?
        'Phiên '+target.session+' · '+fmt(target.localMs)+' — thả chuột để nghe từ đây':
        target.reason??'Không có âm thanh ở vị trí này';
    });
    $('timeline-seek').addEventListener('change',event=>{
      this.scrubbing=false;
      this.seek(Math.round(Number(event.target.value))).catch(e=>this.onError('Không thể tua: '+e.message));
    });
    this.renderEmpty('Chưa có bản ghi âm để tua.');
  }
  setBusy(busy){
    this.busy=!!busy;
    const playable=!!this.model?.playableCount;
    $('timeline-play').disabled=this.busy||!playable;
    $('timeline-seek').disabled=this.busy||!playable;
    $('timeline-sessions').querySelectorAll('button').forEach(b=>b.disabled=this.busy||b.dataset.unplayable==='true');
    if(this.busy&&this.model?.recordingCount)
      $('timeline-notice').textContent='Kết thúc phiên ghi hoặc thao tác dữ liệu trước khi tua âm thanh.';
  }
  renderEmpty(message){
    this.model=null;this.selectedMs=0;this.scrubbing=false;
    $('timeline-bands').replaceChildren();$('timeline-sessions').replaceChildren();
    $('timeline-seek').max='1';$('timeline-seek').value='0';$('timeline-seek').disabled=true;
    $('timeline-play').textContent='▶ Phát';$('timeline-play').disabled=true;
    $('timeline-current').textContent='00:00:00';$('timeline-total').textContent='00:00:00';
    $('timeline-summary').textContent='Chưa có phiên ghi âm';
    $('timeline-notice').textContent=message;
  }
  clear(){
    ++this.epoch;
    this.renderEmpty('Chọn một cuộc họp có bản ghi âm để sử dụng thanh tua.');
  }
  async refresh(run){
    const task=this.load(run);
    this.refreshPromise=task;
    try{await task;}finally{if(this.refreshPromise===task)this.refreshPromise=null;}
  }
  async settle(){if(this.refreshPromise)await this.refreshPromise;}
  async load(run){
    const epoch=++this.epoch;
    if(this.getRun()!==run)return;
    const ids=[...(run.meeting.recordingIds??[])];
    if(!ids.length){this.renderEmpty('Bản ghi âm sẽ xuất hiện ở đây sau khi bấm Kết thúc.');return;}
    $('timeline-notice').textContent='Đang đọc thời lượng '+ids.length+' phiên ghi từ OPFS…';
    const manifests=new Map();
    try{
      for(const id of ids){
        if(this.epoch!==epoch||this.getRun()!==run)return;
        const rpc=new AudioRPC();
        try{
          await rpc.call('init',{recordingId:id,reopen:true},[],120000);
          const manifest=await rpc.call('manifest',{},[],120000);
          manifests.set(id,manifest);
        }finally{await rpc.dispose();}
      }
      if(this.epoch!==epoch||this.getRun()!==run)return;
      this.model=buildMeetingTimeline(ids,manifests);
      const previous=this.selectedMs;
      this.render();
      this.setPosition(Math.min(previous,this.model.totalMs));
      const missing=this.model.unavailableCount;
      $('timeline-notice').textContent=missing?
        'Có '+missing+' khoảng thiếu/không ghi âm (màu xám). Không thể phát hoặc tự nhảy qua khoảng này.':
        'Kéo thanh tua đến vị trí cần nghe, hoặc chọn một phiên ở dưới.';
      this.setBusy(this.busy);
    }catch(e){
      if(this.epoch!==epoch||this.getRun()!==run)return;
      this.renderEmpty('Không mở được dòng thời gian: '+e.message);
      this.onError('Không đọc được toàn bộ ghi âm: '+e.message);
    }
  }
  render(){
    const model=this.model;if(!model)return;
    const total=model.totalMs,root=$('timeline-bands'),sessions=$('timeline-sessions');
    root.replaceChildren();sessions.replaceChildren();
    for(const b of model.bands){
      const part=document.createElement('div');
      part.className='timeline-band '+(b.type==='recorded'?'recorded':'gap');
      part.style.left=(total?100*b.startMs/total:0)+'%';
      part.style.width=(total?100*(b.endMs-b.startMs)/total:0)+'%';
      part.title=b.type==='recorded'?'Phiên '+b.session+' · có âm thanh':'Phiên '+b.session+' · không có mẫu âm thanh';
      root.append(part);
    }
    for(const session of model.sessions){
      if(session.index>1&&total){
        const boundary=document.createElement('span');boundary.className='timeline-boundary';
        boundary.style.left=100*session.startMs/total+'%';
        boundary.title='Bắt đầu phiên '+session.index+' (không cộng thời gian nghỉ giữa các phiên)';
        root.append(boundary);
      }
      const button=document.createElement('button');
      button.type='button';button.className='timeline-session';
      button.dataset.unplayable=String(session.firstPlayableMs===null);
      button.textContent='Phiên '+session.index+' · '+fmt(session.durationMs);
      button.title='Phát phiên '+session.index+' từ mẫu âm thanh đầu tiên';
      button.disabled=this.busy||session.firstPlayableMs===null;
      button.onclick=()=>this.seek(session.firstPlayableMs).catch(e=>this.onError('Không thể mở phiên: '+e.message));
      sessions.append(button);
    }
    $('timeline-total').textContent=fmt(total);
    $('timeline-summary').textContent=model.recordingCount+' phiên · '+fmt(total)+' (không tính thời gian dừng giữa các phiên)';
    $('timeline-seek').max=String(Math.max(1,total));
  }
  setPosition(ms){
    if(!this.model||this.scrubbing)return;
    this.selectedMs=Math.max(0,Math.min(this.model.totalMs,Math.round(ms)));
    $('timeline-seek').value=String(this.selectedMs);
    $('timeline-current').textContent=fmt(this.selectedMs);
  }
  async seek(ms){
    if(this.busy||!this.model)return;
    this.selectedMs=ms;
    $('timeline-current').textContent=fmt(ms);
    const at=locateMeetingPosition(this.model,ms);
    if(at.status!=='valid'){
      this.player.stop();this.updatePlayButton();
      $('timeline-notice').textContent=(at.reason??'Không có âm thanh')+
        '. Chọn vùng màu xanh có ghi âm; không tự chuyển sang phiên khác.';
      return;
    }
    const result=await this.player.start(at.recordingId,at.localMs,{
      preRollMs:0,rate:Number($('play-rate').value)
    });
    if(result.status==='valid'){
      $('timeline-notice').textContent='Đang nghe phiên '+at.session+' từ '+fmt(at.localMs)+
        '. Thanh tua hiển thị thời lượng các phiên ghi, không cộng thời gian nghỉ giữa các phiên.';
    }
    this.updatePlayButton();
  }
  async toggle(){
    if(this.busy||!this.model)return;
    if(this.player.playing){this.player.stop();this.updatePlayButton();return;}
    let ms=this.selectedMs;
    if(locateMeetingPosition(this.model,ms).status==='end'){
      ms=firstPlayablePosition(this.model);
    }
    if(ms===null)return;
    await this.seek(ms);
  }
  updatePlayButton(){
    $('timeline-play').textContent=this.player.playing?'■ Dừng':'▶ Phát';
  }
  onPlayer(type,detail={}){
    const model=this.model;
    if(!model)return;
    if(['playing','position','stopped','ended'].includes(type)){
      const target=meetingPositionFor(model,detail.recordingId,detail.offsetMs);
      if(target!==null)this.setPosition(target);
      this.updatePlayButton();
    }
    if(type==='ended')$('timeline-notice').textContent=
      'Đã phát hết vùng âm thanh liền mạch. Chọn vị trí khác để nghe tiếp; không tự bỏ qua vùng thiếu.';
    if(type==='unavailable'||type==='error')$('timeline-notice').textContent=
      'Không thể phát vùng âm thanh đã chọn. Dữ liệu không bị tự động chuyển sang đoạn khác.';
  }
}
