import test from 'node:test';
import assert from 'node:assert/strict';
import {PAGE_MARGIN_PRESETS,pageMargins,printPageRule} from '../src/page-margins.mjs';

test('G00 print/docx page margin presets are bounded A4 and consistent',()=>{
  assert.deepEqual(pageMargins('official'),{top:1134,bottom:1134,left:1701,right:1134});
  assert.deepEqual(pageMargins('compact'),{top:1134,bottom:1134,left:1134,right:1134});
  assert.deepEqual(pageMargins('balanced'),{top:1134,bottom:1134,left:1417,right:1417});
  assert.match(printPageRule('official'),/margin: 20mm 20mm 20mm 30mm/);
  assert.match(printPageRule('compact'),/margin: 20mm/);
  assert.equal(pageMargins('invalid').left,1701);
  assert.equal(printPageRule('invalid'),printPageRule('official'));
  assert.equal(Object.keys(PAGE_MARGIN_PRESETS).length,3);
});
