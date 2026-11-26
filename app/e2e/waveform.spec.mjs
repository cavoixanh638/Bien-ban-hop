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
  const visual=await page.evaluate(()=>{
    const bar=document.querySelector('.timeline-waveform-bar');
    const lane=document.getElementById('timeline-waveform');
    const coverage=document.querySelector('.timeline-band.recorded');
    const scrub=document.querySelector('.timeline-scrub');
    return {
      barHeight:bar.getBoundingClientRect().height,
      laneHeight:lane.getBoundingClientRect().height,
      laneBottom:lane.getBoundingClientRect().bottom,
      coverageTop:coverage.getBoundingClientRect().top,
      scrubHeight:scrub.getBoundingClientRect().height,
      barColor:getComputedStyle(bar).backgroundColor,
      coverageColor:getComputedStyle(coverage).backgroundColor
    };
  });
  expect(visual.barHeight).toBeGreaterThanOrEqual(4); // No more 1px marks.
  expect(visual.laneHeight).toBeGreaterThan(20);
  expect(visual.scrubHeight).toBeGreaterThanOrEqual(48);
  expect(visual.laneBottom).toBeLessThanOrEqual(visual.coverageTop+1);
  expect(visual.barColor).not.toEqual(visual.coverageColor);
  await expect(page.locator('#waveform-status')).toContainText('Sóng xanh lam ở trên');
  await expect(page.locator('.timeline-band.recorded')).not.toHaveCount(0);
  expect(await page.locator('.tiptap').innerHTML()).toBe(before);
  await page.locator('#waveform-load').click();
  await expect(page.locator('#timeline-waveform')).toHaveCount(0);
  await expect(page.locator('#timeline-seek')).toBeEnabled();
});
