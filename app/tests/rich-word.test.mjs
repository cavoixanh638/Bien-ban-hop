import test from 'node:test';
import assert from 'node:assert/strict';
import {exportWord} from '../src/rich-docx.mjs';
import {foldVietnamese,plainTextFromDoc,buildMeetingSearchIndex,searchMeetings} from '../src/meeting-search.mjs';

test('G00 MiniSearch: Vietnamese accents, original timestamp metadata untouched',()=>{
  const data={type:'doc',content:[{type:'paragraph',content:[
    {type:'text',text:'Quy hoạch đô thị và nông thôn',marks:[
      {type:'timeSpan',attrs:{anchorId:'a',recordingId:'rec-x',audioOffsetMs:15000}}
    ]}
  ]}]};
  const before=JSON.stringify(data);
  assert.equal(foldVietnamese('ĐÔ THỊ'), 'do thi');
  assert.match(plainTextFromDoc(data),/Quy hoạch đô thị/);
  const index=buildMeetingSearchIndex([{meetingId:'m1',title:'Họp quy hoạch',text:plainTextFromDoc(data)},
    {meetingId:'m2',title:'Họp tài chính',text:'ngân sách trung ương'}]);
  assert.equal(searchMeetings(index,'quy hoach')[0].meetingId,'m1');
  assert.equal(searchMeetings(index,'DO THI')[0].meetingId,'m1');
  assert.equal(JSON.stringify(data),before);
});

test('G00 docx: produce an actual ZIP doc with Vietnamese paragraph and table',async()=>{
  const data={title:'Biên bản họp thử',document:{type:'doc',content:[
    {type:'paragraph',attrs:{textAlign:'justify'},content:[
      {type:'text',text:'Nội dung tiếng Việt',marks:[
        {type:'textStyle',attrs:{fontFamily:'Arial',fontSize:'20px',color:'#216B5F'}},
        {type:'bold'}]}
    ]},
    {type:'table',content:[{type:'tableRow',content:[
      {type:'tableHeader',content:[{type:'paragraph',content:[{type:'text',text:'Đơn vị'}]}]},
      {type:'tableCell',content:[{type:'paragraph',content:[{type:'text',text:'Kết quả'}]}]}
    ]}]}
  ]}};
  const blob=await exportWord(data);
  assert.ok(blob instanceof Blob);
  assert.ok(blob.size>1200);
  const bytes=new Uint8Array(await blob.slice(0,4).arrayBuffer());
  assert.deepEqual([...bytes],[80,75,3,4]);
});
