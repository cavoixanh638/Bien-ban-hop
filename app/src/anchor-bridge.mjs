/** Resolve a clicked DOM anchor ID against the immutable ProseMirror model.
 * DOM attributes are NOT trusted audio source and the caret may land on an
 * ambiguous boundary even though the user clicked inside a visible span.
 */
export function verifiedClickedAnchor(doc,anchorId,allowedRecordingIds,pendingLinks=null){
  if(!doc||typeof doc.descendants!=='function'||typeof anchorId!=='string'||!anchorId||
     !allowedRecordingIds || typeof allowedRecordingIds.has!=='function')return null;
  let selected=null,invalid=false;
  doc.descendants(node=>{
    if(!node.isText)return;
    for(const mark of node.marks??[]){
      if(mark.type?.name!=='timeSpan'&&mark.type!=='timeSpan')continue;
      const a=mark.attrs;
      if(a?.anchorId!==anchorId)continue;
      if(selected && JSON.stringify(selected)!==JSON.stringify(a))invalid=true;
      if(!selected)selected={...a};
    }
  });
  if(invalid||!selected||pendingLinks?.has?.(anchorId))return null;
  if(!allowedRecordingIds.has(selected.recordingId)||typeof selected.recordingId!=='string'||
     !Number.isSafeInteger(selected.audioOffsetMs)||selected.audioOffsetMs<0 ||
     !Number.isSafeInteger(selected.typedAt)||selected.typedAt<0||
     !['live_recording','imported_playback','playback_paused'].includes(selected.source)||
     selected.schemaVersion!==1)return null;
  return selected;
}
