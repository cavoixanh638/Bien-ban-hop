/** Transient, zero-document-mutation indication of the note location.
 * No ASR: a timeSpan is a user's note timestamp, not a transcript word.
 * Highlight only a verified recent timeSpan for the SAME recording.
 */
import {isAllowedMeetingMark,sameAnchor} from '../../poc/01-editor/src/policy.mjs';
export const MAX_CUE_LAG_MS=45000;
export function collectNoteCues(doc,allowedRecordingIds,pendingLinks=null){
  const seen=new Map(),conflicts=new Set(),byRecording=new Map();
  if(!doc||typeof doc.descendants!=='function'||!(allowedRecordingIds instanceof Set))return byRecording;
  doc.descendants((node,pos)=>{
    if(!node?.isText||!node.textContent?.trim())return;
    const mark=node.marks?.find(m=>m.type?.name==='timeSpan');
    const a=mark?.attrs;
    if(!isAllowedMeetingMark(a,allowedRecordingIds)||!a.recordingId ||
       pendingLinks?.has?.(a.anchorId))return;
    if(seen.has(a.anchorId)){
      if(!sameAnchor(seen.get(a.anchorId),a))conflicts.add(a.anchorId);
    }else seen.set(a.anchorId,{...a,position:pos});
  });
  for(const [id,a] of seen){
    if(conflicts.has(id))continue;
    const arr=byRecording.get(a.recordingId)??[];
    arr.push(a);byRecording.set(a.recordingId,arr);
  }
  for(const items of byRecording.values())items.sort((a,b)=>
    a.audioOffsetMs-b.audioOffsetMs||a.typedAt-b.typedAt||a.position-b.position);
  return byRecording;
}
export function cueAtPlayback(cues,recordingId,offsetMs,maxLagMs=MAX_CUE_LAG_MS){
  if(!(cues instanceof Map)||!Number.isFinite(offsetMs)||offsetMs<0||
    !Number.isFinite(maxLagMs)||maxLagMs<0)return null;
  const list=cues.get(recordingId);
  if(!list?.length)return null;
  let lo=0,hi=list.length;
  while(lo<hi){
    const mid=(lo+hi)>>>1;
    if(list[mid].audioOffsetMs<=offsetMs)lo=mid+1;
    else hi=mid;
  }
  const cue=list[lo-1];
  return cue&&offsetMs-cue.audioOffsetMs<=maxLagMs?cue:null;
}
const BLOCK='p,h1,h2,h3,h4,h5,h6,li,blockquote,pre';
const isCaptureActive=run=>run?.capture?.state==='capturing';
export class NoteAudioFollower{
  constructor({getRun,player,root,scrollArea,status,toggle}){
    this.getRun=getRun;this.player=player;this.root=root;this.scrollArea=scrollArea;
    this.status=status;this.toggle=toggle;this.autoscroll=true;
    this.index=new Map();this.dirty=true;this.run=null;
    this.activeId=null;this.activeEls=[];this.activeBlocks=[];this.liveBlock=null;
    this.userScrollUntil=0;this.lastJump=0;
    toggle.addEventListener('click',()=>{
      this.autoscroll=!this.autoscroll;
      toggle.setAttribute('aria-pressed',String(this.autoscroll));
      toggle.textContent=this.autoscroll?'Tự cuộn: Bật':'Tự cuộn: Tắt';
      if(this.autoscroll&&this.activeEls.length)this.maybeScroll(this.activeEls[0],true);
    });
    scrollArea.addEventListener('wheel',()=>{this.userScrollUntil=Date.now()+7000;},{passive:true});
    scrollArea.addEventListener('touchstart',()=>{this.userScrollUntil=Date.now()+7000;},{passive:true});
    this.setStatus('Khi nghe lại, đoạn ghi chú gần mốc phát sẽ sáng lên.');
  }
  setStatus(text){if(this.status)this.status.textContent=text;}
  mount(run){
    this.clear();this.run=run;this.dirty=true;
    this.captureChanged();
  }
  onDocChange(){
    this.dirty=true;
    if(!this.run||this.getRun()!==this.run)return;
    // Reindex only on an actual playback progress event, not every keystroke.
    if(this.player.playing && this.player.recordingId)
      this.playback('position',{recordingId:this.player.recordingId,
        offsetMs:this.player.positionMs()});
    else this.captureChanged();
  }
  captureChanged(){
    const run=this.run;
    const current=this.getRun();
    if(!run||run!==current||!isCaptureActive(run)){
      this.clearLive();
      return;
    }
    this.clearPlayback();
    const editor=run.editor,view=editor?.view;
    if(!view||!view.state.selection.empty){this.clearLive();return;}
    const $pos=view.state.selection.$from;
    let block=null;
    for(let depth=$pos.depth;depth>=1;depth--){
      if(!$pos.node(depth).isTextblock)continue;
      const dom=view.nodeDOM($pos.before(depth));
      block=dom?.nodeType===1?dom:dom?.parentElement;
      break;
    }
    if(!block||!this.root.contains(block)){this.clearLive();return;}
    if(this.liveBlock!==block){
      this.clearLive();block.classList.add('note-capture-current');
      this.liveBlock=block;
    }
    this.setStatus('Đang ghi — vị trí ghi chú hiện tại được đánh dấu bên trái.');
  }
  clearLive(){
    if(this.liveBlock?.isConnected)this.liveBlock.classList.remove('note-capture-current');
    this.liveBlock=null;
  }
  buildIndex(){
    if(!this.dirty)return;
    const run=this.run;
    this.index=run?.editor?collectNoteCues(run.editor.state.doc,
      run.tracker.allowed,run.tracker.pendingLinks):new Map();
    this.dirty=false;
  }
  clearPlayback(){
    for(const el of this.activeEls)el.classList.remove('note-audio-current');
    for(const el of this.activeBlocks)el.classList.remove('note-audio-block');
    this.activeEls=[];this.activeBlocks=[];this.activeId=null;
  }
  playback(type,detail={}){
    if(!this.run||this.run!==this.getRun())return;
    if(['stopped','ended','error','unavailable'].includes(type)){
      this.clearPlayback();
      if(!isCaptureActive(this.run))this.setStatus('Phát lại đã dừng. Bấm chữ hoặc kéo thanh tua để theo mốc.');
      return;
    }
    if(!['playing','position'].includes(type))return;
    if(!this.player.playing||!detail.recordingId||!Number.isFinite(detail.offsetMs))return;
    this.clearLive();
    this.buildIndex();
    const cue=cueAtPlayback(this.index,detail.recordingId,detail.offsetMs);
    if(!cue){
      this.clearPlayback();
      this.setStatus('Chưa có ghi chú gắn mốc gần thời điểm âm thanh đang phát.');
      return;
    }
    if(this.activeId===cue.anchorId &&
       this.activeEls.every(el=>el.isConnected))return;
    this.clearPlayback();
    const els=[...this.root.querySelectorAll('[data-time-anchor-id]')].filter(el=>
      el.getAttribute('data-time-anchor-id')===cue.anchorId&&
      el.getAttribute('data-time-recording-id')===cue.recordingId);
    if(!els.length){
      this.setStatus('Mốc đã được lưu nhưng đoạn chữ không còn hiển thị.');
      return;
    }
    const blocks=[...new Set(els.map(el=>el.closest(BLOCK)).filter(Boolean))];
    for(const el of els)el.classList.add('note-audio-current');
    for(const block of blocks)block.classList.add('note-audio-block');
    this.activeEls=els;this.activeBlocks=blocks;this.activeId=cue.anchorId;
    const label=els.map(el=>el.textContent).join(' ').trim().replace(/\s+/g,' ').slice(0,70);
    this.setStatus('Đang theo mốc ghi chú: '+(label||'đoạn có liên kết âm thanh'));
    this.maybeScroll(blocks[0]??els[0]);
  }
  maybeScroll(element,force=false){
    if(!this.autoscroll||!element?.isConnected||
       (!force&&Date.now()<this.userScrollUntil))return;
    // Never move the editing cursor/selection. Scroll only within the paper.
    const area=this.scrollArea.getBoundingClientRect(),rect=element.getBoundingClientRect();
    const margin=Math.min(90,area.height*.2);
    if(rect.top>=area.top+margin&&rect.bottom<=area.bottom-margin)return;
    const desired=this.scrollArea.scrollTop+rect.top-area.top-
      Math.min(area.height*.32,150);
    this.scrollArea.scrollTo({top:Math.max(0,desired),
      behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    this.lastJump=Date.now();
  }
  clear(){
    this.clearPlayback();this.clearLive();
    this.run=null;this.index=new Map();this.dirty=true;this.userScrollUntil=0;
    this.setStatus('Khi nghe lại, đoạn ghi chú gần mốc phát sẽ sáng lên.');
  }
}
