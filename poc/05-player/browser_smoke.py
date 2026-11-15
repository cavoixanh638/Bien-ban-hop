"""Real Chromium smoke with in-memory source modules; avoids blocked localhost navigation.
Linux headless is NOT a substitute for Windows Chrome/Edge, physical hearing or external PCM loopback.
Requires Python Playwright with /usr/bin/chromium. Writes evidence/browser-smoke.json.
"""
import asyncio,base64,json,os,pathlib,time,traceback
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).parent
async def page_from_sources(browser):
 page=await browser.new_page(viewport={'width':1200,'height':900})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 timeline=(ROOT/'timeline.js').read_text()
 timeline_url='data:text/javascript;base64,'+base64.b64encode(timeline.encode()).decode()
 player=(ROOT/'player.js').read_text().replace("from './timeline.js'",f"from '{timeline_url}'")
 player_url='data:text/javascript;base64,'+base64.b64encode(player.encode()).decode()
 html=(ROOT/'index.html').read_text().replace("from './player.js'",f"from '{player_url}'")
 await page.goto('about:blank')
 await page.set_content(html,wait_until='load')
 await page.wait_for_function('window.poc && window.poc.player')
 await page.wait_for_function('poc.records.some(x=>x.type==="seek"&&x.ms===298000)')
 return page,errors
async def capture_tap(page,engine):
 return await page.evaluate('''async engine=>{
 const p=poc.player,ctx=engine==='C1'?new AudioContext({sampleRate:16000}):p.ctx;
 const tap=ctx.createScriptProcessor(256,1,1),values=[];
 tap.onaudioprocess=e=>{const input=e.inputBuffer.getChannelData(0);let sum=0;for(let i=0;i<input.length;i++)sum+=input[i]*input[i];values.push({time:ctx.currentTime,rms:Math.sqrt(sum/input.length)});};
 if(engine==='C1'){for(const audio of p.audio){const source=ctx.createMediaElementSource(audio);source.connect(tap);}}else p.output=tap;
 tap.connect(ctx.destination);await ctx.resume();window.tap={ctx,tap,values};return {sampleRate:ctx.sampleRate};
 }''',engine)
async def take_audio_metrics(page):
 return await page.evaluate('''()=>{
 const v=window.tap?.values||[];const active=v.filter(x=>x.rms>.005);let longest=0,zeros=0,streak=0;
 // Use silent blocks between first and last detected active windows only.
 const min=active[0]?.time,max=active.at(-1)?.time;
 for(const x of v){if(min!==undefined&&x.time>=min&&x.time<=max){if(x.rms<.005){streak++;zeros++;longest=Math.max(longest,streak);}else streak=0;}}
 return {samples:v.length,active:active.length,bufferDurationMs:1000*256/(window.tap?.ctx.sampleRate||16000),maxMidstreamSilenceMs:longest*1000*256/(window.tap?.ctx.sampleRate||16000),zeroBlocksBetweenActive:zeros,firstActiveSec:min,lastActiveSec:max};
 }''')
async def main():
 result={'environment':{'platform':os.uname().sysname,'note':'about:blank + in-memory data ES modules, no network'},'cases':{}}
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required','--disable-dev-shm-usage'])
  result['environment']['chromiumVersion']=browser.version
  page,errors=await page_from_sources(browser)
  result['environment']['userAgent']=await page.evaluate('navigator.userAgent')
  async def case(name,fun):
   try:
    start=time.perf_counter();value=await fun();result['cases'][name]={'status':'PASS','data':value,'elapsedMs':round((time.perf_counter()-start)*1000,1)}
   except Exception as e:
    result['cases'][name]={'status':'FAIL','error':str(e),'trace':traceback.format_exc()[-700:]}
  async def c1_seek():
   await page.click('[data-ms="5400000"]');await page.wait_for_function('poc.records.some(x=>x.type==="seek"&&x.ms===5400000)')
   data1=await page.evaluate('poc.records.filter(x=>x.type==="seek"&&x.ms===5400000).at(-1)')
   await page.click('[data-ms="10200000"]');await page.wait_for_function('poc.records.some(x=>x.type==="seek"&&x.ms===10200000)')
   data2=await page.evaluate('poc.records.filter(x=>x.type==="seek"&&x.ms===10200000).at(-1)')
   assert data1['status']=='valid' and data2['status']=='valid'
   return {'seek90':data1,'seek170':data2}
  await case('C1 seek 90/170',c1_seek)
  async def c1_missing():
   await page.click('[data-ms="6060000"]');await page.wait_for_function('poc.records.some(x=>x.type==="seek"&&x.ms===6060000)')
   data=await page.evaluate('({status:poc.records.filter(x=>x.type==="seek"&&x.ms===6060000).at(-1).status,playing:poc.player.playing})')
   assert data['status']=='missing' and not data['playing'];return data
  await case('C1 missing no fallback',c1_missing)
  async def c1_pause_click():
   await page.locator('#editor .anchor').first.click();data=await page.evaluate('({focused:document.activeElement.id==="editor",playing:poc.player.playing})')
   assert data['focused'] and not data['playing'];return data
  await case('ordinary editor click no playback',c1_pause_click)
  async def c1_play_marker():
   await page.click('[data-ms="298000"]');await page.wait_for_function('poc.records.some(x=>x.type==="seek"&&x.ms===298000&&x.status==="valid")')
   await capture_tap(page,'C1');await page.click('#play');await page.wait_for_timeout(3300)
   boundaries=await page.evaluate('poc.records.filter(x=>x.type==="boundary-C1")')
   data={'boundaries':boundaries,'position':await page.evaluate('poc.player.position()'),'audio':await take_audio_metrics(page)}
   assert any(x['ms']==300000 for x in boundaries),data
   assert data['audio']['active']>40,data
   await page.click('#play');return data
  await case('C1 played 04:58-05:02 browser audio graph',c1_play_marker)
  async def c1_pitch_support():
   await page.select_option('#rate','0.75');a=await page.evaluate('poc.player.audio.map(a=>({rate:a.playbackRate,preserve:a.preservesPitch}))')
   await page.select_option('#rate','0.9');b=await page.evaluate('poc.player.audio.map(a=>({rate:a.playbackRate,preserve:a.preservesPitch}))')
   assert all(x['preserve'] for x in a+b) and all(x['rate']==.75 for x in a) and all(x['rate']==.9 for x in b)
   return {'rate075':a,'rate09':b,'note':'property verification, NOT human voice quality'}
  await case('C1 preservesPitch 0.75/0.9 property',c1_pitch_support)
  async def c1_ab():
   await page.fill('#a','299600');await page.fill('#b','300400');await page.check('#loop')
   await page.click('[data-ms="298000"]')
   await page.click('#play');await page.wait_for_timeout(3900)
   ev=await page.evaluate('poc.records.filter(x=>x.type==="seek-C1"&&x.ms===299600)')
   data={'loopSeeks':len(ev),'position':await page.evaluate('poc.player.position()')}
   assert len(ev)>=1,data
   await page.click('#play');await page.uncheck('#loop');return data
  await case('C1 A-B crossing 05:00',c1_ab)
  async def c1_alt():
   await page.locator('[data-anchor="at90"]').click(modifiers=['Alt']);await page.wait_for_function('poc.records.some(x=>x.type==="anchor"&&x.id==="at90")')
   anchor=await page.evaluate('poc.records.filter(x=>x.type==="anchor"&&x.id==="at90").at(-1)')
   assert anchor['original']==5400000 and anchor['start']==5395000 and anchor['unchanged'];return anchor
  await case('Alt+click anchor immutable with 5s preroll',c1_alt)
  await page.evaluate('poc.player.pause()')
  await page.select_option('#engine','C2');await page.wait_for_timeout(250)
  async def c2_boundary():
   await page.select_option('#rate','1');await page.evaluate('poc.player.pause()')
   await page.click('[data-ms="298000"]')
   await page.click('#play');await page.wait_for_timeout(3200)
   data=await page.evaluate('({boundaries:poc.records.filter(x=>x.type==="boundary-C2"),stats:poc.player.stats(),position:poc.player.position()})')
   assert any(x['ms']==300000 for x in data['boundaries']) and data['stats']['underruns']==0,data
   assert data['stats']['maxPending']<=12,data
   await page.click('#play');return data
  await case('C2 04:58-05:02 scheduling no underrun',c2_boundary)
  async def c2_gap():
   await page.evaluate('poc.player.pause()')
   await page.evaluate('poc.seek(7419900)')
   await page.click('#play');await page.wait_for_timeout(1200)
   data=await page.evaluate('({playing:poc.player.playing,records:poc.records.filter(x=>x.type==="unavailable"||x.type==="pending-stop"||x.type==="underrun-C2").slice(-4),stats:poc.player.stats()})')
   assert not data['playing'],data
   assert any(x.get('status')=='gap' for x in data['records']),data
   return data
  await case('C2 media hole stop before invalid PCM',c2_gap)
  async def c2_rate():
   await page.select_option('#rate','0.75');await page.select_option('#rate','0.9')
   await page.click('[data-ms="298000"]');await page.click('#play');await page.wait_for_timeout(400)
   data=await page.evaluate('({rate:poc.player.rate,pitchPreservation:poc.player.stats().pitchPreservation,pending:poc.player.stats().windows})')
   assert data['rate']==.9 and data['pitchPreservation']==False
   await page.click('#play');return data
  await case('C2 rate .75/.9 no pitch preservation',c2_rate)
  result['errors']=errors
  result['environment']['JSHeapUsedSize']=await page.evaluate('performance.memory?.usedJSHeapSize ?? null')
  result['summary']={'passed':sum(x['status']=='PASS' for x in result['cases'].values()),'failed':sum(x['status']=='FAIL' for x in result['cases'].values())}
  await page.screenshot(path=str(ROOT/'evidence'/'chromium-demo.png'),full_page=True)
  await browser.close()
 (ROOT/'evidence').mkdir(exist_ok=True)
 (ROOT/'evidence'/'browser-smoke.json').write_text(json.dumps(result,indent=2,ensure_ascii=False))
 print(json.dumps(result,indent=2,ensure_ascii=False))
 if result['summary']['failed'] or errors:raise SystemExit(1)
if __name__=='__main__':asyncio.run(main())
