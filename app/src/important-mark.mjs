import {Mark} from '@tiptap/core';
import {isAllowedMeetingMark} from '../../poc/01-editor/src/policy.mjs';

/** The bookmark lives INSIDE the authoritative note document.
 * No independent timestamp table, no fabricated audio positions.
 */
export const ImportantMark=Mark.create({
  name:'important',
  inclusive:false,
  parseHTML(){return [{tag:'span[data-important-note="true"]'}];},
  renderHTML({HTMLAttributes}){return ['span',{...HTMLAttributes,'data-important-note':'true',
    class:'important-note'},0];}
});
export function collectImportantAnchors(doc,allowedRecordingIds,{limit=150}={}){
  const found=new Map();
  function walk(node){
    if(found.size>=limit)return;
    if(node?.type==='text'){
      const marks=Array.isArray(node.marks)?node.marks:[];
      if(!marks.some(x=>x.type==='important'))return;
      const candidate=marks.find(x=>x.type==='timeSpan')?.attrs;
      if(!isAllowedMeetingMark(candidate,allowedRecordingIds)||!candidate.recordingId)return;
      const id=candidate.anchorId;
      const text=String(node.text??'').replace(/\s+/g,' ').trim();
      const old=found.get(id);
      if(old)old.label=(old.label+' '+text).trim().slice(0,140);
      else found.set(id,{anchorId:id,recordingId:candidate.recordingId,
        audioOffsetMs:candidate.audioOffsetMs,label:text.slice(0,140)});
    }
    for(const child of node?.content??[])walk(child);
  }
  walk(doc);
  return [...found.values()];
}
