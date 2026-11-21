/** Keep the real playback UI synchronized with bounded audio capabilities.
 * Pure logic makes conflicting user choices testable without the DOM. The
 * user-visible select/checkboxes must always show the effective settings.
 */
const FOCUS_VALUES=new Set([0,15000,30000,60000]);
const FOCUS_FALLBACK_MS=30000;

export function reconcilePlaybackOptions(input,changed){
  const value={...input},notices=[];
  if(!FOCUS_VALUES.has(value.focusMs)||!Number.isFinite(value.rate)||
     value.rate<.5||value.rate>2||typeof value.skipSilence!=='boolean'||
     typeof value.preservePitch!=='boolean')
    throw Error('Tùy chọn nghe lại không hợp lệ');
  if(changed==='focus'&&value.focusMs===0){
    if(value.skipSilence){
      value.skipSilence=false;
      notices.push('Đã tắt Bỏ qua im lặng vì bạn chọn nghe Liên tục.');
    }
    if(value.preservePitch&&value.rate!==1){
      value.preservePitch=false;
      notices.push('Đã tắt Giữ cao độ vì tốc độ khác 1× không hỗ trợ nghe Liên tục.');
    }
  }else if(value.focusMs===0 &&
      (value.skipSilence || value.preservePitch&&value.rate!==1)){
    value.focusMs=FOCUS_FALLBACK_MS;
    notices.push('Đã tự chọn Nghe tập trung 30 giây để xử lý âm thanh mà không tải cả cuộc họp.');
  }
  if(value.skipSilence&&value.preservePitch&&value.rate!==1){
    if(changed==='pitch'){
      value.skipSilence=false;
      notices.push('Đã tắt Bỏ qua im lặng để Giữ cao độ ở tốc độ khác 1×.');
    }else{
      value.preservePitch=false;
      notices.push('Đã tắt Giữ cao độ để Bỏ qua im lặng ở tốc độ khác 1×.');
    }
  }
  return {settings:value,notice:notices.join(' ')};
}
