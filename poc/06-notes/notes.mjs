// Biên bản họp 06-notes — dependency-free ESM proof of concept.
export const SCHEMA_VERSION = 1;
export class RevisionConflict extends Error { constructor(){super("Revision conflict");this.name="RevisionConflict";} }
export class StorageFailure extends Error { constructor(message){super(message);this.name="StorageFailure";} }
export const clone = x => JSON.parse(JSON.stringify(x));
const uuid = () => globalThis.crypto?.randomUUID?.() || "id-"+Date.now()+"-"+Math.random().toString(36).slice(2);
const textOf = n => {
  if(typeof n?.text === "string") return n.text;
  if(n?.type === "hardBreak") return "\n";
  if(!Array.isArray(n?.content)) return "";
  const separator = ["doc","bulletList","orderedList"].includes(n.type) ? "\n" : "";
  return n.content.map(textOf).join(separator);
};
export const normalize = v => String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLocaleLowerCase("vi");
export function normalizeWithPositions(text) {
  let folded=""; const starts=[],ends=[];
  for(let i=0;i<text.length;){
    const c=String.fromCodePoint(text.codePointAt(i)),n=normalize(c);
    for(let j=0;j<n.length;j++){starts.push(i);ends.push(i+c.length);}
    folded+=n;i+=c.length;
  }
  return {folded,starts,ends};
}
export function migrateNote(input) {
  if(!input || typeof input!=="object") throw new StorageFailure("Invalid note");
  if((input.schemaVersion??0)>SCHEMA_VERSION) throw new StorageFailure("Newer note schema is unsupported");
  const out=clone(input);
  if(!out.content && typeof out.text==="string") out.content={type:"doc",content:[{type:"paragraph",content:[{type:"text",text:out.text}]}]};
  if(out.content?.type!=="doc" || !Array.isArray(out.content.content)) throw new StorageFailure("Invalid ProseMirror JSON");
  out.schemaVersion=SCHEMA_VERSION;
  out.revision=Number.isSafeInteger(out.revision)&&out.revision>=0?out.revision:0;
  delete out.text;
  return out;
}
const request = req => new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
export function openIndexedDB(name="moc-hop-notes-v1", indexedDBImpl=globalThis.indexedDB) {
  if(!indexedDBImpl) return Promise.reject(new StorageFailure("IndexedDB unavailable"));
  return new Promise((resolve,reject)=>{
    let finished=false;
    const q=indexedDBImpl.open(name,1);
    q.onupgradeneeded=()=>{
      const db=q.result;
      for(const store of ["meetings","notes","journals"])
        if(!db.objectStoreNames.contains(store))
          db.createObjectStore(store,{keyPath:store==="meetings"?"meetingId":store==="notes"?"noteDocumentId":"journalId"});
    };
    q.onblocked=()=>{if(!finished){finished=true;reject(new StorageFailure("IndexedDB upgrade blocked by another tab"));}};
    q.onerror=()=>{if(!finished){finished=true;reject(q.error);}};
    q.onsuccess=()=>{
      const db=q.result;
      if(finished){db.close();return;}
      finished=true;
      db.onversionchange=()=>db.close();
      resolve({
        run(stores,mode,fn){
          return new Promise((res,rej)=>{
            let settled=false,completed=false,value,callbackDone=false,cause;
            let tx;
            try {tx=db.transaction(stores,mode);} catch(e){rej(e);return;}
            const finish=(ok,v)=>{if(settled)return;settled=true;ok?res(v):rej(v);};
            const api={
              get:(s,k)=>request(tx.objectStore(s).get(k)),
              all:s=>request(tx.objectStore(s).getAll()),
              put:(s,x)=>request(tx.objectStore(s).put(clone(x))),
              del:(s,k)=>request(tx.objectStore(s).delete(k))
            };
            tx.oncomplete=()=>{completed=true;
              if(callbackDone)finish(true,value);
              else finish(false,new StorageFailure("IndexedDB transaction completed before callback"));
            };
            tx.onabort=()=>finish(false,cause||tx.error||new StorageFailure("IndexedDB transaction aborted"));
            tx.onerror=()=>{}; // allow abort event to deliver the definitive error
            Promise.resolve().then(()=>fn(api)).then(
              result=>{callbackDone=true;value=result;},
              error=>{cause=error;try{tx.abort();}catch{finish(false,error);}}
            );
          });
        },
        close:()=>db.close()
      });
    };
  });
}
// Deterministic atomic test adapter; does not simulate browser quota, task scheduling or crashes.
export function createMemoryDB(initial={}) {
  let data=Object.fromEntries(["meetings","notes","journals"].map(s=>[s,new Map((initial[s]||[]).map(x=>[x[s==="meetings"?"meetingId":s==="notes"?"noteDocumentId":"journalId"],clone(x)]))]));
  let queue=Promise.resolve(),failNext=null;
  return {
    failNextCommit(reason="simulated quota/commit failure"){failNext=reason;},
    run(stores,mode,fn) {
      const execute=async()=>{
        const working=Object.fromEntries(Object.entries(data).map(([k,v])=>[k,new Map([...v].map(([key,val])=>[key,clone(val)]))]));
        const api={
          get:async(s,k)=>clone(working[s].get(k)??null),
          all:async s=>[...working[s].values()].map(clone),
          put:async(s,v)=>{if(mode==="readonly")throw new StorageFailure("Readonly");working[s].set(v[s==="meetings"?"meetingId":s==="notes"?"noteDocumentId":"journalId"],clone(v));},
          del:async(s,k)=>{if(mode==="readonly")throw new StorageFailure("Readonly");working[s].delete(k);}
        };
        const result=await fn(api);
        if(mode!=="readonly"){if(failNext){const reason=failNext;failNext=null;throw new StorageFailure(reason);}data=working;}
        return result;
      };
      const job=queue.then(execute);queue=job.catch(()=>{});return job;
    },
    snapshot:()=>Object.fromEntries(Object.entries(data).map(([k,v])=>[k,[...v.values()].map(clone)]))
  };
}
export function createMockLease(){
  const held=new Map();
  return {async acquire(meetingId){
    if(held.has(meetingId))return null;
    const token=Symbol(meetingId);held.set(meetingId,token);
    return {
      get held(){return held.get(meetingId)===token;},
      release(){if(held.get(meetingId)===token)held.delete(meetingId);}
    };
  }};
}
export class NotesRepository {
  constructor(db,{audioReferences={canDelete:async()=>true,onDelete:async()=>{}}}={}){this.db=db;this.audioReferences=audioReferences;}
  async createMeeting(title="Cuộc họp mới") {
    const meetingId=uuid(),noteDocumentId=uuid(),now=Date.now();
    const meeting={meetingId,title,noteDocumentId,recordingIds:[],schemaVersion:1,createdAt:now,updatedAt:now};
    const note={noteDocumentId,revision:0,schemaVersion:1,content:{type:"doc",content:[{type:"paragraph"}]}};
    await this.db.run(["meetings","notes"],"readwrite",async tx=>{await tx.put("meetings",meeting);await tx.put("notes",note);});
    return clone(meeting);
  }
  async getMeeting(id){return this.db.run(["meetings"],"readonly",tx=>tx.get("meetings",id));}
  async listMeetings(){return this.db.run(["meetings"],"readonly",async tx=>(await tx.all("meetings")).sort((a,b)=>b.updatedAt-a.updatedAt));}
  async getNote(id){return this.db.run(["notes"],"readonly",async tx=>{const x=await tx.get("notes",id);return x?migrateNote(x):null;});}
  async getJournal(id){return this.db.run(["journals"],"readonly",async tx=>(await tx.all("journals")).filter(x=>x.noteDocumentId===id).sort((a,b)=>a.revision-b.revision));}
  async renameMeeting(id,title){
    if(!String(title).trim())throw new StorageFailure("Title required");
    return this.db.run(["meetings"],"readwrite",async tx=>{
      const m=await tx.get("meetings",id);if(!m)throw new StorageFailure("Meeting missing");
      m.title=title.trim();m.updatedAt=Date.now();await tx.put("meetings",m);return m;
    });
  }
  async saveNote(noteDocumentId,content,expectedRevision,lease=null){
    if(lease && !lease.held)throw new StorageFailure("Writer lease not held");
    if(content?.type!=="doc"||!Array.isArray(content.content))throw new StorageFailure("Invalid ProseMirror JSON");
    const safeContent=clone(content);
    return this.db.run(["notes","journals","meetings"],"readwrite",async tx=>{
      const old=await tx.get("notes",noteDocumentId);
      if(!old)throw new StorageFailure("Note missing");
      if(lease && !lease.held)throw new StorageFailure("Writer lease lost before write");
      if((old.revision??0)!==expectedRevision)throw new RevisionConflict();
      if((old.schemaVersion??0)>SCHEMA_VERSION)throw new StorageFailure("Cannot downgrade schema");
      const next={noteDocumentId,revision:expectedRevision+1,schemaVersion:1,content:safeContent};
      await tx.put("notes",next);
      await tx.put("journals",{journalId:noteDocumentId+":"+next.revision,noteDocumentId,revision:next.revision,previousRevision:expectedRevision,committedAt:Date.now(),kind:"snapshot",content:safeContent});
      for(const m of await tx.all("meetings"))if(m.noteDocumentId===noteDocumentId){m.updatedAt=Date.now();await tx.put("meetings",m);}
      return next.revision; // only exposed after successful transaction completion
    });
  }
  async deleteMeeting(id) {
    const m=await this.getMeeting(id);if(!m)return false;
    if(!(await this.audioReferences.canDelete(m.recordingIds,m)))throw new StorageFailure("Audio is referenced by another meeting");
    await this.db.run(["meetings","notes","journals"],"readwrite",async tx=>{
      const current=await tx.get("meetings",id);if(!current)return;
      await tx.del("meetings",id);
      const peers=(await tx.all("meetings")).filter(x=>x.noteDocumentId===current.noteDocumentId);
      if(!peers.length){
        await tx.del("notes",current.noteDocumentId);
        for(const x of await tx.all("journals"))if(x.noteDocumentId===current.noteDocumentId)await tx.del("journals",x.journalId);
      }
    });
    await this.audioReferences.onDelete(m.recordingIds,m);
    return true;
  }
  async search(query) {
    const needle=normalize(query).trim();if(!needle)return [];
    return this.db.run(["meetings","notes"],"readonly",async tx=>{
      const notes=new Map((await tx.all("notes")).map(n=>[n.noteDocumentId,n]));
      const results=[];
      for(const m of (await tx.all("meetings")).sort((a,b)=>b.updatedAt-a.updatedAt)){
        const note=notes.get(m.noteDocumentId),plain=note?textOf(note.content):"";
        const titleMatch=normalize(m.title).includes(needle);
        const {folded,starts,ends}=normalizeWithPositions(plain);
        const i=folded.indexOf(needle);
        if(titleMatch||i>=0){
          const location=i>=0?starts[i]:null;
          const end=i>=0?ends[i+needle.length-1]:null;
          results.push({meetingId:m.meetingId,noteDocumentId:m.noteDocumentId,title:m.title,
            snippet:location===null?"":plain.slice(Math.max(0,location-25),Math.max(0,location-25)+100),
            location,length:location===null?null:end-location,matchedIn:titleMatch?"title":"text"});
        }
      }
      return results;
    });
  }
}
export class Autosave {
  constructor(repo,noteDocumentId,lease,{debounceMs=350,maxWaitMs=1500,onStatus=()=>{}}={}){
    this.repo=repo;this.noteDocumentId=noteDocumentId;this.lease=lease;
    this.debounceMs=debounceMs;this.maxWaitMs=maxWaitMs;this.onStatus=onStatus;
    this.revision=null;this.draft=null;this.seq=0;this.savedSeq=0;
    this.flight=null;this.timer=null;this.maxTimer=null;this.status="loading";this.disposed=false;
  }
  async load(){
    if(this.revision!==null)throw new StorageFailure("Autosave already loaded");
    const note=await this.repo.getNote(this.noteDocumentId);
    if(!note)throw new StorageFailure("Note missing");
    this.revision=note.revision;this.draft=note.content;
    this.status="saved";this.onStatus(this.status,this.revision);return clone(note);
  }
  _clearTimers(){clearTimeout(this.timer);clearTimeout(this.maxTimer);this.timer=this.maxTimer=null;}
  edit(doc){
    if(this.disposed)throw new StorageFailure("Autosave disposed");
    if(this.revision===null)throw new StorageFailure("Autosave not loaded");
    if(doc?.type!=="doc"||!Array.isArray(doc.content))throw new StorageFailure("Invalid ProseMirror JSON");
    this.draft=clone(doc);this.seq++;this.status="dirty";this.onStatus("dirty",this.revision);
    if(!this.flight){
      clearTimeout(this.timer);
      this.timer=setTimeout(()=>this.flush().catch(()=>{}),this.debounceMs);
      if(!this.maxTimer)this.maxTimer=setTimeout(()=>this.flush().catch(()=>{}),this.maxWaitMs);
    }
  }
  async _drain(){
    this._clearTimers();
    while(this.savedSeq<this.seq){
      const captured=this.seq,doc=clone(this.draft);
      this.status="saving";this.onStatus("saving",this.revision);
      try{
        const next=await this.repo.saveNote(this.noteDocumentId,doc,this.revision,this.lease);
        this.revision=next;this.savedSeq=captured;
        this.status=this.seq===captured?"saved":"dirty";
        this.onStatus(this.status,this.revision);
      }catch(e){
        this.status=e instanceof RevisionConflict?"conflict":"error";
        this.onStatus(this.status,this.revision,e);this._clearTimers();throw e;
      }
    }
    this._clearTimers();
    return this.revision;
  }
  flush(){
    if(this.disposed)return Promise.reject(new StorageFailure("Autosave disposed"));
    if(this.revision===null)return Promise.reject(new StorageFailure("Autosave not loaded"));
    if(this.flight)return this.flight;
    this.flight=this._drain().finally(()=>{this.flight=null;});
    return this.flight;
  }
  async dispose(){
    if(this.flight||this.seq!==this.savedSeq)
      throw new StorageFailure("Cannot release writer with unconfirmed notes; flush first");
    this._clearTimers();this.disposed=true;this.lease?.release();
  }
}
