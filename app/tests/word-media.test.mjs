import test from 'node:test';
import assert from 'node:assert/strict';
import {safeLink,imageNodeFromFile,isSafeImageSource} from '../src/word-media.mjs';
import {exportWord} from '../src/rich-docx.mjs';
const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg=='),c=>c.charCodeAt(0));
test('G00 sanitized links reject javascript, credentials, and unsupported schemes',()=>{
  assert.equal(safeLink('https://example.com/a'),'https://example.com/a');
  for(const url of ['javascript:alert(1)','data:text/html,x','file:///etc/passwd',
    'https://username:password@example.com','not-a-url']){
    assert.throws(()=>safeLink(url));
  }
});
test('G00 bounded PNG note embeds safely and exports actual DOCX image + hyperlinks + page break',async()=>{
  const f=new Blob([png],{type:'image/png'});f.name='so-do.png';
  const image=await imageNodeFromFile(f);
  assert.equal(image.type,'meetingImage');
  assert.equal(image.attrs.width,1);assert.equal(image.attrs.height,1);
  assert.equal(isSafeImageSource(image.attrs.src),true);
  const doc={type:'doc',content:[
    {type:'paragraph',content:[{type:'text',text:'Nguồn tham khảo',marks:[
      {type:'meetingLink',attrs:{href:'https://example.com'}}
    ]}]},
    {type:'meetingPageBreak'},
    image
  ]};
  const snapshot=JSON.stringify(doc);
  const blob=await exportWord({title:'Tài liệu thử',document:doc});
  assert.ok(blob.size>1500);
  const contents=Buffer.from(await blob.arrayBuffer());
  assert.ok(contents.includes(Buffer.from('word/media/')),'embedded PNG present in DOCX ZIP');
  assert.ok(contents.includes(Buffer.from('word/_rels/document.xml.rels')),'links relationship part');
  assert.equal(JSON.stringify(doc),snapshot);
});
test('G00 refuse oversize or incorrect media input',async()=>{
  const f=new Blob([new Uint8Array(301000)],{type:'image/png'});f.name='too-big.png';
  await assert.rejects(imageNodeFromFile(f),/300 KB/);
  assert.equal(isSafeImageSource('https://example.com/a.png'),false);
});
