import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

async function recordText(page,text){
  await page.locator('#rec-start').click();
  await expect(page.locator('#rec-label')).toHaveText('Đang ghi âm',{timeout:25000});
  const editor=page.locator('.tiptap');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type(text,{delay:18});
  await expect(editor).toContainText(text);
  await expect(page.locator('.tiptap .note-capture-current')).toBeVisible();
  await page.waitForTimeout(1700);
  await page.locator('#rec-stop').click();
  await expect(page.locator('#rec-label')).toHaveText('Chưa ghi âm',{timeout:30000});
  await expect(page.locator('.tiptap .note-capture-current')).toHaveCount(0);
  await expect(page.locator('#save-status')).toContainText('Đã lưu',{timeout:18000});
}
async function exportBuffer(page){
  await page.evaluate(()=>{
    window.__fileParts=[];
    window.showSaveFilePicker=async()=>({createWritable:async()=>({
      write:async bytes=>window.__fileParts.push(new Uint8Array(bytes)),
      close:async()=>{window.__fileBlob=new Blob(window.__fileParts,{type:'application/zip'});},
      abort:async()=>{window.__fileParts=[];}
    })});
  });
  await page.locator('#backup').click();
  await expect(page.locator('#transfer-status')).toContainText('Đã xuất',{timeout:35000});
  const downloadPromise=page.waitForEvent('download');
  await page.evaluate(()=>{
    const url=URL.createObjectURL(window.__fileBlob),a=document.createElement('a');
    a.href=url;a.download='hop-day-du.mochop';document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),15000);
  });
  const download=await downloadPromise;
  return await readFile(await download.path());
}
async function importBuffer(page,bytes){
  await page.locator('#import-file').setInputFiles({name:'hop-day-du.mochop',
    mimeType:'application/zip',buffer:bytes});
}
test('G10 portable: TWO recordings travel to a separate browser profile, keep notes and both click-to-play markers',async({page,browser})=>{
  test.slow();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.tiptap')).toBeVisible();
  await recordText(page,'Nội dung tiếng Việt ở phiên ghi âm thứ nhất.');
  await recordText(page,'Kết luận ở phiên ghi âm thứ hai.');
  const sourceIds=await page.locator('.tiptap [data-time-recording-id]').evaluateAll(nodes=>
    [...new Set(nodes.map(node=>node.getAttribute('data-time-recording-id')).filter(Boolean))]);
  expect(sourceIds.length).toBe(2);
  await expect(page.locator('#timeline-summary')).toContainText('2 phiên',{timeout:20000});
  await expect(page.locator('#timeline-sessions button')).toHaveCount(2);
  const wholeDuration=Number(await page.locator('#timeline-seek').getAttribute('max'));
  expect(wholeDuration).toBeGreaterThan(2000);
  await page.locator('#timeline-sessions button').nth(1).click();
  await expect(page.locator('#anchor-status')).toContainText('Đang phát từ',{timeout:20000});
  await expect.poll(async()=>Number(await page.locator('#timeline-seek').inputValue())).toBeGreaterThan(1000);
  await page.locator('#timeline-play').click();
  const bytes=await exportBuffer(page);
  expect(bytes.byteLength).toBeGreaterThan(88000);
  // Distinct BrowserContext = a new IndexedDB/OPFS/profile, not the previous cache.
  const clean=await browser.newContext({permissions:['microphone']});
  try{
    const target=await clean.newPage(),errorsB=[];
    target.on('pageerror',e=>errorsB.push(e.message));
    await target.goto('/');
    await expect(target.locator('.tiptap')).toBeVisible();
    await importBuffer(target,bytes);
    await expect(target.locator('#transfer-status')).toContainText('Đã khôi phục 2 phiên',{timeout:60000});
    await expect(target.locator('.tiptap')).toContainText('Nội dung tiếng Việt ở phiên ghi âm thứ nhất.');
    await expect(target.locator('.tiptap')).toContainText('Kết luận ở phiên ghi âm thứ hai.');
    const restoredIds=await target.locator('.tiptap [data-time-recording-id]').evaluateAll(nodes=>
      [...new Set(nodes.map(node=>node.getAttribute('data-time-recording-id')).filter(Boolean))]);
    expect(restoredIds.length).toBe(2);
    expect(restoredIds.every(id=>!sourceIds.includes(id))).toBeTruthy();
    await expect(target.locator('#timeline-summary')).toContainText('2 phiên',{timeout:20000});
    await expect(target.locator('#timeline-sessions button')).toHaveCount(2);
    await target.locator('#timeline-sessions button').nth(1).click();
    await expect(target.locator('#anchor-status')).toContainText('Đang phát từ',{timeout:25000});
    await target.locator('#timeline-play').click();
    for(const id of restoredIds){
      const anchor=target.locator('.tiptap [data-time-recording-id="'+id+'"]').first();
      await anchor.click();
      await expect(target.locator('#anchor-status')).toContainText(/Đang phát từ|Đã phát hết đoạn/,{timeout:25000});
      await expect(target.locator('.tiptap .note-audio-current').first())
        .toHaveAttribute('data-time-recording-id',id,{timeout:12000});
      await target.locator('#play-stop').click();
      await expect(target.locator('.tiptap .note-audio-current')).toHaveCount(0);
    }
    await target.reload();
    await expect(target.locator('.tiptap [data-time-recording-id]')).not.toHaveCount(0);
    // Import the exact same archive again: must create a new meeting, not overwrite.
    const count=await target.locator('#meeting-list .meeting').count();
    await importBuffer(target,bytes);
    await expect(target.locator('#transfer-status')).toContainText('Đã khôi phục 2 phiên',{timeout:60000});
    await expect(target.locator('#meeting-list .meeting')).toHaveCount(count+1);
    expect(errorsB).toEqual([]);
  }finally{await clean.close();}
  expect(errors).toEqual([]);
});
test('G10 portable: tampered WAV is refused with no partially visible meeting',async({page})=>{
  test.slow();
  await page.goto('/');
  await recordText(page,'Nội dung kiểm thử checksum WAV.');
  const bytes=Buffer.from(await exportBuffer(page));
  const at=bytes.indexOf(Buffer.from('RIFF'));
  expect(at).toBeGreaterThan(0);
  bytes[at+88]^=1;
  const before=await page.locator('#meeting-list .meeting').count();
  await importBuffer(page,bytes);
  await expect(page.locator('#transfer-status')).toContainText('Không thể khôi phục gói',{timeout:45000});
  await expect(page.locator('#meeting-list .meeting')).toHaveCount(before);
});
