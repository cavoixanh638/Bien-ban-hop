export const HEADER_BYTES = 44;
export function assert(ok,message){if(!ok)throw Error(message)}
export function wavHeader(n,rate,ch){
 assert(n>=0&&n<=0xffffffff-36,'WAV too large');
 const b=new Uint8Array(44),d=new DataView(b.buffer);
 for(const [p,s] of [[0,'RIFF'],[8,'WAVE'],[12,'fmt '],[36,'data']])for(let i=0;i<s.length;i++)b[p+i]=s.charCodeAt(i);
 d.setUint32(4,36+n,true);d.setUint32(16,16,true);d.setUint16(20,3,true);d.setUint16(22,ch,true);d.setUint32(24,rate,true);d.setUint32(28,rate*ch*4,true);d.setUint16(32,ch*4,true);d.setUint16(34,32,true);d.setUint32(40,n,true);return b;
}
export function checkHeader(b,n,rate,ch){if(b.length!==44)return false;const d=new DataView(b.buffer,b.byteOffset,b.length);return [['RIFF',0],['WAVE',8],['fmt ',12],['data',36]].every(([s,p])=>[...s].every((c,i)=>b[p+i]===c.charCodeAt(0)))&&d.getUint32(4,true)===36+n&&d.getUint16(20,true)===3&&d.getUint16(22,true)===ch&&d.getUint32(24,true)===rate&&d.getUint32(40,true)===n;}
export function crc32(b){let c=0xffffffff;for(const v of b){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
const clone=x=>structuredClone(x);
const ranges=xs=>xs.map(x=>({sampleStart:x.firstSample,sampleEndExclusive:x.firstSample+x.sampleCount,byteStart:x.byteOffset,byteEndExclusive:x.byteOffset+x.byteLength,segmentId:x.segmentId}));
export class Recorder {
 constructor({fs,journal,recordingId,sampleRate=48000,channels=1,segmentSeconds=300,now=()=>performance.now()}){
 assert(/^[\w-]+$/.test(recordingId),'unsafe recordingId');assert(sampleRate>0&&channels>0&&segmentSeconds>0,'invalid format');
 Object.assign(this,{fs,journal,id:recordingId,rate:sampleRate,channels,limit:Math.floor(sampleRate*segmentSeconds),now,failed:false,pending:[]});
 this.manifest={schemaVersion:1,recordingId,sampleRate,channels,format:'f32le',revision:0,segments:[],chunks:[],intervals:[],nextSequenceNo:0,acceptedThroughSampleExclusive:0,committedThroughSampleExclusive:0};
 this.metrics={writeMs:0,flushMs:0,journalMs:0,bytesWritten:0,flushCount:0,maxPendingBytes:0};
 }
 async initialize(){await this.journal.save(this.id,this.manifest);}
 static async reopen(opts){const m=await opts.journal.load(opts.recordingId);assert(m,'missing journal');const r=new Recorder({...opts,sampleRate:m.sampleRate,channels:m.channels});r.manifest=m;r.lastRecovery=await r.reconcile();return r;}
 segment(sample){
 const boundary=Math.floor(sample/this.limit)*this.limit;
 let s=this.manifest.segments.find(x=>x.sampleStart>=boundary&&x.sampleStart+x.sampleCount===sample);
 if(!s){s={segmentId:'seg-'+sample,filePath:this.id+'/seg-'+sample+'.wav',sampleStart:sample,sampleCount:0,byteLength:44,completionState:'writing'};this.manifest.segments.push(s);}
 return s;
 }
 async append(c){
 assert(!this.failed,'recorder failed');assert(c.recordingId===this.id&&c.sampleRate===this.rate&&c.channels===this.channels&&c.format==='f32le','format/source mismatch');
 assert(c.pcm instanceof ArrayBuffer&&Number.isSafeInteger(c.sampleCount)&&c.sampleCount>0&&c.pcm.byteLength===c.sampleCount*c.channels*4,'PCM length mismatch');
 assert(Number.isSafeInteger(c.firstSample)&&c.firstSample>=0&&Number.isSafeInteger(c.sequenceNo)&&c.sequenceNo>=this.manifest.nextSequenceNo,'duplicate or invalid sequence');
 const m=this.manifest;assert(c.firstSample>=m.acceptedThroughSampleExclusive,'overlapping samples');
 if(c.firstSample>m.acceptedThroughSampleExclusive)m.intervals.push({kind:'gap',sampleStart:m.acceptedThroughSampleExclusive,sampleEndExclusive:c.firstSample,reason:'missing_samples_or_sequence'});
 if(c.sequenceNo>m.nextSequenceNo&&c.firstSample===m.acceptedThroughSampleExclusive)m.intervals.push({kind:'gap',sampleStart:c.firstSample,sampleEndExclusive:c.firstSample,reason:'missing_sequence_without_sample_gap'});
 const b=new Uint8Array(c.pcm);let remaining=c.sampleCount,offset=0,sample=c.firstSample;
 try{
 while(remaining){
 const s=this.segment(sample),count=Math.min(remaining,(Math.floor(sample/this.limit)+1)*this.limit-sample);
 const part=b.subarray(offset*this.channels*4,(offset+count)*this.channels*4),at=s.byteLength,t=this.now();
 if(at===44)await this.fs.write(s.filePath,0,wavHeader(0,this.rate,this.channels));
 await this.fs.write(s.filePath,at,part);
 this.metrics.writeMs+=this.now()-t;this.metrics.bytesWritten+=part.length;s.byteLength+=part.length;s.sampleCount+=count;
 this.pending.push({segmentId:s.segmentId,filePath:s.filePath,sequenceNo:c.sequenceNo,firstSample:sample,sampleCount:count,byteOffset:at,byteLength:part.length,crc32:crc32(part)});
 remaining-=count;offset+=count;sample+=count;
 }
 m.nextSequenceNo=c.sequenceNo+1;m.acceptedThroughSampleExclusive=c.firstSample+c.sampleCount;
 this.metrics.maxPendingBytes=Math.max(this.metrics.maxPendingBytes,this.pending.reduce((n,x)=>n+x.byteLength,0));
 return {type:'bufferReleased',sequenceNo:c.sequenceNo,committed:false};
 }catch(e){this.failed=true;throw e;}
 }
 async flush({faultAt}={}){
 assert(!this.failed,'recorder failed');const m=this.manifest;
 if(!this.pending.length)return {type:'committed',committedThroughSampleExclusive:m.committedThroughSampleExclusive,revision:m.revision};
 const dirty=new Set(this.pending.map(x=>x.segmentId));
 try{
 const t=this.now();
 for(const s of m.segments.filter(x=>dirty.has(x.segmentId))){await this.fs.write(s.filePath,0,wavHeader(s.byteLength-44,this.rate,this.channels));await this.fs.flush(s.filePath);}
 this.metrics.flushMs+=this.now()-t;this.metrics.flushCount++;
 if(faultAt==='afterOpfsFlush')throw Error('simulated crash after OPFS flush');
 const next=clone(m);next.chunks.push(...this.pending);next.revision++;const last=next.chunks.at(-1);next.committedThroughSampleExclusive=last.firstSample+last.sampleCount;
 for(const s of next.segments)if(dirty.has(s.segmentId))s.completionState='checkpointed';
 const j=this.now();await this.journal.save(this.id,next);this.metrics.journalMs+=this.now()-j;
 this.manifest=next;this.pending=[];this.lastRecovery=null;
 if(faultAt==='afterJournalCommit')throw Error('simulated crash after journal commit');
 return {type:'committed',committedThroughSampleExclusive:next.committedThroughSampleExclusive,revision:next.revision,committedRanges:ranges(next.chunks)};
 }catch(e){this.failed=true;throw e;}
 }
 async reconcile(){
 const m=this.manifest,report={recordingId:this.id,committedRanges:[],unavailable:[],gaps:m.intervals.filter(x=>x.kind==='gap'),uncommittedBytes:0,truncatedBytes:0,repairedHeaders:[],revision:m.revision};
 const good=[],bad=[];
 for(const s of m.segments){
 const entries=m.chunks.filter(c=>c.segmentId===s.segmentId);
 if(!await this.fs.exists(s.filePath)){for(const c of entries)bad.push({...c,reason:'missing_file'});s.completionState='corrupt';continue;}
 const size=await this.fs.size(s.filePath),committedEnd=entries.reduce((n,c)=>Math.max(n,c.byteOffset+c.byteLength),44);
 if(size>committedEnd){report.uncommittedBytes+=size-committedEnd;await this.fs.truncate(s.filePath,committedEnd);report.truncatedBytes+=size-committedEnd;}
 let allValid=true;
 for(const c of entries){
 if(c.byteOffset+c.byteLength>size){bad.push({...c,reason:'short_file'});allValid=false;continue;}
 const b=await this.fs.read(s.filePath,c.byteOffset,c.byteLength);
 if(b.length!==c.byteLength||crc32(b)!==c.crc32){bad.push({...c,reason:'checksum_mismatch'});allValid=false;}else good.push(c);
 }
 const dataLength=Math.max(0,Math.min(size,committedEnd)-44),header=await this.fs.read(s.filePath,0,44);
 if(!checkHeader(header,dataLength,this.rate,this.channels)){
 if(allValid&&size>=44){await this.fs.write(s.filePath,0,wavHeader(dataLength,this.rate,this.channels));await this.fs.flush(s.filePath);report.repairedHeaders.push(s.segmentId);}
 else s.completionState='recovery_needed';
 }
 if(size<committedEnd)s.completionState='recovery_needed';
 }
 if(this.fs.list){const known=new Set(m.segments.map(s=>s.filePath));for(const path of await this.fs.list(this.id+'/'))if(!known.has(path)){const size=await this.fs.size(path);report.uncommittedBytes+=Math.max(0,size-44);(report.orphanFiles??=[]).push({filePath:path,size,reason:'not_in_journal'});}}
 report.committedRanges=ranges(good);report.unavailable=bad.map(c=>({sampleStart:c.firstSample,sampleEndExclusive:c.firstSample+c.sampleCount,segmentId:c.segmentId,reason:c.reason}));
 this.lastRecovery=report;return report;
 }
 async readSample(sample,count=1){
 assert(Number.isInteger(sample)&&sample>=0&&Number.isInteger(count)&&count>0,'bad seek');
 if(!this.manifest.chunks.some(c=>sample>=c.firstSample&&sample<c.firstSample+c.sampleCount))return {status:'missing',atSample:sample};
 const report=this.pending.length?this.lastRecovery:await this.reconcile();
 if(!report)return {status:'pending',atSample:sample};
 const parts=[];let cursor=sample;
 while(cursor<sample+count){
 const c=this.manifest.chunks.find(x=>x.firstSample<=cursor&&cursor<x.firstSample+x.sampleCount);
 if(!c||!report.committedRanges.some(x=>x.sampleStart===c.firstSample&&x.segmentId===c.segmentId))return {status:'missing',atSample:cursor};
 const take=Math.min(sample+count-cursor,c.firstSample+c.sampleCount-cursor),at=c.byteOffset+(cursor-c.firstSample)*this.channels*4;
 parts.push(await this.fs.read(c.filePath,at,take*this.channels*4));cursor+=take;
 }
 const b=new Uint8Array(parts.reduce((n,x)=>n+x.length,0));let at=0;for(const p of parts){b.set(p,at);at+=p.length;}return {status:'valid',pcm:b.buffer,sampleStart:sample,sampleCount:count};
 }
 toAudioManifest(){const m=this.manifest;return {recordingId:this.id,sampleRate:this.rate,mappingPoints:[],segments:m.segments.map(s=>({segmentId:s.segmentId,filePath:s.filePath,mediaStartMs:Math.round(1000*s.sampleStart/this.rate),mediaDurationMs:Math.round(1000*s.sampleCount/this.rate),sampleStart:s.sampleStart,sampleCount:s.sampleCount,completionState:s.completionState})),intervals:m.intervals.map(x=>({kind:x.kind,meetingStartMs:x.sampleStart*1000/this.rate,meetingEndMs:x.sampleEndExclusive*1000/this.rate,segmentRefs:[],reason:x.reason}))};}
}
export function chunkFixture({recordingId='fixture',sequenceNo,firstSample,sampleCount=4096,sampleRate=48000,channels=1}){
 const pcm=new ArrayBuffer(sampleCount*channels*4),d=new DataView(pcm);
 for(let i=0;i<sampleCount;i++)for(let ch=0;ch<channels;ch++)d.setFloat32((i*channels+ch)*4,Math.sin((firstSample+i)*2*Math.PI*440/sampleRate)*0.1,true);
 return {recordingId,sequenceNo,firstSample,sampleCount,sampleRate,channels,format:'f32le',pcm};
}
