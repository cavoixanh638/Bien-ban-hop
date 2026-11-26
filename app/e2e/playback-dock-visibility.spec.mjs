import {test,expect} from '@playwright/test';

test('G00 playback dock collapses completely, releases editor height, and restores its controls',async({page})=>{
  await page.setViewportSize({width:1600,height:1000});
  await page.goto('/');
  const dock=page.locator('#playback-dock'),toggle=page.locator('#playback-dock-toggle');
  const paper=page.locator('.paper-wrap');
  await expect(page.locator('.tiptap')).toBeVisible();
  await expect(dock).toBeVisible();
  await expect(toggle).toHaveText('Ẩn thanh nghe lại');
  await expect(toggle).toHaveAttribute('aria-expanded','true');
  await page.locator('#play-rate').selectOption('1.5');
  await page.locator('#silence-skip').check();
  const before=await paper.boundingBox();
  await toggle.click();
  await expect(dock).toBeHidden();
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveText('Hiện thanh nghe lại');
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await expect(toggle).toHaveAttribute('aria-controls','playback-dock');
  expect(await dock.boundingBox()).toBeNull();
  expect((await paper.boundingBox()).height).toBeGreaterThan(before.height+100);
  await expect(page.locator('#waveform-load')).toBeHidden();
  await expect(page.locator('#timeline-seek')).toBeHidden();
  await expect(page.locator('#bookmark-panel')).toBeHidden();
  await expect(page.locator('#rec-start')).toBeVisible();

  await toggle.click();
  await expect(dock).toBeVisible();
  await expect(page.locator('#play-rate')).toHaveValue('1.5');
  await expect(page.locator('#silence-skip')).toBeChecked();

  // The preference is local to this browser; it survives a reload both ways.
  await toggle.click();
  await page.reload();
  await expect(page.locator('.tiptap')).toBeVisible();
  await expect(dock).toBeHidden();
  await expect(toggle).toHaveText('Hiện thanh nghe lại');
  await toggle.click();
  await page.reload();
  await expect(page.locator('.tiptap')).toBeVisible();
  await expect(dock).toBeVisible();
});

test('G00 hiding and restoring playback dock during recording preserves capture and timeSpan',async({page})=>{
  test.slow();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1600,height:1000});
  await page.goto('/');
  const editor=page.locator('.tiptap'),dock=page.locator('#playback-dock');
  const toggle=page.locator('#playback-dock-toggle');
  await expect(editor).toBeVisible();
  await page.locator('#rec-start').click();
  await expect(page.locator('#rec-label')).toHaveText('Đang ghi âm',{timeout:25000});
  await toggle.click();
  await expect(dock).toBeHidden();
  await expect(page.locator('#rec-pause')).toBeEnabled();
  await expect(page.locator('#rec-stop')).toBeEnabled();
  await editor.click();
  await page.keyboard.type('Ghi chu khi an thanh nghe lai.');
  await expect(editor).toContainText('Ghi chu khi an thanh nghe lai.');
  await expect(page.locator('#rec-label')).toHaveText('Đang ghi âm');
  await toggle.click();
  await expect(dock).toBeVisible();
  await expect(page.locator('#timeline-seek')).toBeDisabled();
  await toggle.click();
  await expect(dock).toBeHidden();
  // Allow the existing G03 durable PCM/journal ACK.
  await page.waitForTimeout(7000);
  await page.locator('#rec-stop').click();
  await expect(page.locator('#rec-label')).toHaveText('Chưa ghi âm',{timeout:30000});
  await expect(page.locator('#save-status')).toContainText('Đã lưu',{timeout:15000});
  await expect(dock).toBeHidden();
  const marked=editor.locator('[data-time-recording-id]').first();
  await expect(marked).toBeVisible({timeout:15000});
  const note=await editor.innerHTML();
  await toggle.click();
  await expect(dock).toBeVisible();
  await expect(page.locator('#timeline-summary')).toContainText('1 phiên',{timeout:20000});
  await expect(page.locator('#timeline-seek')).toBeEnabled();
  expect(await editor.innerHTML()).toBe(note);
  await page.locator('#timeline-sessions button').first().click();
  await expect(page.locator('#anchor-status')).toContainText('Đang phát từ',{timeout:20000});
  await page.locator('#play-stop').click();
  expect(await editor.innerHTML()).toBe(note);
  expect(errors).toEqual([]);
});
