/**
 * A bounded, source-aware mapper between Worklet render time and performance.now().
 * It NEVER uses the delivery time of a worklet message as the time of its samples.
 * AudioContext.getOutputTimestamp() maps AudioContext.currentTime into the page's
 * performance timeline. That is *not* a measurement of microphone input latency.
 */
const CLOCK_TYPES = new Set(['started','progress','paused','resumed','gap','unavailable','stopped']);
const MAX_INTERVALS = 4096;
const MAX_POINTS = 12000;

export function estimateInputMonoMs(event, timestamp) {
  if (!event || !Number.isFinite(event.contextTimeSec) || !timestamp ||
      !Number.isFinite(timestamp.contextTime) || !Number.isFinite(timestamp.performanceTime) ||
      (timestamp.contextTime === 0 && timestamp.performanceTime === 0)) return null;
  return timestamp.performanceTime + (event.contextTimeSec - timestamp.contextTime) * 1000;
}

export class CaptureClockMapper {
  constructor(sampleRate) {
    if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000)
      throw new RangeError('sampleRate');
    this.sampleRate = sampleRate;
    this.intervals = [];
    this.mappingPoints = [];
    this.state = 'idle';
    this.active = null;
    this.idleInterval = null;
    this.pending = [];
    this.uncalibratedEvents = 0;
    this.maxTimestampTransportLagMs = null;
    this.sensorLatencyCalibrated = false;
    this.sinkGaps = [];
    this.invalidSequences = 0;
  }
  addPoint(interval, inputMonoMs, sampleIndex, eventType) {
    const point = {inputMonoMs, sampleIndex, eventType};
    const prev = interval.mappingPoints.at(-1);
    if (prev && (inputMonoMs < prev.inputMonoMs || sampleIndex < prev.sampleIndex)) {
      this.invalidSequences++;
      return false;
    }
    if (prev && prev.sampleIndex === sampleIndex) {
      if (eventType === 'progress') return true;
      interval.mappingPoints[interval.mappingPoints.length-1] = point;
    } else if (!prev || inputMonoMs - prev.inputMonoMs >= 700 || eventType !== 'progress') {
      if (this.mappingPoints.length < MAX_POINTS && interval.mappingPoints.length < MAX_POINTS) {
        interval.mappingPoints.push(point);
        this.mappingPoints.push({inputMonoMs, sampleIndex, kind:'recorded', eventType});
      } else {
        // Keep last point locally, with a bounded number of periodic interior anchors.
        interval.mappingPoints[interval.mappingPoints.length - 1] = point;
        if (this.mappingPoints.length) this.mappingPoints[this.mappingPoints.length - 1] = {...point,kind:'recorded'};
      }
    }
    return true;
  }
  openRecorded(time, sampleIndex, kind) {
    this.active = {kind:'recorded',reason:kind, inputMonoStartMs:time,
      inputMonoEndMs:time, sampleStart:sampleIndex, sampleEnd:sampleIndex, mappingPoints:[]};
    this.addPoint(this.active, time, sampleIndex, kind);
    this.state = 'capturing';
  }
  closeRecorded(time, sampleIndex, reason='boundary') {
    if (!this.active) return;
    const active = this.active;
    if (time < active.inputMonoStartMs || sampleIndex < active.sampleStart) {
      this.invalidSequences++;
      return;
    }
    this.addPoint(active,time,sampleIndex,reason);
    active.inputMonoEndMs = time;
    active.sampleEnd = sampleIndex;
    if (this.intervals.length < MAX_INTERVALS) this.intervals.push(active);
    this.active = null;
  }
  beginNoAudio(kind, time, sampleIndex, reason=kind) {
    this.idleInterval = {kind,reason,inputMonoStartMs:time,inputMonoEndMs:time,
      sampleStart:sampleIndex,sampleEnd:sampleIndex};
    this.state=kind;
  }
  closeNoAudio(time) {
    if (!this.idleInterval) return;
    this.idleInterval.inputMonoEndMs = Math.max(time,this.idleInterval.inputMonoStartMs);
    if (this.intervals.length < MAX_INTERVALS) this.intervals.push(this.idleInterval);
    this.idleInterval = null;
  }
  receive(message, timestamp = null, observedAtMonoMs = null) {
    if (!CLOCK_TYPES.has(message?.type) || !Number.isSafeInteger(message?.sampleIndex) || message.sampleIndex < 0) return;
    const estimated = estimateInputMonoMs(message,timestamp);
    if (estimated === null) {
      this.uncalibratedEvents++;
      if (this.pending.length < 128) this.pending.push(message);
      return;
    }
    if (Number.isFinite(observedAtMonoMs)) {
      const lag = observedAtMonoMs-estimated;
      if (lag >= 0 && lag < 60000)
        this.maxTimestampTransportLagMs = Math.max(this.maxTimestampTransportLagMs ?? 0,lag);
    }
    const backlog = this.pending.splice(0);
    for (const item of [...backlog,message]) {
      const t = estimateInputMonoMs(item,timestamp);
      if (t !== null) this.consume(item,t);
    }
  }
  consume(m,t) {
    const i=m.sampleIndex;
    if (m.type==='started' || m.type==='resumed') {
      this.closeNoAudio(t);
      if (!this.active) this.openRecorded(t,i,m.type);
    } else if (m.type==='progress') {
      if (this.active) this.addPoint(this.active,t,i,'progress');
    } else if (m.type==='paused' || m.type==='unavailable' || m.type==='stopped') {
      this.closeRecorded(t,i,m.type);
      this.closeNoAudio(t);
      if (m.type!=='stopped') this.beginNoAudio(m.type==='paused'?'paused':'unavailable',t,i,m.reason);
      else this.state='stopped';
    } else if (m.type==='gap' && Number.isSafeInteger(m.start) && Number.isSafeInteger(m.end) && m.end>m.start) {
      // A gap event fires at the END of lost samples, not at the start. Worklet
      // frameCursor includes lost samples; pause does not. Do not bridge this gap.
      const end=t-(i-m.end)*1000/this.sampleRate;
      const start=end-(m.end-m.start)*1000/this.sampleRate;
      this.closeRecorded(start,m.start,'before-gap');
      if (this.intervals.length < MAX_INTERVALS) this.intervals.push({kind:'gap', reason:m.reason,
        inputMonoStartMs:start,inputMonoEndMs:end,sampleStart:m.start,sampleEnd:m.end});
      if (this.state==='capturing') this.openRecorded(end,m.end,'after-gap');
    }
  }
  applySinkGaps(sourceEvents = []) {
    for (const e of sourceEvents) {
      if (e.type!=='gap' || e.reason!=='sink-queue-full' || !Number.isSafeInteger(e.start) ||
          !Number.isSafeInteger(e.end) || e.end<=e.start) continue;
      if (!this.sinkGaps.some(g => g.start===e.start && g.end===e.end))
        this.sinkGaps.push({start:e.start,end:e.end,reason:e.reason});
    }
  }
  resolveInput(inputMonoMs) {
    if (!Number.isFinite(inputMonoMs)) return {status:'unlinked',reason:'invalid input timestamp'};
    const intervals = [...this.intervals];
    if (this.active) intervals.push(this.active);
    if (this.idleInterval) intervals.push({...this.idleInterval,inputMonoEndMs:Infinity});
    // Explicit gap/pause/unavailable take precedence over recorded intervals.
    const ordered = intervals.sort((a,b) => {
      const rank=k=>k==='recorded'?1:0;
      return rank(a.kind)-rank(b.kind);
    });
    for (const interval of ordered) {
      const last=interval===this.active ? interval.mappingPoints.at(-1)?.inputMonoMs : interval.inputMonoEndMs;
      if (inputMonoMs < interval.inputMonoStartMs || inputMonoMs >= last) continue;
      if (interval.kind!=='recorded') return {status:interval.kind,reason:interval.reason};
      const pts=interval.mappingPoints;
      for(let i=1;i<pts.length;i++) {
        if(inputMonoMs>pts[i].inputMonoMs)continue;
        const a=pts[i-1],b=pts[i];
        if(b.inputMonoMs<=a.inputMonoMs || b.sampleIndex<a.sampleIndex)continue;
        const sampleIndex=Math.max(a.sampleIndex,Math.min(b.sampleIndex,Math.round(a.sampleIndex+
          (inputMonoMs-a.inputMonoMs)*(b.sampleIndex-a.sampleIndex)/(b.inputMonoMs-a.inputMonoMs))));
        const missing=this.sinkGaps.find(g=>sampleIndex>=g.start && sampleIndex<g.end);
        if(missing)return {status:'gap',reason:missing.reason,sampleIndex};
        return {status:'valid',sampleIndex,recordedIntervalStart:interval.sampleStart};
      }
      return {status:'pending',reason:'need two distinct calibrated points inside recorded interval'};
    }
    return {status:'unlinked',reason:'outside calibrated recorded coverage'};
  }
  summary() {
    return {calibrationMethod:'AudioContext.getOutputTimestamp (render/output clock, not measured mic latency)',
      sensorLatencyCalibrated:this.sensorLatencyCalibrated,
      mappingPoints:this.mappingPoints.slice(),
      intervals:[...this.intervals,...(this.active?[this.active]:[]),...(this.idleInterval?[this.idleInterval]:[])],
      sinkGaps:this.sinkGaps.slice(), uncalibratedEvents:this.uncalibratedEvents,
      pendingEvents:this.pending.length, invalidSequences:this.invalidSequences,
      maxTimestampTransportLagMs:this.maxTimestampTransportLagMs,
      limitation:'No interpolation across pause/gap/unavailable; source-end and input hardware latency require real-device calibration'};
  }
}
