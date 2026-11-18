/**
 * Document typography helpers.
 * Word font-size controls use points (pt); CSS pixels are only used for
 * legacy documents created before the UI exposed point units.
 */
const ACCEPTED_SPACING=new Set(['1','1.15','1.5','2']);

export function fontSizeToHalfPoints(value,defaultHalfPoints=28){
  if(typeof value!=='string')return defaultHalfPoints;
  const match=/^\s*(\d+(?:\.\d+)?)\s*(px|pt)\s*$/i.exec(value);
  if(!match)return defaultHalfPoints;
  const n=Number(match[1]);
  const points=match[2].toLowerCase()==='px'?n*0.75:n;
  if(!Number.isFinite(points)||points<6||points>96)return defaultHalfPoints;
  return Math.round(points*2);
}

export function paragraphLineHeight(blockValue,legacyInlineValue){
  const value=blockValue??legacyInlineValue;
  const n=Number(value);
  return Number.isFinite(n)&&n>=1&&n<=3?n:1.15;
}

/**
 * Apply spacing to the selected paragraph/heading nodes, not to a TextStyle
 * span. Updating block attrs preserves the timeSpan marks on text children.
 * Only chain matched node types: Tiptap updateAttributes returns false when
 * the selected range has no matching node, which would abort the chain.
 */
export function applyBlockLineHeight(editor,value){
  if(!ACCEPTED_SPACING.has(value)||!editor?.state?.doc)return false;
  const {doc,selection}=editor.state;
  const types=new Set();
  doc.nodesBetween(selection.from,selection.to,node=>{
    if(node.type?.name==='paragraph'||node.type?.name==='heading')types.add(node.type.name);
  });
  // Cursor-only selections: ensure the immediate textblock is included.
  if(!types.size&&['paragraph','heading'].includes(selection.$from?.parent?.type?.name)){
    types.add(selection.$from.parent.type.name);
  }
  if(!types.size)return false;
  let chain=editor.chain().focus();
  for(const type of types)chain=chain.updateAttributes(type,{lineHeight:value});
  return chain.run();
}
