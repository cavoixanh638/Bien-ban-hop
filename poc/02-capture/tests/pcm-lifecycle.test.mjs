import test from 'node:test';
import assert from 'node:assert/strict';
import {CaptureComparison} from '../src/controller.mjs';

class MockNode {
  connect(n){return n;}
  disconnect(){}
}
class MockContext {
  constructor(){MockContext.instances.push(this);this.sampleRate=48000;this.currentTime=0;
    this.destination=new MockNode();this.audioWorklet={addModule:async()=>{}};this.closed=0;}
  async resume(){}
  async close(){this.closed++;}
  getOutputTimestamp(){return {contextTime:.1,performanceTime:100};}
  createGain(){const n=new MockNode();n.gain={value:0};return n;}
  createOscillator(){const n=new MockNode();n.frequency={setValueAtTime(){}};n.start=()=>{};n.stop=()=>{};return n;}
}
MockContext.instances=[];
const workers=[];
class MockWorker {
  constructor(){workers.push(this);this.killed=0;}
  postMessage(message) {
    if(message.type==='attach')queueMicrotask(()=>this.onmessage({data:{type:'ready'}}));
  }
  terminate(){this.killed++;}
}
class MockWorklet extends MockNode {
  constructor(){super();this.port={onmessage:null,postMessage:msg=>{
    if(msg.type==='attach')queueMicrotask(()=>this.port.onmessage({data:{type:'ready',sampleIndex:0,contextTimeSec:0}}));
    if(msg.type==='start')queueMicrotask(()=>this.port.onmessage({data:{type:'started',sampleIndex:0,contextTimeSec:0}}));
    if(msg.type==='stats')queueMicrotask(()=>this.port.onmessage({data:{type:'progress',sampleIndex:48000,contextTimeSec:1}}));
    if(msg.type==='stop')queueMicrotask(()=>{
      this.port.onmessage({data:{type:'stopped',sampleIndex:48000,contextTimeSec:1}});
      workers.at(-1).onmessage({data:{type:'final',metrics:{receivedFrames:48000,committedThroughSampleExclusive:null,sourceEvents:[]}}});
    });
  }};}
}
const old=Object.fromEntries(['AudioContext','AudioWorkletNode','Worker'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
function install(){
  MockContext.instances.length=0;workers.length=0;
  Object.defineProperty(globalThis,'AudioContext',{configurable:true,value:MockContext});
  Object.defineProperty(globalThis,'AudioWorkletNode',{configurable:true,value:MockWorklet});
  Object.defineProperty(globalThis,'Worker',{configurable:true,value:MockWorker});
}
function restore(){for(const [k,d] of Object.entries(old)){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}

test('controller waits for real START ACK, uses worklet timestamp, preserves worker until diagnostic export, then disposes',async t=>{
  install();t.after(restore);
  const run=new CaptureComparison();t.after(async()=>{await run.dispose();});
  await run.start({engine:'pcm',source:'synthetic'});
  assert.equal(run.state,'capturing');
  const started=run.events.find(e=>e.type==='worklet-started');
  assert.ok(started);
  // Simulated progress with an independent reference clock, not message arrival time.
  run.node.port.onmessage({data:{type:'progress',sampleIndex:48000,contextTimeSec:1}});
  const result=await run.stop();
  assert.equal(result.state,'stopped');
  assert.equal(result.resourcesReleased,true);
  assert.equal(result.pcm.receivedFrames,48000);
  assert.equal(result.pcm.committedThroughSampleExclusive,null);
  assert.ok(result.clockMapping.length>=2);
  assert.equal(MockContext.instances[0].closed,1);
  assert.equal(workers[0].killed,0,'worker kept only for optional diagnostic export');
  await run.dispose();
  assert.equal(workers[0].killed,1);
  assert.equal(MockContext.instances[0].closed,1);
});

test('synthetic Worklet processor START error prevents MediaRecorder/oscillator from starting',async t=>{
  install();t.after(restore);
  class RejectedWorklet extends MockWorklet {
    constructor(){super();const send=this.port.postMessage;
      this.port.postMessage=msg=>{
        if(msg.type==='attach') queueMicrotask(()=>this.port.onmessage({data:{type:'error',reason:'invalid-configuration',sampleIndex:0,contextTimeSec:0}}));
        else send(msg);
      };}
  }
  Object.defineProperty(globalThis,'AudioWorkletNode',{configurable:true,value:RejectedWorklet});
  const run=new CaptureComparison();
  await assert.rejects(run.start({engine:'pcm',source:'synthetic'}),/invalid-configuration/);
  assert.equal(run.state,'failed');
  assert.equal(run.resourcesReleased,true);
  assert.equal(workers[0].killed,1);
  assert.equal(MockContext.instances[0].closed,1);
});
