import test from 'node:test';
import assert from 'node:assert/strict';
import {inflateRawSync} from 'node:zlib';
import {exportWord} from '../src/rich-docx.mjs';
import {paragraphLineHeight} from '../src/word-layout.mjs';

/**
 * Extracts a small known DOCX entry using ZIP's central directory.
 * This is test-only: the app's own archive and recovery routines are untouched.
 */
function readEntry(docx,name){
  const bytes=Buffer.from(docx),tail=Math.max(0,bytes.length-65557);
  let eocd=-1;
  for(let i=bytes.length-22;i>=tail;i--){
    if(bytes.readUInt32LE(i)===0x06054b50){eocd=i;break;}
  }
  assert.ok(eocd>=0,'DOCX ZIP end-of-central-directory record');
  const count=bytes.readUInt16LE(eocd+10);
  let cursor=bytes.readUInt32LE(eocd+16);
  for(let i=0;i<count;i++){
    assert.equal(bytes.readUInt32LE(cursor),0x02014b50,'valid ZIP central directory entry');
    const compression=bytes.readUInt16LE(cursor+10);
    const size=bytes.readUInt32LE(cursor+20);
    const filenameLen=bytes.readUInt16LE(cursor+28);
    const extraLen=bytes.readUInt16LE(cursor+30);
    const commentLen=bytes.readUInt16LE(cursor+32);
    const local=bytes.readUInt32LE(cursor+42);
    const filename=bytes.subarray(cursor+46,cursor+46+filenameLen).toString('utf8');
    if(filename===name){
      assert.equal(bytes.readUInt32LE(local),0x04034b50,'valid ZIP local entry');
      const start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28);
      const payload=bytes.subarray(start,start+size);
      if(compression===0)return payload.toString('utf8');
      assert.equal(compression,8,'supported deflate entry for DOCX test');
      return inflateRawSync(payload).toString('utf8');
    }
    cursor+=46+filenameLen+extraLen+commentLen;
  }
  assert.fail(name+' not found in DOCX ZIP');
}

test('G00 Word/OOXML: all four line spacing presets use 240ths with auto rule',async()=>{
  // Microsoft Open XML w:spacing uses 240ths of a line when w:lineRule=auto.
  // This validates the exported file, not just our formula.
  const rates=[['1',240],['1.15',276],['1.5',360],['2',480]];
  const document={type:'doc',content:rates.map(([rate])=>({
    type:'paragraph',
    attrs:{lineHeight:rate},
    content:[{type:'text',text:'Giãn dòng '+rate,marks:[
      {type:'textStyle',attrs:{fontFamily:'Times New Roman',fontSize:'14pt'}},
      {type:'timeSpan',attrs:{recordingId:'r-1',audioOffsetMs:25000}}
    ]}]
  }))};
  const pristine=JSON.stringify(document);
  const blob=await exportWord({title:'Kiểm định giãn dòng',document});
  const xml=readEntry(Buffer.from(await blob.arrayBuffer()),'word/document.xml');
  // Filter paragraph spacing; title has different paragraph-after spacing.
  const tags=[...xml.matchAll(/<w:spacing\b[^>]*\/>/g)].map(m=>m[0])
    .filter(tag=>tag.includes('w:line='));
  assert.equal(tags.length,4,'one explicit line spacing rule per paragraph');
  for(let i=0;i<rates.length;i++){
    const [rate,expected]=rates[i];
    assert.equal(paragraphLineHeight(rate,null),Number(rate));
    assert.match(tags[i],new RegExp('w:line="'+expected+'"'));
    assert.match(tags[i],/w:lineRule="auto"/);
    assert.match(tags[i],/w:before="0"/);
    assert.match(tags[i],/w:after="0"/);
  }
  assert.equal(JSON.stringify(document),pristine,'export must not mutate notes or timeSpan');
});

test('G00 Word/OOXML: fallback 1.15 and legacy inline spacing are exported',async()=>{
  const document={type:'doc',content:[
    {type:'paragraph',content:[{type:'text',text:'Mặc định không đặt giãn dòng'}]},
    {type:'paragraph',content:[{type:'text',text:'Giãn dòng đời trước',
      marks:[{type:'textStyle',attrs:{lineHeight:'1.5'}}]}]}
  ]};
  const xml=readEntry(Buffer.from(await (await exportWord({document})).arrayBuffer()),
    'word/document.xml');
  const tags=[...xml.matchAll(/<w:spacing\b[^>]*\/>/g)].map(m=>m[0])
    .filter(tag=>tag.includes('w:line='));
  assert.equal(tags.length,2);
  assert.match(tags[0],/w:line="276"/);
  assert.match(tags[1],/w:line="360"/);
});


test('G00 actual DOCX A4 margin presets match print selection',async()=>{
  for(const [preset,left,right,top,bottom] of [
    ['official',1701,1134,1134,1134],
    ['balanced',1417,1417,1134,1134],
    ['compact',1134,1134,1134,1134]
  ]){
    const file=await exportWord({
      title:'Kiểm tra lề',
      pageMarginPreset:preset,
      document:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Biên bản họp'}]}]}
    });
    const xml=readEntry(Buffer.from(await file.arrayBuffer()),'word/document.xml');
    const tag=xml.match(/<w:pgMar\b[^>]*\/>/)?.[0];
    assert.ok(tag, 'required OOXML page margins for '+preset);
    for(const [side,value] of Object.entries({left,right,top,bottom}))
      assert.match(tag,new RegExp('w:'+side+'="'+value+'"'),preset+' '+side);
    assert.match(xml,/<w:pgSz\b[^>]*w:w="11906"[^>]*w:h="16838"/);
  }
});


test('G00 DOCX preserves native editable numbered and nested bullet lists',async()=>{
  const p=text=>({type:'paragraph',content:[{type:'text',text}]});
  const li=(name,more=[])=>({type:'listItem',content:[p(name),...more]});
  const document={type:'doc',content:[
    {type:'orderedList',attrs:{start:3},content:[li('Mục thứ ba'),li('Mục thứ tư',[
      {type:'bulletList',content:[li('Ý phụ 1'),li('Ý phụ 2')]}
    ])]},
    p('Một đoạn văn bình thường'),
    {type:'orderedList',content:[li('Danh sách mới bắt đầu từ một')]}
  ]};
  const before=JSON.stringify(document);
  const file=await exportWord({document});
  const bytes=Buffer.from(await file.arrayBuffer());
  const xml=readEntry(bytes,'word/document.xml');
  const numbering=readEntry(bytes,'word/numbering.xml');
  assert.ok((xml.match(/<w:numPr>/g)||[]).length>=5,'native numbering for list items');
  assert.match(numbering,/<w:abstractNum\b/);
  assert.match(numbering,/<w:start w:val="3"\s*\/>/);
  assert.match(numbering,/<w:numFmt w:val="bullet"\s*\/>/);
  assert.match(numbering,/<w:numFmt w:val="decimal"\s*\/>/);
  assert.equal(JSON.stringify(document),before,'export must not edit original note');
});
