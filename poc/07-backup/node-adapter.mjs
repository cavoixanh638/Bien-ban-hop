/** Node filesystem staging reference: immutable data directory + atomic hard-link index. */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {createReadStream} from 'node:fs';
import {fileName,jsonBytes} from './zip-stream.mjs';
const decode=bytes=>JSON.parse(new TextDecoder().decode(bytes));
const child = (root,name)=>{fileName(name);return path.join(root,...name.split('/'));};
export async function sourceFile(filename){
  const file=await fs.open(filename,'r');const {size}=await file.stat();
  return {size,async readAt(offset,length){
    if(offset<0||length<0||offset+length>size)throw Error('source random-access range invalid');
    const bytes=new Uint8Array(length);let done=0;
    while(done<length){const {bytesRead}=await file.read(bytes,done,length-done,offset+done);if(!bytesRead)throw Error('source truncated');done+=bytesRead;}
    return bytes;
  },async close(){await file.close();}};
}
export async function fileSink(filename){
  const handle=await fs.open(filename,'wx');let closed=false;
  const sink=new WritableStream({
    async write(chunk){let done=0;while(done<chunk.length){const {bytesWritten}=await handle.write(chunk,done,chunk.length-done);if(!bytesWritten)throw Error('filesystem stalled');done+=bytesWritten;}},
    async close(){await handle.sync();await handle.close();closed=true;},
    async abort(){if(!closed){await handle.close();closed=true;}await fs.rm(filename,{force:true});}
  });
  return {sink,async cleanup(){if(!closed)await handle.close().catch(()=>{});await fs.rm(filename,{force:true});}};
}
export async function nodeRepo(root){
  await fs.mkdir(path.join(root,'stages'),{recursive:true});
  await fs.mkdir(path.join(root,'index'),{recursive:true});
  return {
    async stage(){
      const uid=randomUUID(),dir=path.join(root,'stages',uid);
      await fs.mkdir(dir);let stageDir=dir,done=false;
      return {
        async create(name){
          const dest=child(stageDir,name);await fs.mkdir(path.dirname(dest),{recursive:true});
          const handle=await fs.open(dest,'wx');let closed=false;
          return {
            async write(chunk){if(closed)throw Error('writer closed');let at=0;while(at<chunk.length){const {bytesWritten}=await handle.write(chunk,at,chunk.length-at);if(!bytesWritten)throw Error('stage stalled');at+=bytesWritten;}},
            async close(){await handle.sync();await handle.close();closed=true;},
            async abort(){if(!closed){closed=true;await handle.close();}await fs.rm(dest,{force:true});}
          };
        },
        async readJSON(name){return decode(await fs.readFile(child(stageDir,name)));},
        async writeJSON(name,obj){await fs.writeFile(child(stageDir,name),jsonBytes(obj));},
        async publish(meetingId){
          if(done)throw Error('already published');
          if(!/^[A-Za-z0-9_-]{1,128}$/.test(meetingId))throw Error('invalid ID');
          const indexPath=path.join(root,'index',meetingId+'.json');
          const tmp=path.join(root,'index','.pending-'+uid+'.json');
          await fs.writeFile(tmp,JSON.stringify({meetingId,stageId:uid}),{flag:'wx'});
          try{
            // Hard link is atomic and fails EEXIST. No TOCTOU overwrite of another meeting.
            await fs.link(tmp,indexPath);done=true;
          }finally{await fs.rm(tmp,{force:true});}
        },
        async discard(){if(!done)await fs.rm(stageDir,{recursive:true,force:true});}
      };
    },
    async locate(meetingId){
      const info=decode(await fs.readFile(path.join(root,'index',meetingId+'.json')));
      if(info.meetingId!==meetingId||!/^[0-9a-f-]{36}$/.test(info.stageId))throw Error('repository index corrupted');
      return path.join(root,'stages',info.stageId);
    },
    async readJSON(meetingId,name){const dir=await this.locate(meetingId);return decode(await fs.readFile(child(dir,name)));},
    async audioHash(meetingId,name){const dir=await this.locate(meetingId);return await fs.readFile(child(dir,name));}
  };
}
