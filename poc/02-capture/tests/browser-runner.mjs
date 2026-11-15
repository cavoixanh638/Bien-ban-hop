/* Chromium CDP integration benchmark. No npm packages required. Linux headless != Windows QA. */
import {spawn, spawnSync} from 'node:child_process';
import {mkdtemp, rm, mkdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {startServer} from '../server.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function assert(value, message) {if (!value) throw new Error(message);}
async function waitFor(f, ms=12000) {
  const started=Date.now();
  while (Date.now()-started<ms) { try {const value=await f();if(value)return value;} catch{} await sleep(100); }
  throw new Error('timeout waiting for Chrome');
}
async function readChromeWs(debugPort) {
  const data=await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
  return data.find(item=>item.type==='page')?.webSocketDebuggerUrl;
}
class CDP {
  constructor(socket) {
    this.ws=socket;this.seq=0;this.pending=new Map();this.events=[];
    socket.onmessage=e=>{
      const data=JSON.parse(e.data);
      if (data.id) {
        const pending=this.pending.get(data.id);
        if (!pending)return;
        this.pending.delete(data.id);
        if(data.error)pending.reject(new Error(JSON.stringify(data.error)));
        else pending.resolve(data.result);
      } else if (data.method==='Runtime.exceptionThrown'||data.method==='Log.entryAdded') this.events.push(data);
    };
  }
  async send(method,params={}) {
    const id=++this.seq;
    return new Promise((resolve,reject)=>{
      this.pending.set(id,{resolve,reject});
      this.ws.send(JSON.stringify({id,method,params}));
      const timer=setTimeout(()=>{if(this.pending.has(id)){this.pending.delete(id);reject(new Error(`CDP timeout ${method}`));}},55000);
      timer.unref();
    });
  }
  async evaluate(expression) {
    const r=await this.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,
      timeout:49000});
    if(r.exceptionDetails)throw new Error(r.exceptionDetails.text + ': '+JSON.stringify(r.exceptionDetails.exception?.description || ''));
    return r.result.value;
  }
  close(){this.ws.close();}
}
function browserProcMetrics(rootPid) {
  const processList=spawnSync('ps',['-e','-o','pid=,ppid=,rss=,time='],{encoding:'utf8'}).stdout.split('\n').map(l=>l.trim().split(/\s+/)).filter(x=>x.length===4).map(x=>({pid:Number(x[0]),ppid:Number(x[1]),rssKB:Number(x[2]),cpuTime:x[3]}));
  const children=new Set([rootPid]);
  let changed=true;
  while(changed){changed=false;for(const p of processList)if(children.has(p.ppid)&&!children.has(p.pid)){children.add(p.pid);changed=true;}}
  const selected=processList.filter(p=>children.has(p.pid));
  function cpu(s){const n=s.split(':').map(Number);return n.reduce((acc,item)=>acc*60+item,0);}
  return {nProcesses:selected.length, sumRssKB:selected.reduce((n,p)=>n+p.rssKB,0), sumCpuSeconds:selected.reduce((n,p)=>n+cpu(p.cpuTime),0)};
}

const argv=process.argv;
const short=argv.includes('--quick');
const tmp=await mkdtemp(path.join(tmpdir(),'moc-hop-capture-'));
const {server,port}=await startServer(0);
let chrome, cdp;
const evidence={environment:{os:process.platform,arch:process.arch,node:process.version,
  chrome:spawnSync('chromium',['--version'],{encoding:'utf8'}).stdout.trim(),
  mode:'Chromium headless, Linux container, fake device for mic, no physical unplug',
  origin:`http://127.0.0.1:${port}`,date:new Date().toISOString()},cases:[],errors:[]};
try{
  const debugPort=9323;
  chrome=spawn('chromium',['--headless=new','--no-sandbox','--disable-dev-shm-usage',
    '--disable-gpu','--disable-background-networking','--no-first-run',
    '--autoplay-policy=no-user-gesture-required','--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream', '--remote-allow-origins=*',
    `--user-data-dir=${tmp}`,`--remote-debugging-port=${debugPort}`,
    `http://127.0.0.1:${port}/`],{stdio:['ignore','ignore','pipe']});
  let stderr='';
  chrome.stderr.on('data',d=>{if(stderr.length<8000)stderr+=String(d);});
  const wsUrl=await waitFor(()=>readChromeWs(debugPort));
  const socket=new WebSocket(wsUrl);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  cdp=new CDP(socket);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Performance.enable');
  await cdp.send('Page.navigate',{url:`http://127.0.0.1:${port}/`});
  await sleep(500);
  if ((await cdp.evaluate('location.href')).startsWith('chrome-error://')) {
    throw new Error('BLOCKED_ENV: Chromium managed URLBlocklist blocks localhost; browser tests NOT_RUN');
  }
  await waitFor(async()=>cdp.evaluate(`!!window.capturePoc`));
  evidence.environment.isolated=await cdp.evaluate(`crossOriginIsolated`);
  evidence.environment.secureContext=await cdp.evaluate(`isSecureContext`);
  assert(evidence.environment.isolated===false,'isolation unexpectedly true');
  assert(evidence.environment.secureContext===true,'localhost not secure context');

  const cases=short ? [
    ['pcm-2048',{engine:'pcm',batchFrames:2048,durationMs:2200}],
    ['both-4096',{engine:'both',batchFrames:4096,durationMs:2600}],
    ['stress',{engine:'pcm',batchFrames:2048,poolSize:2,maxQueue:1,delayMs:130,durationMs:2200}]
  ] : [
    ['pcm-2048',{engine:'pcm',batchFrames:2048,durationMs:2600}],
    ['pcm-4096',{engine:'pcm',batchFrames:4096,durationMs:2600}],
    ['media-only',{engine:'media',durationMs:2600}],
    ['both-2048',{engine:'both',batchFrames:2048,durationMs:3300}],
    ['both-4096',{engine:'both',batchFrames:4096,durationMs:3300}],
    ['slow-2048',{engine:'pcm',batchFrames:2048,poolSize:2,maxQueue:1,delayMs:140,durationMs:2800}],
    ['slow-4096',{engine:'pcm',batchFrames:4096,poolSize:2,maxQueue:1,delayMs:220,durationMs:2800}],
    ['cpu-2048',{engine:'pcm',batchFrames:2048,poolSize:3,maxQueue:2,cpuBurnMs:70,durationMs:2500}],
    ['fake-microphone',{engine:'both',source:'microphone',batchFrames:2048,durationMs:2700}]
  ];
  for(const [name,config] of cases){
    const before=browserProcMetrics(chrome.pid);
    let peakKB=before.sumRssKB;
    const sampler=setInterval(()=>{peakKB=Math.max(peakKB,browserProcMetrics(chrome.pid).sumRssKB);},130);
    const began=performance.now();
    try {
      const result=await cdp.evaluate(`window.capturePoc.runAutomated(${JSON.stringify(config)})`);
      const elapsed=performance.now()-began;
      clearInterval(sampler);
      const after=browserProcMetrics(chrome.pid);
      const metrics={name,result:'PASS',elapsedWallMs:+elapsed.toFixed(1),
        processCpuSecondsDelta:+(after.sumCpuSeconds-before.sumCpuSeconds).toFixed(2),
        approximateCpuCoreFraction:+((after.sumCpuSeconds-before.sumCpuSeconds)/(elapsed/1000)).toFixed(3),
        sumRssBeforeKB:before.sumRssKB,sumRssAfterKB:after.sumRssKB,peakSampledSumRssKB:peakKB,
        // Sum of process RSS double-counts shared pages. Not a precise per-engine memory measurement.
        resourceMeasureNote:'process-tree CPU time and summed RSS; combined mode cannot attribute cost per engine',
        measured:result};
      assert(result.isolated===false,'not crossOriginIsolated=false');
      if(config.engine!=='media') {
        assert(result.pcm?.receivedFrames>0,'no PCM frames');
        assert(result.pcm?.failure===null,'sink error: '+result.pcm.failure);
        assert(result.pcm?.committedThroughSampleExclusive===null,'recycle mistaken for durable commit');
        assert(result.pcmPrefixVerification?.decoded===true,'WAV failed decoder: '+JSON.stringify(result.pcmPrefixVerification));
      }
      if(config.engine!=='pcm') {
        assert(result.media?.blobCount>0,'MediaRecorder emitted no blobs');
        assert(result.mediaVerification?.decoded===true,'WebM failed decoder: '+JSON.stringify(result.mediaVerification));
      }
      if(name.startsWith('slow')||name==='stress') assert((result.pcm?.rejectedFrames||0)+(result.pcm?.missingFrames||0)>0,'stress did not cause backpressure');
      evidence.cases.push(metrics);
      console.log(`${name}: PASS PCM=${result.pcm?.receivedFrames ?? '-'} lost=${(result.pcm?.missingFrames||0)+(result.pcm?.rejectedFrames||0)} MediaBytes=${result.media?.totalBytes ?? '-'} CPU=${metrics.approximateCpuCoreFraction} RSS=${metrics.peakSampledSumRssKB}KiB`);
    } catch(error) {
      clearInterval(sampler);
      evidence.errors.push({name,error:String(error)});
      evidence.cases.push({name,result:'FAIL',error:String(error)});
      console.error(`${name}: FAIL ${error}`);
    }
  }
  evidence.cdpErrors=cdp.events.slice(0,15);
  evidence.chromeStderr=stderr.slice(0,1500);
} catch(error) {
  const blocked=String(error).includes('BLOCKED_ENV');
  evidence.errors.push({name:'harness',status:blocked?'NOT_RUN':'FAIL',error:String(error)});
  console.error(error);
}
finally {
  cdp?.close();
  chrome?.kill('SIGTERM');
  await new Promise(resolve=>server.close(resolve));
  await rm(tmp,{recursive:true,force:true});
}
await mkdir(new URL('../evidence/',import.meta.url),{recursive:true});
const out=new URL('../evidence/browser-results.json',import.meta.url);
await writeFile(out,JSON.stringify(evidence,null,2)+'\n');
const failures=evidence.errors.filter(x=>x.status!=='NOT_RUN');
const blocked=evidence.errors.filter(x=>x.status==='NOT_RUN');
console.log(`Evidence: ${out.pathname}, ${evidence.cases.filter(x=>x.result==='PASS').length} PASS, ${failures.length} FAIL, ${blocked.length} BLOCKED`);
if(failures.length) process.exitCode=1;
else if(blocked.length) process.exitCode=2;
