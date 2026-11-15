import {Recorder} from './core.mjs';
import {OpfsFiles,IDBJournal} from './adapters.mjs';
let recorder,fs,journal;
self.onmessage=async ({data})=>{
 const {id,action,payload={}}=data;
 try{
 let result;
 if(action==='init'){
 fs=new OpfsFiles(await navigator.storage.getDirectory());journal=await IDBJournal.open();
 recorder=payload.reopen?await Recorder.reopen({fs,journal,recordingId:payload.recordingId}):new Recorder({fs,journal,...payload});
 if(!payload.reopen)await recorder.initialize();
 result={ready:true,recovery:recorder.lastRecovery||null};
 }else if(action==='append')result=await recorder.append(payload);
 else if(action==='flush')result=await recorder.flush(payload);
 else if(action==='reconcile')result=await recorder.reconcile();
 else if(action==='seek')result=await recorder.readSample(payload.sample,payload.count);
 else if(action==='manifest')result=recorder.toAudioManifest();
 else if(action==='metrics')result=recorder.metrics;
 else if(action==='close'){await fs.close();result={closed:true};}
 else throw Error('unknown action');
 self.postMessage({id,ok:true,result},result?.pcm?[result.pcm]:[]);
 }catch(e){self.postMessage({id,ok:false,error:{name:e.name,message:e.message}});}
};
