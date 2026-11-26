import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

async function json(relative){
  return JSON.parse(await readFile(new URL(relative,import.meta.url),'utf8'));
}
test('G00: active app has Biên bản họp npm package identifier',async()=>{
  const pkg=await json('../package.json');
  assert.equal(pkg.name,'bien-ban-hop');
});
test('G00: generated npm lock file, if present, uses the new app package name',async()=>{
  let lock;
  try{lock=await json('../package-lock.json');}
  catch(e){if(e.code==='ENOENT')return;throw e;}
  assert.equal(lock.name,'bien-ban-hop',
    'package-lock.json cũ: chạy npm install --package-lock-only --ignore-scripts tại app/');
  assert.equal(lock.packages?.['']?.name,'bien-ban-hop',
    'packages[""].name cũ: chạy npm install --package-lock-only --ignore-scripts');
});
test('G00: all independent proof-of-concept npm packages use product namespace',async()=>{
  for(const [id,name] of [
    ['01-editor','bien-ban-hop-poc-01-editor'],
    ['02-capture','bien-ban-hop-poc-02-capture'],
    ['03-opfs','bien-ban-hop-poc-03-opfs'],
    ['04-timeline','bien-ban-hop-poc-04-timeline'],
    ['05-player','bien-ban-hop-poc-05-player'],
    ['07-backup','bien-ban-hop-poc-07-backup'],
    ['08-export','bien-ban-hop-poc-08-export'],
    ['09-pwa','bien-ban-hop-poc-09-pwa']
  ]){
    assert.equal((await json('../../poc/'+id+'/package.json')).name,name);
  }
});
