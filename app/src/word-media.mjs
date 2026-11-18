import {Node,Mark} from '@tiptap/core';
export const MAX_EMBEDDED_IMAGE=300000;

export function safeLink(raw){
  if(typeof raw!=='string'||raw.length>2048)throw Error('Liên kết quá dài hoặc không hợp lệ');
  const value=raw.trim();let u;
  try{u=new URL(value);}catch{throw Error('Hãy nhập địa chỉ https://, http:// hoặc mailto:');}
  if(!['https:','http:','mailto:'].includes(u.protocol)||u.username||u.password)
    throw Error('Chỉ hỗ trợ http(s) hoặc mailto, không nhận mã thực thi trong liên kết');
  return u.href;
}
export const MeetingLink=Mark.create({
  name:'meetingLink',inclusive:false,
  addAttributes(){return {href:{
    default:null,
    parseHTML:el=>{try{return safeLink(el.getAttribute('href'));}catch{return null;}},
    renderHTML:attrs=>attrs.href?{href:attrs.href,target:'_blank',rel:'noopener noreferrer'}:{}
  }};},
  parseHTML(){return [{tag:'a[href]'}];},
  renderHTML({HTMLAttributes}){return ['a',{...HTMLAttributes,'data-meeting-link':'true'},0];}
});
export const MeetingPageBreak=Node.create({
  name:'meetingPageBreak',group:'block',atom:true,selectable:true,
  parseHTML(){return [{tag:'div[data-meeting-page-break]'}];},
  renderHTML(){return ['div',{'data-meeting-page-break':'true',class:'meeting-page-break'}];}
});
export const MeetingImage=Node.create({
  name:'meetingImage',group:'block',atom:true,draggable:false,
  addAttributes(){return {
    src:{default:null,parseHTML:el=>isSafeImageSource(el.getAttribute('src'))?el.getAttribute('src'):null},
    alt:{default:'Ảnh đính kèm'},
    width:{default:480},height:{default:320}
  };},
  parseHTML(){return [{tag:'img[data-meeting-image]'}];},
  renderHTML({HTMLAttributes}){
    if(!isSafeImageSource(HTMLAttributes.src))return ['span',{'data-invalid-image':'true'}];
    return ['img',{'data-meeting-image':'true',src:HTMLAttributes.src,
      alt:String(HTMLAttributes.alt??'Ảnh đính kèm'),width:HTMLAttributes.width,
      height:HTMLAttributes.height}];
  }
});
export function isSafeImageSource(src){
  return typeof src==='string'&&
    /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(src)&&
    src.length<=MAX_EMBEDDED_IMAGE*1.4;
}
function dimensions(bytes,type){
  const v=new DataView(bytes);
  if(type==='image/png'&&bytes.byteLength>=24)return {
    width:v.getUint32(16,false),height:v.getUint32(20,false)};
  if(type==='image/jpeg'){
    let i=2;
    while(i+9<bytes.byteLength){
      if(v.getUint8(i++)!==255)break;
      let marker=v.getUint8(i++);
      while(marker===255&&i<bytes.byteLength)marker=v.getUint8(i++);
      if([0xc0,0xc1,0xc2,0xc3].includes(marker))
        return {height:v.getUint16(i+3,false),width:v.getUint16(i+5,false)};
      if(i+2>bytes.byteLength)break;
      const len=v.getUint16(i,false);if(len<2)break;i+=len;
    }
  }
  throw Error('Không đọc được kích thước ảnh PNG/JPEG');
}
export async function imageNodeFromFile(file){
  if(!file||!['image/png','image/jpeg'].includes(file.type)||
     file.size<32||file.size>MAX_EMBEDDED_IMAGE)
    throw Error('Chỉ cho chèn PNG/JPEG tối đa 300 KB mỗi ảnh; hãy nén ảnh trước khi chèn');
  const bytes=await file.arrayBuffer(),d=dimensions(bytes,file.type);
  if(!(d.width>0&&d.height>0&&d.width<=20000&&d.height<=20000))
    throw Error('Kích thước ảnh không hợp lệ');
  const raw=new Uint8Array(bytes);let input='';
  for(let i=0;i<raw.length;i+=4096)
    input+=String.fromCharCode(...raw.subarray(i,Math.min(raw.length,i+4096)));
  const src='data:'+file.type+';base64,'+btoa(input);
  if(!isSafeImageSource(src))throw Error('Ảnh không an toàn hoặc quá lớn');
  const scale=Math.min(1,560/d.width,720/d.height);
  return {type:'meetingImage',attrs:{src,alt:String(file.name??'Ảnh đính kèm').slice(0,120),
    width:Math.max(1,Math.round(d.width*scale)),
    height:Math.max(1,Math.round(d.height*scale))}};
}
