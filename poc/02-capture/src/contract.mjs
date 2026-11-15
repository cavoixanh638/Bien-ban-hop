/** Frozen logical capture -> sink contract. Counts are audio FRAMES, not scalar channel samples. */
export const FORMAT = 'f32le';
export const MAX_SAFE_FRAMES = Number.MAX_SAFE_INTEGER;

export function checkChunk(chunk, requirePcm = true) {
  if (!chunk || typeof chunk !== 'object') throw new TypeError('chunk is required');
  if (!chunk.recordingId || typeof chunk.recordingId !== 'string') throw new Error('recordingId required');
  for (const key of ['sequenceNo', 'firstSample', 'sampleCount']) {
    if (!Number.isSafeInteger(chunk[key]) || chunk[key] < 0) throw new Error(`invalid ${key}`);
  }
  if (chunk.sampleCount === 0) throw new Error('empty chunk');
  if (!(Number.isInteger(chunk.sampleRate) && chunk.sampleRate > 0)) throw new Error('invalid sampleRate');
  if (!(Number.isInteger(chunk.channels) && chunk.channels > 0 && chunk.channels <= 8)) throw new Error('invalid channels');
  if (chunk.format !== FORMAT) throw new Error('unsupported format');
  if (chunk.firstSample + chunk.sampleCount > MAX_SAFE_FRAMES) throw new Error('unsafe frame index');
  if (requirePcm && (!(chunk.pcm instanceof ArrayBuffer) || chunk.pcm.byteLength !== chunk.sampleCount * chunk.channels * 4)) {
    throw new Error('f32le payload byteLength mismatch');
  }
  return true;
}

export class CoverageLedger {
  constructor(recordingId = null) {
    this.recordingId = recordingId;
    this.expectedSeq = 0;
    this.highWaterSample = 0;
    this.receivedFrames = 0;
    this.blocks = 0;
    this.gaps = [];
    this.overlaps = [];
    this.sequenceAnomalies = [];
    this.gapEvents = 0;
    this.missingFramesTotal = 0;
    this.overlapEvents = 0;
    this.overlappedFramesTotal = 0;
    this.sequenceErrorsTotal = 0;
    this.sampleRate = null;
    this.channels = null;
  }
  accept(chunk, requirePcm = true) {
    checkChunk(chunk, requirePcm);
    if (this.recordingId && chunk.recordingId !== this.recordingId) throw new Error('mixed recordingIds');
    this.recordingId ??= chunk.recordingId;
    if (this.sampleRate !== null && chunk.sampleRate !== this.sampleRate) throw new Error('sampleRate changed');
    if (this.channels !== null && chunk.channels !== this.channels) throw new Error('channel count changed');
    this.sampleRate ??= chunk.sampleRate;
    this.channels ??= chunk.channels;
    if (chunk.sequenceNo !== this.expectedSeq) {
      this.sequenceErrorsTotal++;
      if (this.sequenceAnomalies.length < 64) this.sequenceAnomalies.push({ expected: this.expectedSeq, actual: chunk.sequenceNo });
    }
    this.expectedSeq = chunk.sequenceNo + 1;
    if (chunk.firstSample > this.highWaterSample) {
      this.gapEvents++;
      this.missingFramesTotal += chunk.firstSample - this.highWaterSample;
      if (this.gaps.length < 64) this.gaps.push({ start: this.highWaterSample, end: chunk.firstSample, count: chunk.firstSample - this.highWaterSample });
    } else if (chunk.firstSample < this.highWaterSample) {
      this.overlapEvents++;
      this.overlappedFramesTotal += Math.min(chunk.firstSample + chunk.sampleCount, this.highWaterSample) - chunk.firstSample;
      if (this.overlaps.length < 64) this.overlaps.push({ start: chunk.firstSample, end: Math.min(chunk.firstSample + chunk.sampleCount, this.highWaterSample) });
    }
    this.highWaterSample = Math.max(this.highWaterSample, chunk.firstSample + chunk.sampleCount);
    this.receivedFrames += chunk.sampleCount;
    this.blocks++;
    return this.summary();
  }
  summary() {
    return {
      recordingId: this.recordingId, sampleRate: this.sampleRate, channels: this.channels,
      blocks: this.blocks, receivedFrames: this.receivedFrames, highWaterSample: this.highWaterSample,
      missingFrames: this.missingFramesTotal,
      overlappedFrames: this.overlappedFramesTotal,
      gapCount: this.gapEvents, overlapCount: this.overlapEvents,
      sequenceErrorCount: this.sequenceErrorsTotal,
      gapExamples: [...this.gaps.slice(0, 2), ...this.gaps.slice(-2)],
      overlapExamples: this.overlaps.slice(0, 3), sequenceExamples: this.sequenceAnomalies.slice(0, 3)
    };
  }
}

/** PCM16 WAV for a *verified contiguous prefix* only. Never fill a gap and call it recorded. */
export function encodeWavPcm16(interleaved, sampleRate, channels) {
  if (!(interleaved instanceof Float32Array)) throw new TypeError('Float32Array required');
  if (!Number.isInteger(sampleRate) || sampleRate <= 0 || !Number.isInteger(channels) || channels < 1 || channels > 8) {
    throw new RangeError('sampleRate/channels');
  }
  if (interleaved.length % channels !== 0) throw new Error('non-integral frame');
  if (interleaved.length * 2 > 0xffffffff - 36) throw new Error('WAV RIFF 4 GiB limit');
  const byteLength = interleaved.length * 2;
  const wav = new ArrayBuffer(44 + byteLength);
  const view = new DataView(wav);
  function text4(offset, str) { for (let i = 0; i < 4; i++) view.setUint8(offset + i, str.charCodeAt(i)); }
  text4(0, 'RIFF'); view.setUint32(4, 36 + byteLength, true); text4(8, 'WAVE');
  text4(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true); text4(36, 'data'); view.setUint32(40, byteLength, true);
  for (let i = 0; i < interleaved.length; i++) {
    const sample = Math.max(-1, Math.min(1, interleaved[i]));
    view.setInt16(44 + i * 2, sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767), true);
  }
  return wav;
}

export function percentile(values, p = 0.95) {
  if (!values.length) return null;
  const copy = [...values].sort((a, b) => a - b);
  return copy[Math.min(copy.length - 1, Math.ceil(copy.length * p) - 1)];
}
