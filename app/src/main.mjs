import './style.css';
import {Editor} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {TextStyleKit,LineHeight} from '@tiptap/extension-text-style';
import {applyBlockLineHeight} from './word-layout.mjs';
import {ParagraphIndent,adjustFirstLineIndent} from './paragraph-indent.mjs';
import {importAudioFile,removeUnlinkedImportedAudio} from './import-audio.mjs';
import {ImportantMark,collectImportantAnchors} from './important-mark.mjs';
import {checkBrowserStorage} from './storage-health.mjs';
import {exportVerifiedWavClip} from './audio-clip.mjs';
import {MeetingImage,MeetingPageBreak,MeetingLink,imageNodeFromFile,safeLink} from './word-media.mjs';
import {makeSafeLoop,jumpMeetingPosition} from './replay-tools.mjs';
import TextAlign from '@tiptap/extension-text-align';
import {TableKit} from '@tiptap/extension-table';
import {FindAndReplace} from '@tiptap/extension-find-and-replace';
import {canReplaceFindResults} from './word-guards.mjs';
import {exportWord} from './rich-docx.mjs';
import {printPageRule} from './page-margins.mjs';
import {importSafeDOCX} from './word-import.mjs';
import {buildMeetingSearchIndex,plainTextFromDoc,searchMeetings} from './meeting-search.mjs';
import {firstMeetingTextMatch} from './meeting-search-position.mjs';
import {InputTracker,TimeSpan,createTrackingExtension,readAnchorAtCursor} from '../../poc/01-editor/src/tracker.mjs';
import {MeetingLease} from '../../poc/09-pwa/lease.js';
import {MeetingStore,SaveQueue} from './meeting-store.mjs';
import {verifiedClickedAnchor} from './anchor-bridge.mjs';
import {CaptureSession,AudioPlayer,AudioRPC} from './audio.mjs';
import {MicProbe} from './mic-probe.mjs';
import {mirrorRecordingToLocalFolder,localRecordingStatus} from './recording-mirror.mjs';
import {exportDOCX,exportTXT,exportMarkdown,exportCSV,mime} from '../../poc/08-export/exporter.mjs';
import {exportMeetingArchiveV2,importMeetingArchiveV2,probeMeetingArchiveVersion,verifyPortableArchiveV2} from './portable-archive.mjs';
import {importLegacyMeetingArchive} from './portable-legacy.mjs';
import {loadPortableSource,createBrowserImportRepo} from './portable-storage.mjs';
import {MeetingTimelineUI} from './timeline-ui.mjs';
import {reconcilePlaybackOptions} from './playback-options.mjs';
import {NoteAudioFollower} from './note-follow.mjs';

const $=id=>document.getElementById(id),state={store:null,run:null,lease:new MeetingLease(),switching:false};
let timelineUI=null,noteFollower=null;
let meetingSearchTimer=null,meetingSearchGeneration=0,meetingSearchTerm='',meetingSearchIds=null,meetingSearchIndex=null;
let loopPoints={a:null,b:null,range:null,active:false},loopVersion=0;
const loopLabel=ms=>Number.isFinite(ms)?(ms/1000).toFixed(1)+'s':'—';
function refreshLoopUI(){
  const el=$('loop-status');if(!el)return;
  el.textContent='A: '+loopLabel(loopPoints.a)+' · B: '+loopLabel(loopPoints.b)+
    (loopPoints.active?' · đang lặp':'');
  $('loop-play').setAttribute('aria-pressed',String(loopPoints.active));
}
function clearLoop(stop=false){
  loopVersion++;loopPoints={a:null,b:null,range:null,active:false};
  if(stop)player.stop();
  refreshLoopUI();
}
function endLoopReplay(type,detail={}){
  if(type==='error'||type==='unavailable'){
    loopPoints.active=false;loopVersion++;refreshLoopUI();return;
  }
  if(type!=='ended'||!loopPoints.active||!loopPoints.range)return;
  const {range}=loopPoints;
  if(detail.recordingId!==range.recordingId ||
      !Number.isFinite(detail.offsetMs) || Math.abs(detail.offsetMs-range.endMs)>300)return;
  const version=loopVersion,meetingId=state.run?.meetingId;
  queueMicrotask(async()=>{
    if(version!==loopVersion||!loopPoints.active||state.run?.meetingId!==meetingId)return;
    try{await player.start(range.recordingId,range.startMs,{
      preRollMs:0,rate:Number($('play-rate').value),preservePitch:$('pitch-preserve').checked,skipSilence:$('silence-skip').checked,rnnoise:$('rnnoise-toggle').checked,maxDurationMs:range.durationMs});
    }catch(e){loopPoints.active=false;refreshLoopUI();show('Không thể phát lặp: '+e.message,'error');}
  });
}
const player=new AudioPlayer((type,detail)=>{
  if(type==='unavailable')show('Không phát được: '+(detail.reason??detail.status),'error');
  if(type==='error')show('Lỗi phát: '+detail.message,'error');
  if(type==='preroll-limited')$('anchor-status').textContent='Đã rút ngắn phần nghe lùi đến đầu vùng âm thanh có thật.';
  if(type==='underrun')$('technical-status').textContent='Bộ phát đang thiếu đệm; chưa chứng minh nối mẫu không ngắt.';
  if(type==='silence-scan')$('anchor-status').textContent='Đang phân tích khoảng im lặng trên PCM đã lưu…';
  if(type==='rnnoise-loading')$('anchor-status').textContent='Đang tải mô hình RNNoise WASM cục bộ để nghe lại…';
  if(type==='silence-indexed')$('anchor-status').textContent='Đã xác minh '+detail.ranges+' khoảng im lặng; có thể bỏ qua khoảng '+(detail.skippedMs/1000).toFixed(1)+' giây.';
  if(type==='playing')$('anchor-status').textContent='Đang phát từ '+(detail.offsetMs/1000).toFixed(2)+' giây · '+detail.recordingId+(detail.preRollLimited?' · nghe lùi đã rút ngắn':'')+(detail.pitchPreserved?' · giữ cao độ':'')+(detail.silenceSkipEnabled?' · bỏ qua im lặng':'')+(detail.rnnoiseEnabled?' · RNNoise':'');
  if(type==='ended')$('anchor-status').textContent='Đã phát hết đoạn âm thanh có dữ liệu. Nhấp chữ để nghe lại.';
  timelineUI?.onPlayer(type,detail);
  noteFollower?.playback(type,detail);
  endLoopReplay(type,detail);
});
let noticeTimer=0,secondsTimer=0,localRecordingBusy=false,transferBusy=false,importController=null;
const micProbe=new MicProbe({
  onStatus(phase,detail={}){
    const label=$('mic-test-status'),button=$('mic-test');
    if(!label||!button)return;
    if(phase==='requesting')label.textContent='Đang yêu cầu quyền truy cập micro…';
    else if(phase==='testing')label.textContent='Đã nhận diện: '+detail.deviceLabel+'. Hãy nói để quan sát mức tín hiệu.';
    else if(phase==='completed'||phase==='stopped')label.textContent=detail.signalSeen?
      'Có tín hiệu âm thanh từ micro. Kiểm tra đã hoàn tất.':
      'Đã nhận micro nhưng chưa phát hiện giọng nói rõ ràng. Hãy thử nói to hoặc chọn micro khác.';
    else if(phase==='disconnected')label.textContent='Micro vừa bị ngắt kết nối.';
    else if(phase==='error')label.textContent='Không kiểm tra được micro: '+(detail.message??'không rõ');
    if(phase==='testing'||phase==='requesting')button.textContent='Dừng thử micro';
    else {
      button.textContent='Thử micro (15 giây)';
      $('mic-level-fill').style.width='0%';
      $('mic-meter')?.setAttribute('aria-valuenow','0');
    }
    refreshMicDevices().catch(()=>{});
  },
  onLevel({rms,dbfs,signalSeen,elapsedMs}){
    const pct=Math.min(100,Math.max(0,Math.round((dbfs+65)*100/65)));
    $('mic-level-fill').style.width=pct+'%';
    $('mic-meter').setAttribute('aria-valuenow',String(pct));
    if(elapsedMs>3000&&!signalSeen)$('mic-test-status').textContent=
      'Đã nhận micro, nhưng âm lượng rất thấp ('+Math.round(dbfs)+' dBFS). Hãy nói gần micro.';
    else if(signalSeen)$('mic-test-status').textContent=
      'Đang nhận âm thanh: '+Math.round(dbfs)+' dBFS · mức '+pct+'%.';
  }
});
async function refreshMicDevices(){
  if(!navigator.mediaDevices?.enumerateDevices)return;
  const choices=await navigator.mediaDevices.enumerateDevices();
  const select=$('mic-device');if(!select)return;
  const current=select.value;
  select.replaceChildren(new Option('Micro mặc định',''));
  choices.filter(d=>d.kind==='audioinput').forEach((d,i)=>
    select.add(new Option(d.label||'Micro '+(i+1),d.deviceId)));
  if([...select.options].some(o=>o.value===current))select.value=current;
}
async function toggleMicProbe(){
  if(micProbe.state!=='idle'){await micProbe.stop();return;}
  const recording=state.run?.capture;
  if(recording&&['starting','capturing','paused','stopping'].includes(recording.state))return;
  try{await micProbe.start($('mic-device').value);await refreshMicDevices();}
  catch(e){show('Kiểm tra micro: '+e.message,'error');}
}
async function saveWavInRecording(recordingId){
  if(localRecordingBusy)return;
  localRecordingBusy=true;setRecordingUI();
  const label=$('recording-path');label.textContent='Đang sao chép các đoạn WAV đã lưu vào app/Recording…';
  try{
    const result=await mirrorRecordingToLocalFolder(recordingId);
    if(result.status==='saved'){
      label.textContent='Đã lưu '+result.segments+' đoạn WAV ('+
        (result.bytes/1048576).toFixed(1)+' MB) tại '+result.relativeFolder+'.';
      show('Đã sao chép WAV vào '+result.relativeFolder+'.');
    }else{
      label.textContent='Âm thanh đã lưu OPFS. '+result.reason+
        '. Mở bằng START_WINDOWS.cmd để tự lưu vào app/Recording.';
    }
  }catch(e){
    label.textContent='Âm thanh vẫn có trong OPFS nhưng chưa sao chép được vào app/Recording: '+e.message;
    show('Sao chép WAV thất bại: '+e.message,'error');
  }finally{localRecordingBusy=false;setRecordingUI();}
}
function show(message,kind='info'){
  const el=$('message');el.textContent=message;el.className='message visible'+(kind==='error'?' error':'');
  clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{el.className='message';},6500);
}
function status(kind,text,isError=false){
  const el=$(kind);el.textContent=text;el.className='chip'+(isError?' error':'');
}
function timing(ms){const s=Math.floor((ms||0)/1000);return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(n=>String(n).padStart(2,'0')).join(':');}
function setRecordingUI(){
  const run=state.run,rec=run?.capture;
  const active=rec&&['starting','capturing','paused','stopping'].includes(rec.state);
  const finalizing=!!run?.recordingFinalization;
  const recording=rec?.state==='capturing',paused=rec?.state==='paused';
  $('rec-start').disabled=!run?.releaseLease||!!active||finalizing||state.switching;
  $('rec-pause').disabled=!recording&&!paused;
  $('rec-pause').textContent=paused?'Tiếp tục':'Tạm dừng';
  $('rec-pause').dataset.mode=paused?'resume':recording?'pause':'idle';
  $('rec-pause').title=paused?'Tiếp tục ghi âm':'Tạm dừng ghi âm';
  $('rec-stop').disabled=!active||rec?.state==='stopping';
  $('rec-stop').dataset.mode=active?'stop':'idle';
  $('rec-stop').title='Kết thúc và lưu ghi âm';
  $('backup').disabled=!!active||finalizing||!run?.releaseLease||state.switching||transferBusy;
  $('verify-backup').disabled=!!active||finalizing||state.switching||transferBusy;
  $('import-audio').disabled=!!active||finalizing||!run?.releaseLease||state.switching||transferBusy;
  $('bookmark-toggle').disabled=!run?.releaseLease||state.switching||transferBusy;
  document.querySelectorAll('#word-add-link,#word-remove-link,#word-page-break,#word-insert-image,#word-link-url')
    .forEach(el=>el.disabled=!run?.releaseLease||state.switching||transferBusy);
  $('export-clip').disabled=!!active||finalizing||state.switching||transferBusy;
  $('import-backup').disabled=!!active||finalizing||state.switching||transferBusy;
  $('mic-test').disabled=!!active;
  $('mic-device').disabled=!!active||micProbe.state!=='idle';
  $('retry-local-recording').disabled=!!active||localRecordingBusy||!run?.meeting.recordingIds?.length||state.switching;
  $('rec-light').className='rec-light'+(recording?' active':paused?' paused':'');
  $('rec-label').textContent=finalizing?'Đang hoàn tất lưu':recording?'Đang ghi âm':paused?'Đã tạm dừng':rec?.state==='starting'?'Đang xin quyền micro':
    rec?.state==='stopping'?'Đang lưu âm thanh':rec?.state==='failed'?'Ghi âm có lỗi':'Chưa ghi âm';
  $('writer-status').textContent=run?.releaseLease?'Có quyền chỉnh sửa':'Chỉ xem / đang có tab khác';
  timelineUI?.setBusy(!!active||finalizing||state.switching||transferBusy);
  noteFollower?.captureChanged();
}
function hideTitleEditor(){
  $('meeting-title-editor').hidden=true;
  if(state.run)$('meeting-title').value=state.run.meeting.title;
}
function openTitleEditor(){
  if(!state.run?.releaseLease||state.switching)return;
  $('meeting-title').value=state.run.meeting.title;
  $('meeting-title-editor').hidden=false;
  $('meeting-title').focus();
  $('meeting-title').select();
}
function renderMeetings(){
  const run=state.run,root=$('meeting-list');root.replaceChildren();
  for(const meeting of state.meetings??[]){
    if(meetingSearchTerm && meetingSearchIds && !meetingSearchIds.has(meeting.meetingId))continue;
    const row=document.createElement('div');row.className='meeting-row';row.setAttribute('role','listitem');
    const button=document.createElement('button');
    button.type='button';
    button.className='meeting'+(meeting.meetingId===run?.meeting.meetingId?' active':'');
    const heading=document.createElement('strong');heading.textContent=meeting.title;
    const small=document.createElement('small');small.textContent=new Date(meeting.updatedAt??meeting.createdAt).toLocaleDateString('vi-VN');
    button.append(heading,small);
    button.onclick=async()=>{
      const query=meetingSearchTerm;
      await openMeeting(meeting.meetingId);
      if(!query||query!==meetingSearchTerm||state.run?.meetingId!==meeting.meetingId)return;
      const editor=state.run.editor;
      const range=firstMeetingTextMatch(editor.state.doc,query);
      if(!range){$('meeting-search-status').textContent='Đã mở cuộc họp; từ khóa chỉ có trong tên hoặc không có vị trí chính xác.';return;}
      editor.chain().focus().setTextSelection(range).scrollIntoView().run();
      $('meeting-search-status').textContent='Đã đến đoạn phù hợp trong biên bản (không sửa mốc âm thanh).';
    };
    row.append(button);
    if(meeting.meetingId===run?.meeting.meetingId){
      const edit=document.createElement('button');
      edit.type='button';edit.className='meeting-edit';edit.textContent='✎';
      edit.title='Đổi tên cuộc họp';edit.setAttribute('aria-label','Đổi tên: '+meeting.title);
      edit.disabled=!run.releaseLease;edit.onclick=openTitleEditor;
      row.append(edit);
    }
    root.append(row);
  }
}
async function refreshMeetings(){
  state.meetings=await state.store.list();
  meetingSearchIndex=null;
  if(meetingSearchTerm)await runMeetingSearch().catch(e=>show('Không tìm được cuộc họp: '+e.message,'error'));
  renderMeetings();
}
async function runMeetingSearch(){
  const query=meetingSearchTerm;
  const generation=++meetingSearchGeneration;
  if(!query){meetingSearchIds=null;renderMeetings();$('meeting-search-status').textContent='';return;}
  $('meeting-search-status').textContent='Đang tìm trong nội dung…';
  if(!meetingSearchIndex){
    const docs=[];
    for(const meeting of state.meetings??[]){
      const doc=state.run?.meetingId===meeting.meetingId?state.run.editor?.getJSON():
        (await state.store.notes.getNote(meeting.noteDocumentId))?.content;
      if(generation!==meetingSearchGeneration)return;
      docs.push({meetingId:meeting.meetingId,title:meeting.title,
        text:plainTextFromDoc(doc)});
    }
    meetingSearchIndex=buildMeetingSearchIndex(docs);
  }
  const matches=searchMeetings(meetingSearchIndex,query);
  if(generation!==meetingSearchGeneration)return;
  meetingSearchIds=new Set(matches.map(m=>m.meetingId));
  renderMeetings();
  $('meeting-search-status').textContent=matches.length+' cuộc họp phù hợp';
}
function updateAnchor(){
  const run=state.run;if(!run?.editor)return;
  const pos=readAnchorAtCursor(run.editor.state,run.tracker.allowed);
  const a=pos.anchor;
  // Selection-update rAF may run after the click handler; never erase a live
  // playback status with the static mark-inspector message.
  if(player.playing && a?.recordingId===player.recordingId){
    $('anchor-status').textContent='Đang phát từ '+timing(player.startOffsetMs)+' · '+player.recordingId;
    return;
  }
  $('anchor-status').textContent=!a?'Chọn một đoạn chữ có mốc để nghe lại':
    pos.status==='ambiguous'||pos.status==='mixed'?'Vùng chọn có nhiều mốc hoặc ranh giới không rõ nguồn':
    run.tracker.pendingLinks.has(a.anchorId)?'Mốc đang chờ dữ liệu âm thanh được xác nhận. Ghi chú vẫn được lưu.':
    a.recordingId&&Number.isInteger(a.audioOffsetMs)?
      'Mốc '+timing(a.audioOffsetMs)+' · '+a.source+' · nhấp đoạn chữ để nghe':
      'Đoạn chữ chưa liên kết âm thanh';
}
function syncControls(){const run=state.run;setRecordingUI();
  $('meeting-title').disabled=!run?.releaseLease;
  document.querySelectorAll('[data-action],[data-word],#word-heading,#word-font,#word-size,#word-color,#word-highlight,#word-lineheight,#find-replace,#find-replace-all,#import-word').forEach(b=>{b.disabled=!run?.releaseLease;});
}
async function safelyCloseCurrent(){
  const run=state.run;if(!run)return;
  if(run.capture&&['starting','capturing','paused','stopping'].includes(run.capture.state)){
    throw Error('Hãy kết thúc ghi âm trước khi chuyển cuộc họp');
  }
  if(run.recordingFinalization)await run.recordingFinalization;
  if(run.releaseLease)await run.queue.close(); // Throws if dirty/error. Do not release/clear unsaved note.
  // Cancel the timeline UI then wait until its OPFS recovery worker has CLOSED
  // every exclusive SyncAccessHandle before changing meetings.
  timelineUI?.clear();
  noteFollower?.clear();
  await timelineUI?.settle();
  clearLoop();
  await player.closeReader();
  run.editor.destroy();
  if(run.releaseLease)await run.releaseLease();
  state.run=null;
}
function importedPlaybackContext(run){
  const id=player.recordingId,manifest=player.manifest;
  if(!player.playing||!id?.startsWith('rec-import-')||
     !run?.tracker?.allowed?.has(id)||!manifest?.sampleRate||player.underruns>0)
    return {source:'unlinked',coverage:'unlinked'};
  const at=player.positionMs(),sample=Math.floor(at*manifest.sampleRate/1000);
  if(!Number.isFinite(at)||at<0||
     !manifest.sampleRanges?.some(r=>sample>=r.sampleStart&&sample<r.sampleEndExclusive))
    return {source:'unlinked',coverage:'gap'};
  return {source:'imported_playback',recordingId:id,
    audioOffsetMs:Math.round(sample*1000/manifest.sampleRate),coverage:'valid'};
}
async function openMeeting(meetingId,{allowTransfer=false}={}){
  if(state.switching||transferBusy&&!allowTransfer||state.run?.meeting.meetingId===meetingId)return;
  state.switching=true;syncControls();
  try{
    await safelyCloseCurrent();
    const loaded=await state.store.load(meetingId),releaseLease=await state.lease.acquire(meetingId);
    const run={...loaded,releaseLease,meetingId,revision:loaded.note.revision,capture:null,editor:null,queue:null};
    state.run=run;
    $('meeting-title').value=run.meeting.title;
    $('meeting-title-editor').hidden=true;
    const tracker=new InputTracker({meetingId,recordingIds:run.meeting.recordingIds??[],
      getAudioContext:mono=>run.capture&&['capturing','starting'].includes(run.capture.state)?
        run.capture.getEditorContext(mono):importedPlaybackContext(run)});
    run.tracker=tracker;
    const queue=new SaveQueue(async()=>{
      if(!run.releaseLease)throw Error('Không có quyền ghi');
      run.revision=await state.store.save(meetingId,run.editor.getJSON(),tracker.exportPendingState(),run.revision,state.lease);
    },(phase,error)=>{
      if(phase==='saved'){meetingSearchIndex=null;status('save-status','Đã lưu • r'+run.revision);}
      else if(phase==='saving')status('save-status','Đang lưu…');
      else if(phase==='dirty')status('save-status','Chưa lưu');
      else {
        status('save-status','Lỗi lưu: '+(error?.message??'không rõ'),true);
        show('Không lưu được ghi chú: '+(error?.message??'không rõ'),'error');
      }
    });
    run.queue=queue;
    run.editor=new Editor({
      element:$('editor'),extensions:[
        StarterKit,TextStyleKit.configure({lineHeight:false}),
        LineHeight.configure({types:['paragraph','heading']}),TextAlign.configure({types:['paragraph','heading']}),
        ParagraphIndent,
        TableKit,FindAndReplace.configure({searchDebounceMs:0}),TimeSpan,ImportantMark,
        MeetingImage,MeetingPageBreak,MeetingLink,
        createTrackingExtension(tracker)
      ],
      // Native browser spellcheck/grammar overlays are too distracting while taking notes.
      // This does not alter text, timeSpan marks, cursor behavior or audio linking.
      editorProps:{attributes:{
        spellcheck:'false',autocorrect:'off',autocapitalize:'off',
        'data-gramm':'false','data-gramm_editor':'false','data-enable-grammarly':'false'
      }},
      content:run.note.content,editable:!!releaseLease,autofocus:false,
      onUpdate:()=>{queue.edit();noteFollower?.onDocChange();requestAnimationFrame(updateAnchor);
        requestAnimationFrame(updateFindCount);requestAnimationFrame(refreshBookmarks);},
      onSelectionUpdate:()=>{noteFollower?.captureChanged();requestAnimationFrame(updateAnchor);}
    });
    if(run.pendingState)tracker.restorePendingState(run.pendingState,run.editor.state.doc);
    noteFollower?.mount(run);
    status('save-status','Đã lưu • r'+run.revision);
    if(!releaseLease)show('Cuộc họp đang được một tab khác chỉnh sửa. Tab này chỉ có quyền xem.','error');
    await refreshMeetings();
    updateAnchor();
    updateFindCount();
    refreshBookmarks();
    timelineUI?.refresh(run).catch(e=>show('Không mở được thanh tua: '+e.message,'error'));
  }catch(error){show('Không mở được cuộc họp: '+error.message,'error');}
  finally{state.switching=false;syncControls();}
}
async function createMeeting(){
  if(state.switching||transferBusy)return;
  const title='Cuộc họp mới '+new Date().toLocaleDateString('vi-VN');
  try{
    const meeting=await state.store.create(title);
    await refreshMeetings();
    await openMeeting(meeting.meetingId);
    if(state.run?.meetingId===meeting.meetingId)openTitleEditor();
  }catch(e){show('Không tạo được cuộc họp: '+e.message,'error');}
}
async function saveTitle(){
  const run=state.run;if(!run?.releaseLease)return;
  const title=$('meeting-title').value.trim();
  if(!title){show('Tên cuộc họp không được để trống.','error');$('meeting-title').focus();return;}
  if(title===run.meeting.title){hideTitleEditor();return;}
  try{
    const renamed=await state.store.notes.renameMeeting(run.meetingId,title);
    if(state.run!==run)return;
    run.meeting=renamed;
    await refreshMeetings();
    hideTitleEditor();
    show('Đã đổi tên cuộc họp.');
  }catch(e){show('Lỗi đổi tên: '+e.message,'error');}
}
function recEvent(run,type,detail){
  if(state.run!==run)return;
  if(type==='clock'){
    const n=detail.sampleIndex??0;
    if(run.capture?.rate)$('rec-clock').textContent=timing(n*1000/run.capture.rate);
    $('technical-status').textContent='Bản ghi: '+run.capture?.recordingId+'\nPCM: '+n.toLocaleString('vi-VN')+
      ' frame\nOPFS đã commit: '+(run.capture?.committedSampleExclusive??0).toLocaleString('vi-VN')+' frame';
  }
  if(type==='committed'){
    const result=run.tracker.finalizePendingLinks(entry=>run.capture.pendingResolver(entry));
    if(result.applied||result.results?.some(x=>x.status==='invalidated'))run.queue.edit();
  }
  if(type==='gap')show('Phát hiện thiếu mẫu âm thanh: '+(detail.reason??'chưa rõ'),'error');
  if(type==='error')show('Lỗi ghi âm: '+detail.message,'error');
  setRecordingUI();
}
async function startRecording(){
  const run=state.run;if(!run?.releaseLease||run.recordingFinalization||state.switching||transferBusy||run.capture&&['starting','capturing','paused','stopping'].includes(run.capture.state))return;
  const recordingId='rec-'+crypto.randomUUID();
  const capture=new CaptureSession({meetingId:run.meetingId,recordingId,deviceId:$('mic-device').value,
    onEvent:(type,detail)=>recEvent(run,type,detail),onError:e=>show('Âm thanh: '+e.message,'error')});
  run.capture=capture;setRecordingUI();
  try{
    if(micProbe.state!=='idle')await micProbe.stop('switch');
    await player.closeReader();
    await capture.start();
    run.meeting=await state.store.addRecording(run.meetingId,recordingId,state.lease);
    run.tracker.allowed.add(recordingId);
    run.queue.edit(); // Persist meeting note/sidecar after recording reference has been committed.
    show('Đang thu micro. Tiếp tục gõ bình thường, mốc được gắn tự động.');
  }catch(e){
    // If the microphone/OPFS started but the Meeting reference failed to commit,
    // never leave an orphan live capture while the UI says "not started".
    if(['starting','capturing','paused','stopping'].includes(capture.state)){
      try{await capture.stop();}catch(cleanupError){show('Lỗi dọn phiên thu: '+cleanupError.message,'error');}
    }
    show('Không bắt đầu ghi âm: '+e.message,'error');
    // Permission still open is explicitly NOT claimed released.
    if(capture.permissionPendingCleanup)show('Yêu cầu quyền micro chưa kết thúc; không khởi tạo phiên mới khi quyền còn treo.','error');
  }finally{setRecordingUI();}
}
async function pauseRecording(){
  const run=state.run,rec=run?.capture;if(!rec)return;
  try{if(rec.state==='paused')rec.resume();else await rec.pause();}
  catch(e){show('Lỗi tạm dừng: '+e.message,'error');}
  setRecordingUI();
}
async function stopRecording(){
  const run=state.run,rec=run?.capture;
  if(!rec||run.recordingFinalization)return;
  // The Stop button is not finished when the micro track ends. Keep a durable
  // finalization barrier through OPFS ACK, note commit, timeline recovery and
  // optional Windows WAV mirror. No second OPFS reader/backup during this step.
  const task=(async()=>{
    const result=await rec.stop();
    const finalized=run.tracker.finalizePendingLinks(entry=>rec.pendingResolver(entry));
    if(finalized.applied)run.queue.edit();
    await run.queue.drain();
    $('technical-status').textContent='Đã chốt bản ghi '+rec.recordingId+
      '\nPCM đã commit: '+result.samples?.toLocaleString('vi-VN')+' frame.'+
      (result.permissionPendingCleanup?'\nQuyền micro vẫn đang chờ hệ điều hành.':'');
    await timelineUI?.refresh(run);
    await saveWavInRecording(rec.recordingId);
    show('Đã kết thúc và lưu âm thanh. Thanh tua đã được cập nhật.');
  })();
  run.recordingFinalization=task;
  setRecordingUI();
  try{await task;}
  catch(e){show('Dừng ghi/lưu chưa hoàn tất: '+e.message,'error');}
  finally{
    if(run.recordingFinalization===task)run.recordingFinalization=null;
    setRecordingUI();
  }
}
async function listenAtCursor(clickedAnchor=null){
  const run=state.run;if(!run?.editor)return;
  const cursor=clickedAnchor?null:readAnchorAtCursor(run.editor.state,run.tracker.allowed),
    anchor=clickedAnchor??cursor?.anchor;
  if((!clickedAnchor && cursor?.status!=='linked')||!anchor?.recordingId||!Number.isInteger(anchor.audioOffsetMs)){
    show(cursor?.status==='ambiguous'||cursor?.status==='mixed'?'Mốc có nhiều nguồn; hãy đặt con trỏ bên trong đoạn chữ.':'Đoạn này chưa có âm thanh hợp lệ.','error');return;
  }
  if(run.capture&&['starting','capturing','paused','stopping'].includes(run.capture.state)){
    show('Bản tích hợp đầu tiên chỉ nghe lại sau khi dừng ghi để tránh tranh chấp OPFS.','error');return;
  }
  try{
    if(transferBusy||state.switching){
      show('Đang xử lý dữ liệu; chưa thể mở thêm bộ đọc âm thanh.','error');return;
    }
    await timelineUI?.settle();
    if(state.run!==run)return;
    const result=await player.start(anchor.recordingId,anchor.audioOffsetMs,
      {preRollMs:Number($('preroll').value),rate:Number($('play-rate').value),preservePitch:$('pitch-preserve').checked,skipSilence:$('silence-skip').checked,rnnoise:$('rnnoise-toggle').checked,
        maxDurationMs:Number($('focus-duration').value)});
    // AudioPlayer already reports unavailable through the source-aware callback.
  }catch(e){show('Không nghe lại được: '+e.message,'error');}
}
function download(filename,data,type){
  const blob=data instanceof Blob?data:new Blob([data],{type});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function exportText(format){
  const run=state.run;if(!run)return;
  try{
    if(run.releaseLease)await run.queue.drain();
    const data={title:run.meeting.title,document:run.editor.getJSON(),includeTimestamps:$('include-time').checked,pageMarginPreset:$('page-margin-preset').value};
    const fns={txt:exportTXT,md:exportMarkdown,csv:exportCSV};
    const result=format==='docx'?await exportWord(data):fns[format](data);
    download('bien-ban-hop-'+run.meetingId+'.'+format,result,mime[format]);
    show('Đã tạo tệp '+format.toUpperCase()+'. Không thay thế bản sao lưu có audio.');
  }catch(e){show('Lỗi xuất tệp: '+e.message,'error');}
}
async function backup(){
  const run=state.run;
  if(!run?.releaseLease||transferBusy||state.switching)return;
  if(run.recordingFinalization){
    show('Đang hoàn tất lưu âm thanh, chưa thể xuất cuộc họp.','error');return;
  }
  if(run.capture&&['starting','capturing','paused','stopping'].includes(run.capture.state)){
    show('Kết thúc và chốt dữ liệu âm thanh trước khi xuất gói.','error');return;
  }
  if(!window.showSaveFilePicker){
    show('Trình duyệt cần hỗ trợ hộp thoại lưu file theo luồng (Chrome/Edge).','error');return;
  }
  let writable=null,editorWasEnabled=run.editor?.isEditable??false;
  try{
    // File picker MUST be opened in this direct click gesture.
    const handle=await window.showSaveFilePicker({suggestedName:'bien-ban-hop-'+run.meetingId+'.bbhop',
      types:[{description:'Sao lưu biên bản họp và ghi âm',accept:{'application/zip':['.bbhop']}}]});
    transferBusy=true;state.switching=true;
    run.editor?.setEditable(false);
    setRecordingUI();syncControls();
    $('transfer-status').textContent='Đang chốt nội dung ghi chú trước khi xuất…';
    await run.queue.drain();
    // AudioPlayer holds OPFS SyncAccessHandles even after "Dừng". Release
    // playback and the timeline's manifest reader before opening backup files.
    await timelineUI?.settle();
    await player.closeReader();
    const source=await loadPortableSource(state.store,run.meetingId);
    let lastProgress=0;
    writable=await handle.createWritable();
    const sink=new WritableStream({
      write:bytes=>writable.write(bytes),close:()=>writable.close(),abort:error=>writable.abort(error)
    });
    const result=await exportMeetingArchiveV2(source,sink,{onProgress:pos=>{
      if(pos-lastProgress>5*1024*1024){lastProgress=pos;
        $('transfer-status').textContent='Đang xuất '+(pos/1048576).toFixed(1)+' MB…';}
    }});
    writable=null;
    const exported='Đã ghi '+source.meeting.recordingIds.length+
      ' phiên ghi, '+result.archive.entries+' mục ('+
      (result.archive.size/1048576).toFixed(1)+' MB) vào tệp.';
    if($('verify-after-backup').checked){
      if(typeof handle.getFile!=='function'){
        $('transfer-status').textContent=exported+' CHƯA kiểm chứng: trình duyệt không hỗ trợ đọc lại file vừa lưu.';
        show('Đã xuất nhưng CHƯA xác nhận an toàn. Hãy dùng nút Kiểm chứng file sao lưu.','error');
      }else{
        const controller=new AbortController();
        importController=controller;
        $('import-cancel').style.display='block';
        $('transfer-status').textContent=exported+' Đang kiểm chứng SHA-256/CRC…';
        try{
          const savedFile=await handle.getFile();
          const verified=await verifyPortableArchiveV2(savedFile,{
            signal:controller.signal,onProgress:({processed,total})=>{
              $('transfer-status').textContent='Đang đọc lại file đã lưu và kiểm SHA-256/CRC: '+
                (processed/1048576).toFixed(1)+' / '+(total/1048576).toFixed(1)+' MB';
            }});
          $('transfer-status').textContent=exported+' Đã kiểm chứng đủ '+
            verified.files+' tệp, '+verified.recordings+' phiên WAV (SHA-256/CRC khớp).';
          show('Đã sao lưu VÀ kiểm chứng file hoàn chỉnh.');
        }catch(error){
          $('transfer-status').textContent=exported+' CHƯA vượt kiểm chứng: '+error.message;
          show('Tệp đã ghi nhưng CHƯA được xác nhận an toàn: '+error.message,'error');
        }finally{
          importController=null;$('import-cancel').style.display='none';
        }
      }
    }else{
      $('transfer-status').textContent=exported+' Chưa kiểm chứng; có thể kiểm tra bằng nút bên dưới.';
      show('Đã ghi file nhưng chưa kiểm chứng SHA-256/CRC.');
    }
  }catch(error){
    if(writable)try{await writable.abort(error);}catch{}
    if(error?.name!=='AbortError'){
      $('transfer-status').textContent='Xuất dữ liệu chưa hoàn tất: '+error.message;
      show('Không sao lưu được đầy đủ: '+error.message,'error');
    }
  }finally{
    transferBusy=false;state.switching=false;
    if(state.run===run)run.editor?.setEditable(!!run.releaseLease&&editorWasEnabled);
    syncControls();setRecordingUI();
  }
}
function displayImportProgress(progress){
  if(progress.phase==='audio')$('transfer-status').textContent=
    'Đang khôi phục WAV '+progress.done+'/'+progress.total+': '+progress.path;
  else if(Number.isFinite(progress.processed))$('transfer-status').textContent=
    'Đang kiểm tra gói đời cũ: '+(progress.processed/1048576).toFixed(1)+' / '+
    (progress.total/1048576).toFixed(1)+' MB';
}
async function verifyBackupFile(file){
  if(!file||transferBusy||state.switching)return;
  if(state.run?.capture&&['capturing','paused','starting','stopping'].includes(state.run.capture.state)){
    show('Kết thúc thu âm trước khi kiểm chứng tệp sao lưu.','error');return;
  }
  const controller=new AbortController();importController=controller;transferBusy=true;
  $('import-cancel').style.display='block';
  $('transfer-status').textContent='Đang kiểm tra từng tệp bên trong gói, gồm toàn bộ WAV…';
  setRecordingUI();syncControls();
  try{
    const result=await verifyPortableArchiveV2(file,{signal:controller.signal,
      onProgress:({processed,total})=>{
        $('transfer-status').textContent='Kiểm chứng ZIP SHA-256/CRC: '+
          (processed/1048576).toFixed(1)+' / '+(total/1048576).toFixed(1)+' MB';
      }});
    $('transfer-status').textContent='Đã kiểm chứng đầy đủ '+
      result.files+' tệp trong gói v2, '+result.recordings+' phiên WAV; mọi SHA-256/CRC khớp.';
    show('File sao lưu đã vượt kiểm chứng toàn bộ mà không thay đổi dữ liệu trong app.');
  }catch(error){
    $('transfer-status').textContent='Kiểm chứng file sao lưu thất bại: '+error.message;
    show('Tệp sao lưu CHƯA được xác nhận an toàn: '+error.message,'error');
  }finally{
    importController=null;transferBusy=false;$('import-cancel').style.display='none';
    $('verify-backup-file').value='';setRecordingUI();syncControls();
  }
}

async function importSelectedFile(file){
  if(!file||transferBusy)return;
  if(state.run?.recordingFinalization){
    show('Đang hoàn tất ghi âm, chưa thể nhập cuộc họp.','error');return;
  }
  if(file.size<22){show('Tệp sao lưu không hợp lệ hoặc rỗng.','error');return;}
  const active=state.run?.capture;
  if(active&&['starting','capturing','paused','stopping'].includes(active.state)){
    show('Kết thúc ghi âm hiện tại trước khi nhập cuộc họp.','error');return;
  }
  const controller=new AbortController();
  importController=controller;transferBusy=true;
  $('import-cancel').style.display='block';
  $('transfer-status').textContent='Đang kiểm tra cấu trúc, checksum và đủ các phiên ghi âm…';
  syncControls();setRecordingUI();
  let imported=null;
  try{
    if(state.run?.releaseLease)await state.run.queue.drain();
    await timelineUI?.settle();
    await player.closeReader();
    const version=await probeMeetingArchiveVersion(file);
    if(version===1){
      imported=await importLegacyMeetingArchive(file,state.store,{signal:controller.signal,
        onProgress:displayImportProgress});
    }else{
      const repo=createBrowserImportRepo(state.store);
      imported=await importMeetingArchiveV2(file,repo,{signal:controller.signal,
        onProgress:displayImportProgress});
    }
    $('transfer-status').textContent='Đã khôi phục '+imported.recordings+
      ' phiên ghi âm và biên bản với mã cuộc họp mới. Không ghi đè dữ liệu cũ.'+
      (imported.legacy?' Đây là file v1: chỉ dữ liệu vốn có trong bản xuất đời cũ được khôi phục.':'');
    await refreshMeetings();
    if(state.run?.capture&&['starting','capturing','paused','stopping'].includes(state.run.capture.state))
      throw Error('Không thể chuyển khi đang ghi âm');
    await openMeeting(imported.meetingId,{allowTransfer:true});
    show('Đã nhập thành công '+imported.recordings+' phiên ghi âm. Bấm chữ để nghe lại.');
  }catch(error){
    $('transfer-status').textContent='Không thể khôi phục gói: '+error.message;
    show('Nhập cuộc họp thất bại: '+error.message,'error');
  }finally{
    importController=null;transferBusy=false;
    $('import-cancel').style.display='none';
    $('import-file').value='';
    syncControls();setRecordingUI();
  }
}

function updateFindCount(){
  const run=state.run,storage=run?.editor?.storage?.findAndReplace;
  const results=storage?.results??[];
  const selected=Number.isInteger(storage?.currentIndex)?storage.currentIndex+1:0;
  $('find-count').textContent=selected+' / '+results.length;
}
function openFind(replace=false){
  $('find-panel').hidden=false;
  $('find-query').focus();
  $('find-query').select();
  if(replace)$('find-replacement').focus();
  updateFindCount();
}
function closeFind(){
  $('find-panel').hidden=true;
  state.run?.editor?.commands.clearSearch?.();
}
function runFindReplacement(all=false){
  const run=state.run,editor=run?.editor;
  if(!editor||!run.releaseLease)return;
  const {results=[],currentIndex=null}=editor.storage.findAndReplace??{};
  if(!results.length){show('Không có kết quả cần thay.');return;}
  const guard=canReplaceFindResults(editor.state.doc,results,currentIndex,all);
  if(!guard.ok){
    show('Có đoạn chữ đang liên kết âm thanh; không tự thay để tránh sai mốc. Hãy sửa trực tiếp đoạn đó.', 'error');
    return;
  }
  editor.commands.setReplaceTerm($('find-replacement').value);
  all?editor.commands.replaceAll():editor.commands.replace();
  requestAnimationFrame(updateFindCount);
}
function refreshBookmarks(){
  const root=$('bookmark-list');if(!root)return;
  root.replaceChildren();
  const run=state.run;
  const list=run?.editor?collectImportantAnchors(run.editor.getJSON(),run.tracker.allowed):[];
  $('bookmark-count').textContent=String(list.length);
  if(!list.length){root.textContent='Chưa có đoạn chữ được đánh dấu cùng mốc âm thanh.';return;}
  for(const item of list){
    const button=document.createElement('button');
    button.type='button';button.className='bookmark-item';
    button.textContent=timing(item.audioOffsetMs)+' · '+(item.label||'Đoạn có âm thanh');
    button.title='Bấm để nghe đoạn đã đánh dấu';
    button.onclick=()=>listenAtCursor(item);
    root.append(button);
  }
}
async function refreshStorageHealth(){
  const el=$('storage-health');if(!el)return;
  try{
    const result=await checkBrowserStorage(navigator);
    el.textContent=result.label;
    el.dataset.level=result.level;
  }catch(e){
    el.textContent='Không lấy được ước tính dung lượng: '+e.message;
    el.dataset.level='unknown';
  }
}

function wireWordTools(){
  const editor=()=>state.run?.editor,runCmd=cb=>{
    if(!state.run?.releaseLease||!editor())return;
    cb(editor().chain().focus()).run();
  };
  $('word-heading').onchange=e=>{
    const level=Number(e.target.value);
    runCmd(chain=>level?chain.setHeading({level}):chain.setParagraph());
  };
  $('word-font').onchange=e=>runCmd(chain=>chain.setFontFamily(e.target.value));
  $('word-size').onchange=e=>runCmd(chain=>chain.setFontSize(e.target.value+'pt'));
  $('word-color').oninput=e=>runCmd(chain=>chain.setColor(e.target.value));
  $('word-highlight').oninput=e=>runCmd(chain=>chain.setBackgroundColor(e.target.value));
  $('word-lineheight').onchange=e=>{
    if(state.run?.releaseLease&&state.run.editor)applyBlockLineHeight(state.run.editor,e.target.value);
  };
  $('indent-more').onclick=()=>{if(state.run?.releaseLease)adjustFirstLineIndent(editor(),12);};
  $('indent-less').onclick=()=>{if(state.run?.releaseLease)adjustFirstLineIndent(editor(),-12);};
  const actions={
    alignLeft:chain=>chain.setTextAlign('left'),
    alignCenter:chain=>chain.setTextAlign('center'),
    alignRight:chain=>chain.setTextAlign('right'),
    alignJustify:chain=>chain.setTextAlign('justify'),
    insertTable:chain=>chain.insertTable({rows:3,cols:3,withHeaderRow:true}),
    addRowAfter:chain=>chain.addRowAfter(),
    addColumnAfter:chain=>chain.addColumnAfter(),
    deleteRow:chain=>chain.deleteRow(),
    deleteColumn:chain=>chain.deleteColumn(),
    mergeOrSplit:chain=>chain.mergeOrSplit(),
    deleteTable:chain=>chain.deleteTable(),
    nestList:chain=>chain.sinkListItem('listItem'),
    unnestList:chain=>chain.liftListItem('listItem')
  };
  document.querySelectorAll('[data-word]').forEach(b=>b.onclick=()=>{
    if(actions[b.dataset.word])runCmd(actions[b.dataset.word]);
  });
  $('word-add-link').onclick=()=>{
    const e=editor();
    if(!state.run?.releaseLease||!e)return;
    if(e.state.selection.empty){show('Hãy bôi đen chữ cần gắn liên kết.','error');return;}
    try{e.chain().focus().setMark('meetingLink',{href:safeLink($('word-link-url').value)}).run();}
    catch(error){show('Liên kết không hợp lệ: '+error.message,'error');}
  };
  $('word-remove-link').onclick=()=>{
    if(state.run?.releaseLease)runCmd(chain=>chain.unsetMark('meetingLink'));
  };
  $('word-page-break').onclick=()=>{
    const editor=state.run?.editor;
    if(!state.run?.releaseLease||!editor)return;
    // Insertion after a selected link/text; never replace the user's existing
    // words or their timeSpan marks with a page-break atom.
    const after=editor.state.selection.to;
    editor.chain().focus().insertContentAt(after,{type:'meetingPageBreak'}).run();
  };
  $('word-insert-image').onclick=()=>$('word-image-file').click();
  $('word-image-file').onchange=async ev=>{
    const file=ev.target.files?.[0],run=state.run;
    try{
      if(!file||!run?.releaseLease||state.switching||transferBusy)return;
      const json=await imageNodeFromFile(file);
      if(run!==state.run)throw Error('Cuộc họp đã thay đổi');
      // Insert AFTER the current selection, not REPLACE a selected page-break
      // or another atomic node when the native file picker returns.
      const after=run.editor.state.selection.to;
      run.editor.chain().focus().insertContentAt(after,json).run();
      show('Đã chèn ảnh nhỏ vào ghi chú. Ảnh được lưu trong tài liệu và bản sao lưu.');
    }catch(error){show('Không chèn được ảnh: '+error.message,'error');}
    finally{$('word-image-file').value='';}
  };
  $('open-find').onclick=()=>openFind(false);
  $('find-close').onclick=closeFind;
  $('find-query').oninput=e=>{
    editor()?.commands.setSearchTerm(e.target.value);
    requestAnimationFrame(updateFindCount);
  };
  $('find-replacement').oninput=e=>editor()?.commands.setReplaceTerm(e.target.value);
  $('find-prev').onclick=()=>{editor()?.commands.goToPreviousResult();updateFindCount();};
  $('find-next').onclick=()=>{editor()?.commands.goToNextResult();updateFindCount();};
  $('find-replace').onclick=()=>runFindReplacement(false);
  $('find-replace-all').onclick=()=>runFindReplacement(true);
  $('find-query').onkeydown=e=>{
    if(e.key==='Enter'){e.preventDefault();editor()?.commands.goToNextResult();updateFindCount();}
    if(e.key==='Escape'){e.preventDefault();closeFind();}
  };
}


async function importAudioSelectedFile(file){
  const run=state.run;
  if(!file||!run?.releaseLease||transferBusy||state.switching)return;
  const active=run.capture;
  if(run.recordingFinalization||
     active&&['starting','capturing','paused','stopping'].includes(active.state)){
    show('Kết thúc thu âm trước khi nhập bản ghi có sẵn.','error');return;
  }
  const recordingId='rec-import-'+crypto.randomUUID();
  const controller=new AbortController();
  transferBusy=true;importController=controller;
  $('import-cancel').style.display='block';
  $('import-audio-status').textContent='Đang chuẩn bị nhập file âm thanh vào OPFS…';
  setRecordingUI();syncControls();
  let linked=false;
  try{
    await run.queue.drain();
    clearLoop(true);
    await timelineUI?.settle();
    await player.closeReader();
    const result=await importAudioFile(file,{recordingId,signal:controller.signal,
      onProgress:({frames,totalFrames})=>{
        $('import-audio-status').textContent='Đang nhập bản ghi âm: '+
          Math.floor(frames*100/totalFrames)+'% (đã xác nhận trên OPFS)';
      }});
    if(controller.signal.aborted||state.run!==run)throw Error('Đã hủy hoặc chuyển cuộc họp');
    run.meeting=await state.store.addRecording(run.meetingId,recordingId,state.lease);
    linked=true; // Never roll back a WAV after its meeting reference committed.
    run.tracker.allowed.add(recordingId);
    run.queue.edit();
    await run.queue.drain();
    await timelineUI?.refresh(run);
    refreshStorageHealth().catch(()=>{});
    $('import-audio-status').textContent='Đã nhập '+(result.durationMs/60000).toFixed(1)+
      ' phút vào cuộc họp. Nhấn Phát rồi gõ để ghi chú tự gắn mốc theo vị trí nghe.';
    show('Đã lưu bản ghi có sẵn thành phiên âm thanh mới, không đụng dữ liệu cũ.');
  }catch(error){
    if(!linked){
      try{await removeUnlinkedImportedAudio(recordingId);}
      catch(cleanup){show('Không dọn được file nhập dở: '+cleanup.message,'error');}
    }
    $('import-audio-status').textContent='Nhập âm thanh thất bại: '+error.message;
    show('Không nhập được âm thanh: '+error.message,'error');
  }finally{
    importController=null;transferBusy=false;
    $('import-cancel').style.display='none';
    $('audio-file').value='';
    setRecordingUI();syncControls();
  }
}

async function importWordFile(file){
  const run=state.run;
  if(!file||!run?.releaseLease||state.switching||transferBusy)return;
  if(run.recordingFinalization || run.capture&&
     ['starting','capturing','paused','stopping'].includes(run.capture.state)){
    show('Hãy kết thúc ghi âm và lưu đầy đủ trước khi chèn tài liệu Word.','error');return;
  }
  try{
    await run.queue.drain();
    const {html,warnings}=await importSafeDOCX(file);
    if(state.run!==run)return;
    // Sanitized Word content contains no data-time-* attributes. Append it as
    // new unlinked paragraphs, never change original note or audio provenance.
    const end=run.editor.state.doc.content.size;
    run.editor.chain().focus().insertContentAt(end,html).run();
    show('Đã chèn nội dung Word (không gắn nguồn âm thanh giả).'+
      (warnings.length?' Một số định dạng có thể chưa chuyển đủ.':''));
  }catch(error){show('Không nhập được Word: '+error.message,'error');}
  finally{$('word-file').value='';}
}

function syncPlaybackControls(changed='initial'){
  const focus=$('focus-duration'),rate=$('play-rate');
  const pitch=$('pitch-preserve'),skip=$('silence-skip');
  const {settings,notice}=reconcilePlaybackOptions({
    focusMs:Number(focus.value),rate:Number(rate.value),
    preservePitch:pitch.checked,skipSilence:skip.checked
  },changed);
  focus.value=String(settings.focusMs);
  pitch.checked=settings.preservePitch;
  skip.checked=settings.skipSilence;
  const status=$('playback-mode-status');
  const summary=skip.checked?'Bỏ qua im lặng theo cửa sổ '+(settings.focusMs/1000)+' giây, không thay đổi âm thanh gốc.':
    pitch.checked&&settings.rate!==1?'Giữ cao độ khi nghe chậm trong cửa sổ đã chọn.':
    'Nghe Liên tục dùng đường phát gốc; xử lý nâng cao có giới hạn thời lượng.';
  if(status)status.textContent=(notice?notice+' ':'')+summary;
  return settings;
}

function wire(){
  wireWordTools();
  for(const [id,kind] of [['silence-skip','silence'],['pitch-preserve','pitch'],
    ['focus-duration','focus'],['play-rate','rate']])
    $(id).addEventListener('change',()=>syncPlaybackControls(kind));
  syncPlaybackControls();
  $('meeting-search').oninput=e=>{
    meetingSearchTerm=e.target.value.trim();
    meetingSearchIds=null;
    ++meetingSearchGeneration;
    clearTimeout(meetingSearchTimer);
    if(!meetingSearchTerm){
      meetingSearchIds=null;renderMeetings();$('meeting-search-status').textContent='';
    }else meetingSearchTimer=setTimeout(()=>runMeetingSearch().catch(
      err=>show('Lỗi tìm kiếm: '+err.message,'error')),250);
  };
  $('new-meeting').onclick=createMeeting;
  $('meeting-title-save').onclick=()=>saveTitle();
  $('meeting-title-cancel').onclick=hideTitleEditor;
  $('meeting-title').addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();saveTitle();}
    else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();hideTitleEditor();}
  });
  $('mic-test').onclick=toggleMicProbe;
  $('retry-local-recording').onclick=()=>{
    const r=state.run?.meeting?.recordingIds?.at(-1);
    if(r)saveWavInRecording(r);
  };
  $('rec-start').onclick=startRecording;
  $('rec-pause').onclick=pauseRecording;
  $('rec-stop').onclick=stopRecording;
  $('play-stop').onclick=()=>{
    loopPoints.active=false;loopVersion++;refreshLoopUI();
    player.stop();show('Đã dừng phát lại.');
  };
  const placeAB=key=>{
    const ms=timelineUI?.selectedMs;
    const at=timelineUI?.model&&Number.isSafeInteger(ms)?
      jumpMeetingPosition(timelineUI.model,ms,0):null;
    if(at?.status!=='valid'){show('Hãy chọn một vị trí có âm thanh trên thanh tua.','error');return;}
    loopPoints[key]=ms;loopPoints.range=null;loopPoints.active=false;loopVersion++;
    refreshLoopUI();
  };
  $('loop-set-a').onclick=()=>placeAB('a');
  $('loop-set-b').onclick=()=>placeAB('b');
  $('loop-clear').onclick=()=>clearLoop(true);
  $('export-clip').onclick=async()=>{
    if(transferBusy||state.switching||state.run?.capture&&
       ['capturing','paused','starting','stopping'].includes(state.run.capture.state)){
      show('Hãy kết thúc ghi âm và thao tác nhập trước khi xuất WAV.','error');return;
    }
    try{
      const range=makeSafeLoop(timelineUI?.model,loopPoints.a,loopPoints.b);
      loopPoints.active=false;loopVersion++;refreshLoopUI();
      await timelineUI?.settle();
      await player.closeReader();
      const result=await exportVerifiedWavClip(range.recordingId,range.startMs,range.endMs);
      download('bien-ban-hop-doan-'+Math.round(range.absoluteStart)+'-'+
        Math.round(range.absoluteEnd)+'.wav',result.blob,'audio/wav');
      show('Đã xuất '+(result.durationMs/1000).toFixed(1)+' giây WAV. File ghi âm gốc không đổi.');
    }catch(e){show('Không xuất được WAV A–B: '+e.message,'error');}
  };
  $('loop-play').onclick=async()=>{
    try{
      const range=makeSafeLoop(timelineUI?.model,loopPoints.a,loopPoints.b);
      loopVersion++;loopPoints.range=range;loopPoints.active=true;refreshLoopUI();
      const result=await player.start(range.recordingId,range.startMs,{
        preRollMs:0,rate:Number($('play-rate').value),preservePitch:$('pitch-preserve').checked,skipSilence:$('silence-skip').checked,rnnoise:$('rnnoise-toggle').checked,maxDurationMs:range.durationMs});
      if(result.status!=='valid'){loopPoints.active=false;refreshLoopUI();}
    }catch(e){loopPoints.active=false;refreshLoopUI();show('Lặp A–B: '+e.message,'error');}
  };
  const skip=async delta=>{
    const current=timelineUI?.selectedMs;
    const at=jumpMeetingPosition(timelineUI?.model,current,delta);
    if(at.status!=='valid'){show(at.reason??'Không thể tua qua đoạn thiếu âm thanh.','error');return;}
    loopPoints.active=false;loopVersion++;refreshLoopUI();
    await timelineUI.seek(at.absoluteMs);
  };
  $('skip-back').onclick=()=>skip(-10000).catch(e=>show(e.message,'error'));
  $('skip-forward').onclick=()=>skip(10000).catch(e=>show(e.message,'error'));
  $('voice-filter').onchange=e=>{
    try{player.setVoiceMode(e.target.value);}catch(error){show(error.message,'error');}
  };
  $('refresh-storage').onclick=()=>refreshStorageHealth();
  $('bookmark-toggle').onclick=()=>{
    const run=state.run;
    if(!run?.releaseLease||!run.editor)return;
    if(run.editor.state.selection.empty){
      show('Hãy bôi đen chữ có mốc âm thanh để đánh dấu quan trọng.','error');return;
    }
    const checked=readAnchorAtCursor(run.editor.state,run.tracker.allowed);
    if(checked.status!=='linked'){
      show('Vùng chọn phải có cùng một mốc âm thanh hợp lệ.','error');return;
    }
    run.editor.chain().focus().toggleMark('important').run();
  };
  $('import-audio').onclick=()=>$('audio-file').click();
  $('audio-file').onchange=e=>importAudioSelectedFile(e.target.files?.[0]);
  $('import-word').onclick=()=>$('word-file').click();
  $('word-file').onchange=e=>importWordFile(e.target.files?.[0]);
  $('page-margin-preset').onchange=e=>{
    const style=$('print-page-margins');
    if(style)style.textContent=printPageRule(e.target.value);
  };
  const pageStyle=document.createElement('style');
  pageStyle.id='print-page-margins';
  pageStyle.textContent=printPageRule($('page-margin-preset').value);
  document.head.append(pageStyle);
  $('print-document').onclick=()=>window.print();
  $('backup').onclick=backup;
  $('import-backup').onclick=()=>$('import-file').click();
  $('verify-backup').onclick=()=>$('verify-backup-file').click();
  $('verify-backup-file').onchange=e=>verifyBackupFile(e.target.files?.[0]);
  $('import-file').onchange=event=>importSelectedFile(event.target.files?.[0]);
  $('import-cancel').onclick=()=>importController?.abort();
  document.querySelectorAll('[data-export]').forEach(b=>b.onclick=()=>exportText(b.dataset.export));
  const editorCommands={
    bold:'toggleBold',italic:'toggleItalic',underline:'toggleUnderline',
    strike:'toggleStrike',bulletList:'toggleBulletList',
    orderedList:'toggleOrderedList',undo:'undo',redo:'redo'
  };
  document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{
    const cmd=editorCommands[b.dataset.action],editor=state.run?.editor;
    if(editor&&state.run.releaseLease&&typeof editor.chain().focus()[cmd]==='function')
      editor.chain().focus()[cmd]().run();
  });
  $('editor').addEventListener('click',e=>{
    const element=e.target.closest?.('[data-time-anchor-id]'),run=state.run;
    if(!element||!run?.editor)return;
    const verified=verifiedClickedAnchor(run.editor.state.doc,element.getAttribute('data-time-anchor-id'),
      run.tracker.allowed,run.tracker.pendingLinks);
    if(!verified){show('Không xác minh được nguồn âm thanh của đoạn chữ này.','error');return;}
    listenAtCursor(verified);
  });
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&!e.altKey&&['f','h'].includes(e.key.toLowerCase())){
      e.preventDefault();openFind(e.key.toLowerCase()==='h');return;
    }
    if(e.altKey&&e.key==='Enter'){e.preventDefault();listenAtCursor();}
    if(e.altKey&&e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.isComposing &&
        (e.key==='ArrowLeft'||e.key==='ArrowRight')){
      e.preventDefault();
      (e.key==='ArrowLeft'?$('skip-back'):$('skip-forward')).click();
    }
    if(e.key==='Escape')player.stop();
  });
  window.addEventListener('beforeunload',e=>{
    if(state.run?.queue?.generation!==state.run?.queue?.durableGeneration ||
       state.run?.capture&&['starting','capturing','paused','stopping'].includes(state.run.capture.state)){
      e.preventDefault();e.returnValue='';
    }
  });
  secondsTimer=setInterval(()=>{
    const c=state.run?.capture;
    if(c&&['capturing','paused'].includes(c.state)&&c.rate){
      const info=c.mapper?.summary(),sample=info?.mappingPoints?.at(-1)?.sampleIndex??0;
      $('rec-clock').textContent=timing(sample*1000/c.rate);
    }
  },1000);
}
async function registerPwa(){
  const button=$('update-app');
  if(!import.meta.env.PROD || !('serviceWorker' in navigator) || !isSecureContext)return;
  try{
    const scope=new URL('./',document.baseURI),registration=await navigator.serviceWorker.register(new URL('./sw.js',scope),{scope:scope.pathname});
    button.disabled=false;
    button.onclick=async()=>{
      await registration.update();
      if(!registration.waiting){show('Chưa có bản PWA mới đang chờ kích hoạt.');return;}
      const channel=new MessageChannel(),answer=new Promise(resolve=>channel.port1.onmessage=e=>resolve(e.data));
      registration.waiting.postMessage({type:'REQUEST_SAFE_ACTIVATION'},[channel.port2]);
      const result=await Promise.race([answer,new Promise(resolve=>setTimeout(()=>resolve({accepted:false,reason:'Timeout'}),7000))]);
      if(result.accepted)show('Đã cho phép phiên bản mới kích hoạt an toàn. Tự tải lại sau khi kết thúc công việc.');
      else show('Chưa thể cập nhật: '+result.reason,'error');
      channel.port1.close();
    };
  }catch(e){show('PWA chưa sẵn sàng: '+e.message,'error');}
}
async function main(){
  timelineUI=new MeetingTimelineUI({player,getRun:()=>state.run,onError:message=>show(message,'error')});
  timelineUI.bind();
  noteFollower=new NoteAudioFollower({getRun:()=>state.run,player,root:$('editor'),
    scrollArea:document.querySelector('.paper-wrap'),status:$('note-follow-status'),toggle:$('note-follow-toggle')});
  wire();
  refreshLoopUI();
  refreshBookmarks();
  refreshStorageHealth().catch(()=>{});
  refreshMicDevices().catch(()=>{});
  navigator.mediaDevices?.addEventListener?.('devicechange',()=>refreshMicDevices().catch(()=>{}));
  localRecordingStatus().then(r=>{
    if(r.available)$('recording-path').textContent='Sẵn sàng: tự lưu WAV vào app/Recording khi Kết thúc ghi.';
    else $('recording-path').textContent='Tự lưu WAV trong OPFS. '+r.reason+'.';
  }).catch(()=>{});
  registerPwa().catch(()=>{});
  try{
    state.store=await MeetingStore.open();
    await refreshMeetings();
    if(!state.meetings.length){const meeting=await state.store.create('Cuộc họp đầu tiên');await refreshMeetings();await openMeeting(meeting.meetingId);}
    else await openMeeting(state.meetings[0].meetingId);
  }catch(e){show('Không khởi tạo được dữ liệu trình duyệt: '+e.message,'error');}
}
main();
