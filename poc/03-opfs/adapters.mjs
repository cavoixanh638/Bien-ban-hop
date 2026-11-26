// Production-shaped OPFS and IndexedDB adapters, plus deterministic Node substitutes.
export class OpfsFiles {
  constructor(root){this.root=root;this.handles=new Map();}
  async file(path,create=true){
    let dir=this.root;const p=path.split('/');for(const part of p.slice(0,-1))dir=await dir.getDirectoryHandle(part,{create});
    return dir.getFileHandle(p.at(-1),{create});
  }
  async access(path){if(!this.handles.has(path)){const f=await this.file(path);this.handles.set(path,await f.createSyncAccessHandle());}return this.handles.get(path);}
  async write(path,at,bytes){const h=await this.access(path);let off=0;while(off<bytes.byteLength){const n=h.write(bytes.subarray(off),{at:at+off});if(n<=0)throw Error('OPFS short write');off+=n;}}
  async read(path,at,size){const h=await this.access(path),b=new Uint8Array(size),n=h.read(b,{at});return b.subarray(0,n);}
  async flush(path){(await this.access(path)).flush();}
  async size(path){return (await this.access(path)).getSize();}
  async truncate(path,size){(await this.access(path)).truncate(size);await this.flush(path);}
  async exists(path){try{await this.file(path,false);return true;}catch(e){if(e.name==='NotFoundError')return false;throw e;}}
  async list(prefix){const out=[];const walk=async(dir,path)=>{for await(const [name,entry] of dir.entries()){const p=path+name;if(entry.kind==='directory')await walk(entry,p+'/');else out.push(p);}};await walk(this.root,'');return out.filter(p=>p.startsWith(prefix));}
  async close(){for(const h of this.handles.values())h.close();this.handles.clear();}
}
export class IDBJournal {
  constructor(db){this.db=db;}
  static async open(name='mochop-opfs-poc-v1'){
    const request=indexedDB.open(name,1);
    const db=await new Promise((resolve,reject)=>{request.onupgradeneeded=()=>request.result.createObjectStore('audioManifest');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    return new IDBJournal(db);
  }
  async transaction(mode,act){return new Promise((resolve,reject)=>{const tx=this.db.transaction('audioManifest',mode),s=tx.objectStore('audioManifest');const r=act(s);let value;r.onsuccess=()=>value=r.result;r.onerror=()=>reject(r.error);tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  async create(key,value){await this.transaction('readwrite',s=>s.add(value,key));}
  async save(key,value){await this.transaction('readwrite',s=>s.put(value,key));}
  async load(key){return await this.transaction('readonly',s=>s.get(key));}
}
export class MemoryFiles {
  constructor(){this.files=new Map();this.failWritesAfter=Infinity;this.totalWritten=0;}
  async write(path,at,bytes){if(this.totalWritten+bytes.length>this.failWritesAfter){const e=Error('quota exceeded');e.name='QuotaExceededError';throw e;}const old=this.files.get(path)||new Uint8Array(0),b=new Uint8Array(Math.max(old.length,at+bytes.length));b.set(old);b.set(bytes,at);this.files.set(path,b);this.totalWritten+=bytes.length;}
  async read(path,at,n){return this.files.get(path)?.slice(at,at+n)||new Uint8Array(0);}
  async flush(path){}
  async size(path){return this.files.get(path)?.length||0;}
  async truncate(path,n){const old=this.files.get(path)||new Uint8Array();const b=new Uint8Array(n);b.set(old.subarray(0,n));this.files.set(path,b);}
  async exists(path){return this.files.has(path);}
  async list(prefix){return [...this.files.keys()].filter(p=>p.startsWith(prefix));}
}
export class MemoryJournal {
  constructor(){this.records=new Map();this.fail=false;}
  async create(key,value){if(this.records.has(key))throw Error('recording already exists');await this.save(key,value);}
  async save(key,value){if(this.fail)throw Error('journal transaction failed');this.records.set(key,structuredClone(value));}
  async load(key){const v=this.records.get(key);return v&&structuredClone(v);}
}
