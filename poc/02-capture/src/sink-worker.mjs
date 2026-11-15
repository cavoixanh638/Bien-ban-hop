/* Deliberately NOT OPFS. This is a bounded diagnostic sink for the capture worker's contract. */
import {CoverageLedger, checkChunk, encodeWavPcm16} from './contract.mjs';

let transport = null;
let config = null;
let ledger = null;
let queue = [];
let busy = false;
let sourceEnded = null;
let finalSent = false;
let ingressFrames = 0;
let rejectedFrames = 0;
let rejectedBlocks = 0;
let peakQueued = 0;
let prefixFrames = 0;
let prefixNext = 0;
let prefixClosed = false;
let retained = [];
let prefixRate = null;
let prefixChannels = null;
let firstBlock = null;
let middleBlock = null;
let lastBlock = null;
let sourceEvents = [];
let sourceEventCount = 0;
function recordSourceEvent(event) {
  sourceEventCount++;
  if (sourceEvents.length >= 160) sourceEvents.shift();
  sourceEvents.push(event);
}
let failure = null;

function report() {
  const counters = ledger?.summary() || {};
  return {
    ...counters, ingressFrames, rejectedFrames, rejectedBlocks, peakQueued,
    queued: queue.length + Number(busy),
    recycledBuffers: counters.blocks + rejectedBlocks,
    retainedPrefixFrames: prefixFrames,
    retainedPrefixBytes: prefixFrames * (prefixChannels || 1) * 4,
    prefixIsComplete: !prefixClosed,
    tailMissingFrames: Math.max(0, (sourceEnded?.frameCursor || 0) - (counters.highWaterSample || 0)),
    firstBlock, middleBlock, lastBlock,
    sourceEvents,
    sourceEventCount,
    failure,
    committedThroughSampleExclusive: null,
    durability: 'NOT_IMPLEMENTED_CAPTURE_SINK_ONLY'
  };
}

function retainPrefix(chunk) {
  if (prefixClosed || prefixFrames >= config.maxPrefixFrames) { prefixClosed = true; return; }
  if (chunk.firstSample !== prefixNext) { prefixClosed = true; return; }
  const frames = Math.min(chunk.sampleCount, config.maxPrefixFrames - prefixFrames);
  if (frames > 0) {
    const view = new Float32Array(chunk.pcm, 0, frames * chunk.channels);
    retained.push(view.slice());
    prefixFrames += frames;
    prefixNext += frames;
    prefixRate = chunk.sampleRate;
    prefixChannels = chunk.channels;
  }
  if (frames !== chunk.sampleCount) prefixClosed = true;
}

function summarizeBlock(chunk) {
  const samples = new Float32Array(chunk.pcm);
  const summary = {
    sequenceNo: chunk.sequenceNo, firstSample: chunk.firstSample, sampleCount: chunk.sampleCount,
    firstValues: [...samples.slice(0, 3)].map(x => +x.toFixed(5)),
    lastValues: [...samples.slice(-3)].map(x => +x.toFixed(5))
  };
  firstBlock ??= summary;
  lastBlock = summary;
  // Middle sample of the *observed* input stream, not necessarily the 90-minute point.
  if ((ledger?.blocks || 0) % 31 === 0) middleBlock = summary;
}

function recycle(chunk) {
  // Buffer return is a pool ACK only. It is explicitly NOT a committed/durable ACK.
  transport.postMessage({type: 'recycle', pcm: chunk.pcm}, [chunk.pcm]);
}

function processNext() {
  if (busy || !queue.length) { maybeFinalize(); return; }
  busy = true;
  const chunk = queue.shift();
  setTimeout(() => {
    try {
      if (config.cpuBurnMs > 0) {
        const until = performance.now() + config.cpuBurnMs;
        while (performance.now() < until) { /* Worker-only synthetic CPU stress. */ }
      }
      checkChunk(chunk);
      ledger.accept(chunk);
      summarizeBlock(chunk);
      retainPrefix(chunk);
    } catch (error) {
      failure = `${error?.stack || error}`;
      self.postMessage({type: 'error', reason: failure});
    } finally {
      recycle(chunk);
      busy = false;
      processNext();
    }
  }, config.delayMs);
}

function maybeFinalize() {
  if (!sourceEnded || busy || queue.length || finalSent) return;
  finalSent = true;
  self.postMessage({type: 'final', metrics: report()});
}

function onPacket(message) {
  if (message?.type === 'source-event') {
    recordSourceEvent(message.event);
    return;
  }
  if (message?.type === 'source-ended') {
    sourceEnded = message;
    maybeFinalize();
    return;
  }
  if (message?.type !== 'chunk') return;
  const chunk = message.chunk;
  try {
    checkChunk(chunk);
    ingressFrames += chunk.sampleCount;
    if (queue.length + Number(busy) >= config.maxQueue) {
      rejectedFrames += chunk.sampleCount;
      rejectedBlocks++;
      recordSourceEvent({type: 'gap', reason: 'sink-queue-full',
        start: chunk.firstSample, end: chunk.firstSample + chunk.sampleCount,
        count: chunk.sampleCount});
      recycle(chunk);
      return;
    }
    queue.push(chunk);
    peakQueued = Math.max(peakQueued, queue.length + Number(busy));
    processNext();
  } catch (error) {
    failure = String(error);
    self.postMessage({type: 'error', reason: failure});
    if (chunk?.pcm instanceof ArrayBuffer) recycle(chunk);
  }
}

self.onmessage = event => {
  const message = event.data;
  if (message?.type === 'attach') {
    config = {
      delayMs: Math.max(0, Math.min(message.delayMs || 0, 5000)),
      cpuBurnMs: Math.max(0, Math.min(message.cpuBurnMs || 0, 1000)),
      maxQueue: Math.max(1, Math.min(message.maxQueue || 6, 128)),
      maxPrefixFrames: Math.max(0, Math.round((message.maxPrefixSeconds ?? 8) * message.sampleRate))
    };
    ledger = new CoverageLedger(message.recordingId);
    transport = message.port;
    transport.onmessage = event => onPacket(event.data);
    transport.start?.();
    self.postMessage({type: 'ready', maxQueue: config.maxQueue});
  }
  if (message?.type === 'export-prefix') {
    if (!finalSent || prefixFrames === 0) {
      self.postMessage({type: 'export-error', reason: 'no finalized contiguous prefix'});
      return;
    }
    const joined = new Float32Array(prefixFrames * prefixChannels);
    let offset = 0;
    for (const part of retained) {joined.set(part, offset); offset += part.length;}
    const wav = encodeWavPcm16(joined, prefixRate, prefixChannels);
    self.postMessage({type: 'wav', wav, frames: prefixFrames, sampleRate: prefixRate,
      channels: prefixChannels, warning: 'Diagnostic contiguous prefix only; not durability evidence.'}, [wav]);
  }
  if (message?.type === 'snapshot') self.postMessage({type: 'snapshot', metrics: report()});
};
