import {RnnoiseWorkletNode,loadRnnoise} from '@sapphi-red/web-noise-suppressor';
import rnnoiseWorkletUrl from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url';
import rnnoiseWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url';

// Only load the third-party WASM model when the user explicitly enables
// playback-only denoising. Both assets are bundled at same-origin by Vite:
// never send recorded PCM to a server or CDN.
const prepared=new WeakMap();
export async function createPlaybackRNNoise(ctx){
  if(!ctx?.audioWorklet?.addModule||ctx.sampleRate!==48000)
    throw Error('RNNoise cần AudioWorklet và AudioContext 48 kHz trên trình duyệt này.');
  let setup=prepared.get(ctx);
  if(!setup){
    setup=Promise.all([
      loadRnnoise({url:rnnoiseWasmUrl}),
      ctx.audioWorklet.addModule(rnnoiseWorkletUrl)
    ]).then(([wasmBinary])=>wasmBinary);
    prepared.set(ctx,setup);
  }
  let wasmBinary;
  try{wasmBinary=await setup;}catch(e){
    prepared.delete(ctx);
    throw Error('Không tải được RNNoise WASM cục bộ: '+e.message);
  }
  return new RnnoiseWorkletNode(ctx,{wasmBinary,maxChannels:1});
}
export function destroyPlaybackRNNoise(node){
  if(!node)return;
  try{node.disconnect();}catch{}
  try{node.destroy?.();}catch{}
}
