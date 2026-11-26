/** Tests only the guard and fflate *adapter's* fail-closed behavior. These do
 * NOT execute the real fflate npm package and never count as a package PASS.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {CLASSIC_ZIP32_MAX_BYTES,CLASSIC_ZIP32_MAX_ENTRIES,ClassicZip32Budget,exportWithFflate} from './candidates.mjs';
import {syntheticSource,BackupError} from './mochop-web.mjs';

class FakeZipPassThrough {
  constructor(filename){this.filename=filename;this.ondata=null;}
  push(chunk,final=false){this.ondata(null,chunk,final);}
}
class FakeZip {
  constructor(ondata){this.ondata=ondata;this.terminated=false;}
  add(file){file.ondata=(err,chunk,final)=>{
    if(err)this.ondata(err,null,final);
    else {
      if(chunk.length)this.ondata(null,chunk,false);
      if(final)this.ondata(null,new Uint8Array(24),false);
    }
  };}
  end(){this.ondata(null,new Uint8Array(22),true);}
  terminate(){this.terminated=true;}
}
const stub={Zip:FakeZip,ZipPassThrough:FakeZipPassThrough};

test('classic ZIP32 budget accepts last ordinary byte but rejects ZIP64 sentinel and 65,535 entries',()=>{
  const b=new ClassicZip32Budget();
  assert.equal(CLASSIC_ZIP32_MAX_BYTES,4294967294);
  assert.equal(CLASSIC_ZIP32_MAX_ENTRIES,65534);
  b.checkEntries(65534);
  assert.throws(()=>b.checkEntries(65535),/ZIP64 entry counts/);
  b.reserve(4294967293);
  b.reserve(1);
  assert.equal(b.bytes,4294967294);
  assert.throws(()=>b.reserve(1),/classic ZIP overflow/);
});

test('fflate adapter guards entry-count before module load and sink writes',async()=>{
  const source=syntheticSource(1),old=source.audio.segments;
  source.audio.segments=Array.from({length:65531},(_,i)=>({...old[0],segmentId:'s'+i,filePath:'audio/s'+i+'.pcm'}));
  let writes=0;
  const sink=new WritableStream({write(){writes++}});
  await assert.rejects(()=>exportWithFflate(source,sink),/ZIP64 entry counts/);
  assert.equal(writes,0,'preflight must not write any archive bytes');
});

test('fflate adapter stops and aborts partial output on overflow with fake producer',async()=>{
  let writes=0,aborted=false,closed=false;
  const sink=new WritableStream({write(){writes++},close(){closed=true},abort(){aborted=true}});
  const fake=new ClassicZip32Budget({maxBytes:2048});
  await assert.rejects(()=>exportWithFflate(syntheticSource(8000),sink,{fflateModule:stub,classicBudget:fake}),/classic ZIP overflow/);
  assert.equal(closed,false);
  assert.equal(aborted,true);
  assert(writes>0,'fixture must reach a partial stream before failing');
});

test('fflate adapter non-overflow smoke with fake producer; not a valid ZIP benchmark',async()=>{
  let bytes=0,closed=false;
  const sink=new WritableStream({write(v){bytes+=v.byteLength},close(){closed=true}});
  const r=await exportWithFflate(syntheticSource(1024),sink,{fflateModule:stub,classicBudget:new ClassicZip32Budget({maxBytes:8192})});
  assert.equal(closed,true);
  assert(bytes>1024);
  assert.equal(r.manifest.files.length,4);
});

test('reject invalid configured ZIP32 budgets',()=>{
  for(const n of [-1,4294967295,NaN,Infinity,1.5])
    assert.throws(()=>new ClassicZip32Budget({maxBytes:n}),BackupError);
});
