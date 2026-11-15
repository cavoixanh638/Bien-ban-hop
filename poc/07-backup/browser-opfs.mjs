/** Real Chromium OPFS + IndexedDB reference adapter. Origin-local demo only.
 * The IndexedDB index is the atomic visibility point; OPFS staging data is immutable.
 * Crash before the index transaction may leave an orphan stage (recover via GC).
 */
import {fileName,jsonBytes} from './zip-stream.mjs';
const dbName='mochop-07-poc';
function idb(){return new Promise((resolve,reject)=>{
  const r=indexedDB.open(dbName,1);
  r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('meetings'))r.result.createObjectStore('meetings',{keyPath:'meetingId'});};
  r.onerror=()=>reject(r.error);r.onsuccess=()=>resolve(r.result);
});}
async function dbTx(work){const db=await idb();try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction('meetings','readwrite');let result;
  tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??Error('transaction aborted'));
  work(tx.objectStore('meetings'),v=>{result=v});
});}finally{db.close();}}
async function folder(root,name,create=false){const parts=name.split('/');let dest=root;
  for(const part of parts){if(!part||part==='..'||part==='.')throw Error('unsafe directory');dest=await dest.getDirectoryHandle(part,{create});}return dest;}
async function fileHandle(stage,name,create=false){fileName(name);const parts=name.split('/');const base=parts.pop();let dir=stage;
  for(const part of parts)dir=await dir.getDirectoryHandle(part,{create});
  return dir.getFileHandle(base,{create});}
export async function createBrowserRepo(){
  if(!navigator.storage?.getDirectory)throw Error('OPFS not supported');
  const root=await navigator.storage.getDirectory(),app=await root.getDirectoryHandle('mochop-07-poc',{create:true});
  const stages=await app.getDirectoryHandle('stages',{create:true});
  const archives=await app.getDirectoryHandle('archives',{create:true});
  return {
    async stage(){
      const stageId=crypto.randomUUID(),dir=await stages.getDirectoryHandle(stageId,{create:true});let published=false;
      return {
        async create(name){const handle=await fileHandle(dir,name,true),w=await handle.createWritable();let closed=false;
          return {
            async write(bytes){if(closed)throw Error('closed file');await w.write(bytes);},
            async close(){await w.close();closed=true;},
            async abort(e){if(!closed){closed=true;await w.abort(e);}}
          };
        },
        async readJSON(name){const f=await fileHandle(dir,name);return JSON.parse(await (await f.getFile()).text());},
        async writeJSON(name,obj){const file=await fileHandle(dir,name);const w=await file.createWritable();await w.write(jsonBytes(obj));await w.close();},
        async publish(meetingId){await dbTx((store)=>{store.add({meetingId,stageId,createdAt:Date.now()});});published=true;},
        async discard(){if(!published)await stages.removeEntry(stageId,{recursive:true});}
      };
    },
    async archiveSink(name){
      fileName(name);const handle=await fileHandle(archives,name,true),w=await handle.createWritable();
      const sink=new WritableStream({write(bytes){return w.write(bytes);},close(){return w.close();},abort(e){return w.abort(e);}});
      return {sink,async file(){return handle.getFile();},async remove(){await archives.removeEntry(name);}};
    },
    async getMeeting(meetingId){
      const db=await idb();let index;
      try{index=await new Promise((resolve,reject)=>{const tx=db.transaction('meetings','readonly'),r=tx.objectStore('meetings').get(meetingId);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
      finally{db.close();}
      if(!index)return null;
      const dir=await stages.getDirectoryHandle(index.stageId);
      return {index,readJSON:async name=>JSON.parse(await (await (await fileHandle(dir,name)).getFile()).text()),
        readFile:async name=>(await fileHandle(dir,name)).getFile()};
    },
    async reset(){
      const db=await idb();await new Promise((resolve,reject)=>{const tx=db.transaction('meetings','readwrite');tx.objectStore('meetings').clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
      for await(const [name] of stages.entries())await stages.removeEntry(name,{recursive:true});
      for await(const [name] of archives.entries())await archives.removeEntry(name,{recursive:true});
    }
  };
}
