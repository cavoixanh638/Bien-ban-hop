"""Chromium synthetic-tone pitch and bounded resource probe (not speech listening).
Outputs evidence/synthetic-benchmark.json. No network or real audio device required.
"""
import asyncio,json,time,os
import numpy as np
import psutil
from playwright.async_api import async_playwright
from browser_smoke import page_from_sources
from pathlib import Path
ROOT=Path(__file__).parent
async def attach_tap(page,engine):
 await page.evaluate('''async engine=>{
  const p=poc.player, ctx=engine==='C1'?new AudioContext({sampleRate:16000}):p.ctx;
  const tap=ctx.createScriptProcessor(1024,1,1),raw=[];
  tap.onaudioprocess=e=>{raw.push(Array.from(e.inputBuffer.getChannelData(0)));};
  if(engine==='C1'){for(const a of p.audio)ctx.createMediaElementSource(a).connect(tap);} else p.output=tap;
  tap.connect(ctx.destination);await ctx.resume();window.tap={ctx,tap,raw};
 }''',engine)
async def frequency(page):
 d=await page.evaluate('''()=>({sampleRate:tap.ctx.sampleRate,raw:tap.raw})''')
 data=np.asarray([x for block in d['raw'] for x in block],dtype=np.float64)
 rate=d['sampleRate']
 # Take 1 s from the middle, past startup; guard silence on browser failures.
 start=int(.6*rate);end=min(len(data),start+int(1*rate));part=data[start:end]
 if part.size<rate//2 or np.sqrt(np.mean(part**2))<.005:return {'status':'no-audio','samples':len(data)}
 ft=np.abs(np.fft.rfft(part*np.hanning(part.size)))
 freqs=np.fft.rfftfreq(part.size,1/rate)
 indices=np.where((freqs>120)&(freqs<260))[0]
 peak=float(freqs[indices[np.argmax(ft[indices])]])
 return {'status':'measured','dominantFundamentalHz':round(peak,2),'frames':int(len(data)),'rms':round(float(np.sqrt(np.mean(part**2))),4),'sampleRate':rate}
async def main():
 result={'environment':{'platform':os.uname().sysname,'kind':'Linux headless Chromium, synthetic sine tones (NOT speech)'}}
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required','--disable-dev-shm-usage'])
  result['environment']['chromium']=browser.version
  cdp=await browser.new_browser_cdp_session()
  try: infos=(await cdp.send('SystemInfo.getProcessInfo'))['processInfo']
  except Exception:infos=[]
  browser_pids=[x['id'] for x in infos]
  result['environment']['chromiumProcessIDs']=browser_pids
  def rss():
   vals=[]
   for pid in browser_pids:
    try: vals.append(psutil.Process(pid).memory_info().rss)
    except psutil.Error:pass
   return sum(vals)
  result['environment']['rssScope']='chromium processes observed by CDP (not page-only)'
  result['measurements']=[]
  for engine in ['C1','C2']:
   for rate in [.75,.9]:
    page,errors=await page_from_sources(browser)
    if engine=='C2':
     await page.select_option('#engine','C2');await page.wait_for_function('poc.player.constructor.name==="C2"')
     await page.evaluate('''async()=>{poc.player.ctx=new AudioContext({sampleRate:16000});await poc.player.ctx.resume();}''')
    await page.evaluate('poc.player.pause()')
    await page.select_option('#rate',str(rate));await page.evaluate('poc.seek(298000)')
    await attach_tap(page,engine)
    initial_rss=rss()
    await page.click('#play')
    await page.wait_for_timeout(2250)
    data=await frequency(page)
    data.update({'engine':engine,'rate':rate,'rssBytesSnapshot':rss(),'rssBytesInitial':initial_rss,'urlCount':await page.evaluate('poc.player.stats().urls??null'),'maxPending':await page.evaluate('poc.player.stats().maxPending??null'),'errors':errors})
    result['measurements'].append(data)
    await page.evaluate('poc.player.pause()')
    await page.close()
  await browser.close()
 ROOT.joinpath('evidence').mkdir(exist_ok=True)
 (ROOT/'evidence'/'synthetic-benchmark.json').write_text(json.dumps(result,indent=2,ensure_ascii=False))
 print(json.dumps(result,indent=2,ensure_ascii=False))
if __name__=='__main__':asyncio.run(main())
