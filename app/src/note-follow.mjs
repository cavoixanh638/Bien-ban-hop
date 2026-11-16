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
    // An OUTSIDE-EDITOR overlay is mandatory: ProseMirror's DOM observer
    // removes transient classes added to its content nodes during input.
    // All overlay children are paper siblings of #editor, not editable nodes.
    this.paper=root.closest('.paper');
    this.layer=document.createElement('div');this.layer.className='note-follow-overlay';
    this.playbackLayer=document.createElement('div');
    this.playbackLayer.className='note-playback-layer';
    this.captureMarker=document.createElement('div');
    this.captureMarker.className='note-capture-pointer';
    this.captureMarker.style.display='none';
    this.layer.append(this.playbackLayer,this.captureMarker);
    this.paper.append(this.layer);
    window.addEventListener('resize',()=>{
      if(this.activeEls.length)this.redrawPlayback();
      if(this.liveBlock)this.positionCaptureMarker(this.liveBlock);
    });
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
    if(this.player.playing && this.player.recordingId){
      if(this.activeEls.length)this.redrawPlayback();
      this.playback('position',{recordingId:this.player.recordingId,
        offsetMs:this.player.positionMs()});
    }
    else this.captureChanged();
  }
  captureChanged(){
    const run=this.run;
    const current=this.getRun();
    if(!run||run!==current||!isCaptureActive(run)){
      const hadLive=!!this.liveBlock;
      this.clearLive();
      if(run===current&&!this.player.playing&&hadLive)
        this.setStatus(run.capture?.state==='paused'?
          'Tạm dừng ghi — vị trí ghi chú được giữ nguyên.':
          'Đã dừng thu — bấm chữ hoặc kéo thanh tua để theo mốc ghi chú.');
      return;
    }
    this.clearPlayback();
    const editor=run.editor,view=editor?.view;
    if(!view||!view.state.selection.empty){this.clearLive();return;}
    // The browser's DOM selection is the authority for the currently edited
    // paragraph. A ProseMirror nodeDOM() lookup may return null for textblock
    // positions between inline marks or around composition boundaries.
    const rawSelection=view.root?.getSelection?.()??window.getSelection?.();
    const textNode=rawSelection?.anchorNode;
    const nearestBlock=node=>{
      const el=node?.nodeType===1?node:node?.parentElement;
      return el?.closest?.(BLOCK)??null;
    };
    let block=textNode&&this.root.contains(textNode)?nearestBlock(textNode):null;
    if(!block){
      const resolved=view.domAtPos(view.state.selection.from);
      block=nearestBlock(resolved.node);
      if(!block&&resolved.node?.nodeType===1){
        const adjacent=resolved.node.childNodes[resolved.offset]??
          resolved.node.childNodes[Math.max(0,resolved.offset-1)];
        block=nearestBlock(adjacent);
      }
    }
    if(!block||!this.root.contains(block)){this.clearLive();return;}
    this.liveBlock=block;
    this.positionCaptureMarker(block);
    this.setStatus('Đang ghi — vị trí ghi chú hiện tại được đánh dấu bên trái.');
  }
  positionCaptureMarker(block){
    if(!block?.isConnected)return;
    const paper=this.paper.getBoundingClientRect(),rect=block.getBoundingClientRect();
    const selection=window.getSelection?.();
    const range=selection?.rangeCount?selection.getRangeAt(0):null;
    const caret=range?.getClientRects?.()[0];
    const line=caret&&caret.height>0?caret:rect;
    const left=Math.max(0,rect.left-paper.left-12),top=Math.max(0,line.top-paper.top);
    this.captureMarker.style.left=left+'px';
    this.captureMarker.style.top=top+'px';
    this.captureMarker.style.height=Math.max(22,Math.min(40,line.height||22))+'px';
    this.captureMarker.style.display='block';
  }
  clearLive(){
    this.captureMarker.style.display='none';
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
    this.playbackLayer.replaceChildren();
    this.activeEls=[];this.activeBlocks=[];this.activeId=null;this.activeRecordingId=null;
  }
  redrawPlayback(){
    this.playbackLayer.replaceChildren();
    if(!this.activeEls.length)return;
    const paper=this.paper.getBoundingClientRect();
    const fragment=document.createDocumentFragment();
    let total=0;
    for(const el of this.activeEls){
      if(!el.isConnected)continue;
      for(const rect of el.getClientRects()){
        if(total++>=80)break; // prevent pathological pasted notes from flooding DOM
        if(rect.width<=1||rect.height<=1)continue;
        const glow=document.createElement('span');
        glow.className='note-playback-highlight-rect';
        glow.dataset.recordingId=this.activeRecordingId;
        glow.style.left=(rect.left-paper.left-2)+'px';
        glow.style.top=(rect.top-paper.top-1)+'px';
        glow.style.width=(rect.width+4)+'px';
        glow.style.height=(rect.height+2)+'px';
        fragment.append(glow);
      }
    }
    const first=this.activeBlocks[0];
    if(first?.isConnected){
      const rect=first.getBoundingClientRect();
      const gutter=document.createElement('span');
      gutter.className='note-playback-gutter';
      gutter.style.left=Math.max(0,rect.left-paper.left-12)+'px';
      gutter.style.top=Math.max(0,rect.top-paper.top)+'px';
      gutter.style.height=Math.max(24,Math.min(45,rect.height))+'px';
      fragment.append(gutter);
    }
    this.playbackLayer.append(fragment);
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
    this.activeEls=els;this.activeBlocks=blocks;this.activeId=cue.anchorId;
    this.activeRecordingId=cue.recordingId;
    this.redrawPlayback();
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
      behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    this.lastJump=Date.now();
  }
  clear(){
    this.clearPlayback();this.clearLive();
    this.run=null;this.index=new Map();this.dirty=true;this.userScrollUntil=0;
    this.setStatus('Khi nghe lại, đoạn ghi chú gần mốc phát sẽ sáng lên.');
  }
}
