const MiB=1024*1024;
export function assessStorageEstimate(estimate,{minFreeMiB=250,minFreeRatio=0.10}={}){
  const quota=estimate?.quota,usage=estimate?.usage;
  if(!Number.isFinite(quota)||quota<=0||!Number.isFinite(usage)||usage<0||usage>quota)
    return {level:'unknown',label:'Trình duyệt chưa cung cấp ước tính dung lượng lưu trữ.'};
  const free=Math.max(0,quota-usage),ratio=free/quota;
  const level=free<minFreeMiB*MiB||ratio<minFreeRatio?'warning':'normal';
  return {level,usedBytes:usage,quotaBytes:quota,freeBytes:free,ratio,
    label:'Dữ liệu trình duyệt ~'+(usage/MiB).toFixed(0)+' MB / '+
      (quota/MiB).toFixed(0)+' MB; còn ước tính '+(free/MiB).toFixed(0)+' MB.'+
      (level==='warning'?' GẦN ĐẦY: hãy sao lưu rồi giải phóng dung lượng an toàn.':'')};
}
export async function checkBrowserStorage(navigatorRef=navigator){
  if(!navigatorRef.storage?.estimate)return assessStorageEstimate(null);
  return assessStorageEstimate(await navigatorRef.storage.estimate());
}
