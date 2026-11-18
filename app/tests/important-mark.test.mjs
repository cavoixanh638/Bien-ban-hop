import test from 'node:test';
import assert from 'node:assert/strict';
import {collectImportantAnchors} from '../src/important-mark.mjs';
const linked={schemaVersion:1,anchorId:'span-a',recordingId:'rec-import-r',
  audioOffsetMs:8700,source:'imported_playback',typedAt:1795000000000};
test('G00 bookmark is derived from the note text, never invents audio provenance',()=>{
  const doc={type:'doc',content:[{type:'paragraph',content:[
    {type:'text',text:'Điểm một',marks:[{type:'important'},{type:'timeSpan',attrs:linked}]},
    {type:'text',text:' nối tiếp',marks:[{type:'important'},{type:'timeSpan',attrs:linked}]},
    {type:'text',text:'không liên kết',marks:[{type:'important'}]},
    {type:'text',text:'nguồn khác',marks:[{type:'important'},{type:'timeSpan',
      attrs:{...linked,anchorId:'span-b',recordingId:'rec-other'}}]}
  ]}]};
  const before=JSON.stringify(doc);
  const found=collectImportantAnchors(doc,new Set(['rec-import-r']));
  assert.equal(found.length,1);
  assert.equal(found[0].recordingId,'rec-import-r');
  assert.equal(found[0].audioOffsetMs,8700);
  assert.match(found[0].label,/Điểm một nối tiếp/);
  assert.equal(JSON.stringify(doc),before,'bookmark indexing cannot change the note');
});
