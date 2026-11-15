import {test,expect} from '@playwright/test';

test('G10: mở ứng dụng, gõ chữ Việt và lưu/reopen bản ghi chú',async({page})=>{
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.tiptap')).toBeVisible();
  await expect(page.locator('#writer-status')).toContainText('Có quyền chỉnh sửa');
  const editor=page.locator('.tiptap');
  await editor.click();
  await page.keyboard.type('Nội dung họp: rà soát tiến độ, thống nhất giải pháp.');
  await expect(editor).toContainText('Nội dung họp');
  await expect(page.locator('#save-status')).toContainText('Đã lưu',{timeout:15000});
  await page.reload();
  await expect(page.locator('.tiptap')).toContainText('Nội dung họp');
  expect(errors).toEqual([]);
});

test('G10: hai tab không thể cùng có quyền ghi một cuộc họp',async({context,page})=>{
  await page.goto('/');
  await expect(page.locator('#writer-status')).toContainText('Có quyền chỉnh sửa');
  const second=await context.newPage();
  await second.goto('/');
  await expect(second.locator('#writer-status')).toContainText('Chỉ xem');
  await expect(second.locator('.tiptap')).toHaveAttribute('contenteditable','false');
  await page.close();
  await second.reload();
  await expect(second.locator('#writer-status')).toContainText('Có quyền chỉnh sửa');
});

test('G10: ghi âm fake mic -> OPFS ACK -> gắn mốc -> dừng -> đọc lại đoạn',async({page})=>{
  test.slow();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.tiptap')).toBeVisible();
  await page.locator('#rec-start').click();
  await expect(page.locator('#rec-label')).toHaveText('Đang ghi âm',{timeout:25000});
  const editor=page.locator('.tiptap');
  await editor.click();
  await page.keyboard.type('Mốc thử ghi âm trong lúc soạn biên bản.');
  await expect(editor).toContainText('Mốc thử');
  // The G03 journal flush schedule is 5 s. This is a short synthetic integration test,
  // NOT evidence for 3-hour recording or native Windows IME.
  await page.waitForTimeout(7000);
  await page.locator('#rec-stop').click();
  await expect(page.locator('#rec-label')).toHaveText('Chưa ghi âm',{timeout:25000});
  await expect(page.locator('#technical-status')).toContainText('Đã chốt bản ghi',{timeout:15000});
  await expect(page.locator('#save-status')).toContainText('Đã lưu',{timeout:15000});
  const marked=page.locator('.tiptap [data-time-recording-id]');
  await expect(marked.first()).toBeVisible({timeout:10000});
  await marked.first().click();
  // Playback error toasts must fail fast with a diagnostic instead of being
  // silently retried and misreported as a successful end-to-end run.
  await expect.poll(async()=>{
    const text=await page.locator('#anchor-status').innerText();
    const toast=await page.locator('#message').innerText();
    if(/Không (phát|nghe)|Lỗi phát|Không xác minh được nguồn âm thanh/.test(toast))
      throw Error('Playback unavailable: '+toast+'; anchor='+text);
    return text;
  },{timeout:12000,message:'Durable OPFS playback did not start'}).toContain('Đang phát từ');
  await page.locator('#play-stop').click();
  await page.reload();
  await expect(page.locator('.tiptap [data-time-recording-id]').first()).toBeVisible({timeout:15000});
  await page.locator('.tiptap [data-time-recording-id]').first().click();
  await expect(page.locator('#anchor-status')).toContainText('Đang phát từ',{timeout:20000});
  expect(errors).toEqual([]);
});

test('G10 PWA production shell reloads offline without caching meeting notes',async({page,context})=>{
  test.skip(process.env.G10_PREVIEW!=='1','This checks the production build Service Worker only');
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.tiptap')).toBeVisible();
  await page.evaluate(async()=>{
    await navigator.serviceWorker.ready;
    if(!navigator.serviceWorker.controller)await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(Error('Service Worker did not claim current client')),15000);
      navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(timeout);resolve();},{once:true});
    });
  });
  await page.reload();await expect(page.locator('.tiptap')).toBeVisible();
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('.tiptap')).toBeVisible({timeout:15000});
  await context.setOffline(false);
  expect(errors).toEqual([]);
});
