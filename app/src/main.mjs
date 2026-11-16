import './style.css';
import {Editor} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {InputTracker,TimeSpan,createTrackingExtension,readAnchorAtCursor} from '../../poc/01-editor/src/tracker.mjs';
import {MeetingLease} from '../../poc/09-pwa/lease.js';
import {MeetingStore,SaveQueue} from './meeting-store.mjs';
import {verifiedClickedAnchor} from './anchor-bridge.mjs';
import {CaptureSession,AudioPlayer,AudioRPC} from './audio.mjs';
import {exportDOCX,exportTXT,exportMarkdown,exportCSV,mime} from '../../poc/08-export/exporter.mjs';
import {exportMochop} from '../../poc/07-backup/mochop-web.mjs';

const $=id=>document.getElementById(id),state={store:null,run:null,lease:new MeetingLease(),switching:false};
const player=new AudioPlayer((type,detail)=>{
  if(type==='unavailable')show('Không phát được: '+(detail.reason??detail.status),'error');
  if(type==='error')show('Lỗi phát: '+detail.message,'error');
  if(type==='preroll-limited')show('Không có đủ âm thanh trước mốc; phát từ đúng mốc ghi chú, không bỏ qua đoạn thiếu.');
  if(type==='underrun')$('technical-status').textContent='Bộ phát đang thiếu đệm; chưa chứng minh nối mẫu không ngắt.';
  if(type==='playing')$('anchor-status').textContent='Đang phát từ '+(detail.offsetMs/1000).toFixed(2)+' giây · '+detail.recordingId;
});
let noticeTimer=0,secondsTimer=0;
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
  $('backup').disabled=!!active||!run?.meeting.recordingIds?.length||state.switching;
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
  const capture=new CaptureSession({meetingId:run.meetingId,recordingId,
    onEvent:(type,detail)=>recEvent(run,type,detail),onError:e=>show('Âm thanh: '+e.message,'error')});
  run.capture=capture;setRecordingUI();
  try{
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
    show('Đã dừng. Âm thanh chỉ được ghi là bền vững đến frame đã flush.');
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
    if(result.status!=='valid')show('Không phát được đoạn này: '+(result.reason??result.status),'error');
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
async function opfsStream(root,sourcePath){
  const parts=sourcePath.split('/');if(parts.some(p=>!p||p==='.'||p==='..'))throw Error('Đường dẫn audio không hợp lệ');
  let dir=root;for(const p of parts.slice(0,-1))dir=await dir.getDirectoryHandle(p);
  const h=await dir.getFileHandle(parts.at(-1)),file=await h.getFile();
  return file.stream();
}
async function backup(){
  const run=state.run;if(!run?.releaseLease)return;
  if(run.capture&&['starting','capturing','paused','stopping'].includes(run.capture.state)){
    show('Hãy dừng và flush ghi âm trước khi sao lưu.','error');return;
  }
  if(run.meeting.recordingIds?.length!==1){
    show('Bản tích hợp hiện chỉ sao lưu một bản ghi âm mỗi cuộc họp. Có thể xuất riêng Word/TXT.','error');return;
  }
  if(!window.showSaveFilePicker){show('Trình duyệt chưa hỗ trợ ghi tệp ZIP theo luồng. Không tự giữ ZIP nhiều GiB trong RAM.','error');return;}
  let writable=null;
  try{
    // File picker MUST be entered in direct user gesture, before other awaits.
    const handle=await window.showSaveFilePicker({suggestedName:'moc-hop-'+run.meetingId+'.mochop',
      types:[{description:'Mốc Họp backup',accept:{'application/zip':['.mochop']}}]});
    await run.queue.drain();
    const note=await state.store.notes.getNote(run.meeting.noteDocumentId);
    const id=run.meeting.recordingIds[0],reader=new AudioRPC();
    let raw;
    try{await reader.call('init',{recordingId:id,reopen:true});raw=await reader.call('manifest');}
    finally{await reader.dispose();}
    const audio={...raw,segments:raw.segments.map(s=>({...s,filePath:'audio/'+s.filePath,
      completionState:s.completionState==='checkpointed'?'complete':s.completionState}))};
    const root=await navigator.storage.getDirectory();
    writable=await handle.createWritable();
    const sink=new WritableStream({write:bytes=>writable.write(bytes),close:()=>writable.close(),abort:e=>writable.abort(e)});
    await exportMochop({meeting:run.meeting,note,audio,
      openAudio:name=>opfsStream(root,name.replace(/^audio\//,''))},sink);
    writable=null;show('Đã xuất bản sao lưu .mochop có audio và mốc thời gian.');
  }catch(e){
    if(writable)try{await writable.abort(e);}catch{}
    if(e?.name!=='AbortError')show('Không sao lưu được: '+e.message,'error');
  }
}
function wire(){
  $('new-meeting').onclick=createMeeting;
  $('meeting-title').addEventListener('blur',saveTitle);
  $('meeting-title').addEventListener('keydown',e=>{if(e.key==='Enter'){$('meeting-title').blur();e.preventDefault();}});
  $('rec-start').onclick=startRecording;
  $('rec-pause').onclick=pauseRecording;
  $('rec-stop').onclick=stopRecording;
  $('play-stop').onclick=()=>{player.stop();show('Đã dừng phát lại.');};
  $('backup').onclick=backup;
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
  registerPwa().catch(()=>{});
  try{
    state.store=await MeetingStore.open();
    await refreshMeetings();
    if(!state.meetings.length){const meeting=await state.store.create('Cuộc họp đầu tiên');await refreshMeetings();await openMeeting(meeting.meetingId);}
    else await openMeeting(state.meetings[0].meetingId);
  }catch(e){show('Không khởi tạo được dữ liệu trình duyệt: '+e.message,'error');}
}
main();
