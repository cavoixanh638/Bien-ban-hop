import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectWavHeader,toMonoPCM,importAudioFile} from '../src/import-audio.mjs';

function sampleWav({channels=2,rate=8000,frames=9000}={}){
  const samples=frames*channels,bytes=44+samples*2;
  const out=new ArrayBuffer(bytes),dv=new DataView(out);
  for(const [at,text] of [[0,'RIFF'],[8,'WAVE'],[12,'fmt '],[36,'data']])
    for(let i=0;i<text.length;i++)dv.setUint8(at+i,text.charCodeAt(i));
  dv.setUint32(4,bytes-8,true);dv.setUint32(16,16,true);
  dv.setUint16(20,1,true);dv.setUint16(22,channels,true);
  dv.setUint32(24,rate,true);dv.setUint32(28,rate*channels*2,true);
  dv.setUint16(32,channels*2,true);dv.setUint16(34,16,true);
  dv.setUint32(40,samples*2,true);
  for(let i=0;i<frames;i++)for(let c=0;c<channels;c++)
    dv.setInt16(44+(i*channels+c)*2,c===0?16384:-16384,true);
  return out;
}
test('G00 WAV parser validates container and stereo downmix',()=>{
  const raw=sampleWav();
  const fmt=inspectWavHeader(raw,raw.byteLength);
  assert.equal(fmt.sampleRate,8000);assert.equal(fmt.frames,9000);
  const pcm=toMonoPCM(raw.slice(44),fmt);
  const v=new DataView(pcm);
  assert.equal(pcm.byteLength,9000*4);
  assert.equal(v.getFloat32(0,true),0);
  assert.equal(v.getFloat32(8000,true),0);
  assert.throws(()=>inspectWavHeader(new ArrayBuffer(44),44),/RIFF/);
});
test('G00 WAV import commits all frames before publishing a recording ID',async()=>{
  const raw=sampleWav({frames:50000});
  const file=new Blob([raw],{type:'audio/wav'});file.name='meeting.wav';
  const id='rec-import-123e4567-e89b-12d3-a456-426614174000';
  const calls=[],ranges=[];
  class FakeRPC{
    async call(action,payload){
      calls.push(action);
      if(action==='init')return {ready:true};
      if(action==='append'){
        ranges.push([payload.firstSample,payload.firstSample+payload.sampleCount,payload.sampleRate]);
        return {committed:false};
      }
      if(action==='flush')return {committedThroughSampleExclusive:ranges.at(-1)[1]};
      if(action==='manifest')return {recordingId:id,sampleRate:8000,
        sampleRanges:[{sampleStart:0,sampleEndExclusive:50000}]};
      return {closed:true};
    }
    async dispose(){calls.push('dispose');}
  }
  const progress=[];
  const result=await importAudioFile(file,{recordingId:id,RPC:FakeRPC,onProgress:x=>progress.push(x)});
  assert.equal(result.frames,50000);
  assert.equal(ranges.length,2);
  assert.deepEqual(ranges.map(x=>[x[0],x[1]]),[[0,32768],[32768,50000]]);
  assert.ok(calls.includes('flush'));
  assert.ok(calls.indexOf('manifest')>calls.indexOf('flush'));
  assert.equal(progress.at(-1).frames,50000);
});
test('G00 malformed import fails before writing to OPFS',async()=>{
  const file=new Blob([new Uint8Array(128)],{type:'audio/wav'});file.name='bad.wav';
  await assert.rejects(importAudioFile(file,{
    recordingId:'rec-import-123e4567-e89b-12d3-a456-426614174000'}),/RIFF/);
});
