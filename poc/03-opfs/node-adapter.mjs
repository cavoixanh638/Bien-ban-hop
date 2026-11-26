import {open,mkdir,stat,readdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
export class NodeFiles {
 constructor(base){this.base=base;this.handles=new Map();}
 async handle(path){if(!this.handles.has(path)){const full=join(this.base,path);await mkdir(dirname(full),{recursive:true});let h;try{h=await open(full,'r+');}catch(e){if(e.code!=='ENOENT')throw e;h=await open(full,'w+');}this.handles.set(path,h);}return this.handles.get(path);}
 async write(path,at,b){const h=await this.handle(path);let i=0;while(i<b.length){const {bytesWritten}=await h.write(b,i,b.length-i,at+i);if(bytesWritten<=0)throw Error('short write');i+=bytesWritten;}}
 async read(path,at,n){const b=Buffer.alloc(n),h=await this.handle(path);const {bytesRead}=await h.read(b,0,n,at);return b.subarray(0,bytesRead);}
 async flush(path){await (await this.handle(path)).sync();}
 async size(path){return (await (await this.handle(path)).stat()).size;}
 async truncate(path,n){await (await this.handle(path)).truncate(n);}
 async exists(path){try{await stat(join(this.base,path));return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
 async list(prefix){const out=[];const walk=async(dir,p)=>{for(const d of await readdir(dir,{withFileTypes:true})){const name=p+d.name;if(d.isDirectory())await walk(join(dir,d.name),name+'/');else out.push(name);}};await walk(this.base,'');return out.filter(p=>p.startsWith(prefix));}
 async close(){for(const h of this.handles.values())await h.close();this.handles.clear();}
}
