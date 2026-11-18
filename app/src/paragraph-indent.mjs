import {Extension} from '@tiptap/core';
/** Serializable bounded first-line indent; does not change timeSpan marks. */
export const ParagraphIndent=Extension.create({
  name:'meetingParagraphIndent',
  addGlobalAttributes(){
    return [{types:['paragraph','heading'],attributes:{
      firstLineIndentPt:{
        default:0,
        parseHTML:el=>{
          const n=Number(el.getAttribute('data-indent-first-pt'));
          return Number.isFinite(n)&&n>=0&&n<=72?n:0;
        },
        renderHTML:attrs=>{
          const n=Number(attrs.firstLineIndentPt);
          return Number.isFinite(n)&&n>0&&n<=72?
            {'data-indent-first-pt':String(n),style:'text-indent:'+n+'pt'}:{};
        }
      }
    }}];
  }
});
export function adjustFirstLineIndent(editor,delta){
  if(!editor?.state?.doc||![-12,12].includes(delta))return false;
  const {doc,selection}=editor.state,blocks=[];
  doc.nodesBetween(selection.from,selection.to,(node,pos)=>{
    if(['paragraph','heading'].includes(node.type?.name))
      blocks.push({type:node.type.name,indent:node.attrs?.firstLineIndentPt??0,pos});
  });
  if(!blocks.length&&['paragraph','heading'].includes(selection.$from?.parent?.type?.name))
    blocks.push({type:selection.$from.parent.type.name,
      indent:selection.$from.parent.attrs?.firstLineIndentPt??0,pos:selection.$from.before()});
  if(!blocks.length)return false;
  const first=blocks[0],target=Math.max(0,Math.min(72,first.indent+delta));
  let chain=editor.chain().focus();
  for(const type of new Set(blocks.map(b=>b.type)))
    chain=chain.updateAttributes(type,{firstLineIndentPt:target});
  return chain.run();
}
export function firstLineIndentTwips(value){
  const n=Number(value);
  return Number.isFinite(n)&&n>=0&&n<=72?Math.round(n*20):0;
}
