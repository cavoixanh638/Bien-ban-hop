import test from 'node:test';
import assert from 'node:assert/strict';
import {makeSafeLoop,jumpMeetingPosition} from '../src/replay-tools.mjs';
import {adjustFirstLineIndent,firstLineIndentTwips} from '../src/paragraph-indent.mjs';
const timeline={totalMs:25000,
 sessions:[{recordingId:'r',index:1,startMs:0,endMs:25000,sampleRate:1000,
  ranges:[{sampleStart:0,sampleEndExclusive:10000},{sampleStart:15000,sampleEndExclusive:25000}]}],
 bands:[{type:'recorded',recordingId:'r',startMs:0,endMs:10000},
        {type:'gap',startMs:10000,endMs:15000},
        {type:'recorded',recordingId:'r',startMs:15000,endMs:25000}]};
test('G00 A/B never bridges missing samples or recordings',()=>{
  assert.deepEqual(makeSafeLoop(timeline,1000,5000),{
    recordingId:'r',startMs:1000,endMs:5000,absoluteStart:1000,absoluteEnd:5000,durationMs:4000});
  assert.throws(()=>makeSafeLoop(timeline,9500,16000),/vượt vùng âm thanh/);
  assert.throws(()=>makeSafeLoop(timeline,1000,200),/trước mốc B/);
  assert.throws(()=>makeSafeLoop(timeline,1000,1000+120001),/120 giây/);
  assert.throws(()=>makeSafeLoop(timeline,10000,11000),/cùng một phiên/);
  assert.equal(jumpMeetingPosition(timeline,6000,-3000).localMs,3000);
  assert.equal(jumpMeetingPosition(timeline,9000,3000).status,'gap');
});
test('G00 first-line indent 12pt = 240 twip and never mutates source marks',()=>{
  assert.equal(firstLineIndentTwips(12),240);
  assert.equal(firstLineIndentTwips(72),1440);
  assert.equal(firstLineIndentTwips(-1),0);
  const recordingMark={type:{name:'timeSpan'},attrs:{audioOffsetMs:1000,recordingId:'r'}};
  const calls=[];
  const editor={
    state:{doc:{nodesBetween(from,to,visit){
      visit({type:{name:'paragraph'},attrs:{firstLineIndentPt:0}},0);
      visit({type:{name:'text'},marks:[recordingMark]},1);
    }},selection:{from:0,to:5}},
    chain(){return {focus(){return this;},updateAttributes(name,attrs){
      calls.push({name,attrs});return this;},run(){return true;}}}
  };
  assert.equal(adjustFirstLineIndent(editor,12),true);
  assert.deepEqual(calls,[{name:'paragraph',attrs:{firstLineIndentPt:12}}]);
  assert.equal(recordingMark.attrs.audioOffsetMs,1000);
});
