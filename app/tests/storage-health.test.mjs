import test from 'node:test';
import assert from 'node:assert/strict';
import {assessStorageEstimate,checkBrowserStorage} from '../src/storage-health.mjs';
test('G00 storage warning separates estimate from proven durability',async()=>{
  assert.equal(assessStorageEstimate({quota:1024*1024*1024,usage:1024*1024*1023}).level,'warning');
  assert.equal(assessStorageEstimate({quota:10*1024**3,usage:1*1024**3}).level,'normal');
  assert.equal(assessStorageEstimate(null).level,'unknown');
  assert.equal((await checkBrowserStorage({storage:{estimate:async()=>({quota:1024,usage:1020})}})).level,'warning');
});
