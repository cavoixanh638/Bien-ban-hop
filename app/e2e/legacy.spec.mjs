import {test,expect} from '@playwright/test';
import {exportMochop} from '../../poc/07-backup/mochop-web.mjs';
import {wavHeader} from '../../poc/03-opfs/core.mjs';

async function makeV1({corruptWav=false}={}){
  const id='rec-legacy-session-000001',frames=4800,header=wavHeader(frames*4,48000,1);
  const pcm=new Float32Array(frames);
  for(let i=0;i<frames;i++)pcm[i]=Math.sin(i*2*Math.PI*440/48000)*0.2;
  const wav=new Uint8Array(44+frames*4);wav.set(header);
  wav.set(new Uint8Array(pcm.buffer),44);
  if(corruptWav)wav[0]=0;
  const mark={type:'timeSpan',attrs:{anchorId:'legacy-1',recordingId:id,audioOffsetMs:50,
    typedAt:1794740000000,source:'live_recording',schemaVersion:1}};
  const meeting={meetingId:'legacy-meeting-01',title:'Biên bản máy tính cũ',noteDocumentId:'legacy-note',
    recordingIds:[id],schemaVersion:1};
  const note={noteDocumentId:'legacy-note',revision:3,schemaVersion:1,content:{
    type:'doc',content:[{type:'paragraph',content:[{type:'text',
      text:'Nội dung biên bản cũ đã xuất',marks:[mark]}]}]}};
  const audio={recordingId:id,sampleRate:48000,mappingPoints:[],
    segments:[{segmentId:'seg-0',filePath:'audio/'+id+'/seg-0.wav',mediaStartMs:0,
      mediaDurationMs:100,sampleStart:0,sampleCount:frames,completionState:'complete'}],
    intervals:[{kind:'recorded',meetingStartMs:0,meetingEndMs:100,mediaStartMs:0,
      mediaEndMs:100,segmentRefs:['seg-0']}]};
  const pieces=[],sink=new WritableStream({write:b=>pieces.push(new Uint8Array(b))});
  await exportMochop({meeting,note,audio,openAudio:async()=>new Blob([wav]).stream()},sink);
  return Buffer.from(await new Blob(pieces).arrayBuffer());
}
test('G10 legacy v1: import old archive into fresh browser profile and play the original timeSpan',async({page})=>{
  test.slow();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const oldFile=await makeV1();
  await page.goto('/');
  await expect(page.locator('.tiptap')).toBeVisible();
  await page.locator('#import-file').setInputFiles({name:'ban-xuat-cu.mochop',
    mimeType:'application/zip',buffer:oldFile});
  await expect(page.locator('#transfer-status')).toContainText('Đã khôi phục 1 phiên',{timeout:45000});
  await expect(page.locator('#transfer-status')).toContainText('file v1');
  await expect(page.locator('#meeting-title')).toHaveValue(/Biên bản máy tính cũ/);
  await expect(page.locator('.tiptap')).toContainText('Nội dung biên bản cũ đã xuất');
  const anchor=page.locator('.tiptap [data-time-recording-id]').first();
  await expect(anchor).toBeVisible();
  await anchor.click();
  await expect(page.locator('#anchor-status')).toContainText(/Đang phát từ|Đã phát hết đoạn/,{timeout:15000});
  await page.reload();
  await expect(page.locator('.tiptap')).toContainText('Nội dung biên bản cũ đã xuất');
  expect(errors).toEqual([]);
});
test('G10 legacy v1: valid ZIP with invalid WAV header fails before publishing a meeting',async({page})=>{
  const corrupted=await makeV1({corruptWav:true});
  await page.goto('/');
  await expect(page.locator('.tiptap')).toBeVisible();
  const before=await page.locator('#meeting-list .meeting').count();
  await page.locator('#import-file').setInputFiles({name:'v1-hong.mochop',
    mimeType:'application/zip',buffer:corrupted});
  await expect(page.locator('#transfer-status')).toContainText('Không thể khôi phục gói',{timeout:40000});
  await expect(page.locator('#meeting-list .meeting')).toHaveCount(before);
});
