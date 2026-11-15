import {Recorder,chunkFixture} from './core.mjs';
import {NodeFiles} from './node-adapter.mjs';
import {MemoryJournal} from './adapters.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const dir=await mkdtemp(join(tmpdir(),'opfs-wav-probe-')),fs=new NodeFiles(dir);
try{
 const r=new Recorder({fs,journal:new MemoryJournal(),recordingId:'probe',sampleRate:48000,channels:2});
 await r.initialize();await r.append(chunkFixture({recordingId:'probe',sequenceNo:0,firstSample:0,sampleRate:48000,channels:2,sampleCount:48000}));await r.flush();await fs.close();
 const details=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_name,sample_rate,channels,duration','-of','json',join(dir,'probe/seg-0.wav')],{encoding:'utf8'}));
 const s=details.streams[0];if(s.codec_name!=='pcm_f32le'||Number(s.sample_rate)!==48000||s.channels!==2)throw Error('Unexpected codec header '+JSON.stringify(s));
 console.log(JSON.stringify({status:'PASS',decoder:'ffprobe',stream:s,recording:'synthetic one-second stereo f32le WAV'},null,2));
}finally{await fs.close();await rm(dir,{force:true,recursive:true});}
