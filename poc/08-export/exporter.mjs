/** Mốc Họp V1.2 PoC: standalone DOCX, TXT, Markdown, CSV exporters. */
const utf8=new TextEncoder();
const esc=s=>String(s??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g,'\uFFFD').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const mdesc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/([\\`*_{}\[\]()#+.!|~-])/g,'\\$1');
const children=n=>Array.isArray(n?.content)?n.content:[];
const anchor=n=>n?.marks?.find(m=>m.type==='timeSpan')?.attrs??null;
const linked=a=>!!a&&typeof a.recordingId==='string'&&a.recordingId.trim().length>0&&Number.isInteger(a.audioOffsetMs)&&a.audioOffsetMs>=0;
const clock=ms=>{let n=Math.floor(ms/1000);return [Math.floor(n/3600),Math.floor(n%3600/60),n%60].map(x=>String(x).padStart(2,'0')).join(':')+'.'+String(ms%1000).padStart(3,'0');};
const label=a=>linked(a)?'['+a.recordingId+'@'+clock(a.audioOffsetMs)+']':'[không liên kết âm thanh]';
function flatten(nodes,level=0,list='',group=0,ctx={next:1,starts:new Map()}){let out=[];
 for(const n of nodes){if(n.type==='bulletList'||n.type==='orderedList'){const groupId=ctx.next++;if(n.type==='orderedList'){const start=n.attrs?.start;ctx.starts.set(groupId,Number.isSafeInteger(start)&&start>=1?start:1);}out.push(...flatten(children(n),level+1,n.type==='bulletList'?'bullet':'ordered',groupId,ctx));continue;}
 if(n.type==='listItem'){let first=true;for(const b of flatten(children(n),level,list,group,ctx)){if(b.level>level){out.push(b);}else{out.push({...b,list:first?list:'',level});first=false;}}continue;}
 if(n.type==='paragraph'||n.type==='heading'){const runs=[];function walk(ns){for(const c of ns){if(c.type==='text'){runs.push({text:String(c.text??''),bold:!!c.marks?.some(m=>m.type==='bold'),italic:!!c.marks?.some(m=>m.type==='italic'),anchor:anchor(c)});}else if(c.type==='hardBreak')runs.push({text:'\n',bold:false,italic:false,anchor:null});else walk(children(c));}}
 walk(children(n));out.push({kind:n.type,heading:n.type==='heading'?Math.min(6,Math.max(1,n.attrs?.level||1)):0,list,level,group,listStart:ctx.starts.get(group)||1,runs});continue;}
 out.push(...flatten(children(n),level,list,group,ctx));}return out;}
export function normalize(input){const d=input?.document??input;const pm=d?.type==='doc'?d:d?.content?.type==='doc'?d.content:null;if(!pm||!Array.isArray(pm.content))throw new TypeError('Expected ProseMirror doc');return {title:input?.title??'',marked:input?.includeTimestamps===true,blocks:flatten(pm.content)};}
function annotated(runs,marked){let last=null;const out=[];for(const r of runs){if(r.text==='\n'){out.push(r);continue;}if(!r.text)continue;const a=r.anchor;const key=linked(a)?JSON.stringify([a.anchorId,a.recordingId,a.audioOffsetMs,a.typedAt,a.source,a.schemaVersion]):'unlinked';if(marked&&key!==last){const prev=out.at(-1)?.text??'';out.push({text:(prev&&!/\s$/.test(prev)?' ':'')+label(a)+' ',bold:false,italic:false,annotation:true});}last=key;out.push(r);}return out;}
function numbers(blocks){const counter=new Map();return blocks.map(b=>{if(b.list!=='ordered')return 0;const n=(counter.get(b.group)??(b.listStart-1))+1;counter.set(b.group,n);return n;});}
function prefix(b,n){return b.list?'  '.repeat(Math.max(0,b.level-1))+(b.list==='bullet'?'• ':n+'. '):'';}
export function exportTXT(input){const {title,marked,blocks}=normalize(input);const nums=numbers(blocks);return [title,...blocks.map((b,i)=>prefix(b,nums[i])+annotated(b.runs,marked).map(r=>r.text).join(''))].join('\n')+'\n';}
function markdownRuns(runs,marked){return annotated(runs,marked).map(r=>{const t=mdesc(r.text).replace(/\n/g,'  \n');return r.bold&&r.italic&&t.trim()?'***'+t+'***':r.bold&&t.trim()?'**'+t+'**':r.italic&&t.trim()?'*'+t+'*':t;}).join('');}
function markdownBlock(n,marked){const block=flatten([n])[0];const text=markdownRuns(block?.runs??[],marked);return n.type==='heading'?'#'.repeat(Math.max(1,Math.min(6,n.attrs?.level||1)))+' '+text:text;}
function markdownList(n,indent,marked){const ordered=n.type==='orderedList';const start=ordered&&Number.isInteger(n.attrs?.start)?n.attrs.start:1;return children(n).map((item,i)=>{
 const marker=ordered?(start+i)+'. ':'- ',continuation=indent+' '.repeat(marker.length),lines=[];let first=true;
 for(const child of children(item)){
  if(child.type==='paragraph'||child.type==='heading'){
   const text=markdownBlock(child,marked);
   if(first){lines.push(indent+marker+text);first=false;}else{lines.push('',continuation+text);}
  }else if(child.type==='orderedList'||child.type==='bulletList'){
   if(first){lines.push(indent+marker.trimEnd());first=false;}
   lines.push(markdownList(child,continuation,marked));
  }else if(children(child).length){for(const nested of children(child)){if(nested.type==='paragraph'){lines.push('',continuation+markdownBlock(nested,marked));}}}
 }
 if(first)lines.push(indent+marker.trimEnd());return lines.join('\n');
}).join('\n');}
export function exportMarkdown(input){const {title,marked}=normalize(input),doc=input?.document??input,pm=doc.type==='doc'?doc:doc.content;const parts=['# '+mdesc(title)];for(const n of children(pm)){
 if(n.type==='bulletList'||n.type==='orderedList')parts.push(markdownList(n,'',marked));
 else if(n.type==='paragraph'||n.type==='heading')parts.push(markdownBlock(n,marked));
 else if(children(n).length)parts.push(children(n).map(c=>markdownBlock(c,marked)).join('\n'));
}return parts.join('\n\n')+'\n';}
const quote=s=>'"'+String(s??'').replace(/"/g,'""')+'"';
// CSV quotes alone do not prevent Excel/LibreOffice formula execution.
// Prefix a literal apostrophe for formula-like user content by default.
const formulaLike=s=>/^[\s\uFEFF\u00a0\u200b\u2028\u2029]*[=+\-@]/u.test(s)||/^[\t\r\n]/.test(s);
const safeCell=(s,policy)=>{const value=String(s??'');return quote(policy==='raw'||!formulaLike(value)?value:"'"+value);};
export function exportCSV(input){const {title,marked,blocks}=normalize(input);const policy=input?.csvFormulaPolicy??'escape';if(!['escape','raw'].includes(policy))throw new TypeError('csvFormulaPolicy must be escape or raw');const rows=[['meetingTitle','blockIndex','blockType','headingLevel','listType','text',...(marked?['anchorId','recordingId','audioOffsetMs','typedAt','source','linked']:[])]];blocks.forEach((b,i)=>{for(const r of b.runs.length?b.runs:[{text:'',anchor:null}]){const a=r.anchor;rows.push([title,i+1,b.kind,b.heading||'',b.list,r.text,...(marked?[a?.anchorId??'',a?.recordingId??'',Number.isInteger(a?.audioOffsetMs)?a.audioOffsetMs:'',Number.isFinite(a?.typedAt)?a.typedAt:'',a?.source??'',linked(a)]:[])]);}});return '\uFEFF'+rows.map(row=>row.map(value=>safeCell(value,policy)).join(',')).join('\r\n')+'\r\n';}
const u16=n=>[n&255,n>>>8&255],u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
const join=chunks=>{const size=chunks.reduce((s,x)=>s+x.length,0),data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}return data;};
const table=Array.from({length:256},(_,i)=>{let c=i;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc=bytes=>{let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return c^0xffffffff;};
function zip(files){const data=[],dir=[];let offset=0;for(const [name,content] of files){const filename=utf8.encode(name),bytes=utf8.encode(content),sum=crc(bytes)>>>0,s=bytes.length;const local=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(sum),...u32(s),...u32(s),...u16(filename.length),...u16(0)]);const entry=new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(sum),...u32(s),...u32(s),...u16(filename.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset)]);data.push(local,filename,bytes);dir.push(entry,filename);offset+=local.length+filename.length+s;}const directory=join(dir);const end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(directory.length),...u32(offset),...u16(0)]);return join([...data,directory,end]);}
const run=r=>String(r.text??'').split('\n').map((s,i)=>(i?'<w:r><w:br/></w:r>':'')+'<w:r>'+(r.annotation?'<w:rPr><w:b w:val="0"/><w:i w:val="0"/><w:color w:val="666666"/><w:sz w:val="17"/></w:rPr>':r.bold||r.italic?'<w:rPr>'+(r.bold?'<w:b/>':'')+(r.italic?'<w:i/>':'')+'</w:rPr>':'')+'<w:t xml:space="preserve">'+esc(s)+'</w:t></w:r>').join('');
const para=(runs,style='',listInfo=null)=>{
 const listPr=listInfo?'<w:numPr><w:ilvl w:val="'+listInfo.level+'"/><w:numId w:val="'+listInfo.id+'"/></w:numPr>':'';
 const properties=style||listPr?'<w:pPr>'+(style?'<w:pStyle w:val="'+style+'"/>':'')+listPr+'</w:pPr>':'';
 return '<w:p>'+properties+(runs.length?runs.map(run).join(''):'<w:r><w:t></w:t></w:r>')+'</w:p>';
};
function numberingXML(blocks,ns){
 const lists=new Map(blocks.filter(b=>b.list).map(b=>[b.group,{type:b.list,level:Math.max(0,Math.min(8,b.level-1)),start:b.listStart}]));
 const level=(type,i)=>'<w:lvl w:ilvl="'+i+'"><w:start w:val="1"/><w:numFmt w:val="'+(type==='bullet'?'bullet':'decimal')+'"/><w:lvlText w:val="'+(type==='bullet'?'•':'%'+(i+1)+'.')+'"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="'+((i+2)*540)+'"/></w:tabs><w:ind w:left="'+((i+2)*540)+'" w:hanging="360"/></w:pPr></w:lvl>';
 const abstracts=['bullet','ordered'].map((type,j)=>'<w:abstractNum w:abstractNumId="'+(j+1)+'"><w:multiLevelType w:val="hybridMultilevel"/>'+Array.from({length:9},(_,i)=>level(type,i)).join('')+'</w:abstractNum>').join('');
 const instances=[...lists].map(([id,info])=>'<w:num w:numId="'+id+'"><w:abstractNumId w:val="'+(info.type==='bullet'?1:2)+'"/>'+(info.type==='ordered'&&info.start!==1?'<w:lvlOverride w:ilvl="'+info.level+'"><w:startOverride w:val="'+info.start+'"/></w:lvlOverride>':'')+'</w:num>').join('');
 return '<w:numbering xmlns:w="'+ns+'">'+abstracts+instances+'</w:numbering>';
}
export function exportDOCX(input){
 const {title,marked,blocks}=normalize(input);
 const body=para([{text:title,bold:true}],'Title')+blocks.map(b=>para(annotated(b.runs,marked),b.heading?'Heading'+b.heading:'',b.list?{id:b.group,level:Math.min(8,Math.max(0,b.level-1))}:null)).join('');
 const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
 const styles='<w:styles xmlns:w="'+ns+'"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>'+Array.from({length:6},(_,i)=>'<w:style w:type="paragraph" w:styleId="Heading'+(i+1)+'"><w:name w:val="heading '+(i+1)+'"/><w:pPr><w:outlineLvl w:val="'+i+'"/></w:pPr><w:rPr><w:b/><w:sz w:val="'+Math.max(22,32-i*2)+'"/></w:rPr></w:style>').join('')+'</w:styles>';
 const relns='http://schemas.openxmlformats.org/package/2006/relationships';
 return zip([
  ['[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>'],
  ['_rels/.rels','<Relationships xmlns="'+relns+'"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
  ['word/_rels/document.xml.rels','<Relationships xmlns="'+relns+'"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>'],
  ['word/styles.xml','<?xml version="1.0" encoding="UTF-8"?>'+styles],
  ['word/numbering.xml','<?xml version="1.0" encoding="UTF-8"?>'+numberingXML(blocks,ns)],
  ['word/document.xml','<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="'+ns+'"><w:body>'+body+'<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1200" w:right="1200" w:bottom="1200" w:left="1200"/></w:sectPr></w:body></w:document>']
 ]);
}
export function exportAll(input){return {txt:exportTXT(input),md:exportMarkdown(input),csv:exportCSV(input),docx:exportDOCX(input)};}
export const mime={txt:'text/plain;charset=utf-8',md:'text/markdown;charset=utf-8',csv:'text/csv;charset=utf-8',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
