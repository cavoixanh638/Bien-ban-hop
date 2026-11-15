// Node-only integration harness, deliberately NOT browser OPFS/IndexedDB.
// A real worker thread plus fsync'd files and an atomic JSON journal reproduces
// termination between file flush and journal publish without other workstreams.
import {parentPort,workerData} from 'node:worker_threads';
import {readFile,open,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {Recorder} from './core.mjs';
import {NodeFiles} from './node-adapter.mjs';
class JsonJournal{
 constructor(dir){this.path=join(dir,'journal.json');this.dir=dir;}
 async load(key){try{const m=JSON.parse(await readFile(this.path,'utf8'));return m.recordingId===key?m:undefined;}catch(e){if(e.code==='ENOENT')return undefined;throw e;}}
 async create(key,value){if(await this.load(key))throw Error('recording already exists');await this.save(key,value);}
 async save(key,value){const path=this.path+'.tmp',f=await open(path,'w');try{await f.writeFile(JSON.stringify(value));await f.sync();}finally{await f.close();}await rename(path,this.path);}
}
const fs=new NodeFiles(workerData.dir),journal=new JsonJournal(workerData.dir);
let r=null,chain=Promise.resolve();
parentPort.on('message',({id,action,payload={}})=>{
 chain=chain.then(async()=>{
  try{
   let result;
   if(action==='init') {r=payload.reopen?await Recorder.reopen({fs,journal,recordingId:'fixture'}):new Recorder({fs,journal,recordingId:'fixture',sampleRate:48000,channels:1});if(!payload.reopen)await r.initialize();result={ready:true,recovery:r.lastRecovery};}
   else if(!r)throw Error('not initialized');
   else if(action==='append')result=await r.append(payload);
   else if(action==='flush')result=await r.flush(payload);
   else if(action==='seek')result=await r.readSample(payload.sample,payload.count);
   else if(action==='reconcile')result=await r.reconcile();
   else if(action==='close'){await fs.close();result={closed:true};}
   else throw Error('invalid action');
   parentPort.postMessage({id,ok:true,result});
  }catch(e){parentPort.postMessage({id,ok:false,error:{name:e.name,message:e.message}});}
 });
});
