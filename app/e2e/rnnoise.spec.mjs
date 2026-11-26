import {test,expect} from '@playwright/test';

test('G00 opt-in RNNoise loads local WASM worklet during replay without rewriting notes',async({page})=>{
  test.slow();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.tiptap')).toBeVisible();
  await page.locator('#rec-start').click();
  await expect(page.locator('#rec-label')).toHaveText('Đang ghi âm',{timeout:25000});
  await page.locator('.tiptap').click();
  await page.keyboard.type('Kiem tra loc nhieu RNNoise khi nghe lai.');
  await page.waitForTimeout(1900);
  await page.locator('#rec-stop').click();
  await expect(page.locator('#rec-label')).toHaveText('Chưa ghi âm',{timeout:30000});
  await expect(page.locator('#timeline-sessions button')).toHaveCount(1,{timeout:20000});
  const note=await page.locator('.tiptap').innerHTML();
  await page.locator('#rnnoise-toggle').check();
  await page.locator('#timeline-sessions button').first().click();
  await expect(page.locator('#anchor-status')).toContainText('RNNoise',{timeout:35000});
  await expect(page.locator('#timeline-play')).toContainText('Dừng',{timeout:12000});
  expect(await page.locator('.tiptap').innerHTML()).toBe(note);
  await page.locator('#play-stop').click();
  expect(errors).toEqual([]);
});
