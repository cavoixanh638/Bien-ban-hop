import {
  Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,
  AlignmentType,HeadingLevel,WidthType
} from 'docx';
import {fontSizeToHalfPoints,paragraphLineHeight} from './word-layout.mjs';
import {firstLineIndentTwips} from './paragraph-indent.mjs';

/* Rendering is deliberately one-way. The authoritative timeSpan marks and audio
   stay in the .bbhop backup; a DOCX is a standalone human-readable document. */
const blocks=x=>Array.isArray(x?.content)?x.content:[];
const color=x=>typeof x==='string'&&/^#?[0-9a-fA-F]{6}$/.test(x)?x.replace('#','').toUpperCase():undefined;
const textStyle=n=>n?.marks?.find(m=>m.type==='textStyle')?.attrs??{};
const linkedMark=n=>n?.marks?.find(m=>m.type==='timeSpan')?.attrs??null;
const clock=ms=>{
  const seconds=Math.floor(ms/1000);
  return [Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60]
    .map(n=>String(n).padStart(2,'0')).join(':');
};
const richRun=(node,{includeTimestamps=false,lastAnchor=null}={})=>{
  const text=String(node?.text??'');
  const style=textStyle(node),marks=new Set(node?.marks?.map(m=>m.type)??[]);
  const options={
    text,
    bold:marks.has('bold'),
    italics:marks.has('italic'),
    underline:marks.has('underline')?{type:'single'}:undefined,
    strike:marks.has('strike'),
    font:style.fontFamily||'Times New Roman',
    size:fontSizeToHalfPoints(style.fontSize),
    color:color(style.color)||'23353C',
    shading:color(style.backgroundColor)?{fill:color(style.backgroundColor)}:
      marks.has('important')?{fill:'FDE68A'}:undefined
  };
  const out=[];
  const mark=linkedMark(node);
  if(includeTimestamps && mark?.recordingId && Number.isFinite(mark?.audioOffsetMs)){
    const key=mark.recordingId+':'+mark.audioOffsetMs;
    if(key!==lastAnchor)out.push(new TextRun({text:' ['+clock(mark.audioOffsetMs)+'] ',color:'6D7A7C',size:19}));
    lastAnchor=key;
  }
  out.push(new TextRun(options));
  return {runs:out,lastAnchor};
};
function runsFrom(nodes,opts){
  const runs=[];let anchor=null;
  for(const n of nodes){
    if(n.type==='hardBreak'){runs.push(new TextRun({break:1}));anchor=null;continue;}
    if(n.type!=='text')continue;
    const result=richRun(n,{includeTimestamps:opts.includeTimestamps,lastAnchor:anchor});
    runs.push(...result.runs);anchor=result.lastAnchor;
  }
  return runs.length?runs:[new TextRun({text:''})];
}
const alignment=a=>({center:AlignmentType.CENTER,right:AlignmentType.RIGHT,
  justify:AlignmentType.JUSTIFIED,left:AlignmentType.LEFT}[a]||AlignmentType.LEFT);
function para(n,opts={},extra={}){
  const level=Number(n.attrs?.level);
  const h=n.type==='heading'&&level>=1&&level<=3?
    [HeadingLevel.HEADING_1,HeadingLevel.HEADING_2,HeadingLevel.HEADING_3][level-1]:undefined;
  // Line height is a block attribute; older notes may still contain the
  // previous ineffective inline textStyle value, supported for export only.
  const firstStyled=blocks(n).find(x=>textStyle(x).lineHeight);
  const height=paragraphLineHeight(n.attrs?.lineHeight,textStyle(firstStyled).lineHeight);
  return new Paragraph({
    children:runsFrom(blocks(n),opts),
    heading:h,alignment:alignment(n.attrs?.textAlign),
    indent:firstLineIndentTwips(n.attrs?.firstLineIndentPt)?{
      firstLine:firstLineIndentTwips(n.attrs?.firstLineIndentPt)}:undefined,
    spacing:{before:0,after:0,line:Math.round(240*height),lineRule:'auto'},
    ...extra
  });
}
function listBlocks(n,opts={},depth=0){
  const out=[],ordered=n.type==='orderedList';
  let count=Number.isSafeInteger(n.attrs?.start)?n.attrs.start:1;
  for(const li of blocks(n)){
    let first=true;
    for(const child of blocks(li)){
      if(child.type==='paragraph'||child.type==='heading'){
        // The explicit prefix is intentional: no unstable numbering relationship
        // when exporting nested lists through the independent browser pipeline.
        const prefix=first?(ordered?String(count++)+'. ':'• '):'';
        const clone={...child,content:[{type:'text',text:prefix},...blocks(child)]};
        out.push(para(clone,opts,{indent:{left:360*(depth+1),hanging:180}}));
        first=false;
      }else if(child.type==='bulletList'||child.type==='orderedList'){
        out.push(...listBlocks(child,opts,Math.min(depth+1,8)));
      }
    }
  }
  return out;
}
function tableNode(n,opts){
  const rows=blocks(n).filter(x=>x.type==='tableRow').map(row=>new TableRow({
    children:blocks(row).filter(x=>x.type==='tableCell'||x.type==='tableHeader').map(cell=>{
      const content=renderNodes(blocks(cell),opts);
      return new TableCell({
        children:content.length?content:[new Paragraph('')],
        columnSpan:Number.isSafeInteger(cell.attrs?.colspan)&&cell.attrs.colspan>=1?
          Math.min(cell.attrs.colspan,20):1
      });
    })
  }));
  return new Table({rows:rows.length?rows:[new TableRow({children:[
    new TableCell({children:[new Paragraph('')]})
  ]})],width:{size:100,type:WidthType.PERCENTAGE}});
}
export function renderNodes(nodes,opts={}){
  const out=[];
  for(const node of nodes){
    if(node.type==='paragraph'||node.type==='heading')out.push(para(node,opts));
    else if(node.type==='bulletList'||node.type==='orderedList')
      out.push(...listBlocks(node,opts));
    else if(node.type==='table')out.push(tableNode(node,opts));
    else if(node.type==='blockquote'){
      for(const child of blocks(node))if(child.type==='paragraph')
        out.push(para(child,opts,{indent:{left:440}}));
    }
  }
  return out;
}
export async function exportWord(input){
  const doc=input?.document??input;
  if(doc?.type!=='doc'||!Array.isArray(doc.content))throw Error('Nội dung ghi chú không hợp lệ');
  const title=String(input.title??'Biên bản họp');
  const page=new Document({
    creator:'Biên bản họp',
    sections:[{properties:{
      page:{size:{width:11906,height:16838},margin:{top:1134,bottom:1134,left:1701,right:1134}}
    },children:[
      new Paragraph({text:title,heading:HeadingLevel.TITLE,spacing:{after:220}}),
      ...renderNodes(doc.content,{includeTimestamps:!!input.includeTimestamps})
    ]}]
  });
  return Packer.toBlob(page);
}
