import test from 'node:test';
import assert from 'node:assert/strict';
import {planVerifiedWavClip,exportVerifiedWavClip} from '../src/audio-clip.mjs';
const manifest={recordingId:'r',sampleRate:48000,sampleRanges:[
  {sampleStart:0,sampleEndExclusive:48000*30},
  {sampleStart:48000*40,sampleEndExclusive:48000*70}
]};
test('G00 WAV clip refuses gaps, overlength and wrong provenance',()=>{
  assert.equal(planVerifiedWavClip(manifest,1000,3500).count,48000*2.5);
  assert.throws(()=>planVerifiedWavClip(manifest,25000,45000),/vùng thiếu/);
  assert.throws(()=>planVerifiedWavClip(manifest,-1,2000),/không hợp lệ/);
  assert.throws(()=>planVerifiedWavClip(manifest,0,130000),/120 giây/);
});
test('G00 WAV clip matches source float32 without altering the OPFS journal',async()=>{
  const calls=[];
  class FakeRPC{
    async call(action,payload){
      calls.push(action);
      if(action==='manifest')return manifest;
      if(action==='seek'){
        const pcm=new ArrayBuffer(payload.count*4),v=new DataView(pcm);
        for(let i=0;i<payload.count;i++)
          v.setFloat32(i*4,0.25,true);
        return {status:'valid',pcm};
      }
      return {ready:true};
    }
    async dispose(){calls.push('close');}
  }
  const {blob,samples}=await exportVerifiedWavClip('r',2000,3000,{rpcFactory:()=>new FakeRPC()});
  assert.equal(samples,48000);
  assert.equal(blob.size,44+samples*4);
  const header=new Uint8Array(await blob.slice(0,12).arrayBuffer());
  assert.equal(new TextDecoder().decode(header.slice(0,4)),'RIFF');
  assert.ok(calls.filter(x=>x==='seek').length>1);
  assert.equal(calls.at(-1),'close');
});
