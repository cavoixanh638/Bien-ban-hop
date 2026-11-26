import test from 'node:test';
import assert from 'node:assert/strict';
import {VOICE_PRESETS,capPlaybackEnd,setVoiceEQ} from '../src/voice-eq.mjs';

test('G00 focus clips to committed source while never moving the anchor',()=>{
  const check={anchorSample:480000,startSample:240000,endSampleExclusive:4800000};
  const snapshot=JSON.stringify(check);
  assert.equal(capPlaybackEnd(check,48000,30000),1920000);
  assert.equal(capPlaybackEnd(check,48000,0),4800000);
  assert.equal(JSON.stringify(check),snapshot);
  assert.throws(()=>capPlaybackEnd(check,48000,200000),/không hợp lệ/);
});
test('G00 voice EQ presets change output only and can always return dry original',()=>{
  const p=()=>({value:0,setTargetAtTime(v){this.value=v}});
  const chain={ctx:{currentTime:1},highpass:{frequency:p()},presence:{gain:p()},
    limiter:{threshold:p()},dry:{gain:p()},wet:{gain:p()}};
  setVoiceEQ(chain,'clear');
  assert.equal(chain.dry.gain.value,0);assert.equal(chain.wet.gain.value,1);
  assert.equal(chain.highpass.frequency.value,VOICE_PRESETS.clear.highpass);
  setVoiceEQ(chain,'off');
  assert.equal(chain.dry.gain.value,1);assert.equal(chain.wet.gain.value,0);
  assert.throws(()=>setVoiceEQ(chain,'magic'),/không hợp lệ/);
});
