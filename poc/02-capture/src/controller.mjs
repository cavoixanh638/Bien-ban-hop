import {MediaRecorderProbe} from './media-recorder.mjs';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const timeout = (promise, ms, label) => Promise.race([promise, wait(ms).then(() => {throw new Error(`timeout: ${label}`);})]);

export class CaptureComparison {
  constructor(onUpdate = () => {}) {
    this.onUpdate = onUpdate;
    this.started = false;
    this.stopping = false;
    this.events = [];
    this.source = null;
    this.workletFinal = null;
    this.workletStop = null;
    this.workerErrors = [];
    this.trackInfo = null;
  }
  log(type, details = {}) {
    const event = {type, inputMonoMs: performance.now(), ...details};
    this.eventCount = (this.eventCount || 0) + 1;
    if (this.events.length >= 1500) this.events.shift();
    this.events.push(event);
    this.onUpdate(event);
  }
  async start({engine = 'both', source = 'synthetic', batchFrames = 2048,
    poolSize = 8, maxQueue = 6, delayMs = 0, cpuBurnMs = 0,
    mediaTimesliceMs = 600, maxPrefixSeconds = 8} = {}) {
    if (this.started) throw new Error('already started');
    this.started = true;
    this.engine = engine;
    this.source = source;
    this.recordingId = `capture-poc-${Math.round(performance.timeOrigin)}-${Math.round(performance.now())}`;
    this.engine = engine;
    this.config = {engine, source, batchFrames, poolSize, maxQueue, delayMs, cpuBurnMs, mediaTimesliceMs};
    try {
      let audioStream = null;
      if (source === 'microphone') {
        audioStream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: false, noiseSuppression: false}, video: false});
      } else if (source === 'display-audio') {
        const display = await navigator.mediaDevices.getDisplayMedia({audio: true, video: true});
        audioStream = new MediaStream(display.getAudioTracks());
        this.displayStream = display;
        if (!audioStream.getAudioTracks().length) throw new Error('TC21: getDisplayMedia granted no audio track; not supported');
      }
      this.inputStream = audioStream;
      this.context = new AudioContext({latencyHint: 'interactive'});
      this.inputMonoAtStart = performance.now();
      this.contextTimeAtStart = this.context.currentTime;
      this.sampleRate = this.context.sampleRate;
      if (audioStream) {
        this.sourceNode = this.context.createMediaStreamSource(audioStream);
        this.trackInfo = audioStream.getAudioTracks().map(track => ({
          kind: track.kind, label: track.kind === 'audio' ? 'audio-track' : 'other-track',
          readyState: track.readyState, settings: (() => {
            const s = track.getSettings?.() || {};
            return {sampleRate:s.sampleRate ?? null, channelCount:s.channelCount ?? null,
              echoCancellation:s.echoCancellation ?? null, noiseSuppression:s.noiseSuppression ?? null};
          })()
        }));
        for (const track of audioStream.getAudioTracks()) {
          track.addEventListener('ended', () => {
            if (!this.stopping) {
              this.log('track-ended', {trackLabel: track.label, gap: 'unavailable'});
              this.node?.port.postMessage({type:'unavailable', reason:'track-ended'});
              // Do not record silence as real microphone audio.
              this.stop().catch(err => this.log('error', {reason:String(err)}));
            }
          }, {once:true});
        }
      } else {
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(437, this.context.currentTime);
        gain.gain.value = 0.18;
        oscillator.connect(gain);
        this.oscillator = oscillator;
        this.sourceNode = gain;
        this.trackInfo = [{kind:'synthetic', label:'437 Hz sine WebAudio, same fanout'}];
      }
      await this.context.resume();
      if (engine === 'both' || engine === 'pcm') {
        await this.context.audioWorklet.addModule(new URL('./capture-processor.js', import.meta.url));
        this.node = new AudioWorkletNode(this.context, 'transfer-capture', {
          numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
          channelCount: 1, channelCountMode: 'explicit'
        });
        this.mute = this.context.createGain();
        this.mute.gain.value = 0;
        this.sourceNode.connect(this.node);
        this.node.connect(this.mute).connect(this.context.destination);
        this.worker = new Worker(new URL('./sink-worker.mjs', import.meta.url), {type:'module'});
        const channel = new MessageChannel();
        let readyResolve;
        const ready = new Promise(resolve => { readyResolve = resolve; });
        this.final = new Promise((resolve, reject) => {
          this.finalResolve = resolve; this.finalReject = reject;
        });
        this.worker.onmessage = event => {
          const message = event.data;
          if (message.type === 'ready') readyResolve();
          if (message.type === 'final') {this.workletFinal = message.metrics; this.finalResolve(message.metrics);}
          if (message.type === 'error') {this.workerErrors.push(message.reason); this.log('worker-error', {reason: message.reason});}
          if (message.type === 'wav') this.wavResolve?.(message);
          if (message.type === 'export-error') this.wavReject?.(new Error(message.reason));
          if (message.type === 'snapshot') this.snapshotResolve?.(message.metrics);
        };
        this.worker.onerror = event => {this.log('worker-crash', {reason: event.message}); this.finalReject?.(new Error(event.message));};
        this.node.port.onmessage = event => this.log('worklet-' + event.data.type, event.data);
        this.worker.postMessage({type:'attach', port:channel.port2, recordingId:this.recordingId,
          sampleRate: this.sampleRate, delayMs, cpuBurnMs, maxQueue, maxPrefixSeconds}, [channel.port2]);
        await timeout(ready, 5000, 'worker ready');
        this.node.port.postMessage({type:'attach', port:channel.port1, recordingId:this.recordingId,
          batchFrames, channels:1, poolSize}, [channel.port1]);
      }
      if (engine === 'both' || engine === 'media') {
        this.destination = this.context.createMediaStreamDestination();
        this.sourceNode.connect(this.destination);
        this.media = new MediaRecorderProbe(this.destination.stream, {timesliceMs:mediaTimesliceMs});
      }
      if (this.oscillator) this.oscillator.start();
      this.startMonoMs = performance.now();
      this.media?.start();
      this.node?.port.postMessage({type:'start'});
      this.log('started', {recordingId:this.recordingId, engine, source, sampleRate:this.sampleRate,
        crossOriginIsolated: globalThis.crossOriginIsolated,
        messageChannel: !!this.node, sharedArrayBufferUsed: false, trackInfo:this.trackInfo});
      return this;
    } catch (error) {
      this.log('start-error', {reason: String(error)});
      await this.dispose();
      throw error;
    }
  }
  pause() {
    if (this.stopping) return;
    this.node?.port.postMessage({type:'pause'});
    this.media?.pause();
    this.log('pause-request');
  }
  resume() {
    if (this.stopping) return;
    this.node?.port.postMessage({type:'resume'});
    this.media?.resume();
    this.log('resume-request');
  }
  simulateTrackEnd() {
    if (this.inputStream) for (const track of this.inputStream.getAudioTracks()) track.stop();
    else {
      this.log('simulated-input-loss', {source:'synthetic'});
      this.node?.port.postMessage({type:'unavailable', reason:'synthetic-source-lost'});
      this.stop().catch(error => this.log('stop-error', {reason:String(error)}));
    }
  }
  async stop() {
    if (this.stopPromise) return this.stopPromise;
    this.stopping = true;
    this.stopPromise = (async () => {
      this.node?.port.postMessage({type:'stop'});
      const mediaFinal = this.media ? await timeout(this.media.stop(), 10000, 'media stop') : null;
      const pcmFinal = this.worker ? await timeout(this.final, 25000, 'sink drain') : null;
      this.endedMonoMs = performance.now();
      this.log('stopped', {pcmFrames:pcmFinal?.receivedFrames, mediaBytes:mediaFinal?.totalBytes});
      await this.context?.close();
      this.oscillator?.stop();
      for (const track of this.inputStream?.getTracks() || []) track.stop();
      for (const track of this.displayStream?.getTracks() || []) track.stop();
      return this.results();
    })();
    return this.stopPromise;
  }
  async exportPcmPrefixWav() {
    if (!this.worker || !this.workletFinal) throw new Error('stop the worklet first');
    const answer = new Promise((resolve, reject) => {this.wavResolve = resolve; this.wavReject = reject;});
    this.worker.postMessage({type:'export-prefix'});
    return timeout(answer, 4000, 'export WAV');
  }
  results() {
    return {
      config: this.config, recordingId: this.recordingId,
      clockMapping: [{inputMonoMs:this.startMonoMs, sampleIndex:0,
        contextTimeSec:this.contextTimeAtStart, note:'Input monotonic clock calibration is approximate; microphone latency not calibrated.'}],
      actualSampleRate: this.sampleRate, trackInfo:this.trackInfo,
      runtimeMs: this.endedMonoMs - this.startMonoMs,
      isolated: globalThis.crossOriginIsolated,
      pcm: this.workletFinal,
      media: this.media?.metrics() || null,
      events: this.events.slice(0, 400),
      eventCount: this.eventCount || 0,
      workerErrors: this.workerErrors,
      browserHeapBytes: performance.memory?.usedJSHeapSize ?? null,
      limitations: ['Buffer recycle is not durable storage ACK', 'MediaRecorder timeslice does not prove independently seekable chunks']
    };
  }
  async dispose() {
    try {this.worker?.terminate();} catch {};
    try {this.oscillator?.stop();} catch {};
    try {await this.context?.close();} catch {};
    for (const track of this.inputStream?.getTracks() || []) track.stop();
    for (const track of this.displayStream?.getTracks() || []) track.stop();
  }
}

export async function verifyDecodable(blob, {maxWaitMs = 5000} = {}) {
  if (!blob?.size) return {decoded:false, error:'empty blob'};
  const result = {mimeType:blob.type, bytes:blob.size, decoded:false,
    durationSeconds:null, seekMidpoint:false, seekNearEnd:false, error:null};
  let ctx, audio, url;
  try {
    ctx = new AudioContext();
    const bytes = await blob.arrayBuffer();
    const decoded = await timeout(ctx.decodeAudioData(bytes.slice(0)), maxWaitMs, 'decodeAudioData');
    result.decoded = true;
    result.durationSeconds = decoded.duration;
    result.decodedFrames = decoded.length;
    result.decodedSampleRate = decoded.sampleRate;
  } catch(error) { result.error = `decode: ${String(error)}`; }
  finally {await ctx?.close();}
  try {
    url = URL.createObjectURL(blob);
    audio = document.createElement('audio');
    audio.preload = 'auto'; audio.src = url;
    await timeout(new Promise((resolve,reject) => {
      audio.addEventListener('loadedmetadata', resolve, {once:true});
      audio.addEventListener('error', () => reject(new Error('HTMLAudioElement error')), {once:true});
    }), maxWaitMs, 'metadata');
    result.mediaElementDurationSeconds = Number.isFinite(audio.duration) ? audio.duration : null;
    for (const [key, fraction] of [['seekMidpoint',0.5], ['seekNearEnd',0.9]]) {
      if (!(audio.duration > 0) || !Number.isFinite(audio.duration)) break;
      const target = Math.max(0, audio.duration * fraction);
      const event = new Promise((resolve,reject) => {
        audio.addEventListener('seeked', resolve, {once:true});
        audio.addEventListener('error', () => reject(new Error('seek error')), {once:true});
      });
      audio.currentTime = target;
      await timeout(event, maxWaitMs, key);
      result[key] = Math.abs(audio.currentTime - target) < 0.5;
    }
  } catch (error) {result.error = (result.error ? result.error + '; ' : '') + `seek: ${String(error)}`;}
  finally {if (audio) {audio.removeAttribute('src'); audio.load();} if (url) URL.revokeObjectURL(url);}
  return result;
}

export async function runAutomated(config = {}) {
  const durationMs = config.durationMs ?? 2600;
  const run = new CaptureComparison();
  await run.start(config);
  await wait(durationMs * 0.45);
  if (config.pauseResume !== false) {run.pause(); await wait(Math.min(230, durationMs * 0.12)); run.resume();}
  await wait(durationMs * 0.55);
  const result = await run.stop();
  if (run.media && !run.media.truncated) {
    const mediaBlob = run.media.getBlob();
    result.mediaVerification = await verifyDecodable(mediaBlob);
    result.mediaPartVerification = run.media.parts.length > 1 ? await verifyDecodable(run.media.parts[1]) : null;
  }
  if (run.worker) {
    try {
      const wav = await run.exportPcmPrefixWav();
      result.pcmPrefixVerification = await verifyDecodable(new Blob([wav.wav], {type:'audio/wav'}));
      result.pcmPrefixVerification.frames = wav.frames;
    } catch(error) {result.pcmPrefixVerification = {decoded:false, error:String(error)};}
  }
  await run.dispose();
  return result;
}
