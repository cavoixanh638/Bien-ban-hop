import {test,expect} from '@playwright/test';

test('G10: mở ứng dụng, gõ chữ Việt và lưu/reopen bản ghi chú',async({page})=>{
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.tiptap')).toBeVisible();
  await expect(page.locator('#writer-status')).toContainText('Có quyền chỉnh sửa');
  const editor=page.locator('.tiptap');
  await expect(editor).toHaveAttribute('spellcheck','false');
  await expect(editor).toHaveAttribute('autocorrect','off');
  await expect(editor).toHaveAttribute('data-gramm','false');
  await expect(page.locator('#meeting-title')).toHaveAttribute('spellcheck','false');
  await editor.click();
  await page.keyboard.type('Nội dung họp: rà soát tiến độ, thống nhất giải pháp.');
  await expect(editor).toContainText('Nội dung họp');
  await expect(page.locator('#save-status')).toContainText('Đã lưu',{timeout:15000});
  await page.reload();
  await expect(page.locator('.tiptap')).toContainText('Nội dung họp');
  await expect(page.locator('.tiptap')).toHaveAttribute('spellcheck','false');
  expect(errors).toEqual([]);
});

test('G10: Times New Roman mặc định và chữ Unicode tiếng Việt còn nguyên khi mở lại',async({page})=>{
  await page.goto('/');
  const editor=page.locator('.tiptap');
  await expect(editor).toBeVisible();
  await expect.poll(()=>editor.evaluate(el=>getComputedStyle(el).fontFamily)).toContain('Times New Roman');
  const sample='Tại sao lại có những điều không nên làm vậy?';
  await editor.click();
  await page.keyboard.type(sample);
  await expect(editor).toContainText(sample);
  await expect(page.locator('#save-status')).toContainText('Đã lưu',{timeout:15000});
  await page.reload();
  await expect(page.locator('.tiptap')).toContainText(sample);
  await expect.poll(()=>page.locator('.tiptap').evaluate(el=>getComputedStyle(el).fontFamily)).toContain('Times New Roman');
  // Synthetic keyboard text is not a substitute for Windows UniKey/EVKey IME tests.
});

test('G10: microphone meter sees a deterministic non-silent PCM stream',async({page})=>{
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  // Chromium's fake microphone may be intentionally silent depending on runner.
  // Provide a 440 Hz, low-level WebAudio MediaStream to assert real PCM detection,
  // not just success of getUserMedia() permission.
  await page.goto('/');
  await page.evaluate(()=>{
    // Override only this test page's input at the exact moment the button calls it.
    window.__micOverrideCalls=0;
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{
      window.__micOverrideCalls++;
      const context=new AudioContext();
      const oscillator=context.createOscillator(),gain=context.createGain();
      const output=context.createMediaStreamDestination();
      oscillator.frequency.value=440;gain.gain.value=0.15;
      oscillator.connect(gain);gain.connect(output);
      oscillator.start();await context.resume();
      window.__micSynthetic={context,oscillator,gain,output};
      return output.stream;
    }});
  });
  await expect(page.locator('#mic-test')).toBeEnabled();
  await expect(page.locator('#mic-meter')).toBeVisible();
  await page.locator('#mic-test').click();
  await expect(page.locator('#mic-test')).toHaveText('Dừng thử micro',{timeout:10000});
  await expect(page.locator('#mic-test-status')).toContainText(/Đang nhận|đã nhận|âm thanh|tín hiệu/i);
  await expect.poll(()=>page.evaluate(()=>window.__micOverrideCalls),{timeout:3000}).toBeGreaterThan(0);
  await expect.poll(()=>page.locator('#mic-meter').getAttribute('aria-valuenow'),
    {timeout:8000}).not.toBe('0');
  await page.locator('#mic-test').click();
  await expect(page.locator('#mic-test')).toHaveText('Thử micro (15 giây)');
  await expect(page.locator('#mic-meter')).toHaveAttribute('aria-valuenow','0');
  await expect(page.locator('#mic-test-status')).toContainText('Có tín hiệu âm thanh');
  expect(pageErrors).toEqual([]);
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
  if(process.env.G10_PREVIEW!=='1'){
    await expect(page.locator('#recording-path')).toContainText('app/Recording/',{timeout:20000});
    const message=await page.locator('#technical-status').innerText();
    const recordingId=message.match(/rec-[a-z0-9-]+/i)?.[0];
    expect(recordingId).toBeTruthy();
    const local=await page.request.head('/__moc_hop_local_recording/'+recordingId+'/seg-0.wav',
      {headers:{'X-MocHop-Local':'recording-v1'}});
    expect(local.status()).toBe(200);
    expect(Number(local.headers()['x-recording-bytes'])).toBeGreaterThan(44);
  }else{
    await expect(page.locator('#recording-path')).toContainText('OPFS');
  }
  const marked=page.locator('.tiptap [data-time-recording-id]');
  await expect(marked.first()).toBeVisible({timeout:10000});
  // A timeSpan remains clickable but has no black/colored underline.
  await expect.poll(()=>marked.first().evaluate(el=>getComputedStyle(el).textDecorationLine)).toBe('none');
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
  await expect(page.locator('#anchor-status')).toContainText('Đã phát hết đoạn',{timeout:25000});
  expect(await page.locator('#message').innerText()).not.toContain('audioOffsetMs outside media');
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
