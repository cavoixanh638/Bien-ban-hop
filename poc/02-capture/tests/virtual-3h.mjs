/* FAST-FORWARD METADATA traversal; 3 hours of sample indices, NOT 3 hours of real-time recording. */
import assert from 'node:assert/strict';
import {writeFile, mkdir} from 'node:fs/promises';
import {CoverageLedger} from '../src/contract.mjs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const sampleRate=48000, durationSeconds=3*3600, frames=sampleRate*durationSeconds;
const results=[];
function signature(sampleIndex) {
  // Bounded deterministic probe of first/middle/last frame; no large PCM payload generated.
  return [sampleIndex, ((sampleIndex*31)%1000003)/1000003, sampleIndex % sampleRate];
}
for (const batchFrames of [2048,4096]) {
  const ledger=new CoverageLedger(`virtual-3h-${batchFrames}`);
  const started=performance.now();
  let current=0, seq=0;
  let atMiddle=null;
  let first=null, last=null;
  while (current < frames) {
    const count=Math.min(batchFrames,frames-current);
    const block={recordingId:`virtual-3h-${batchFrames}`, sequenceNo:seq,
      firstSample:current,sampleCount:count,sampleRate,channels:1,format:'f32le'};
    ledger.accept(block,false);
    if (current===0) first=signature(current);
    if (current<=frames/2 && current+count>frames/2) atMiddle=signature(frames/2);
    if (current+count===frames) last=signature(frames-1);
    current+=count;seq++;
  }
  const summary=ledger.summary();
  assert.equal(summary.receivedFrames,frames);
  assert.equal(summary.highWaterSample,frames);
  assert.equal(summary.missingFrames,0);
  assert.equal(summary.overlappedFrames,0);
  assert.equal(summary.sequenceErrorCount,0);
  const defective=new CoverageLedger(`virtual-3h-${batchFrames}`);
  defective.accept({recordingId:`virtual-3h-${batchFrames}`, sequenceNo:0,firstSample:0,sampleCount:batchFrames,sampleRate,channels:1,format:'f32le'},false);
  defective.accept({recordingId:`virtual-3h-${batchFrames}`, sequenceNo:2,firstSample:2*batchFrames,sampleCount:batchFrames,sampleRate,channels:1,format:'f32le'},false);
  defective.accept({recordingId:`virtual-3h-${batchFrames}`, sequenceNo:2,firstSample:2*batchFrames,sampleCount:batchFrames,sampleRate,channels:1,format:'f32le'},false);
  assert.equal(defective.summary().missingFrames,batchFrames);
  assert.equal(defective.summary().overlappedFrames,batchFrames);
  assert.equal(defective.summary().sequenceErrorCount,2);
  results.push({test:'virtual-three-hour-frame-index',isRealTimeCapture:false,batchFrames,
    sampleRate,durationSeconds,expectedFrames:frames,blocks:seq,first,atMiddle,last,
    elapsedWallMs: +(performance.now()-started).toFixed(2),summary,
    injectedFault: defective.summary(), result:'PASS_METADATA_ONLY'});
}
const file=process.argv[2];
if (file) {await mkdir(path.dirname(path.resolve(file)),{recursive:true});await writeFile(file,JSON.stringify({environment:`Node ${process.version}`,results},null,2));}
console.log(JSON.stringify({environment:`Node ${process.version}`,results},null,2));
