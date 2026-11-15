import assert from 'node:assert/strict';
import { exportTXT, exportMarkdown, exportCSV, exportDOCX, exportAll, normalize } from './exporter.mjs';

const t=(text,marks)=>({type:'text',text,...(marks?{marks}:{})});
const p=(...content)=>({type:'paragraph',content});
const item=(...content)=>({type:'listItem',content});
const list=(type,...content)=>({type,content});
const wrap=(content,includeTimestamps=true,title='Họp thử nghiệm')=>({
  document:{type:'doc',content}, title,includeTimestamps
});
let total=0;
function check(description,callback){callback();console.log('PASS',description);total++;}
const a=(id,ms=0,typedAt=1794756000000)=>({type:'timeSpan',attrs:{anchorId:id,recordingId:'rec-thử',audioOffsetMs:ms,typedAt,source:'live_recording',schemaVersion:1}});

check('combined bold and italic retained in Markdown',()=>{
  assert.match(exportMarkdown(wrap([p(t('Văn bản', [{type:'bold'},{type:'italic'}]))],false)),/\*\*\*Văn bản\*\*\*/);
});
check('Markdown escapes pasted metacharacters',()=>{
  const markdown=exportMarkdown(wrap([p(t('mẫu * _ [ ] # & < >'))],false));
  assert.match(markdown,/\\\*/);
  assert.match(markdown,/\\\[/);
});
check('Markdown bullet list uses valid syntax',()=>{
  const d=wrap([list('bulletList',item(p(t('A'))),item(p(t('B'))))],false);
  assert.match(exportMarkdown(d),/\n- A\n- B\n/);
});
check('nested list retains indentation and parent ordinal',()=>{
  const doc=wrap([list('orderedList',item(p(t('một')),list('bulletList',item(p(t('nhánh')))),p(t('giải thích'))),item(p(t('hai'))))],false);
  const plain=exportTXT(doc);
  assert.match(plain,/1\. một\n  • nhánh\ngiải thích\n2\. hai/);
});
check('separate ordered lists restart at 1',()=>{
  const doc=wrap([list('orderedList',item(p(t('một'))),item(p(t('hai')))),list('orderedList',item(p(t('ba'))))],false);
  assert.match(exportTXT(doc),/1\. một\n2\. hai\n1\. ba/);
});
check('two paragraphs in one list item have one bullet',()=>{
  const doc=wrap([list('bulletList',item(p(t('đầu')),p(t('tiếp'))))],false);
  assert.match(exportTXT(doc),/• đầu\ntiếp/);
});
check('zero media offset stays a real mark',()=>{
  assert.match(exportTXT(wrap([p(t('bắt đầu',[a('a-zero',0)]))])),/rec-thử@00:00:00\.000/);
});
check('different typedAt produces separate mark boundaries',()=>{
  const doc=wrap([p(t('A',[a('same',10,1)]),t('B',[a('same',10,2)]))]);
  assert.equal((exportTXT(doc).match(/rec-thử@00:00:00\.010/g)||[]).length,2);
});
check('mark label is separated from previous word',()=>{
  const doc=wrap([p(t('trước',[a('a1',1000)]),t('sau',[a('a2',2000)]))]);
  assert.match(exportTXT(doc),/trước \[rec-thử@00:00:02\.000\] sau/);
});
check('hardBreak inside a marked phrase does not introduce an unlinked label',()=>{
  const doc=wrap([p(t('đầu',[a('a1',2)]),{type:'hardBreak'},t('cuối',[a('a1',2)]))]);
  const result=exportTXT(doc);
  assert.match(result,/đầu\ncuối/);
  assert.doesNotMatch(result,/không liên kết âm thanh/);
});
check('missing audio and null recording are reported as unlinked',()=>{
  const doc=wrap([p(t('vùng không có nguồn',[{type:'timeSpan',attrs:{recordingId:null,audioOffsetMs:null,source:'unlinked'}}]))]);
  assert.match(exportTXT(doc),/không liên kết âm thanh/);
  assert.doesNotMatch(exportTXT(doc),/rec-thử@/);
});
check('DOCX XML escapes tags, ampersands and quotes',()=>{
  const s=new TextDecoder().decode(exportDOCX(wrap([p(t('a<&>"b'))],false)));
  assert.match(s,/a&lt;&amp;&gt;&quot;b/);
  assert.doesNotMatch(s,/<w:t[^>]*>a<&>/);
});
check('DOCX replaces prohibited XML control characters',()=>{
  const s=new TextDecoder().decode(exportDOCX(wrap([p(t('x\u0001y\uffffz'))],false)));
  assert.match(s,/x�y�z/);
  assert.doesNotMatch(s.slice(s.indexOf('<w:document'),s.indexOf('</w:document>')+13),/\u0001|\uffff/);
});
check('DOCX keeps supplementary Unicode characters',()=>{
  const s=new TextDecoder().decode(exportDOCX(wrap([p(t('Hải Phòng 😀'))],false)));
  assert.match(s,/Hải Phòng 😀/);
});
check('CSV quotes commas, double quotes and CRLF inside a field',()=>{
  const raw='Một, "hai"\r\nBa';
  const csv=exportCSV(wrap([p(t(raw))],false));
  assert.match(csv, /"Một, ""hai""\r\nBa"/);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.endsWith('\r\n'));
});
check('marked CSV keeps raw audioOffsetMs/typedAt without pre-roll',()=>{
  const csv=exportCSV(wrap([p(t('mốc',[a('a1',3723456,1794756000000)]))]));
  assert.match(csv,/"3723456","1794756000000","live_recording","true"/);
});
check('clean exports omit metadata timestamps',()=>{
  const doc=wrap([p(t('chữ',[a('a1',3723456)]))],false);
  const files=exportAll(doc);
  for(const ext of ['txt','md','csv'])assert.doesNotMatch(files[ext],/rec-thử@|3723456|a1/);
  assert.doesNotMatch(new TextDecoder().decode(files.docx),/rec-thử@|3723456|a1/);
});
check('invalid ProseMirror input is rejected early',()=>{
  assert.throws(()=>normalize({document:{type:'paragraph',content:[]}}),TypeError);
});
check('export does not mutate the caller document',()=>{
  const doc=wrap([p(t('chữ',[a('a1',3)]))]);const before=JSON.stringify(doc);
  exportAll(doc);assert.equal(JSON.stringify(doc),before);
});
check('DOCX ZIP output is repeatable and has a signature',()=>{
  const doc=wrap([p(t('dữ liệu'))]);const x=exportDOCX(doc);
  assert.deepEqual(x,exportDOCX(doc));assert.deepEqual([...x.slice(0,4)],[0x50,0x4b,0x03,0x04]);
});
console.log('TOTAL '+total+' PASS');
