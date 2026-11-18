import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {overlapsTimeSpan,canReplaceFindResults} from '../src/word-guards.mjs';

function fakeDoc(chars,links){
  return {nodesBetween(from,to,fn){
    for(let i=from;i<to;i++)fn({isText:true,nodeSize:1,
      marks:links.has(i)?[{type:{name:'timeSpan'},attrs:{anchorId:'a'+i,recordingId:'rec-fixture',audioOffsetMs:i*1000}}]:[]},i);
  }};
}
test('G00 replace guard: results involving a timeSpan never get silently replaced',()=>{
  fc.assert(fc.property(fc.array(fc.boolean(),{minLength:1,maxLength:90}),fc.nat(),(flags,n)=>{
    const links=new Set(flags.flatMap((b,i)=>b?[i]:[]));
    const idx=n%flags.length,doc=fakeDoc(flags,links),one={from:idx,to:idx+1};
    assert.equal(canReplaceFindResults(doc,[one],0).ok,!flags[idx]);
    assert.equal(overlapsTimeSpan(doc,one),flags[idx]);
  }),{numRuns:250});
});
test('G00 replace guard: replace-all blocks any linked result; plain result remains editable',()=>{
  const d=fakeDoc(5,new Set([2]));
  assert.equal(canReplaceFindResults(d,[{from:0,to:1},{from:2,to:3}],0,true).ok,false);
  assert.equal(canReplaceFindResults(d,[{from:0,to:1},{from:2,to:3}],0,false).ok,true);
  assert.equal(canReplaceFindResults(d,[{from:2,to:3}],0,false).ok,false);
  assert.equal(canReplaceFindResults(d,[],null,true).ok,false);
});


test('G00 replace guard: unlinked timeSpan has no valid recording and may be replaced',()=>{
  const doc={nodesBetween(_from,_to,visit){
    visit({isText:true,nodeSize:4,marks:[{
      type:{name:'timeSpan'},attrs:{recordingId:null,audioOffsetMs:null,source:'unlinked'}
    }]},0);
  }};
  assert.equal(canReplaceFindResults(doc,[{from:0,to:4}],0,true).ok,true);
});
