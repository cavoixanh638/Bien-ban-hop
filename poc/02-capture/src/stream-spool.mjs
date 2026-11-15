/**
 * Diagnostic-only sequential streaming sink for MediaRecorder's ONE container.
 * This is not OPFS durability/journaling (G03). Timeslice blobs MUST NOT be
 * treated as individually playable segments. Writes use a bounded queue.
 */
export class BoundedBlobSpool {
  constructor(openWriter, {maxQueueBytes=8_000_000,maxQueueChunks=32}={}) {
    this.maxQueueBytes=maxQueueBytes;
    this.maxQueueChunks=maxQueueChunks;
    this.pendingBytes=0;
    this.pendingChunks=0;
    this.peakPendingBytes=0;
    this.peakPendingChunks=0;
    this.writtenBytes=0;
    this.writtenChunks=0;
    this.rejectedBytes=0;
    this.rejectedChunks=0;
    this.failure=null;
    this.closed=false;
    this.opened=Promise.resolve().then(openWriter);
    this.tail=Promise.resolve();
  }
  append(blob) {
    if (this.closed || this.failure) return false;
    if (!blob || !Number.isFinite(blob.size) || blob.size<0 ||
        this.pendingBytes+blob.size>this.maxQueueBytes || this.pendingChunks>=this.maxQueueChunks) {
      this.rejectedBytes+=blob?.size||0;
      this.rejectedChunks++;
      return false;
    }
    this.pendingBytes+=blob.size;
    this.pendingChunks++;
    this.peakPendingBytes=Math.max(this.peakPendingBytes,this.pendingBytes);
    this.peakPendingChunks=Math.max(this.peakPendingChunks,this.pendingChunks);
    this.tail=this.tail.then(async()=>{
      const sink=await this.opened;
      if(this.failure)return;
      await sink.write(blob);
      this.writtenBytes+=blob.size;
      this.writtenChunks++;
    }).catch(error=>{
      this.failure=String(error?.stack||error);
    }).finally(()=>{
      this.pendingBytes-=blob.size;
      this.pendingChunks--;
    });
    return true;
  }
  async finalize() {
    if (this.closed) return this.summary();
    this.closed=true;
    await this.tail;
    try {
      const sink=await this.opened;
      if(!this.failure) await sink.close();
      else await sink.abort?.();
    } catch(error) {this.failure ||= String(error);}
    return this.summary();
  }
  summary() {
    return {status: this.failure?'FAILED':this.rejectedChunks?'INCOMPLETE':this.closed?'FINISHED':'WRITING',
      writtenBytes:this.writtenBytes,writtenChunks:this.writtenChunks,
      rejectedBytes:this.rejectedBytes,rejectedChunks:this.rejectedChunks,
      pendingBytes:this.pendingBytes,pendingChunks:this.pendingChunks,
      peakPendingBytes:this.peakPendingBytes,peakPendingChunks:this.peakPendingChunks,
      failure:this.failure,durable:false,
      note:'Diagnostic sequential blob spool only; no G03 flush/journal/manifest durability ACK'};
  }
  async getFile() {
    if (!this.closed || this.failure || this.rejectedChunks) throw new Error('spool not complete');
    const sink=await this.opened;
    if(typeof sink.getFile!=='function') throw new Error('spool has no readable file');
    return sink.getFile();
  }
  async discard() {
    await this.finalize();
    const sink=await this.opened.catch(()=>null);
    await sink?.discard?.();
  }
}

export async function createOpfsDiagnosticWriter(recordingId) {
  if (!globalThis.navigator?.storage?.getDirectory) throw new Error('OPFS unavailable');
  const root=await navigator.storage.getDirectory();
  const dir=await root.getDirectoryHandle('moc-hop-capture-poc-02',{create:true});
  const safe=String(recordingId).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,100);
  const name=`${safe}-${Date.now()}-${Math.random().toString(16).slice(2)}.webm`;
  const handle=await dir.getFileHandle(name,{create:true});
  const writer=await handle.createWritable();
  return {write:blob=>writer.write(blob),close:()=>writer.close(),
    abort:()=>writer.abort?.(),getFile:()=>handle.getFile(),
    discard:()=>dir.removeEntry(name),fileName:name};
}
