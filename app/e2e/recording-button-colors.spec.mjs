import {test,expect} from '@playwright/test';

test('G00 recording controls: pause is amber, stop red, resume green and states follow recorder',async({page})=>{
  test.slow();
  await page.goto('/');
  await expect(page.locator('.tiptap')).toBeVisible();
  await expect(page.locator('#rec-pause')).toBeDisabled();
  await expect(page.locator('#rec-stop')).toBeDisabled();
  await page.locator('#rec-start').click();
  await expect(page.locator('#rec-label')).toHaveText('Đang ghi âm',{timeout:25000});
  await expect(page.locator('#rec-pause')).toBeEnabled();
  await expect(page.locator('#rec-stop')).toBeEnabled();
  await expect(page.locator('#rec-pause')).toHaveAttribute('data-mode','pause');
  await expect(page.locator('#rec-start')).toBeDisabled();
  // The generic button style animates background for 150 ms when enabled.
  // Wait for the final computed colors rather than sampling the transition.
  await page.mouse.move(0,0);
  await expect(page.locator('#rec-pause')).toHaveCSS('background-color','rgb(255, 198, 92)');
  await expect(page.locator('#rec-stop')).toHaveCSS('background-color','rgb(199, 47, 58)');
  const active=await page.evaluate(()=>{
    const pause=document.querySelector('#rec-pause'),stop=document.querySelector('#rec-stop');
    return {pause:getComputedStyle(pause).backgroundColor,
      stop:getComputedStyle(stop).backgroundColor,
      pauseText:getComputedStyle(pause).color,
      stopText:getComputedStyle(stop).color,
      pauseHeight:pause.getBoundingClientRect().height,
      stopHeight:stop.getBoundingClientRect().height};
  });
  expect(active.pause).toBe('rgb(255, 198, 92)');
  expect(active.stop).toBe('rgb(199, 47, 58)');
  expect(active.pause).not.toEqual(active.stop);
  expect(active.pauseHeight).toBeGreaterThanOrEqual(44);
  expect(active.stopHeight).toBeGreaterThanOrEqual(44);
  await page.locator('#rec-pause').click();
  await expect(page.locator('#rec-label')).toHaveText('Đã tạm dừng');
  await expect(page.locator('#rec-pause')).toHaveText('Tiếp tục');
  await expect(page.locator('#rec-pause')).toHaveAttribute('data-mode','resume');
  await page.mouse.move(0,0); // Leave :hover before checking the resting color.
  await expect(page.locator('#rec-pause')).toHaveCSS('background-color','rgb(22, 124, 96)');
  await expect(page.locator('#rec-stop')).toBeEnabled();
  await page.locator('#rec-pause').click();
  await expect(page.locator('#rec-label')).toHaveText('Đang ghi âm');
  await page.mouse.move(0,0);
  await expect(page.locator('#rec-pause')).toHaveCSS('background-color','rgb(255, 198, 92)');
  await page.locator('#rec-stop').click();
  await expect(page.locator('#rec-label')).toHaveText('Chưa ghi âm',{timeout:30000});
  await expect(page.locator('#rec-pause')).toBeDisabled();
  await expect(page.locator('#rec-stop')).toBeDisabled();
});
