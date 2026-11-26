import {test,expect} from '@playwright/test';

test('G00 integrated playback matrix: pitch+RNNoise and silence+RNNoise use same durable note',async({page})=>{
  test.slow();
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.tiptap')).toBeVisible();
  await page.locator('#rec-start').click();
  await expect(page.locator('#rec-label')).toHaveText('Đang ghi âm',{timeout:25000});
  await page.locator('.tiptap').click();
  await page.keyboard.type('Test to hop nghe lai voi loc nhieu va bo im lang.');
  await page.waitForTimeout(2200);
  await page.locator('#rec-stop').click();
  await expect(page.locator('#rec-label')).toHaveText('Chưa ghi âm',{timeout:30000});
  await expect(page.locator('#timeline-sessions button')).toHaveCount(1,{timeout:20000});
  const note=await page.locator('.tiptap').innerHTML();

  // Path A: native pitch preservation with optional RNNoise at 0.75x.
  await page.locator('#focus-duration').selectOption('15000');
  await page.locator('#play-rate').selectOption('0.75');
  await page.locator('#pitch-preserve').check();
  await page.locator('#rnnoise-toggle').check();
  await page.locator('#timeline-sessions button').first().click();
  await expect(page.locator('#anchor-status')).toContainText('giữ cao độ',{timeout:35000});
  await expect(page.locator('#anchor-status')).toContainText('RNNoise');
  await page.locator('#play-stop').click();

  // Path B: a fresh read-only RMS scan, RNNoise, same verified PCM.
  await page.locator('#play-rate').selectOption('1');
  await page.locator('#silence-skip').check();
  await expect(page.locator('#silence-skip')).toBeChecked();
  await page.locator('#timeline-sessions button').first().click();
  await expect(page.locator('#anchor-status')).toContainText('bỏ qua im lặng',{timeout:35000});
  await expect(page.locator('#anchor-status')).toContainText('RNNoise');
  await page.locator('#play-stop').click();

  expect(await page.locator('.tiptap').innerHTML()).toBe(note);
  expect(pageErrors).toEqual([]);
  await expect(page.locator('.message.error')).toHaveCount(0);
});
