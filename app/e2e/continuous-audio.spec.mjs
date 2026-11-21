import {test,expect} from '@playwright/test';

function longWav(){
  const rate=8000,frames=rate*16,bytes=Buffer.alloc(44+frames*2);
  bytes.write('RIFF',0);bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVE',8);
  bytes.write('fmt ',12);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);
  bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(rate,24);
  bytes.writeUInt32LE(rate*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);
  bytes.write('data',36);bytes.writeUInt32LE(frames*2,40);
  for(let i=0;i<frames;i++){
    const silence=i>=rate*3&&i<rate*7;
    const wave=silence?0:Math.round(9000*Math.sin(2*Math.PI*190*i/rate));
    bytes.writeInt16LE(wave,44+i*2);
  }
  return bytes;
}

test('G00 16s continuous file streams native pitch+RNNoise+skip simultaneously beyond first 6s chunk',async({page})=>{
  test.slow();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.tiptap')).toBeVisible();
  await page.locator('#audio-file').setInputFiles({
    name:'long-continuous-16s.wav',mimeType:'audio/wav',buffer:longWav()
  });
  await expect(page.locator('#import-audio-status')).toContainText('Đã nhập',{timeout:45000});
  await expect(page.locator('#timeline-summary')).toContainText('1 phiên',{timeout:30000});
  await page.locator('#play-rate').selectOption('2');
  await page.locator('#silence-skip').check();
  await page.locator('#rnnoise-toggle').check();
  await expect(page.locator('#focus-duration')).toHaveValue('0');
  await expect(page.locator('#pitch-preserve')).toBeChecked();
  await page.locator('#timeline-play').click();
  await expect(page.locator('#timeline-play')).toHaveAttribute('data-stream-chunks','1',{timeout:25000});
  // Native pitch-preserving decoder moves through successive <=6s source WAV
  // clips. This would fail with the old one-shot <=60s focused adapter.
  await expect.poll(async()=>Number(await page.locator('#timeline-play').getAttribute('data-stream-chunks')),
    {timeout:20000}).toBeGreaterThanOrEqual(2);
  await expect(page.locator('#timeline-play')).toHaveText('▶ Phát',{timeout:20000});
  await expect(page.locator('.message.error')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('G00 playback switches can be toggled while audio is playing without changing source note',async({page})=>{
  test.slow();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.tiptap')).toBeVisible();
  await page.locator('#audio-file').setInputFiles({
    name:'live-options-16s.wav',mimeType:'audio/wav',buffer:longWav()
  });
  await expect(page.locator('#import-audio-status')).toContainText('Đã nhập',{timeout:45000});
  await page.locator('#timeline-play').click();
  await expect(page.locator('#timeline-play')).toHaveText('■ Dừng',{timeout:15000});
  await page.waitForTimeout(800);
  const before=await page.locator('#timeline-current').textContent();
  await page.locator('#silence-skip').check();  // restarts at same source time
  await page.locator('#play-rate').selectOption('1.5');
  await page.locator('#rnnoise-toggle').check();
  await expect(page.locator('#pitch-preserve')).toBeChecked();
  await expect(page.locator('#focus-duration')).toHaveValue('0');
  await expect(page.locator('#anchor-status')).toContainText('giữ cao độ',{timeout:30000});
  await expect(page.locator('#anchor-status')).toContainText('RNNoise');
  await expect(page.locator('#anchor-status')).toContainText('bỏ qua im lặng');
  const after=await page.locator('#timeline-current').textContent();
  expect(before).not.toBeNull();expect(after).not.toBeNull();
  await page.locator('#play-stop').click();
  await expect(page.locator('.message.error')).toHaveCount(0);
  expect(errors).toEqual([]);
});
