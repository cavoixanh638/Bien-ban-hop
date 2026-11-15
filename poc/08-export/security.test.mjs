import assert from 'node:assert/strict';
import {exportTXT,exportMarkdown,exportCSV,exportDOCX,normalize} from './exporter.mjs';

const text=(value,marks=[])=>({type:'text',text:value,...(marks.length?{marks}:{})});
const para=(value,marks=[])=>({type:'paragraph',content:[text(value,marks)]});
const listItem=value=>({type:'listItem',content:[para(value)]});
const document=(blocks,includeTimestamps=false,extra={})=>({document:{type:'doc',content:blocks},title:'Biên bản họp thử',includeTimestamps,...extra});
let total=0;
const test=(name,fn)=>{fn();console.log('PASS',name);total++;};

const hostile='<script>alert(1)</script> & <img src=x onerror=alert(2)>';
test('Markdown pasted HTML is entity-escaped, not rendered as raw HTML',()=>{
 const result=exportMarkdown(document([para(hostile)]));
 assert.doesNotMatch(result,/<script>|<img\s/);
 assert.match(result,/&lt;script&gt;/);
 assert.match(result,/&lt;img src=x onerror=alert\\\(2\\\)&gt;/);
 assert.match(result,/&amp;/);
});
test('Markdown preserves literal ampersands and Vietnamese text through safe escaping',()=>{
 const result=exportMarkdown(document([para('Hải Phòng & Quán Nam < 7')]))
 assert.match(result,/Hải Phòng &amp; Quán Nam &lt; 7/);
});
test('Plain text export remains faithful to user-entered HTML-like text',()=>{
 assert.match(exportTXT(document([para(hostile)])),/<script>alert\(1\)<\/script>/);
});
test('CSV formula-leading text is neutralized by default',()=>{
 const value='=SUM(1,2)';const result=exportCSV(document([para(value)]));
 assert.match(result,/'=SUM\(1,2\)/);
 assert.doesNotMatch(result,/,"=SUM\(1,2\)"/);
});
test('CSV alternative formula triggers are neutralized',()=>{
 for(const prefix of ['+','-','@',' =','\t=','\r\n=','\uFEFF=']){
  const csv=exportCSV(document([para(prefix+'1+1')]));
  assert.ok(csv.includes('"\''+prefix+'1+1"'),JSON.stringify({prefix,csv}));
 }
});
test('CSV ordinary text remains byte-for-byte unchanged except quoting',()=>{
 assert.match(exportCSV(document([para('Trường tiểu học, Hải Phòng')])),/"Trường tiểu học, Hải Phòng"/);
});
test('CSV raw opt-out preserves formula-like strings, but is explicitly opt-in',()=>{
 const csv=exportCSV(document([para('=1+1')],false,{csvFormulaPolicy:'raw'}));
 assert.ok(csv.includes('"=1+1"'));
 assert.ok(!csv.includes('"\'=1+1"'));
});
test('CSV invalid safety policy fails closed',()=>{
 assert.throws(()=>exportCSV(document([para('1')],false,{csvFormulaPolicy:'typo'})),/csvFormulaPolicy/);
});
test('CSV risky meeting title is guarded too',()=>{
 const input=document([para('Nội dung')]);input.title='=cmd();';
 assert.match(exportCSV(input),/"'=cmd\(\);"/);
});
test('CSV risky anchorId is guarded in marked mode',()=>{
 const marker={type:'timeSpan',attrs:{anchorId:'=1+1',recordingId:'r',audioOffsetMs:0,typedAt:1,source:'paste',schemaVersion:1}};
 const result=exportCSV(document([para('text',[marker])],true));
 assert.match(result,/"'=1\+1","r","0"/);
});
test('TXT non-default ordered list numbering is honored',()=>{
 const doc=document([{type:'orderedList',attrs:{start:7},content:[listItem('Bảy'),listItem('Tám')]}]);
 assert.match(exportTXT(doc),/7\. Bảy\n8\. Tám\n/);
});
test('Markdown non-default ordered list numbering is honored',()=>{
 const doc=document([{type:'orderedList',attrs:{start:7},content:[listItem('Bảy'),listItem('Tám')]}]);
 assert.match(exportMarkdown(doc),/7\. Bảy\n8\. Tám\n/);
});
test('DOCX native list numbering has correct startOverride',()=>{
 const doc=document([{type:'orderedList',attrs:{start:7},content:[listItem('Bảy'),listItem('Tám')]}]);
 const raw=new TextDecoder().decode(exportDOCX(doc));
 assert.match(raw,/<w:startOverride w:val="7"\/>/);
 assert.match(raw,/<w:numPr><w:ilvl w:val="0"\/><w:numId w:val="1"\/><\/w:numPr>/);
});
test('Separate DOCX ordered list groups have separate numbering instances and starts',()=>{
 const blocks=[{type:'orderedList',attrs:{start:2},content:[listItem('Hai')]},{type:'orderedList',attrs:{start:9},content:[listItem('Chín')]}];
 const raw=new TextDecoder().decode(exportDOCX(document(blocks)));
 assert.match(raw,/<w:num w:numId="1">[\s\S]*?<w:startOverride w:val="2"\/>/);
 assert.match(raw,/<w:num w:numId="2">[\s\S]*?<w:startOverride w:val="9"\/>/);
});
test('Export does not mutate input document even with safety transforms',()=>{
 const input=document([para(hostile),para('=SUM(1,2)')]);
 const before=JSON.stringify(input);
 exportMarkdown(input);exportCSV(input);exportTXT(input);exportDOCX(input);
 assert.equal(JSON.stringify(input),before);
});
console.log('TOTAL',total,'PASS');
