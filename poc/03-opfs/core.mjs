// Deterministic OPFS durability PoC. Raw IEEE754 float32 PCM in standard WAV containers.
export const HEADER_BYTES = 44;
export function assert(ok, message) { if (!ok) throw Error(message); }
export function wavHeader(byteLength, sampleRate, channels) {
  assert(Number.isSafeInteger(byteLength) && byteLength >= 0 && byteLength <= 0xffffffff - 36, 'WAV segment too large');
  const b = new ArrayBuffer(44), d = new DataView(b);
  for (const [at, str] of [[0,'RIFF'],[8,'WAVE'],[12,'fmt '],[36,'data']]) for(let i=0;i<str.length;i++) d.setUint8(at+i,str.charCodeAt(i));
  d.setUint32(4,36+byteLength,true);d.setUint32(16,16,true);d.setUint16(20,3,true);
  d.setUint16(22,channels,true);d.setUint32(24,sampleRate,true);d.setUint32(28,sampleRate*channels*4,true);
  d.setUint16(32,channels*4,true);d.setUint16(34,32,true);d.setUint32(40,byteLength,true);
  return new Uint8Array(b);
}
export function checkHeader(bytes, byteLength, sampleRate, channels) {
  if(bytes.byteLength!==HEADER_BYTES) return false;
  const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const four=(at,s)=>[...s].every((c,i)=>bytes[at+i]===c.charCodeAt(0));
  return four(0,'RIFF')&&four(8,'WAVE')&&four(12,'fmt ')&&four(36,'data')&&
    d.getUint32(4,true)===36+byteLength&&d.getUint32(16,true)===16&&d.getUint16(20,true)===3&&
    d.getUint16(22,true)===channels&&d.getUint32(24,true)===sampleRate&&
    d.getUint32(28,true)===sampleRate*channels*4&&d.getUint16(32,true)===channels*4&&
    d.getUint16(34,true)===32&&d.getUint32(40,true)===byteLength;
}
const CRC_TABLE = new Uint32Array(256);
for (let i=0;i<256;i++) {
  let c=i;
  for(let j=0;j<8;j++) c=(c>>>1)^((c&1)?0xedb88320:0);
  CRC_TABLE[i]=c>>>0;
}
export function crc32(u8) {
  let c=0xffffffff;
  for (const b of u8) c=CRC_TABLE[(c^b)&255]^(c>>>8);
  return (c^0xffffffff)>>>0;
}
function bytesFor(chunk) {
  assert(chunk?.format==='f32le' && chunk.pcm instanceof ArrayBuffer,'f32le ArrayBuffer required');
  assert(Number.isSafeInteger(chunk.sampleCount)&&chunk.sampleCount>0,'invalid sampleCount');
  assert(chunk.pcm.byteLength===chunk.sampleCount*chunk.channels*4,'PCM length mismatch');
  // Wire format explicitly little-endian even on a non-little-endian platform.
  const v=new DataView(chunk.pcm);for(let i=0;i<chunk.pcm.byteLength;i+=4) assert(Number.isFinite(v.getFloat32(i,true)),'nonfinite PCM');
  return new Uint8Array(chunk.pcm);
}
const copy=o=>structuredClone(o);
const ranges=(items)=>items.map(x=>({sampleStart:x.firstSample,sampleEndExclusive:x.firstSample+x.sampleCount,byteStart:x.byteOffset,byteEndExclusive:x.byteOffset+x.byteLength,segmentId:x.segmentId}));
export class Recorder {
  constructor({fs,journal,recordingId,sampleRate=48000,channels=1,segmentSeconds=300,now=()=>performance.now()}) {
    assert(recordingId && /^[a-zA-Z0-9_-]+$/.test(recordingId),'unsafe recordingId');
    assert(Number.isInteger(sampleRate)&&sampleRate>0&&sampleRate<=384000&&Number.isInteger(channels)&&channels>0&&channels<=8,'invalid format');
    this.fs=fs;this.journal=journal;this.id=recordingId;this.rate=sampleRate;this.channels=channels;
    this.limit=Math.floor(sampleRate*segmentSeconds);assert(this.limit>0 && this.limit*channels*4 <= 0xffffffff-36,'invalid WAV segment limit');this.now=now;
    this.manifest={schemaVersion:1,recordingId,sampleRate,channels,format:'f32le',revision:0,segments:[],chunks:[],intervals:[],nextSequenceNo:0,acceptedThroughSampleExclusive:0,committedThroughSampleExclusive:0};
    this.pending=[];this.metrics={writeMs:0,flushMs:0,journalMs:0,bytesWritten:0,flushCount:0,maxPendingBytes:0};this.failed=false;
  }
  async initialize() {
    if(this.journal.create) await this.journal.create(this.id,this.manifest);
    else {if(await this.journal.load(this.id)) throw Error('recording already exists');await this.journal.save(this.id,this.manifest);}
  }
  static async reopen(opts) {
    const m=await opts.journal.load(opts.recordingId);assert(m,'missing manifest');
    const out=new Recorder({...opts,sampleRate:m.sampleRate,channels:m.channels});out.manifest=m;
    assert(m.schemaVersion===1 && m.recordingId===opts.recordingId && m.format==='f32le','invalid audio journal');
    await out.reconcile();return out;
  }
  segment(sample) {
    const boundary=Math.floor(sample/this.limit)*this.limit;
    let s=this.manifest.segments.find(x=>x.sampleStart>=boundary && x.sampleStart<=sample && x.sampleStart+x.sampleCount===sample && !['corrupt','recovery_needed'].includes(x.completionState));
    if(!s){const start=sample;s={segmentId:`seg-${start}`,filePath:`${this.id}/seg-${start}.wav`,sampleStart:start,sampleCount:0,byteLength:HEADER_BYTES,completionState:'writing'};this.manifest.segments.push(s);}
    return s;
  }
  async append(chunk) {
    assert(!this.failed,'recorder failed; recover before further writes');
    assert(chunk.recordingId===this.id && chunk.sampleRate===this.rate && chunk.channels===this.channels,'source/format mismatch');
    assert(Number.isSafeInteger(chunk.sequenceNo)&&chunk.sequenceNo>=0&&Number.isSafeInteger(chunk.firstSample)&&chunk.firstSample>=0,'invalid sequence/sample');
    const b=bytesFor(chunk), m=this.manifest;
    assert(chunk.sequenceNo>=m.nextSequenceNo,'duplicate/out-of-order sequence');
    assert(chunk.firstSample>=m.acceptedThroughSampleExclusive,'overlapping samples');
    if(chunk.sequenceNo>m.nextSequenceNo||chunk.firstSample>m.acceptedThroughSampleExclusive) {
      if(chunk.firstSample>m.acceptedThroughSampleExclusive) m.intervals.push({kind:'gap',sampleStart:m.acceptedThroughSampleExclusive,sampleEndExclusive:chunk.firstSample,reason:'missing_samples_or_sequence'});
      else m.intervals.push({kind:'gap',sampleStart:chunk.firstSample,sampleEndExclusive:chunk.firstSample,reason:'missing_sequence_without_sample_gap'});
    }
    let remaining=chunk.sampleCount, off=0, sample=chunk.firstSample;
    try {
    while(remaining){
      const s=this.segment(sample), n=Math.min(remaining,(Math.floor(sample/this.limit)+1)*this.limit-sample), part=b.subarray(off*this.channels*4,(off+n)*this.channels*4);
      // A sequence can be split across segment boundaries; each slice has its own checksum.
      const byteOffset=s.byteLength, t=this.now();
      if(byteOffset===HEADER_BYTES) await this.fs.write(s.filePath,0,wavHeader(0,this.rate,this.channels));
      await this.fs.write(s.filePath,byteOffset,part);
      this.metrics.writeMs+=this.now()-t;this.metrics.bytesWritten+=part.byteLength;
      s.byteLength+=part.byteLength;s.sampleCount+=n;
      const record={segmentId:s.segmentId,filePath:s.filePath,sequenceNo:chunk.sequenceNo,firstSample:sample,sampleCount:n,byteOffset,byteLength:part.byteLength,crc32:crc32(part)};
      this.pending.push(record);remaining-=n;off+=n;sample+=n;
    }
    m.nextSequenceNo=chunk.sequenceNo+1;m.acceptedThroughSampleExclusive=chunk.firstSample+chunk.sampleCount;
    this.metrics.maxPendingBytes=Math.max(this.metrics.maxPendingBytes,this.pending.reduce((a,x)=>a+x.byteLength,0));
    return {type:'bufferReleased',sequenceNo:chunk.sequenceNo,committed:false};
    } catch (error) { this.failed=true; throw error; }
  }
  async flush({faultAt}={}) {
    assert(!this.failed,'recorder failed');
    const m=this.manifest;
    if(!this.pending.length) return {type:'committed',committedThroughSampleExclusive:m.committedThroughSampleExclusive,revision:m.revision};
    const dirty=new Set(this.pending.map(x=>x.segmentId));
    try{
      const start=this.now();
      for(const s of m.segments.filter(x=>dirty.has(x.segmentId))) {
        await this.fs.write(s.filePath,0,wavHeader(s.byteLength-HEADER_BYTES,this.rate,this.channels));
        await this.fs.flush(s.filePath);
      }
      this.metrics.flushMs+=this.now()-start;this.metrics.flushCount++;
      if(faultAt==='afterOpfsFlush') throw Error('simulated crash after OPFS flush');
      const next=copy(m);next.chunks.push(...this.pending);
      next.revision++;next.committedThroughSampleExclusive=next.chunks.at(-1).firstSample+next.chunks.at(-1).sampleCount;
      for(const s of next.segments) if(dirty.has(s.segmentId)) s.completionState='checkpointed';
      const t=this.now();await this.journal.save(this.id,next);this.metrics.journalMs+=this.now()-t;
      this.manifest=next;this.pending=[];this.lastRecovery=null;
      if(faultAt==='afterJournalCommit') throw Error('simulated crash after journal commit');
      return {type:'committed',committedThroughSampleExclusive:next.committedThroughSampleExclusive,revision:next.revision,committedRanges:ranges(next.chunks)};
    }catch(e){this.failed=true;throw e;}
  }
  async reconcile() {
    assert(!this.pending.length,'reconcile cannot truncate active unflushed writes');
    const m=this.manifest, report={recordingId:this.id,committedRanges:[],unavailable:[],uncommittedBytes:0,repairedHeaders:[],truncatedBytes:0,revision:m.revision,gaps:m.intervals.filter(i=>i.kind==='gap')};
    const bySegment=new Map();for(const c of m.chunks){const list=bySegment.get(c.segmentId)||[];list.push(c);bySegment.set(c.segmentId,list);}
    const good=[],missing=[];
    for(const s of m.segments){
      const entries=bySegment.get(s.segmentId)||[];
      assert(s.filePath===`${this.id}/${s.segmentId}.wav` && /^seg-\d+$/.test(s.segmentId),'unsafe/corrupt segment path');
      if(!await this.fs.exists(s.filePath)){
        for(const c of entries)missing.push({...c,reason:'missing_file'});
        s.completionState='corrupt';continue;
      }
      let size=await this.fs.size(s.filePath);
      const committedEnd=entries.reduce((n,c)=>Math.max(n,c.byteOffset+c.byteLength),HEADER_BYTES);
      if(size>committedEnd){report.uncommittedBytes+=size-committedEnd;await this.fs.truncate(s.filePath,committedEnd);report.truncatedBytes+=size-committedEnd;size=committedEnd;}
      for(const c of entries){
        assert(c.filePath===s.filePath && Number.isSafeInteger(c.byteOffset) && c.byteOffset>=HEADER_BYTES && Number.isSafeInteger(c.byteLength) && c.byteLength===c.sampleCount*this.channels*4 && Number.isSafeInteger(c.firstSample) && c.firstSample>=0,'invalid chunk metadata');
        if(c.byteOffset+c.byteLength>size){missing.push({...c,reason:'short_file'});continue;}
        const bytes=await this.fs.read(s.filePath,c.byteOffset,c.byteLength);
        if(bytes.byteLength!==c.byteLength||crc32(bytes)!==c.crc32)missing.push({...c,reason:'checksum_mismatch'});
        else good.push(c);
      }
      // A damaged header is reconstructable from the committed byte extent even if a
      // DIFFERENT chunk has bad CRC. Preserve independently valid PCM chunk ranges.
      const availableBytes=size>=HEADER_BYTES?size-HEADER_BYTES:0;
      const alignedBytes=availableBytes-availableBytes%(this.channels*4);
      const header=await this.fs.read(s.filePath,0,HEADER_BYTES);
      if(!checkHeader(header,alignedBytes,this.rate,this.channels)){
        if(size>=HEADER_BYTES){
          if(alignedBytes!==availableBytes){await this.fs.truncate(s.filePath,HEADER_BYTES+alignedBytes);report.truncatedBytes+=availableBytes-alignedBytes;}
          await this.fs.write(s.filePath,0,wavHeader(alignedBytes,this.rate,this.channels));
          await this.fs.flush(s.filePath);report.repairedHeaders.push(s.segmentId);
        }else{
          // Header cannot be reconstructed safely: no range is playable as WAV.
          for(let i=good.length-1;i>=0;i--)if(good[i].segmentId===s.segmentId){missing.push({...good[i],reason:'missing_wav_header'});good.splice(i,1);}
          s.completionState='corrupt';
        }
      }
      if(size<committedEnd) s.completionState='recovery_needed';
    }
    if(this.fs.list){
      const known=new Set(m.segments.map(s=>s.filePath));
      for(const path of await this.fs.list(this.id+'/'))if(!known.has(path)){
        const size=await this.fs.size(path);report.uncommittedBytes+=Math.max(0,size-HEADER_BYTES);
        (report.orphanFiles??=[]).push({filePath:path,size,reason:'not_in_journal'});
      }
    }
    report.committedRanges=ranges(good);
    report.unavailable=missing.map(x=>({sampleStart:x.firstSample,sampleEndExclusive:x.firstSample+x.sampleCount,reason:x.reason,segmentId:x.segmentId}));
    this.lastRecovery=report;return report;
  }
  async readSample(sample,count=1) {
    assert(Number.isSafeInteger(sample)&&sample>=0&&Number.isSafeInteger(count)&&count>0 && Number.isSafeInteger(sample+count),'invalid seek');
    if(!this.manifest.chunks.some(x=>x.firstSample<=sample&&sample<x.firstSample+x.sampleCount))
      return {status:this.pending.some(x=>x.firstSample<=sample&&sample<x.firstSample+x.sampleCount)?'pending':'missing',atSample:sample};
    const report=this.lastRecovery?.revision===this.manifest.revision?this.lastRecovery:
      this.pending.length?{committedRanges:ranges(this.manifest.chunks),revision:this.manifest.revision}:await this.reconcile();
    let cursor=sample,parts=[];
    while(cursor<sample+count){
      const c=this.manifest.chunks.find(x=>x.firstSample<=cursor&&cursor<x.firstSample+x.sampleCount);
      if(!c || !report.committedRanges.some(x=>x.sampleStart===c.firstSample&&x.segmentId===c.segmentId))return {status:'missing',atSample:cursor};
      if(!await this.fs.exists(c.filePath)) return {status:'missing',atSample:cursor,reason:'missing_file_after_reconcile'};
      const size=await this.fs.size(c.filePath);
      if(size<c.byteOffset+c.byteLength)return {status:'missing',atSample:cursor,reason:'file_truncated_after_reconcile'};
      const header=await this.fs.read(c.filePath,0,HEADER_BYTES);
      const committedBytes=this.manifest.chunks.filter(x=>x.filePath===c.filePath).reduce((n,x)=>Math.max(n,x.byteOffset+x.byteLength),HEADER_BYTES)-HEADER_BYTES;
      const expectedBytes=this.pending.length?committedBytes:size-HEADER_BYTES;
      if(!checkHeader(header,expectedBytes,this.rate,this.channels))return {status:'missing',atSample:cursor,reason:'invalid_header_after_reconcile'};
      // Validate just the touched chunk, not three hours of other chunks on each seek.
      const full=await this.fs.read(c.filePath,c.byteOffset,c.byteLength);
      if(full.byteLength!==c.byteLength||crc32(full)!==c.crc32)return {status:'missing',atSample:cursor,reason:'checksum_mismatch_after_reconcile'};
      const n=Math.min(sample+count-cursor,c.firstSample+c.sampleCount-cursor),byteOffset=(cursor-c.firstSample)*this.channels*4;
      parts.push(full.subarray(byteOffset,byteOffset+n*this.channels*4));cursor+=n;
    }
    const output=new Uint8Array(parts.reduce((n,b)=>n+b.byteLength,0));let at=0;
    for(const p of parts){output.set(p,at);at+=p.byteLength;}
    return {status:'valid',pcm:output.buffer,sampleStart:sample,sampleCount:count};
  }
  async toAudioManifest(){
    const m=this.manifest;
    const report=this.lastRecovery?.revision===m.revision?this.lastRecovery:this.pending.length?{committedRanges:ranges(m.chunks),unavailable:[],gaps:m.intervals.filter(i=>i.kind==='gap'),revision:m.revision}:await this.reconcile();
    const good=new Set(report.committedRanges.map(x=>`${x.segmentId}/${x.sampleStart}`));
    const segments=m.segments.map(s=>{const committed=m.chunks.filter(c=>c.segmentId===s.segmentId).reduce((n,c)=>n+c.sampleCount,0);return {segmentId:s.segmentId,filePath:s.filePath,mediaStartMs:Math.round(s.sampleStart*1000/this.rate),mediaDurationMs:Math.round(committed*1000/this.rate),sampleStart:s.sampleStart,sampleCount:committed,completionState:s.completionState};});
    const intervals=[];
    const make=(kind,start,end,segmentRefs,reason)=>({meetingStartMs:start*1000/this.rate,meetingEndMs:end*1000/this.rate,kind,segmentRefs,...(kind!=='gap'?{mediaStartMs:start*1000/this.rate,mediaEndMs:end*1000/this.rate}:{}),...(reason?{reason}:{})});
    for(const c of m.chunks){
      if(good.has(`${c.segmentId}/${c.firstSample}`))intervals.push(make('recorded',c.firstSample,c.firstSample+c.sampleCount,[c.segmentId]));
    }
    for(const u of report.unavailable)intervals.push(make('unavailable',u.sampleStart,u.sampleEndExclusive,[u.segmentId],u.reason));
    for(const g of report.gaps)if(g.sampleStart<g.sampleEndExclusive)intervals.push(make('gap',g.sampleStart,g.sampleEndExclusive,[],g.reason));
    intervals.sort((a,b)=>a.meetingStartMs-b.meetingStartMs||a.meetingEndMs-b.meetingEndMs);
    return {recordingId:this.id,sampleRate:this.rate,mappingPoints:[],segments,intervals};
  }
}
// Deterministic sine generator: bounded memory, exact f32le wire encoding.
export function chunkFixture({recordingId='fixture',sequenceNo,firstSample,sampleCount=4096,sampleRate=48000,channels=1}){
  const pcm=new ArrayBuffer(sampleCount*channels*4),v=new DataView(pcm);
  for(let i=0;i<sampleCount;i++)for(let ch=0;ch<channels;ch++) v.setFloat32((i*channels+ch)*4,Math.sin((firstSample+i)*2*Math.PI*440/sampleRate)*0.1,true);
  return {recordingId,sequenceNo,firstSample,sampleCount,sampleRate,channels,format:'f32le',pcm};
}
