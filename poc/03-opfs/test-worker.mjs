import test from 'node:test';
import {strict as a} from 'node:assert';
import {Worker} from 'node:worker_threads';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chunkFixture} from './core.mjs';
const newWorker=dir=>{
 const w=new Worker(new URL('./node-worker-harness.mjs',import.meta.url),{workerData:{dir}}),pending=new Map();let id=0;
 w.on('message',m=>{const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.ok?p.resolve(m.result):p.reject(Error(m.error.message));});
 w.on('exit',()=>{for(const p of pending.values())p.reject(Error('worker exited'));pending.clear();});
 return {w,send(action,payload={}){return new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});w.postMessage({id:key,action,payload});});}};
};
const fixture=(seq,start)=>chunkFixture({recordingId:'fixture',sequenceNo:seq,firstSample:start,sampleCount:48000,sampleRate:48000});
for(const fault of ['after_buffer_release','afterOpfsFlush','afterJournalCommit']){
 test('worker termination/reopen after '+fault,async()=>{
  const dir=await mkdtemp(join(tmpdir(),'opfs-node-worker-'));let x;
  try{
   x=newWorker(dir);await x.send('init');await x.send('append',fixture(0,0));
   const ack=await x.send('flush');a.equal(ack.committedThroughSampleExclusive,48000);
   const released=await x.send('append',fixture(1,48000));a.equal(released.committed,false);
   if(fault!=='after_buffer_release')await a.rejects(x.send('flush',{faultAt:fault}),/simulated crash/);
   await x.w.terminate();x=newWorker(dir);
   const reopened=await x.send('init',{reopen:true}),expected=fault==='afterJournalCommit'?96000:48000;
   a.equal((await x.send('seek',{sample:0,count:1})).status,'valid');
   a.equal((await x.send('seek',{sample:48000,count:1})).status,expected===96000?'valid':'missing');
   a.equal(reopened.recovery.unavailable.length,0);a.equal(reopened.recovery.committedRanges.at(-1).sampleEndExclusive,expected);
   await x.send('close');
  }finally{if(x)await x.w.terminate();await rm(dir,{recursive:true,force:true});}
 });
}
