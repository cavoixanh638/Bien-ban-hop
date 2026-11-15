import {Recorder} from './core.mjs';
import {OpfsFiles,IDBJournal} from './adapters.mjs';
let recorder,fs,journal;
// Each message is serialized; overlapping append/flush may otherwise race and
// publish a journal watermark beyond the flushed bytes.
let chain=Promise.resolve();
self.onmessage=({data})=>{
 chain=chain.then(async()=>{
  const {id,action,payload={}}=data;
  try{
   let result;
   if(action==='init'){
    if(recorder)throw Error('worker already initialized; close first');
    const storage=new OpfsFiles(await navigator.storage.getDirectory()),db=await IDBJournal.open();
    let candidate;
    try{
      candidate=payload.reopen?await Recorder.reopen({fs:storage,journal:db,recordingId:payload.recordingId}):new Recorder({fs:storage,journal:db,...payload});
      if(!payload.reopen)await candidate.initialize();
    }catch(error){await storage.close();db.db.close();throw error;}
    fs=storage;journal=db;recorder=candidate;
    result={ready:true,recovery:recorder.lastRecovery||null};
   }else{
    if(!recorder)throw Error('worker not initialized');
    if(action==='append')result=await recorder.append(payload);
    else if(action==='flush')result=await recorder.flush(payload);
    else if(action==='reconcile')result=await recorder.reconcile();
    else if(action==='seek')result=await recorder.readSample(payload.sample,payload.count);
    else if(action==='manifest')result=await recorder.toAudioManifest();
    else if(action==='metrics')result=recorder.metrics;
    else if(action==='close'){
     await fs.close();journal.db.close();recorder=fs=journal=null;result={closed:true};
    }else throw Error('unknown action');
   }
   self.postMessage({id,ok:true,result},result?.pcm?[result.pcm]:[]);
  }catch(e){self.postMessage({id,ok:false,error:{name:e.name,message:e.message}});}
 }).catch(e=>{self.postMessage({id:data?.id,ok:false,error:{name:'WorkerInternalError',message:String(e)}});});
};
