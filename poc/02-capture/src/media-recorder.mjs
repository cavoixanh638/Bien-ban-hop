import {percentile} from './contract.mjs';

export class MediaRecorderProbe {
  constructor(stream, {timesliceMs = 1000, maxRetainedBytes = 20_000_000} = {}) {
    if (typeof MediaRecorder === 'undefined') throw new Error('MediaRecorder unsupported');
    const selected = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
      .find(mimeType => MediaRecorder.isTypeSupported(mimeType));
    this.recorder = new MediaRecorder(stream, selected ? {mimeType: selected, audioBitsPerSecond: 64000} : {});
    this.timesliceMs = timesliceMs;
    this.maxRetainedBytes = maxRetainedBytes;
    this.parts = [];
    this.bytes = 0;
    this.retainedBytes = 0;
    this.truncated = false;
    this.events = [];
    this.eventCount = 0;
    this.cadences = [];
    this.lastBlobAt = null;
    this.startedAt = null;
    this.endedAt = null;
    this.error = null;
    this.stopped = new Promise(resolve => {this.resolveStop = resolve;});
    this.recorder.addEventListener('dataavailable', event => {
      const t = performance.now();
      if (this.lastBlobAt !== null) this.cadences.push(t - this.lastBlobAt);
      this.lastBlobAt = t;
      this.bytes += event.data.size;
      this.blobCount = (this.blobCount || 0) + 1;
      if (!this.truncated && this.retainedBytes + event.data.size <= this.maxRetainedBytes) {
        this.parts.push(event.data);
        this.retainedBytes += event.data.size;
      } else this.truncated = true;
      this.pushEvent({type:'dataavailable', atMs:t, size:event.data.size, eventTimecode:event.timecode ?? null});
    });
    this.recorder.addEventListener('error', event => {
      this.error = String(event.error?.message || event.message || 'MediaRecorder error');
      this.pushEvent({type:'error', atMs:performance.now(), reason:this.error});
    });
    for (const type of ['pause', 'resume', 'start']) this.recorder.addEventListener(type, () => {
      this.pushEvent({type, atMs:performance.now()});
    });
    this.recorder.addEventListener('stop', () => {
      this.endedAt = performance.now();
      this.pushEvent({type:'stop', atMs:this.endedAt});
      this.resolveStop(this.metrics());
    }, {once: true});
  }
  pushEvent(event) {
    this.eventCount++;
    if (this.events.length >= 160) this.events.shift();
    this.events.push(event);
  }
  start() { this.startedAt = performance.now(); this.recorder.start(this.timesliceMs); }
  pause() { if (this.recorder.state === 'recording') this.recorder.pause(); }
  resume() { if (this.recorder.state === 'paused') this.recorder.resume(); }
  async stop() {
    if (this.recorder.state !== 'inactive') this.recorder.stop();
    return this.stopped;
  }
  getBlob() {
    if (this.truncated) throw new Error('retained MediaRecorder data was truncated; cannot export valid full container');
    return new Blob(this.parts, {type:this.recorder.mimeType});
  }
  metrics() {
    return {
      mimeType: this.recorder.mimeType, timesliceMs: this.timesliceMs,
      durationWallMs: this.endedAt !== null ? this.endedAt - this.startedAt : null,
      totalBytes: this.bytes, retainedBytes: this.retainedBytes, truncated: this.truncated,
      blobCount: this.blobCount || 0,
      blobCadenceP95Ms: percentile(this.cadences),
      blobCadenceMeanMs: this.cadences.length ? this.cadences.reduce((a,b) => a+b,0)/this.cadences.length : null,
      blobCadenceMaxMs: this.cadences.length ? Math.max(...this.cadences) : null,
      events: this.events.slice(0, 70),
      sampleFramesKnown: false, // WebM timeslice cannot prove sample count or independent seekability.
      error: this.error,
      durable: false
    };
  }
}
