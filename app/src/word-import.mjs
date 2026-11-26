import mammothModule from 'mammoth/mammoth.browser';
import DOMPurify from 'dompurify';

const mammoth=mammothModule?.convertToHtml?mammothModule:mammothModule?.default;
const LIMIT=15*1024*1024;

/** Converts only the document's prose, never imported provenance.
 * Images/embedded objects are ignored; no external HTML or data-time-*
 * attributes can be used to forge a playable recording mark.
 */
export async function importSafeDOCX(file){
  if(!file || !/\.docx$/i.test(file.name??'') ||
     !Number.isFinite(file.size) || file.size<100 || file.size>LIMIT)
    throw Error('Chỉ hỗ trợ tệp .docx hợp lệ tối đa 15 MB');
  if(!mammoth?.convertToHtml)throw Error('Bộ nhập Word chưa sẵn sàng');
  const converted=await mammoth.convertToHtml({arrayBuffer:await file.arrayBuffer()},
    {includeEmbeddedStyleMap:false});
  const html=DOMPurify.sanitize(converted.value??'',{
    USE_PROFILES:{html:true},
    ALLOW_DATA_ATTR:false,
    FORBID_TAGS:['style','script','iframe','svg','math','form','input','img','video','audio','object','embed'],
    FORBID_ATTR:['id','class','name']
  });
  const probe=document.createElement('div');probe.innerHTML=html;
  if(!probe.textContent?.trim())throw Error('Tệp Word không có nội dung văn bản để chèn');
  if(probe.querySelector('[data-time-anchor-id],[data-time-recording-id]'))
    throw Error('Nội dung Word chứa mốc âm thanh không hợp lệ');
  return {html,warnings:converted.messages??[]};
}
