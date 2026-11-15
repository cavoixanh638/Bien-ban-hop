/** Reproducible synthetic-only stress test, not a Windows endurance claim. */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {exportAll} from './exporter.mjs';

const blocks = 10000;
const content = Array.from({length:blocks},(_,i)=>({type:'paragraph',content:[
  {type:'text',text:'Mục '+(i+1)+' — Nội dung biên bản tại Hải Phòng '+(i%3===0?'& < >':'đang xử lý')},
  {type:'text',text:' mốc ghi '+i,marks:[{type:'timeSpan',attrs:{
    recordingId:'rec-test',audioOffsetMs:i*8,anchorId:'anchor-'+i,
    typedAt:1794756000000+i*8,source:'live_recording',schemaVersion:1,
  }}]},
]}));
const input={document:{type:'doc',content},title:'Stress 10.000 đoạn',includeTimestamps:true};
const start=performance.now();
const outputs=exportAll(input);
const elapsedMs=+(performance.now()-start).toFixed(2);
assert.match(outputs.txt,/Mục 10000/);
assert.match(outputs.md,/Mục 10000/);
assert.match(outputs.csv,/Mục 10000/);
assert.match(new TextDecoder().decode(outputs.docx),/Mục 10000/);
assert.equal([...outputs.txt.matchAll(/rec-test@/g)].length,blocks);
console.log('PASS 10000 synthetic paragraphs, four formats, markers preserved');
console.log(JSON.stringify({blocks,elapsedMs,rssMiB:+(process.memoryUsage().rss/2**20).toFixed(2),
  docxBytes:outputs.docx.length,csvBytes:outputs.csv.length,mdBytes:outputs.md.length,txtBytes:outputs.txt.length}));
console.log('NOT_RUN Windows/Word real-world endurance, not a synthetic stress assertion');
