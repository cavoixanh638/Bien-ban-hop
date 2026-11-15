/** ZIP_STORED streaming ZIP64 writer + random-access reader, dependency-free PoC.
 * Only methods 0 (stored) are accepted. Never treat this as a general ZIP extractor.
 * Web Streams sink/source and Blob/slice readers work on Windows and browsers.
 */
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export class Crc32 {
  constructor() { this.value = 0xffffffff; }
  update(bytes) { let c = this.value; for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8); this.value = c; return this; }
  digest() { return (this.value ^ 0xffffffff) >>> 0; }
}
const K = Uint32Array.from([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
]);
const rotr = (n,x) => (x >>> n) | (x << (32 - n));
export class Sha256 {
  constructor() {
    this.h = Uint32Array.from([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
    this.w = new Uint32Array(64); this.buf = new Uint8Array(64); this.used = 0; this.total = 0n; this.finalized = false;
  }
  block(bytes, at) {
    const w=this.w, h=this.h;
    for (let i=0;i<16;i++) w[i] = ((bytes[at+i*4]<<24)|(bytes[at+i*4+1]<<16)|(bytes[at+i*4+2]<<8)|bytes[at+i*4+3])>>>0;
    for (let i=16;i<64;i++) {
      const x=w[i-15], y=w[i-2];
      w[i]=(w[i-16] + (rotr(7,x)^rotr(18,x)^(x>>>3)) + w[i-7] + (rotr(17,y)^rotr(19,y)^(y>>>10)))>>>0;
    }
    let [a,b,c,d,e,f,g,j] = h;
    for (let i=0;i<64;i++) {
      const s1=rotr(6,e)^rotr(11,e)^rotr(25,e), ch=(e&f)^(~e&g);
      const t1=(j+s1+ch+K[i]+w[i])>>>0;
      const s0=rotr(2,a)^rotr(13,a)^rotr(22,a), maj=(a&b)^(a&c)^(b&c);
      const t2=(s0+maj)>>>0;
      j=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    h[0]=(h[0]+a)>>>0;h[1]=(h[1]+b)>>>0;h[2]=(h[2]+c)>>>0;h[3]=(h[3]+d)>>>0;
    h[4]=(h[4]+e)>>>0;h[5]=(h[5]+f)>>>0;h[6]=(h[6]+g)>>>0;h[7]=(h[7]+j)>>>0;
  }
  update(bytes) {
    if (this.finalized) throw Error('hash already finalized');
    if (!(bytes instanceof Uint8Array)) throw TypeError('SHA256 requires Uint8Array');
    this.total+=BigInt(bytes.byteLength);
    let pos=0;
    if (this.used) {
      const n=Math.min(64-this.used,bytes.length);
      this.buf.set(bytes.subarray(0,n),this.used);this.used+=n;pos=n;
      if(this.used===64){this.block(this.buf,0);this.used=0;}
    }
    while(pos+64<=bytes.length){this.block(bytes,pos);pos+=64;}
    if(pos<bytes.length){this.buf.set(bytes.subarray(pos),0);this.used=bytes.length-pos;}
    return this;
  }
  digestHex() {
    if (!this.finalized) {
      const bits=this.total*8n;
      this.buf[this.used++]=128;
      if(this.used>56){this.buf.fill(0,this.used);this.block(this.buf,0);this.used=0;}
      this.buf.fill(0,this.used,56);
      new DataView(this.buf.buffer).setBigUint64(56,bits,false);
      this.block(this.buf,0);this.finalized=true;
    }
    return Array.from(this.h,v=>v.toString(16).padStart(8,'0')).join('');
  }
}
export const jsonBytes = value => encoder.encode(JSON.stringify(value));
const u16=(d,p,x)=>d.setUint16(p,x,true),u32=(d,p,x)=>d.setUint32(p,x>>>0,true),u64=(d,p,x)=>d.setBigUint64(p,BigInt(x),true);
const n64 = x => { if(x>BigInt(Number.MAX_SAFE_INTEGER))throw Error('ZIP offset exceeds safe JS integer');return Number(x); };
function bytes(n){const b=new Uint8Array(n);return {b,d:new DataView(b.buffer)};}
function requireBytes(chunk){if(!(chunk instanceof Uint8Array)) throw Error('stream chunk must be Uint8Array');return chunk;}
function fileName(name){
  if(typeof name!=='string'||!name||name.normalize('NFC')!==name||name.startsWith('/')||name.includes('\\')||name.includes('\0')||/^[A-Za-z]:/.test(name)||name.split('/').some(p=>
    !p||p==='.'||p==='..'||/[. ]$/.test(p)||/[<>:"|?*]/.test(p)||/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(p)
  )||/[\x00-\x1f\x7f]/.test(name)) throw Error('unsafe ZIP path: '+name);
  return name;
}
export {fileName};
export class ZipStoreWriter {
  /** sink: WHATWG WritableStream or equivalent {getWriter()} */
  constructor(sink,{onProgress,signal}={}){this.writer=sink.getWriter();this.position=0n;this.entries=[];this.names=new Set();this.closed=false;this.peakChunk=0;this.onProgress=onProgress;this.signal=signal;}
  async put(buf){if(this.signal?.aborted)throw Error('ZIP write aborted');requireBytes(buf);this.peakChunk=Math.max(this.peakChunk,buf.length);await this.writer.write(buf);this.position+=BigInt(buf.length);this.onProgress?.(Number(this.position));}
  async add(name,readable){
    if(this.closed)throw Error('ZIP closed');
    fileName(name);
    const collisionKey=name.normalize('NFC').toLowerCase();
    if(this.names.has(collisionKey))throw Error('ZIP duplicate path');
    this.names.add(collisionKey);
    const f=encoder.encode(name),offset=this.position;
    if(f.length>65535)throw Error('ZIP filename too long');
    // ZIP64 local extra with placeholder sizes, data descriptor after streamed bytes.
    const h=bytes(30+f.length+20),d=h.d;
    u32(d,0,0x04034b50);u16(d,4,45);u16(d,6,0x0808);u16(d,8,0);u16(d,10,0);u16(d,12,0);
    u32(d,14,0);u32(d,18,0xffffffff);u32(d,22,0xffffffff);u16(d,26,f.length);u16(d,28,20);
    h.b.set(f,30);const e=30+f.length;u16(d,e,1);u16(d,e+2,16);u64(d,e+4,0n);u64(d,e+12,0n);
    await this.put(h.b);
    const crc=new Crc32(),hash=new Sha256();let length=0n;
    const r=readable.getReader();
    try{
      for(;;){const {done,value}=await r.read();if(done)break;const chunk=requireBytes(value);crc.update(chunk);hash.update(chunk);length+=BigInt(chunk.length);await this.put(chunk);}
    } finally { r.releaseLock(); }
    const dd=bytes(24);u32(dd.d,0,0x08074b50);u32(dd.d,4,crc.digest());u64(dd.d,8,length);u64(dd.d,16,length);
    await this.put(dd.b);
    const meta={name,size:n64(length),sha256:hash.digestHex(),crc32:crc.digest(),offset};
    this.entries.push(meta);return {path:name,size:meta.size,sha256:meta.sha256};
  }
  async close(){
    if(this.closed)throw Error('ZIP already closed');this.closed=true;
    const start=this.position;
    for(const entry of this.entries){
      const f=encoder.encode(entry.name),v=bytes(46+f.length+28),d=v.d;
      u32(d,0,0x02014b50);u16(d,4,0x032d);u16(d,6,45);u16(d,8,0x0808);u16(d,10,0);u16(d,12,0);u16(d,14,0);
      u32(d,16,entry.crc32);u32(d,20,0xffffffff);u32(d,24,0xffffffff);u16(d,28,f.length);u16(d,30,28);
      u16(d,32,0);u16(d,34,0);u16(d,36,0);u32(d,38,0o100600<<16);u32(d,42,0xffffffff);
      v.b.set(f,46);const e=46+f.length;u16(d,e,1);u16(d,e+2,24);
      u64(d,e+4,entry.size);u64(d,e+12,entry.size);u64(d,e+20,entry.offset);
      await this.put(v.b);
    }
    const cdSize=this.position-start,zip64Offset=this.position;
    const end=bytes(56);u32(end.d,0,0x06064b50);u64(end.d,4,44n);u16(end.d,12,45);u16(end.d,14,45);
    u32(end.d,16,0);u32(end.d,20,0);u64(end.d,24,this.entries.length);u64(end.d,32,this.entries.length);
    u64(end.d,40,cdSize);u64(end.d,48,start);await this.put(end.b);
    const locator=bytes(20);u32(locator.d,0,0x07064b50);u32(locator.d,4,0);u64(locator.d,8,zip64Offset);u32(locator.d,16,1);
    await this.put(locator.b);
    const legacy=bytes(22);u32(legacy.d,0,0x06054b50);
    u16(legacy.d,4,0);u16(legacy.d,6,0);u16(legacy.d,8,Math.min(this.entries.length,65535));
    u16(legacy.d,10,Math.min(this.entries.length,65535));u32(legacy.d,12,0xffffffff);u32(legacy.d,16,0xffffffff);u16(legacy.d,20,0);
    await this.put(legacy.b);
    await this.writer.close();this.writer.releaseLock();
    return {size:n64(this.position),entries:this.entries.length,peakChunk:this.peakChunk,zip64:true};
  }
  async abort(reason){if(!this.closed){this.closed=true;try{await this.writer.abort(reason);}catch{}this.writer.releaseLock();}}
}
const dv = bytes => new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
function eocdScan(bytes){const d=dv(bytes);for(let p=bytes.length-22;p>=0;p--){if(d.getUint32(p,true)===0x06054b50&&p+22+d.getUint16(p+20,true)===bytes.length)return p;}throw Error('end of ZIP missing');}
export class ZipStoreReader {
  /** readAt(offset,length) -> Uint8Array; size integer. Methods 0 only, fully streamed. */
  constructor(source,{maxEntries=10000,maxCentralBytes=8*1024*1024}={}){this.source=source;this.maxEntries=maxEntries;this.maxCentralBytes=maxCentralBytes;}
  async entries(){
    const size=this.source.size;
    if(!Number.isSafeInteger(size)||size<22)throw Error('invalid ZIP size');
    const tailStart=Math.max(0,size-65557),tail=await this.source.readAt(tailStart,size-tailStart),p=eocdScan(tail),d=dv(tail);
    if(d.getUint16(p+4,true)!==0||d.getUint16(p+6,true)!==0)throw Error('multi-disk ZIP not supported');
    let count=d.getUint16(p+10,true),cdSize=d.getUint32(p+12,true),cdOffset=d.getUint32(p+16,true);
    if(p>=20&&d.getUint32(p-20,true)===0x07064b50){
      const locOffset=n64(d.getBigUint64(p-12,true));
      const eocd=await this.source.readAt(locOffset,56),z=dv(eocd);
      if(z.getUint32(0,true)!==0x06064b50)throw Error('ZIP64 EOCD missing');
      if(z.getUint32(16,true)!==0||z.getUint32(20,true)!==0)throw Error('ZIP64 multidisk unsupported');
      count=n64(z.getBigUint64(32,true));cdSize=n64(z.getBigUint64(40,true));cdOffset=n64(z.getBigUint64(48,true));
    } else if(count===65535||cdSize===0xffffffff||cdOffset===0xffffffff)throw Error('ZIP64 locator missing');
    if(count>this.maxEntries||cdSize>this.maxCentralBytes)throw Error('ZIP Central Directory limit');
    if(cdOffset+cdSize>size||cdOffset<0)throw Error('Central Directory offset invalid');
    const raw=await this.source.readAt(cdOffset,cdSize),c=dv(raw),out=[];let cursor=0;
    for(let i=0;i<count;i++){
      if(cursor+46>raw.length||c.getUint32(cursor,true)!==0x02014b50)throw Error('bad central header');
      const flags=c.getUint16(cursor+8,true),method=c.getUint16(cursor+10,true);
      const crc32=c.getUint32(cursor+16,true),n=c.getUint16(cursor+28,true),ex=c.getUint16(cursor+30,true),cm=c.getUint16(cursor+32,true);
      const end=cursor+46+n+ex+cm;
      if(end>raw.length)throw Error('truncated central directory');
      const nameBytes=raw.subarray(cursor+46,cursor+46+n);
      if(!(flags&0x0800)&&nameBytes.some(b=>b>=128))throw Error('non-UTF8 ZIP filename unsupported');
      const name=decoder.decode(nameBytes);fileName(name);
      let compressed=c.getUint32(cursor+20,true),length=c.getUint32(cursor+24,true),offset=c.getUint32(cursor+42,true);
      const attributes=c.getUint32(cursor+38,true),needSize=length===0xffffffff,needCompressed=compressed===0xffffffff,needOffset=offset===0xffffffff;
      if(needSize||needCompressed||needOffset){
        let found=false;let ep=cursor+46+n;
        while(ep+4<=cursor+46+n+ex){const id=c.getUint16(ep,true),l=c.getUint16(ep+2,true);ep+=4;
          if(ep+l>cursor+46+n+ex)throw Error('bad extra field');
          if(id===1){let qp=ep;const bound=ep+l;
            if(needSize){if(qp+8>bound)throw Error('ZIP64 size missing');length=n64(c.getBigUint64(qp,true));qp+=8;}
            if(needCompressed){if(qp+8>bound)throw Error('ZIP64 compressed size missing');compressed=n64(c.getBigUint64(qp,true));qp+=8;}
            if(needOffset){if(qp+8>bound)throw Error('ZIP64 offset missing');offset=n64(c.getBigUint64(qp,true));qp+=8;}
            found=true;break;
          }
          ep+=l;
        }
        if(!found)throw Error('ZIP64 extra missing');
      }
      if(flags&0x0001||flags&0x0040||method!==0||length!==compressed)throw Error('unsupported ZIP method/flags');
      if(name.endsWith('/')||((attributes>>>16)&0o170000)===0o120000)throw Error('directory/symlink forbidden');
      if(!Number.isSafeInteger(offset)||offset+30>cdOffset)throw Error('local ZIP offset invalid');
      out.push({name,size:length,compressedSize:compressed,offset,crc32,mode:attributes>>>16,flags,method,centralOffset:cdOffset});cursor=end;
    }
    if(cursor!==raw.length)throw Error('unexpected Central Directory bytes');
    return out;
  }
  async open(entry){
    const head=await this.source.readAt(entry.offset,30),d=dv(head);
    if(d.getUint32(0,true)!==0x04034b50)throw Error('local header missing');
    const flags=d.getUint16(6,true),method=d.getUint16(8,true),nameLen=d.getUint16(26,true),exLen=d.getUint16(28,true);
    if(flags!==entry.flags||flags&0x0001||method!==entry.method||method!==0)throw Error('local flags/method mismatch');
    const localName=await this.source.readAt(entry.offset+30,nameLen);
    if(decoder.decode(localName)!==entry.name)throw Error('local name mismatch');
    let pos=entry.offset+30+nameLen+exLen,left=entry.size;
    if(pos+left>entry.centralOffset||pos+left>this.source.size)throw Error('entry overlaps ZIP Central Directory');
    const readAt=this.source.readAt.bind(this.source);
    return new ReadableStream({
      async pull(controller){
        if(!left){controller.close();return;}
        const count=Math.min(left,256*1024),chunk=await readAt(pos,count);
        if(chunk.length!==count)throw Error('archive truncated');pos+=count;left-=count;controller.enqueue(chunk);
      }
    },{highWaterMark:1});
  }
}
export function blobSource(blob){return {size:blob.size,async readAt(offset,length){if(offset<0||length<0||offset+length>blob.size)throw Error('range out of bounds');return new Uint8Array(await blob.slice(offset,offset+length).arrayBuffer());}};}
