/** G00: Playback effects are independent of duration. In particular, full
 * meeting playback must never change a Continuous selection into 30s.
 * Only a verified source boundary or explicit Stop/seek can end the stream.
 */
const FOCUS_VALUES=new Set([0,15000,30000,60000]);

export function reconcilePlaybackOptions(input,changed='initial'){
  const value={...input};
  if(!FOCUS_VALUES.has(value.focusMs)||!Number.isFinite(value.rate)||
     value.rate<.5||value.rate>2||typeof value.skipSilence!=='boolean'||
     typeof value.preservePitch!=='boolean')
    throw Error('Tùy chọn nghe lại không hợp lệ');
  const mode=value.focusMs===0?'Liên tục':'Nghe tập trung '+(value.focusMs/1000)+' giây';
  const skip=value.skipSilence?'bỏ qua im lặng theo luồng':'không bỏ qua im lặng';
  const pitch=value.rate===1?'giữ cao độ tự nhiên':value.preservePitch?
    'giữ cao độ giọng khi thay đổi tốc độ':'thay đổi cao độ theo tốc độ';
  return {settings:value,
    notice:mode+' · '+skip+' · '+pitch+'. Các mốc luôn theo bản ghi gốc.'};
}
