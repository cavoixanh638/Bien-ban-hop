import MiniSearch from 'minisearch';

/** Deterministic Vietnamese accent folding for offline search only.
 * Original content, grapheme offsets and timeSpan anchors are never modified.
 */
export const foldVietnamese=input=>String(input??'')
  .normalize('NFD').replace(/\p{Diacritic}/gu,'')
  .replace(/[đĐ]/g,c=>c==='đ'?'d':'D')
  .toLowerCase();

export function plainTextFromDoc(doc,maxChars=160000){
  const out=[];let size=0;
  function walk(node){
    if(!node||size>=maxChars)return;
    if(node.type==='text'&&typeof node.text==='string'){
      const sub=node.text.slice(0,maxChars-size);out.push(sub);size+=sub.length;
    }
    for(const child of node.content??[])walk(child);
    if(['paragraph','heading','tableCell'].includes(node.type)){out.push(' ');size++;}
  }
  walk(doc);
  return out.join(' ').slice(0,maxChars);
}
export function buildMeetingSearchIndex(meetings){
  const index=new MiniSearch({
    fields:['titleSearch','contentSearch'],
    storeFields:['meetingId','title','excerpt'],
    searchOptions:{prefix:true,fuzzy:0.15,boost:{titleSearch:3}}
  });
  index.addAll(meetings.map(m=>({
    id:m.meetingId,
    meetingId:m.meetingId,
    title:m.title,
    excerpt:m.text?.slice(0,120)??'',
    titleSearch:foldVietnamese(m.title),
    contentSearch:foldVietnamese(m.text)
  })));
  return index;
}
export function searchMeetings(index,query){
  if(!String(query??'').trim())return [];
  return index.search(foldVietnamese(query),{prefix:true,fuzzy:0.15});
}
