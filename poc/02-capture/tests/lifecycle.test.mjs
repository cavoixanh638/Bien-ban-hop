import test from 'node:test';
import assert from 'node:assert/strict';
import {CaptureComparison} from '../src/controller.mjs';

const deferred=()=>{let resolve,reject;const promise=new Promise((ok,fail)=>{resolve=ok;reject=fail;});return {promise,resolve,reject};};
class FakeTrack extends EventTarget {
  constructor(){super();this.kind='audio';this.readyState='live';this.stopCalls=0;this.label='fake audio';}
  getSettings(){return {sampleRate:48000,channelCount:1};}
  stop(){this.stopCalls++;this.readyState='ended';} // stop() by spec does not itself dispatch ended
  revoke(){this.readyState='ended';this.dispatchEvent(new Event('ended'));}
}
class FakeStream {
  constructor(tracks=[new FakeTrack()]){this.tracks=tracks;}
  getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio');}
  getTracks(){return this.tracks;}
}
class FakeNode {
  connect(n){return n;}
  disconnect(){this.disconnected=true;}
}
let fakeContexts=[];
class FakeContext {
  constructor(){this.sampleRate=48000;this.currentTime=0;this.destination=new FakeNode();
    this.audioWorklet={addModule:async()=>{}};this.closed=0;fakeContexts.push(this);}
  createMediaStreamSource(){return new FakeNode();}
  createMediaStreamDestination(){const node=new FakeNode();node.stream=new FakeStream();return node;}
  createGain(){const node=new FakeNode();node.gain={value:1};return node;}
  createOscillator(){const node=new FakeNode();node.frequency={setValueAtTime(){}};node.start=()=>{};node.stop=()=>{};return node;}
  resume(){return Promise.resolve();}
  close(){this.closed++;return Promise.resolve();}
  getOutputTimestamp(){return {contextTime:0,performanceTime:performance.now()};}
}
let recorders=[];
class FakeRecorder extends EventTarget {
  static isTypeSupported(){return true;}
  constructor(stream,config){super();this.mimeType=config.mimeType;this.state='inactive';this.stopCalls=0;recorders.push(this);}
  start(){this.state='recording';this.dispatchEvent(new Event('start'));}
  pause(){this.state='paused';this.dispatchEvent(new Event('pause'));}
  resume(){this.state='recording';this.dispatchEvent(new Event('resume'));}
  stop(){
    this.stopCalls++;
    if(this.stopImpl)return this.stopImpl();
    this.state='inactive';
    queueMicrotask(()=>{
      const e=new Event('dataavailable');e.data=new Blob([new Uint8Array([1,2,3])]);this.dispatchEvent(e);
      this.dispatchEvent(new Event('stop'));
    });
  }
}
const old={AudioContext:Object.getOwnPropertyDescriptor(globalThis,'AudioContext'),
  MediaRecorder:Object.getOwnPropertyDescriptor(globalThis,'MediaRecorder'),
  navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator'),
  MediaStream:Object.getOwnPropertyDescriptor(globalThis,'MediaStream')};
function setGlobal(name,value){Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});}
function install(mediaDevices){fakeContexts=[];recorders=[];
  setGlobal('AudioContext',FakeContext);setGlobal('MediaRecorder',FakeRecorder);
  setGlobal('MediaStream',FakeStream);setGlobal('navigator',{mediaDevices});}
function restore(){for(const [key,descriptor] of Object.entries(old)) {
  if(descriptor)Object.defineProperty(globalThis,key,descriptor);
  else delete globalThis[key];
}}

test('deferred mic grant: Stop before permission cancels future Start and closes late track',async t=>{
  const grant=deferred(),track=new FakeTrack();
  install({getUserMedia:()=>grant.promise});t.after(restore);
  const run=new CaptureComparison();
  const start=run.start({engine:'media',source:'microphone'});
  const stop=run.stop();
  grant.resolve(new FakeStream([track]));
  await assert.rejects(start,/cancelled/);
  const result=await stop;
  assert.equal(result.state,'stopped');assert.equal(result.resourcesReleased,true);
  assert.equal(track.stopCalls,1);assert.equal(fakeContexts.length,0);
  assert.equal(recorders.length,0);
});

test('double-click Start during prompt is rejected, only one recorder/context can start',async t=>{
  const grant=deferred(),track=new FakeTrack();
  install({getUserMedia:()=>grant.promise});t.after(restore);
  const run=new CaptureComparison();
  const first=run.start({engine:'media',source:'microphone'});
  assert.throws(()=>run.start({engine:'media',source:'microphone'}),/single-use/);
  grant.resolve(new FakeStream([track]));
  await first;
  assert.equal(recorders.length,1);assert.equal(fakeContexts.length,1);
  await run.stop();
  assert.equal(track.stopCalls,1);assert.equal(fakeContexts[0].closed,1);
});

test('permission denied/setup failure leaves no live capture resources, and no auto-retry',async t=>{
  install({getUserMedia:()=>Promise.reject(new DOMException('denied','NotAllowedError'))});t.after(restore);
  const run=new CaptureComparison();
  await assert.rejects(run.start({engine:'media',source:'microphone'}),/denied/);
  assert.equal(run.state,'failed');assert.equal(run.resourcesReleased,true);
  assert.equal(recorders.length,0);
  assert.throws(()=>run.start(),/single-use/);
});

test('MediaRecorder.stop throwing still releases live tracks/context exactly once; stop idempotent',async t=>{
  const track=new FakeTrack();
  install({getUserMedia:async()=>new FakeStream([track])});t.after(restore);
  const run=new CaptureComparison();await run.start({engine:'media',source:'microphone'});
  recorders[0].stopImpl=()=>{throw new Error('forced MediaRecorder.stop failure');};
  await assert.rejects(run.stop(),/forced MediaRecorder.stop failure/);
  await assert.rejects(run.stop(),/forced MediaRecorder.stop failure/);
  assert.equal(run.state,'failed');assert.equal(track.stopCalls,1);
  assert.equal(recorders[0].stopCalls,1,'MediaRecorder.stop not called twice on error');
  assert.equal(fakeContexts[0].closed,1);
  assert.equal(run.resourcesReleased,true);
});

test('MediaRecorder never acknowledging stop times out without leaving live microphone/context',async t=>{
  const track=new FakeTrack();
  install({getUserMedia:async()=>new FakeStream([track])});t.after(restore);
  const run=new CaptureComparison(()=>{},{mediaStopTimeoutMs:35});
  await run.start({engine:'media',source:'microphone'});
  recorders[0].stopImpl=()=>{recorders[0].state='inactive';}; // no stop ACK
  await assert.rejects(run.stop(),/timeout: media stop/);
  assert.equal(track.stopCalls,1);assert.equal(fakeContexts[0].closed,1);
  assert.equal(run.state,'failed');
});

test('track-ended concurrent with Stop cannot double-stop, and no recording remains',async t=>{
  const track=new FakeTrack();
  install({getUserMedia:async()=>new FakeStream([track])});t.after(restore);
  const run=new CaptureComparison();await run.start({engine:'media',source:'microphone'});
  const stop=run.stop();track.revoke();
  const result=await stop;
  assert.equal(result.state,'stopped');assert.equal(track.stopCalls,1);
  assert.equal(recorders[0].stopCalls,1);assert.equal(run.resourcesReleased,true);
});

test('Stop at idle is idempotent, and public invalid config is rejected before creation',async t=>{
  install({getUserMedia:()=>{throw new Error('should not request mic');}});t.after(restore);
  const run=new CaptureComparison();
  assert.throws(()=>run.start({engine:'pcm',source:'microphone',poolSize:1e8}),/invalid-configuration/);
  assert.equal(run.state,'idle');assert.equal(fakeContexts.length,0);
  const a=await run.stop(),b=await run.stop();
  assert.equal(a.state,'stopped');assert.equal(b.state,'stopped');
});

test('Worker final reject/timeout after stop always terminates worker and closes context',async t=>{
  const track=new FakeTrack();
  install({getUserMedia:async()=>new FakeStream([track])});t.after(restore);
  const run=new CaptureComparison(()=>{},{workerDrainTimeoutMs:30});
  await run.start({engine:'media',source:'microphone'});
  // Inject a Worker final promise and synthetic worklet stop for the worker-failure boundary.
  let terminated=0;
  run.worker={terminate(){terminated++;}};
  run.node={port:{postMessage(){}},disconnect(){}};
  run.final=Promise.reject(new Error('forced worker crash'));
  run.final.catch(()=>{});
  await assert.rejects(run.stop(),/forced worker crash/);
  assert.equal(terminated,1);assert.equal(track.stopCalls,1);
  assert.equal(fakeContexts[0].closed,1);assert.equal(run.state,'failed');
});

test('Stop during await AudioContext.resume closes the context even after slow setup resolves',async t=>{
  const gate=deferred(),track=new FakeTrack();
  install({getUserMedia:async()=>new FakeStream([track])});t.after(restore);
  const resume=FakeContext.prototype.resume;
  FakeContext.prototype.resume=()=>gate.promise;
  t.after(()=>{FakeContext.prototype.resume=resume;});
  const run=new CaptureComparison();
  const started=run.start({engine:'media',source:'microphone'});
  // Allow getUserMedia to resolve and context.resume() to become pending.
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(fakeContexts.length,1);
  const stopped=run.stop();gate.resolve();
  await assert.rejects(started,/cancelled/);
  const result=await stopped;
  assert.equal(result.state,'stopped');assert.equal(fakeContexts[0].closed,1);
  assert.equal(track.stopCalls,1);assert.equal(recorders.length,0);
});

test('a pending worker final never resolves: Stop reports timeout and still terminates worker',async t=>{
  const track=new FakeTrack();
  install({getUserMedia:async()=>new FakeStream([track])});t.after(restore);
  const run=new CaptureComparison(()=>{},{workerDrainTimeoutMs:35});
  await run.start({engine:'media',source:'microphone'});
  let killed=0;
  run.worker={terminate(){killed++;}};
  run.node={port:{postMessage(){}},disconnect(){}};
  run.final=new Promise(()=>{});
  await assert.rejects(run.stop(),/timeout: sink drain/);
  assert.equal(killed,1);assert.equal(track.stopCalls,1);
  assert.equal(fakeContexts[0].closed,1);assert.equal(run.state,'failed');
});

test('display share with video but no audio track closes granted screen track and never claims TC21 PASS',async t=>{
  const track=new FakeTrack();track.kind='video';
  install({getDisplayMedia:async()=>new FakeStream([track])});t.after(restore);
  const run=new CaptureComparison();
  await assert.rejects(run.start({engine:'media',source:'display-audio'}),/NO audio track/);
  assert.equal(run.state,'failed');
  assert.equal(track.stopCalls,1);
  assert.equal(fakeContexts.length,0);
  assert.equal(run.resourcesReleased,true);
});
