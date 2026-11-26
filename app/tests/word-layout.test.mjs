import test from 'node:test';
import assert from 'node:assert/strict';
import {fontSizeToHalfPoints,paragraphLineHeight,applyBlockLineHeight} from '../src/word-layout.mjs';

test('G00 Word sizing: points and historical pixels export as true half-points',()=>{
  assert.equal(fontSizeToHalfPoints('14pt'),28);
  assert.equal(fontSizeToHalfPoints('18.6667px'),28);
  assert.equal(fontSizeToHalfPoints('14px'),21);
  assert.equal(fontSizeToHalfPoints('20px'),30);
  assert.equal(fontSizeToHalfPoints('12pt'),24);
  assert.equal(fontSizeToHalfPoints(undefined),28);
  assert.equal(fontSizeToHalfPoints('bogus'),28);
  assert.equal(fontSizeToHalfPoints('0pt'),28);
});

test('G00 paragraph spacing: node-level wins, legacy inline remains exportable',()=>{
  assert.equal(paragraphLineHeight('1.5','1'),1.5);
  assert.equal(paragraphLineHeight('1','1.5'),1);
  assert.equal(paragraphLineHeight(null,'1.15'),1.15);
  assert.equal(paragraphLineHeight(undefined,undefined),1.15);
  assert.equal(paragraphLineHeight('invalid','1.5'),1.15);
});
test('G00 spacing edit touches only selected paragraph/heading, never audio marks',()=>{
  const calls=[];
  const doc={nodesBetween(_from,_to,fn){
    fn({type:{name:'paragraph'},marks:[]},0);
    fn({type:{name:'text'},marks:[{type:{name:'timeSpan'},attrs:{recordingId:'rec'}}]},1);
    fn({type:{name:'heading'},marks:[]},20);
  }};
  const makeChain=()=>({
    focus(){calls.push('focus');return this;},
    updateAttributes(type,attrs){calls.push([type,attrs]);return this;},
    run(){calls.push('run');return true;}
  });
  const editor={state:{doc,selection:{from:0,to:40}},chain:makeChain};
  assert.equal(applyBlockLineHeight(editor,'1.5'),true);
  assert.deepEqual(calls,['focus',['paragraph',{lineHeight:'1.5'}],
    ['heading',{lineHeight:'1.5'}],'run']);
  assert.equal(applyBlockLineHeight(editor,'999'),false);
  assert.equal(calls.length,4);
});
test('G00 spacing: single cursor heading only does not chain unmatched paragraph',()=>{
  const calls=[];
  const doc={nodesBetween(){/* no nodes for zero-length selection */}};
  const editor={state:{doc,selection:{from:4,to:4,$from:{parent:{type:{name:'heading'}}}}},
    chain(){return {focus(){return this;},updateAttributes(type,value){calls.push({type,value});return this;},
      run(){return true;}}}};
  assert.equal(applyBlockLineHeight(editor,'2'),true);
  assert.deepEqual(calls,[{type:'heading',value:{lineHeight:'2'}}]);
});
