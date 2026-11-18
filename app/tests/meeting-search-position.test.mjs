import test from 'node:test';
import assert from 'node:assert/strict';
import {firstMeetingTextMatch} from '../src/meeting-search-position.mjs';

function fakeDoc(parts){
  return {descendants(fn){for(const [pos,text] of parts)fn({isText:true,text},pos);}};
}
test('finds Vietnamese without accents using ProseMirror UTF-16 positions',()=>{
  assert.deepEqual(firstMeetingTextMatch(fakeDoc([[1,'Họp về quy hoạch đô thị']]),'QUY HOACH'),
    {from:8,to:17});
  assert.equal(firstMeetingTextMatch(fakeDoc([[1,'Họp']]),'thiếu'),null);
});
test('matches across adjacent formatting marks, not across paragraphs',()=>{
  assert.deepEqual(firstMeetingTextMatch(fakeDoc([[1,'Quy '],[5,'hoạch đô thị']]),'quy hoach'),
    {from:1,to:10});
  assert.equal(firstMeetingTextMatch(fakeDoc([[1,'Quy'],[6,'hoạch']]),'quyhoach'),null);
});
test('search navigates without modifying original timeSpan-bearing content',()=>{
  const note={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Tài liệu đính kèm',
    marks:[{type:'timeSpan',attrs:{recordingId:'rec-1',audioOffsetMs:12000}}]}]}]};
  const original=JSON.stringify(note);
  const doc=fakeDoc([[1,'Tài liệu đính kèm']]);
  assert.deepEqual(firstMeetingTextMatch(doc,'tai lieu'),{from:1,to:9});
  assert.equal(JSON.stringify(note),original);
});
test('supplementary Unicode codepoints use UTF-16 offsets',()=>{
  assert.deepEqual(firstMeetingTextMatch(fakeDoc([[2,'😀 Thành phố Hải Phòng']]),'thanh pho'),
    {from:5,to:14});
});
test('rejects missing, empty and overlong query without side effects',()=>{
  assert.equal(firstMeetingTextMatch(null,'a'),null);
  assert.equal(firstMeetingTextMatch(fakeDoc([[1,'ab']]),'  '),null);
  assert.equal(firstMeetingTextMatch(fakeDoc([[1,'ab']]),'a'.repeat(300)),null);
});
