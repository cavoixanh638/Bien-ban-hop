import {test,expect} from '@playwright/test';

test('G00 Continuous+skip preserves Continuous and replays committed PCM',async({page})=>{
  test.slow();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.tiptap')).toBeVisible();
  await expect(page.locator('#focus-duration')).toHaveValue('0');
  await expect(page.locator('#pitch-preserve')).toBeChecked();
  await page.locator('#rec-start').click();
  await expect(page.locator('#rec-label')).toHaveText('Đang ghi âm',{timeout:25000});
  await page.locator('.tiptap').click();
  await page.keyboard.type('Ghi chu kiem thu loc im lang khi nghe lien tuc.');
  await page.waitForTimeout(2000);
  await page.locator('#rec-stop').click();
  await expect(page.locator('#rec-label')).toHaveText('Chưa ghi âm',{timeout:30000});
  await expect(page.locator('#timeline-sessions button')).toHaveCount(1,{timeout:20000});

  const note=await page.locator('.tiptap').innerHTML();
  await page.locator('#silence-skip').check();
  await expect(page.locator('#focus-duration')).toHaveValue('0');
  await expect(page.locator('#silence-skip')).toBeChecked();
  await expect(page.locator('#pitch-preserve')).toBeChecked();
  await expect(page.locator('#playback-mode-status')).toContainText('Liên tục');
  await page.locator('#timeline-sessions button').first().click();
  await expect(page.locator('#anchor-status')).toContainText('bỏ qua im lặng',{timeout:25000});
  expect(await page.locator('.tiptap').innerHTML()).toBe(note);
  await expect(page.locator('.message.error')).toHaveCount(0);
  await page.locator('#play-stop').click();
  expect(errors).toEqual([]);
});

test('G00 continuous 0.75x keeps pitch+silence on when the user changes focus and rate',async({page})=>{
  await page.goto('/');
  await expect(page.locator('.tiptap')).toBeVisible();
  await page.locator('#play-rate').selectOption('0.75');
  await expect(page.locator('#pitch-preserve')).toBeChecked();
  await page.locator('#silence-skip').check();
  await expect(page.locator('#pitch-preserve')).toBeChecked();
  await expect(page.locator('#silence-skip')).toBeChecked();
  await expect(page.locator('#focus-duration')).toHaveValue('0');
  await expect(page.locator('#playback-mode-status')).toContainText('giữ cao độ');
  await page.locator('#focus-duration').selectOption('15000');
  await expect(page.locator('#silence-skip')).toBeChecked();
  await page.locator('#focus-duration').selectOption('0');
  await expect(page.locator('#silence-skip')).toBeChecked();
  await expect(page.locator('#pitch-preserve')).toBeChecked();
  await page.locator('#rnnoise-toggle').check();
  await expect(page.locator('#rnnoise-toggle')).toBeChecked();
  await expect(page.locator('#focus-duration')).toHaveValue('0');
});
