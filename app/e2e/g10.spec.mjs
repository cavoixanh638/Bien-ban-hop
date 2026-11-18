import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

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
  await expect(page.locator('#timeline-seek')).toBeDisabled();
  const editor=page.locator('.tiptap');
  await editor.click();
  await page.keyboard.type('Mốc thử ghi âm trong lúc soạn biên bản.');
  await expect(editor).toContainText('Mốc thử');
  await expect(page.locator('.paper .note-capture-pointer')).toBeVisible();
  await expect(page.locator('#note-follow-status')).toContainText('Đang ghi');
  // The G03 journal flush schedule is 5 s. This is a short synthetic integration test,
  // NOT evidence for 3-hour recording or native Windows IME.
  await page.waitForTimeout(7000);
  await page.locator('#rec-stop').click();
  await expect(page.locator('#rec-label')).toHaveText('Chưa ghi âm',{timeout:25000});
  await expect(page.locator('.paper .note-capture-pointer')).toBeHidden();
  await expect(page.locator('#technical-status')).toContainText('Đã chốt bản ghi',{timeout:15000});
  await expect(page.locator('#save-status')).toContainText('Đã lưu',{timeout:15000});
  await expect(page.locator('#timeline-summary')).toContainText('1 phiên',{timeout:20000});
  await expect(page.locator('#timeline-seek')).toBeEnabled();
  expect(await page.locator('#timeline-sessions button').count()).toBe(1);
  const total=Number(await page.locator('#timeline-seek').getAttribute('max'));
  expect(total).toBeGreaterThan(1000);
  const middle=Math.floor(total/2);
  await page.locator('#timeline-seek').evaluate((slider,at)=>{
    slider.value=String(at);slider.dispatchEvent(new Event('input',{bubbles:true}));
    slider.dispatchEvent(new Event('change',{bubbles:true}));
  },middle);
  await expect(page.locator('#anchor-status')).toContainText('Đang phát từ',{timeout:20000});
  await expect.poll(async()=>Number(await page.locator('#timeline-seek').inputValue()),
    {timeout:6000}).toBeGreaterThan(middle);
  await page.locator('#timeline-play').click();
  await expect(page.locator('#timeline-play')).toHaveText('▶ Phát');
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
  // The cue overlay must be derived from validated marks, not from the text
  // selection, and must not persist in note JSON after stopping.
  await expect(page.locator('.paper .note-playback-highlight-rect').first()).toBeVisible({timeout:12000});
  await expect(page.locator('#note-follow-status')).toContainText('Đang theo mốc');
  const followedId=await page.locator('.paper .note-playback-highlight-rect').first()
    .getAttribute('data-recording-id');
  expect(followedId).toBeTruthy();
  await page.locator('#play-stop').click();
  await expect(page.locator('.paper .note-playback-highlight-rect')).toHaveCount(0);
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


test('G00 UX: bright sidebar, compact document, replay options in timeline, rename in sidebar',async({page})=>{
  await page.goto('/');
  await expect(page).toHaveTitle(/Biên bản họp/);
  await expect(page.locator('.topbar')).toHaveCount(0);
  await expect(page.locator('.toolbar #save-status')).toBeVisible();
  await expect(page.locator('.toolbar #writer-status')).toContainText('Có quyền chỉnh sửa');
  await expect(page.locator('.timeline-dock #play-stop')).toBeVisible();
  await expect(page.locator('.timeline-dock #play-rate')).toHaveValue('1');
  await expect(page.locator('.timeline-dock #preroll')).toHaveValue('5000');
  await expect(page.locator('.timeline-dock #anchor-status')).toBeVisible();
  await expect(page.locator('.panel #play-rate')).toHaveCount(0);
  await expect(page.locator('.sidebar .brand strong')).toHaveText('Biên bản họp');
  await expect(page.locator('.sidebar .brand-logo')).toHaveText('B');
  await expect.poll(()=>page.locator('.sidebar').evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('gradient');
  await expect(page.locator('#meeting-title-editor')).toBeHidden();
  await page.locator('#meeting-list .meeting-edit').click();
  await expect(page.locator('#meeting-title-editor')).toBeVisible();
  await page.locator('#meeting-title').fill('Họp rà soát tiến độ tháng 11');
  await page.locator('#meeting-title').press('Enter');
  await expect(page.locator('#meeting-title-editor')).toBeHidden();
  await expect(page.locator('#meeting-list .meeting.active strong')).toHaveText('Họp rà soát tiến độ tháng 11');
  await page.reload();
  await expect(page.locator('#meeting-list .meeting.active strong')).toHaveText('Họp rà soát tiến độ tháng 11');
});

test('G00 export: TXT and portable filename use Biên bản họp product name',async({page})=>{
  await page.goto('/');
  await expect(page.locator('.tiptap')).toBeVisible();
  const downloadPromise=page.waitForEvent('download');
  await page.locator('[data-export="txt"]').click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^bien-ban-hop-.+\.txt$/);
  await page.evaluate(()=>{
    window.__pickerOptions=null;
    window.showSaveFilePicker=async options=>{
      window.__pickerOptions=options;
      throw new DOMException('User cancelled','AbortError');
    };
  });
  await page.locator('#backup').click();
  await expect.poll(()=>page.evaluate(()=>window.__pickerOptions?.suggestedName)).toMatch(/^bien-ban-hop-.+\.bbhop$/);
  await expect(page.locator('#backup')).toHaveText('Sao lưu biên bản và ghi âm');
  await expect(page.locator('#import-backup')).toHaveText('Khôi phục biên bản từ tệp');
  await expect(page.locator('#transfer-status')).not.toContainText('.mochop');
  await expect(page.locator('#import-file')).toHaveAttribute('accept','.bbhop,.mochop,application/zip');
  const picker=await page.evaluate(()=>window.__pickerOptions);
  expect(picker.types[0].accept['application/zip']).toEqual(['.bbhop']);
  expect(await page.locator('body').innerText()).not.toMatch(/\.mochop|Mốc Họp/);
  const pwaManifest=await page.evaluate(async()=>await (await fetch('./manifest.webmanifest')).json());
  expect(pwaManifest.name).toContain('Biên bản họp');
  expect(pwaManifest.short_name).toBe('Biên bản họp');
});


test('G00 Word editor: style survives autosave and old note remains editable',async({page})=>{
  await page.goto('/');
  const editor=page.locator('.tiptap');
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.type('Van ban thu nghiem Word.');
  await page.keyboard.press('ControlOrMeta+A');
  await page.locator('[data-action="underline"]').click();
  await expect(editor.locator('u')).toContainText('Van ban thu nghiem Word.');
  await page.locator('#word-menu summary').click();
  await page.locator('#word-font').selectOption('Arial');
  await page.locator('#word-size').selectOption('20');
  await page.locator('[data-word="alignCenter"]').click();
  await expect(editor.locator('p')).toHaveAttribute('style',/text-align: center/);
  await expect(page.locator('#save-status')).toContainText('Đã lưu',{timeout:15000});
  await page.reload();
  await expect(editor.locator('u')).toContainText('Van ban thu nghiem Word.');
  await expect(editor.locator('p')).toHaveAttribute('style',/text-align: center/);
  await expect(editor.locator('[style*="font-family"]')).toContainText('Van ban thu nghiem Word.');
});

test('G00 Word editor: find/replace unlinked text and create a table',async({page})=>{
  await page.goto('/');
  const editor=page.locator('.tiptap');
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.type('Kien nghi ve cong viec. Kien nghi cua thanh pho.');
  await page.locator('#open-find').click();
  await page.locator('#find-query').fill('Kien nghi');
  await expect(page.locator('#find-count')).toContainText('/ 2');
  await page.locator('#find-replacement').fill('De xuat');
  await page.locator('#find-replace-all').click();
  await expect(editor).toContainText('De xuat ve cong viec. De xuat cua thanh pho.');
  await page.locator('#find-close').click();
  await page.locator('#word-menu summary').click();
  await page.locator('[data-word="insertTable"]').click();
  await expect(editor.locator('table')).toHaveCount(1);
  await expect(editor.locator('tr')).toHaveCount(3);
  await expect(page.locator('#save-status')).toContainText('Đã lưu',{timeout:15000});
  await page.reload();
  await expect(editor.locator('table')).toHaveCount(1);
});


test('G00 offline multi-meeting search supports Vietnamese without accents',async({page})=>{
  await page.goto('/');
  await expect(page.locator('.tiptap')).toBeVisible();
  await page.locator('#new-meeting').click();
  await expect(page.locator('#meeting-title-editor')).toBeVisible();
  await page.locator('#meeting-title').fill('Họp về quy hoạch đô thị');
  await page.locator('#meeting-title').press('Enter');
  await page.locator('.tiptap').click();
  await page.keyboard.type('Noi dung ve chinh sach phat trien.');
  await expect(page.locator('#save-status')).toContainText('Đã lưu',{timeout:15000});
  await page.locator('#meeting-search').fill('quy hoach');
  await expect(page.locator('#meeting-search-status')).toContainText('1 cuộc họp',{timeout:15000});
  await expect(page.locator('#meeting-list .meeting')).toHaveCount(1);
  await expect(page.locator('#meeting-list .meeting strong')).toContainText('quy hoạch đô thị');
  await page.locator('#meeting-search').fill('');
  await expect(page.locator('#meeting-list .meeting')).toHaveCount(2);
});

test('G00 Word DOCX export produces a complete file from a table and formatted text',async({page})=>{
  await page.goto('/');
  const editor=page.locator('.tiptap');
  await editor.click();
  await page.keyboard.type('Tai lieu xuat Word.');
  await page.locator('#word-menu summary').click();
  await page.locator('[data-word="insertTable"]').click();
  await expect(editor.locator('table')).toHaveCount(1);
  const downloadPromise=page.waitForEvent('download');
  await page.locator('[data-export="docx"]').click();
  const result=await downloadPromise;
  expect(result.suggestedFilename()).toMatch(/^bien-ban-hop-.+\.docx$/);
  const file=await result.path();
  expect(file).toBeTruthy();
});


test('G00 playback presets: focused 30s and voice EQ do not modify saved note',async({page})=>{
  await page.goto('/');
  await expect(page.locator('#focus-duration')).toHaveValue('0');
  await expect(page.locator('#voice-filter')).toHaveValue('off');
  const before=await page.locator('.tiptap').innerText();
  await page.locator('#focus-duration').selectOption('30000');
  await page.locator('#voice-filter').selectOption('clear');
  await expect(page.locator('#focus-duration')).toHaveValue('30000');
  await expect(page.locator('#voice-filter')).toHaveValue('clear');
  await expect(page.locator('.tiptap')).toHaveText(before);
});


test('G00 Word import sanitizes file, appends unlinked text, native A4 print works',async({page})=>{
  await page.goto('/');
  const editor=page.locator('.tiptap');
  await editor.click();
  await page.keyboard.type('Noi dung trong Word.');
  await expect(page.locator('#save-status')).toContainText('Đã lưu',{timeout:15000});
  const downloadPromise=page.waitForEvent('download');
  await page.locator('[data-export="docx"]').click();
  const downloaded=await downloadPromise;
  const bytes=await readFile(await downloaded.path());
  await page.locator('#word-file').setInputFiles({name:'van-ban-thu.docx',
    mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:bytes});
  await expect(editor).toContainText('Noi dung trong Word.Noi dung trong Word.',{timeout:20000});
  await page.evaluate(()=>{window.__printInvoked=false;window.print=()=>{window.__printInvoked=true;};});
  await page.locator('#print-document').click();
  expect(await page.evaluate(()=>window.__printInvoked)).toBe(true);
});
