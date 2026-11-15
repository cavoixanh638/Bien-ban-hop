/* AudioWorkletGlobalScope; no imports, no SharedArrayBuffer, no blocking I/O. */
class TransferCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.state = 'idle';
    this.port.onmessage = (event) => this.command(event.data);
    this.transport = null;
    this.free = [];
    this.pcm = null;
    this.used = 0;
    this.firstSample = 0;
    this.frameCursor = 0; // media frames excluding explicit pause; includes gaps.
    this.sequenceNo = 0;
    this.quantumCounts = {};
    this.allocated = 0;
    this.sent = 0;
    this.recycled = 0;
    this.workletDroppedFrames = 0;
    this.inFlight = 0;
    this.peakInFlight = 0;
    this.openGap = null;
    this.inQuantum = false;
    this.contextAtFrameCursor = 0;
    this.poolSize = 0;
  }
  command(command) {
    switch (command?.type) {
      case 'start':
        if (this.state === 'armed') { this.state = 'capturing'; this.emit('started'); }
        break;
      case 'attach': {
        if (this.state !== 'idle') return;
        const bytes = command.batchFrames * command.channels * 4 * command.poolSize;
        // A public caller may bypass the UI. Never allocate arbitrary memory on the audio thread.
        if (!command.port || typeof command.port.postMessage !== 'function' ||
            typeof command.recordingId !== 'string' || command.recordingId.length < 1 || command.recordingId.length > 128 ||
            ![2048, 4096].includes(command.batchFrames) ||
            !Number.isInteger(command.poolSize) || command.poolSize < 2 || command.poolSize > 64 ||
            !Number.isInteger(command.channels) || command.channels < 1 || command.channels > 2 ||
            !Number.isSafeInteger(bytes) || bytes > 2 * 1024 * 1024) {
          this.emit('error', { reason: 'invalid-configuration' }); return;
        }
        let free;
        try {
          free = Array.from({length:command.poolSize}, () => new ArrayBuffer(command.batchFrames * command.channels * 4));
        } catch (error) {
          this.emit('error', {reason:'pool-allocation-failed'}); return;
        }
        this.recordingId = command.recordingId;
        this.batchFrames = command.batchFrames;
        this.channels = command.channels;
        this.poolSize = command.poolSize;
        this.free = free;
        this.allocated = free.length;
        this.transport = command.port;
        this.transport.onmessage = (event) => {
          if (event.data?.type === 'recycle' && event.data.pcm instanceof ArrayBuffer &&
              event.data.pcm.byteLength === this.batchFrames * this.channels * 4 &&
              this.inFlight > 0 && this.free.length < this.poolSize) {
            this.free.push(event.data.pcm);
            this.recycled++;
            this.inFlight = Math.max(0, this.inFlight - 1);
          }
        };
        this.transport.start?.();
        this.state = 'armed';
        this.emit('ready');
        break;
      }
      case 'pause':
        if (this.state === 'capturing') {
          this.flush(); this.closeGap(); this.state = 'paused'; this.emit('paused');
        }
        break;
      case 'resume':
        if (this.state === 'paused') { this.state = 'capturing'; this.emit('resumed'); }
        break;
      case 'unavailable':
        if (this.state === 'capturing' || this.state === 'paused') {
          this.flush(); this.closeGap(); this.state = 'unavailable';
          this.emit('unavailable', { reason: command.reason || 'track-ended' });
        }
        break;
      case 'stats':
        this.emit('progress', this.statistics());
        break;
      case 'stop':
        if (this.state !== 'stopped') {
          if (this.state === 'capturing') this.flush();
          this.closeGap(); this.state = 'stopped'; this.emit('stopped', this.statistics());
          this.transport?.postMessage({type: 'source-ended', frameCursor: this.frameCursor, sequenceNo: this.sequenceNo});
        }
        break;
    }
  }
  statistics() {
    return {sent: this.sent, allocated: this.allocated, recycled: this.recycled,
      poolFree: this.free.length, inFlight: this.inFlight, peakInFlight: this.peakInFlight,
      workletDroppedFrames: this.workletDroppedFrames, quantumCounts: this.quantumCounts};
  }
  emit(type, extra = {}) {
    const value = {type, sampleIndex: this.frameCursor,
      contextTimeSec: this.inQuantum ? this.contextAtFrameCursor : currentTime,
      ...extra};
    this.port.postMessage(value);
    if (type !== 'started' && type !== 'stopped') this.transport?.postMessage({type: 'source-event', event: value});
  }
  closeGap() {
    if (!this.openGap) return;
    const gap = this.openGap;
    this.openGap = null;
    this.emit('gap', {start: gap.start, end: gap.start + gap.count,
      count: gap.count, reason: gap.reason, contextTimeSec: gap.endContextTimeSec});
  }
  addGap(count, reason) {
    if (!count) return;
    if (this.openGap && (this.openGap.reason !== reason || this.openGap.start + this.openGap.count !== this.frameCursor)) this.closeGap();
    if (!this.openGap) this.openGap = {start: this.frameCursor, count: 0, reason};
    this.openGap.count += count;
    // Save the actual render timestamp of the last lost frame. A late Stop
    // must not relabel a gap as occurring at the Stop command's delivery time.
    this.openGap.endContextTimeSec = this.inQuantum ? this.contextAtFrameCursor : currentTime;
    this.workletDroppedFrames += count;
    this.frameCursor += count;
  }
  borrow() {
    if (this.pcm) return true;
    const buffer = this.free.pop();
    if (!buffer) return false;
    this.pcm = buffer;
    this.used = 0;
    this.firstSample = this.frameCursor;
    return true;
  }
  flush() {
    if (!this.pcm || !this.used) return;
    const buffer = this.pcm;
    const used = this.used;
    const byteLength = used * this.channels * 4;
    // Partial final block: transfer exact bytes; receiver may recycle it only when full length.
    const send = used === this.batchFrames ? buffer : buffer.slice(0, byteLength);
    this.transport.postMessage({type: 'chunk', chunk: {
      recordingId: this.recordingId, sequenceNo: this.sequenceNo++,
      firstSample: this.firstSample, sampleCount: used, sampleRate,
      channels: this.channels, format: 'f32le', pcm: send
    }}, [send]);
    if (send !== buffer) this.free.push(buffer);
    else { this.inFlight++; this.peakInFlight = Math.max(this.inFlight, this.peakInFlight); }
    this.pcm = null;
    this.used = 0;
    this.sent++;
    if (this.sent % 64 === 0) this.emit('progress', {sent: this.sent, poolFree: this.free.length,
      inFlight: this.inFlight, peakInFlight: this.peakInFlight,
      workletDroppedFrames: this.workletDroppedFrames, quantumCounts: this.quantumCounts});
  }
  process(inputs, outputs) {
    const data = inputs?.[0] || [];
    // Use real quantum size; never rely on 128 except in tests/config lower-bound.
    const frames = data[0]?.length ?? outputs?.[0]?.[0]?.length ?? 0;
    if (frames > 0) this.quantumCounts[frames] = (this.quantumCounts[frames] || 0) + 1;
    if (this.state !== 'capturing' || frames === 0) return true;
    this.inQuantum = true;
    this.contextAtFrameCursor = currentTime;
    if (!data.length) {
      this.flush();
      this.contextAtFrameCursor = currentTime + frames / sampleRate;
      this.addGap(frames, 'no-input-channel');
      this.inQuantum = false; return true;
    }
    let offset = 0;
    while (offset < frames) {
      if (!this.borrow()) {
        this.contextAtFrameCursor = currentTime + frames / sampleRate;
        this.addGap(frames - offset, 'pool-exhausted');
        break;
      }
      this.closeGap();
      const take = Math.min(frames - offset, this.batchFrames - this.used);
      const dest = new Float32Array(this.pcm);
      for (let f = 0; f < take; f++) {
        for (let c = 0; c < this.channels; c++) {
          if (this.channels === 1 && data.length > 1) {
            let sum = 0;
            for (let src = 0; src < data.length; src++) sum += data[src][offset + f];
            dest[(this.used + f)] = sum / data.length;
          } else {
            dest[(this.used + f) * this.channels + c] = (data[c] || data[0])[offset + f];
          }
        }
      }
      this.used += take;
      this.frameCursor += take;
      offset += take;
      this.contextAtFrameCursor = currentTime + offset / sampleRate;
      if (this.used === this.batchFrames) this.flush();
    }
    this.inQuantum = false;
    return true;
  }
}
registerProcessor('transfer-capture', TransferCaptureProcessor);
