import {test,expect} from '@playwright/test';

async function shortRecording(page,label){
  await page.locator('#rec-start').click();
  await expect(page.locator('#rec-label')).toHaveText('Đang ghi âm',{timeout:25000});
  await page.locator('.tiptap').click();
  await page.keyboard.type(label);
  await page.waitForTimeout(1400);
  await page.locator('#rec-stop').click();
  await expect(page.locator('#rec-label')).toHaveText('Chưa ghi âm',{timeout:30000});
  await expect(page.locator('#save-status')).toContainText('Đã lưu',{timeout:18000});
}

test('G00 Continuous auto-advances across two adjacent committed sessions without note mutation',async({page})=>{
  test.slow();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.tiptap')).toBeVisible();
  await shortRecording(page,'Cuoc hop phien mot.');
  await shortRecording(page,'Cuoc hop phien hai.');
  await expect(page.locator('#timeline-sessions button')).toHaveCount(2,{timeout:20000});
  const note=await page.locator('.tiptap').innerHTML();
  await expect(page.locator('#focus-duration')).toHaveValue('0');
  await page.locator('#timeline-sessions button').first().click();
  await expect(page.locator('#timeline-notice')).toContainText('Đang nghe phiên 2',{timeout:25000});
  expect(await page.locator('.tiptap').innerHTML()).toBe(note);
  await page.locator('#play-stop').click();
  expect(errors).toEqual([]);
});
