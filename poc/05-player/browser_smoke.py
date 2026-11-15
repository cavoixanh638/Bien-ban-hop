"""Optional browser smoke runner. Requires: pip install playwright; playwright install chromium.
Launch: python3 browser_smoke.py. Do not mark pitch/PCM integrity PASS from event logs.
"""
import asyncio, json, subprocess
from playwright.async_api import async_playwright
async def main():
    server = subprocess.Popen(['python3','-m','http.server','8765','--bind','127.0.0.1'])
    try:
        await asyncio.sleep(1)
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True,args=['--autoplay-policy=no-user-gesture-required'])
            page = await browser.new_page()
            errors = []
            page.on('pageerror',lambda e: errors.append(str(e)))
            await page.goto('http://127.0.0.1:8765/index.html')
            await page.wait_for_function('window.poc && window.poc.player')
            output = {'browser':browser.version,'userAgent':await page.evaluate('navigator.userAgent')}
            await page.click('#play');await page.wait_for_timeout(500)
            output['C1play'] = await page.evaluate('({playing:poc.player.playing,position:poc.player.position(),stats:poc.player.stats()})')
            await page.click('#play')
            await page.click('[data-ms="5400000"]');await page.wait_for_timeout(150)
            output['C1seek90'] = await page.evaluate('poc.records.filter(x=>x.type==="seek").slice(-1)[0]')
            await page.click('[data-ms="6060000"]');await page.wait_for_timeout(120)
            output['C1missing'] = await page.locator('#message').inner_text()
            await page.select_option('#engine','C2')
            await page.click('[data-ms="10200000"]');await page.wait_for_timeout(150)
            await page.click('#play');await page.wait_for_timeout(500)
            output['C2play'] = await page.evaluate('({playing:poc.player.playing,position:poc.player.position(),stats:poc.player.stats()})')
            await page.click('#play')
            await page.locator('#editor').click()
            output['ordinaryClick'] = await page.evaluate('({playing:poc.player.playing,focused:document.activeElement.id==="editor"})')
            await page.click('#anchorPlay');await page.wait_for_timeout(120)
            output['preroll'] = await page.evaluate('poc.records.filter(x=>x.type==="anchor").slice(-1)[0]')
            output['errors'] = errors
            print(json.dumps(output,indent=2,ensure_ascii=False))
            await browser.close()
    finally:
        server.terminate()
        server.wait()
asyncio.run(main())
