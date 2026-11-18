import {foldVietnamese} from './meeting-search.mjs';

/** Find a match in a ProseMirror document without changing the source text.
 * Mapping is stored in UTF-16 ProseMirror offsets, not grapheme ordinals.
 * Adjacent styled text nodes remain searchable; paragraph/table boundaries
 * never become a false contiguous match. Return null for title-only matches.
 */
export function firstMeetingTextMatch(doc,rawQuery){
  const query=foldVietnamese(String(rawQuery??'').trim());
  if(!query||query.length>256||!doc?.descendants)return null;
  let folded='',starts=[],ends=[],lastEnd=null;
  doc.descendants((node,pos)=>{
    if(!node?.isText||typeof node.text!=='string')return;
    // ProseMirror text nodes in the same paragraph are position-contiguous;
    // crossing any structural boundary creates an intentional separator.
    if(lastEnd!==null&&pos>lastEnd){
      folded+='\n';starts.push(-1);ends.push(-1);
    }
    for(let i=0;i<node.text.length;){
      const scalar=String.fromCodePoint(node.text.codePointAt(i));
      const len=scalar.length;
      const normalized=foldVietnamese(scalar);
      for(let k=0;k<normalized.length;k++){
        folded+=normalized[k];starts.push(pos+i);ends.push(pos+i+len);
      }
      i+=len;
    }
    lastEnd=pos+node.text.length;
  });
  const at=folded.indexOf(query);
  if(at<0||starts[at]<0||ends[at+query.length-1]<0)return null;
  return {from:starts[at],to:ends[at+query.length-1]};
}
