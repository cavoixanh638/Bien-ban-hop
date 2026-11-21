import {scanVerifiedSilence} from './silence-skip.mjs';

/** Bounded look-ahead over durable source samples. The index never fabricates
 * coverage, never scans the entire recording before first playback, and prunes
 * consumed silence ranges so hours of meetings do not accumulate in memory.
 */
export const SILENCE_LOOKAHEAD_MS=8000;
export const PITCH_CHUNK_MS=6000;
export const PITCH_CHUNK_MAX_BYTES=8*1024*1024;

export function planStreamChunk(rate,startSample,endSample,limitSample){
  if(!Number.isSafeInteger(rate)||rate<8000||rate>192000||
    !Number.isSafeInteger(startSample)||startSample<0||
    !Number.isSafeInteger(endSample)||endSample<=startSample||
    !Number.isSafeInteger(limitSample)||limitSample<=startSample)
    throw Error('Không thể chọn vùng PCM phát theo luồng');
  const maxFrames=Math.min(Math.round(rate*PITCH_CHUNK_MS/1000),
    Math.floor(PITCH_CHUNK_MAX_BYTES/4));
  const last=Math.min(endSample,limitSample,startSample+maxFrames);
  const frames=last-startSample;
  if(frames<=0)throw Error('Không có mẫu PCM liền mạch cho phát theo luồng');
  return {startSample,endSample:last,frames,bytes:frames*4,rate};
}

export class ProgressiveSilenceIndex {
  constructor(reader,rate,startSample,endSample,{cancelled=()=>false,onScanned=()=>{}}={}){
    if(!reader?.call||!Number.isSafeInteger(rate)||rate<8000||rate>192000||
      !Number.isSafeInteger(startSample)||startSample<0||
      !Number.isSafeInteger(endSample)||endSample<=startSample)
      throw Error('Phạm vi phân tích im lặng không hợp lệ');
    this.reader=reader;this.rate=rate;this.cursor=startSample;this.end=endSample;
    this.cancelled=cancelled;this.onScanned=onScanned;
    this.ranges=[];this.skippedMs=0;this.scannedSamples=0;
    this.windowFrames=Math.round(rate*SILENCE_LOOKAHEAD_MS/1000);
  }
  async ensure(sample){
    if(!Number.isSafeInteger(sample)||sample<0||sample>=this.end)
      return this.cursor;
    while(this.cursor<=sample&&this.cursor<this.end){
      if(this.cancelled())return null;
      const first=this.cursor,last=Math.min(this.end,first+this.windowFrames);
      const focusMs=Math.max(400,Math.ceil((last-first)*1000/this.rate));
      const result=await scanVerifiedSilence(this.reader,
        {status:'valid',startSample:first,anchorSample:first,endSampleExclusive:last},
        this.rate,focusMs,{cancelled:this.cancelled});
      if(!result||this.cancelled())return null;
      this.ranges.push(...result.ranges);
      this.skippedMs+=result.skippedMs;
      this.scannedSamples+=result.scannedSamples;
      this.cursor=last;
      this.onScanned({scannedSamples:this.scannedSamples,skippedMs:this.skippedMs,
        scannedThroughSample:this.cursor});
    }
    return this.cursor;
  }
  async next(sample){
    if(!Number.isSafeInteger(sample)||sample<0||sample>=this.end)
      return null;
    const cursor=await this.ensure(sample);
    if(cursor===null)return null;
    // The scheduler never needs a silence interval fully behind its cursor.
    this.ranges=this.ranges.filter(r=>r.endSample>sample);
    const current=this.ranges.find(r=>r.startSample<=sample&&sample<r.endSample);
    if(current)return {skipTo:current.endSample,availableUntil:cursor};
    const next=this.ranges.find(r=>r.startSample>sample);
    const availableUntil=Math.min(this.end,cursor,next?.startSample??this.end);
    if(availableUntil<=sample)throw Error('Bộ phân tích im lặng không tiến triển');
    return {skipTo:null,availableUntil};
  }
}
