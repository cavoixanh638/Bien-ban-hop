import './style.css';
import {Editor} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {InputTracker,TimeSpan,createTrackingExtension,readAnchorAtCursor} from '../../poc/01-editor/src/tracker.mjs';
import {MeetingLease} from '../../poc/09-pwa/lease.js';
import {MeetingStore,SaveQueue} from './meeting-store.mjs';
import {verifiedClickedAnchor} from './anchor-bridge.mjs';
import {CaptureSession,AudioPlayer,AudioRPC} from './audio.mjs';
import {MicProbe} from './mic-probe.mjs';
import {mirrorRecordingToLocalFolder,localRecordingStatus} from './recording-mirror.mjs';
import {exportDOCX,exportTXT,exportMarkdown,exportCSV,mime} from '../../poc/08-export/exporter.mjs';
import {exportMochopV2,importMochopV2} from './portable-archive.mjs';
import {loadPortableSource,createBrowserImportRepo} from './portable-storage.mjs';

const $=id=>document.getElementById(id),state={store:null,run:null,lease:new MeetingLease(),switching:false};
const player=new AudioPlayer((type,detail)=>{
  if(type==='unavailable')show('Không phát được: '+(detail.reason??detail.status),'error');
  if(type==='error')show('Lỗi phát: '+detail.message,'error');
  if(type==='preroll-limited')$('anchor-status').textContent='Đã rút ngắn phần nghe lùi đến đầu vùng âm thanh có thật.';
  if(type==='underrun')$('technical-status').textContent='Bộ phát đang thiếu đệm; chưa chứng minh nối mẫu không ngắt.';
  if(type==='playing')$('anchor-status').textContent='Đang phát từ '+(detail.offsetMs/1000).toFixed(2)+' giây · '+detail.recordingId+(detail.preRollLimited?' · nghe lùi đã rút ngắn':'');
  if(type==='ended')$('anchor-status').textContent='Đã phát hết đoạn âm thanh có dữ liệu. Nhấp chữ để nghe lại.';
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
  const recording=rec?.state==='capturing',paused=rec?.state==='paused';
  $('rec-start').disabled=!run?.releaseLease||!!active||state.switching;
  $('rec-pause').disabled=!recording&&!paused;
  $('rec-pause').textContent=paused?'Tiếp tục':'Tạm dừng';
  $('rec-stop').disabled=!active||rec?.state==='stopping';
  $('backup').disabled=!!active||!run?.releaseLease||state.switching||transferBusy;
  $('import-backup').disabled=!!active||state.switching||transferBusy;
  $('mic-test').disabled=!!active;
  $('mic-device').disabled=!!active||micProbe.state!=='idle';
  $('retry-local-recording').disabled=!!active||localRecordingBusy||!run?.meeting.recordingIds?.length||state.switching;
  $('rec-light').className='rec-light'+(recording?' active':paused?' paused':'');
  $('rec-label').textContent=recording?'Đang ghi âm':paused?'Đã tạm dừng':rec?.state==='starting'?'Đang xin quyền micro':
    rec?.state==='stopping'?'Đang lưu âm thanh':rec?.state==='failed'?'Ghi âm có lỗi':'Chưa ghi âm';
  $('writer-status').textContent=run?.releaseLease?'Có quyền chỉnh sửa':'Chỉ xem / đang có tab khác';
}
function renderMeetings(){
  const run=state.run,root=$('meeting-list');root.replaceChildren();
  for(const meeting of state.meetings??[]){
    const button=document.createElement('button');
    button.className='meeting'+(meeting.meetingId===run?.meeting.meetingId?' active':'');
    const heading=document.createElement('strong');heading.textContent=meeting.title;
    const small=document.createElement('small');small.textContent=new Date(meeting.updatedAt??meeting.createdAt).toLocaleDateString('vi-VN');
    button.append(heading,small);button.onclick=()=>openMeeting(meeting.meetingId);
    root.append(button);
  }
}
async function refreshMeetings(){state.meetings=await state.store.list();renderMeetings();}
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
  document.querySelectorAll('[data-action]').forEach(b=>{b.disabled=!run?.releaseLease;});
}
async function safelyCloseCurrent(){
  const run=state.run;if(!run)return;
  if(run.capture&&['starting','capturing','paused','stopping'].includes(run.capture.state)){
    throw Error('Hãy kết thúc ghi âm trước khi chuyển cuộc họp');
  }
  if(run.releaseLease)await run.queue.close(); // Throws if dirty/error. Do not release/clear unsaved note.
  await player.closeReader();
  run.editor.destroy();
  if(run.releaseLease)await run.releaseLease();
  state.run=null;
}
async function openMeeting(meetingId){
  if(state.switching||state.run?.meeting.meetingId===meetingId)return;
  state.switching=true;syncControls();
  try{
    await safelyCloseCurrent();
    const loaded=await state.store.load(meetingId),releaseLease=await state.lease.acquire(meetingId);
    const run={...loaded,releaseLease,meetingId,revision:loaded.note.revision,capture:null,editor:null,queue:null};
    state.run=run;
    $('meeting-title').value=run.meeting.title;
    const tracker=new InputTracker({meetingId,recordingIds:run.meeting.recordingIds??[],
      getAudioContext:mono=>run.capture?.getEditorContext(mono)??{source:'unlinked',coverage:'unlinked'}});
    run.tracker=tracker;
    const queue=new SaveQueue(async()=>{
      if(!run.releaseLease)throw Error('Không có quyền ghi');
      run.revision=await state.store.save(meetingId,run.editor.getJSON(),tracker.exportPendingState(),run.revision,state.lease);
    },(phase,error)=>{
      if(phase==='saved')status('save-status','Đã lưu • r'+run.revision);
      else if(phase==='saving')status('save-status','Đang lưu…');
      else if(phase==='dirty')status('save-status','Chưa lưu');
      else status('save-status','Lỗi lưu: '+(error?.message??'không rõ'),true);
    });
    run.queue=queue;
    run.editor=new Editor({
      element:$('editor'),extensions:[StarterKit,TimeSpan,createTrackingExtension(tracker)],
      // Native browser spellcheck/grammar overlays are too distracting while taking notes.
      // This does not alter text, timeSpan marks, cursor behavior or audio linking.
      editorProps:{attributes:{
        spellcheck:'false',autocorrect:'off',autocapitalize:'off',
        'data-gramm':'false','data-gramm_editor':'false','data-enable-grammarly':'false'
      }},
      content:run.note.content,editable:!!releaseLease,autofocus:false,
      onUpdate:()=>{queue.edit();requestAnimationFrame(updateAnchor);},
      onSelectionUpdate:()=>requestAnimationFrame(updateAnchor)
    });
    if(run.pendingState)tracker.restorePendingState(run.pendingState,run.editor.state.doc);
    status('save-status','Đã lưu • r'+run.revision);
    if(!releaseLease)show('Cuộc họp đang được một tab khác chỉnh sửa. Tab này chỉ có quyền xem.','error');
    await refreshMeetings();
    updateAnchor();
  }catch(error){show('Không mở được cuộc họp: '+error.message,'error');}
  finally{state.switching=false;syncControls();}
}
async function createMeeting(){
  if(state.switching)return;
  const title='Cuộc họp mới '+new Date().toLocaleDateString('vi-VN');
  try{
    const meeting=await state.store.create(title);
    await refreshMeetings();
    await openMeeting(meeting.meetingId);
    $('meeting-title').focus();$('meeting-title').select();
  }catch(e){show('Không tạo được cuộc họp: '+e.message,'error');}
}
async function saveTitle(){
  const run=state.run;if(!run?.releaseLease)return;
  const title=$('meeting-title').value.trim();
  if(!title){$('meeting-title').value=run.meeting.title;return;}
  if(title===run.meeting.title)return;
  try{run.meeting=await state.store.notes.renameMeeting(run.meetingId,title);await refreshMeetings();}
  catch(e){show('Lỗi đổi tên: '+e.message,'error');$('meeting-title').value=run.meeting.title;}
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
  const run=state.run;if(!run?.releaseLease||run.capture&&['starting','capturing','paused','stopping'].includes(run.capture.state))return;
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
  const run=state.run,rec=run?.capture;if(!rec)return;
  $('rec-stop').disabled=true;
  try{
    const result=await rec.stop();
    const finalized=run.tracker.finalizePendingLinks(entry=>rec.pendingResolver(entry));
    if(finalized.applied)run.queue.edit();
    await run.queue.drain();
    $('technical-status').textContent='Đã chốt bản ghi '+rec.recordingId+
      '\nPCM đã commit: '+result.samples?.toLocaleString('vi-VN')+' frame.'+
      (result.permissionPendingCleanup?'\nQuyền micro vẫn đang chờ hệ điều hành.':'');
    show('Đã dừng; bản lưu OPFS đã được xác nhận.');
    await saveWavInRecording(rec.recordingId);
  }catch(e){show('Dừng ghi/lưu chưa hoàn tất: '+e.message,'error');}
  finally{setRecordingUI();}
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
    const result=await player.start(anchor.recordingId,anchor.audioOffsetMs,
      {preRollMs:Number($('preroll').value),rate:Number($('play-rate').value)});
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
    const data={title:run.meeting.title,document:run.editor.getJSON(),includeTimestamps:$('include-time').checked};
    const fns={docx:exportDOCX,txt:exportTXT,md:exportMarkdown,csv:exportCSV};
    const result=fns[format](data);
    download('moc-hop-'+run.meetingId+'.'+format,result,mime[format]);
    show('Đã tạo tệp '+format.toUpperCase()+'. Không thay thế bản sao lưu có audio.');
  }catch(e){show('Lỗi xuất tệp: '+e.message,'error');}
}
async function backup(){
  const run=state.run;
  if(!run?.releaseLease||transferBusy||state.switching)return;
  if(run.capture&&['starting','capturing','paused','stopping'].includes(run.capture.state)){
    show('Kết thúc và chốt dữ liệu âm thanh trước khi xuất gói.','error');return;
  }
  if(!window.showSaveFilePicker){
    show('Trình duyệt cần hỗ trợ hộp thoại lưu file theo luồng (Chrome/Edge).','error');return;
  }
  let writable=null,editorWasEnabled=run.editor?.isEditable??false;
  try{
    // File picker MUST be opened in this direct click gesture.
    const handle=await window.showSaveFilePicker({suggestedName:'moc-hop-'+run.meetingId+'.mochop',
      types:[{description:'Gói dữ liệu Mốc Họp',accept:{'application/zip':['.mochop']}}]});
    transferBusy=true;state.switching=true;
    run.editor?.setEditable(false);
    setRecordingUI();syncControls();
    $('transfer-status').textContent='Đang chốt nội dung ghi chú trước khi xuất…';
    await run.queue.drain();
    const source=await loadPortableSource(state.store,run.meetingId);
    let lastProgress=0;
    writable=await handle.createWritable();
    const sink=new WritableStream({
      write:bytes=>writable.write(bytes),close:()=>writable.close(),abort:error=>writable.abort(error)
    });
    const result=await exportMochopV2(source,sink,{onProgress:pos=>{
      if(pos-lastProgress>5*1024*1024){lastProgress=pos;
        $('transfer-status').textContent='Đang xuất '+(pos/1048576).toFixed(1)+' MB…';}
    }});
    writable=null;
    $('transfer-status').textContent='Đã xuất '+source.meeting.recordingIds.length+
      ' phiên ghi, '+result.archive.entries+' mục trong gói .mochop ('+
      (result.archive.size/1048576).toFixed(1)+' MB).';
    show('Đã sao lưu toàn bộ cuộc họp và các phiên ghi âm vào file .mochop.');
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
}
async function importSelectedFile(file){
  if(!file||transferBusy)return;
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
    const repo=createBrowserImportRepo(state.store);
    imported=await importMochopV2(file,repo,{signal:controller.signal,
      onProgress:displayImportProgress});
    $('transfer-status').textContent='Đã khôi phục '+imported.recordings+
      ' phiên ghi âm và biên bản với mã cuộc họp mới. Không ghi đè dữ liệu cũ.';
    await refreshMeetings();
    if(state.run?.capture&&['starting','capturing','paused','stopping'].includes(state.run.capture.state))
      throw Error('Không thể chuyển khi đang ghi âm');
    await openMeeting(imported.meetingId);
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
function wire(){
  $('new-meeting').onclick=createMeeting;
  $('meeting-title').addEventListener('blur',saveTitle);
  $('meeting-title').addEventListener('keydown',e=>{if(e.key==='Enter'){$('meeting-title').blur();e.preventDefault();}});
  $('mic-test').onclick=toggleMicProbe;
  $('retry-local-recording').onclick=()=>{
    const r=state.run?.meeting?.recordingIds?.at(-1);
    if(r)saveWavInRecording(r);
  };
  $('rec-start').onclick=startRecording;
  $('rec-pause').onclick=pauseRecording;
  $('rec-stop').onclick=stopRecording;
  $('play-stop').onclick=()=>{player.stop();show('Đã dừng phát lại.');};
  $('backup').onclick=backup;
  $('import-backup').onclick=()=>$('import-file').click();
  $('import-file').onchange=event=>importSelectedFile(event.target.files?.[0]);
  $('import-cancel').onclick=()=>importController?.abort();
  document.querySelectorAll('[data-export]').forEach(b=>b.onclick=()=>exportText(b.dataset.export));
  document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{
    const cmd=b.dataset.action,editor=state.run?.editor;
    if(editor&&state.run.releaseLease)editor.chain().focus()[cmd]().run();
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
    if(e.altKey&&e.key==='Enter'){e.preventDefault();listenAtCursor();}
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
  wire();
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
