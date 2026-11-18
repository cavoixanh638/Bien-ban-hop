/** Fail-closed guard for bulk find-and-replace.
 * A typed timeSpan belongs to the original text, not a transcription.
 * Search decoration is safe; auto-replacing linked words may invent provenance.
 */
export function overlapsTimeSpan(doc,{from,to}){
  if(!doc||!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<0||to<=from)return true;
  let found=false;
  try{
    doc.nodesBetween(from,to,(node,pos)=>{
      if(!node?.isText)return;
      if(pos<to && pos+node.nodeSize>from &&
        node.marks?.some(m=>m.type?.name==='timeSpan'||m.type==='timeSpan'))found=true;
    });
  }catch{return true;}
  return found;
}
export function canReplaceFindResults(doc,results,currentIndex,all=false){
  if(!Array.isArray(results)||!results.length)return {ok:false,reason:'no-results'};
  const current=all?results:(Number.isInteger(currentIndex)&&currentIndex>=0?
    [results[currentIndex]]:[]);
  if(!current.length||current.some(r=>!r||overlapsTimeSpan(doc,r)))
    return {ok:false,reason:'linked-or-ambiguous'};
  return {ok:true};
}
