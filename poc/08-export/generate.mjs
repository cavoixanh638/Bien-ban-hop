import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {exportAll} from './exporter.mjs';
const note=JSON.parse(await readFile(new URL('./fixture.json',import.meta.url),'utf8'));
const dir=new URL('./samples/',import.meta.url);await mkdir(dir,{recursive:true});
for(const includeTimestamps of [false,true]){
 const name=includeTimestamps?'with-marks':'clean';
 const files=exportAll({document:note,title:'HỌP ĐIỀU HÀNH – Hải Phòng',includeTimestamps});
 for(const [ext,body] of Object.entries(files)){await writeFile(new URL('meeting-'+name+'.'+ext,dir),body);console.log('WROTE',name,ext);}
}
