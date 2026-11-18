/**
 * A4 margins shared by DOCX and the native browser print UI.
 * Values are bounded, fixed presets. Never concatenate user text into CSS.
 */
export const PAGE_MARGIN_PRESETS=Object.freeze({
  official:Object.freeze({label:'Biên bản: trái 3 cm, các lề khác 2 cm',
    left:1701,right:1134,top:1134,bottom:1134,css:'20mm 20mm 20mm 30mm'}),
  balanced:Object.freeze({label:'Cân đối: trái/phải 2,5 cm, trên/dưới 2 cm',
    left:1417,right:1417,top:1134,bottom:1134,css:'20mm 25mm 20mm 25mm'}),
  compact:Object.freeze({label:'Lề đều 2 cm',
    left:1134,right:1134,top:1134,bottom:1134,css:'20mm'})
});
export function pageMargins(option){
  const preset=PAGE_MARGIN_PRESETS[option]??PAGE_MARGIN_PRESETS.official;
  return {top:preset.top,bottom:preset.bottom,left:preset.left,right:preset.right};
}
export function printPageRule(option){
  const preset=PAGE_MARGIN_PRESETS[option]??PAGE_MARGIN_PRESETS.official;
  return '@page { size: A4; margin: '+preset.css+'; }';
}
