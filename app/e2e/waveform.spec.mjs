import {test,expect} from '@playwright/test';

test('G00 waveform is opt-in, sampled from stored PCM and leaves note links untouched',async({page})=>{
  test.slow();
  await page.goto('/');
  await expect(page.locator('.tiptap')).toBeVisible();
  await expect(page.locator('#waveform-load')).toBeDisabled();
  await page.locator('#rec-start').click();
  await expect(page.locator('#rec-label')).toHaveText('Đang ghi âm',{timeout:25000});
  await page.locator('.tiptap').click();
  await page.keyboard.type('Thu nghiem dang song PCM duoc luu.');
  await page.waitForTimeout(1900);
  await page.locator('#rec-stop').click();
  await expect(page.locator('#rec-label')).toHaveText('Chưa ghi âm',{timeout:30000});
  await expect(page.locator('#waveform-load')).toBeEnabled({timeout:20000});
  const before=await page.locator('.tiptap').innerHTML();
  await page.locator('#waveform-load').click();
  await expect(page.locator('#waveform-load')).toHaveText('Ẩn dạng sóng',{timeout:30000});
  await expect(page.locator('#waveform-status')).toContainText('Đã lấy mẫu');
  await expect(page.locator('.timeline-waveform-bar').first()).toBeVisible();
  await expect(page.locator('.timeline-band.recorded')).not.toHaveCount(0);
  expect(await page.locator('.tiptap').innerHTML()).toBe(before);
  await page.locator('#waveform-load').click();
  await expect(page.locator('#timeline-waveform')).toHaveCount(0);
  await expect(page.locator('#timeline-seek')).toBeEnabled();
});
