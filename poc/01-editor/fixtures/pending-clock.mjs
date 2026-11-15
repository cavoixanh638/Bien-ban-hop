// Independent monotonic-clock fixture. No imports from other workstreams.
// Recorded intervals do not cross pause/gap/resume; cannot extrapolate beyond
// the most recently confirmed point. Audio offset is in media milliseconds.
export class CalibratedClockFixture {
  constructor({ meetingId, recordingId, sampleRate = 48000, generation = 'take-1', intervalId = 'interval-1' }) {
    this.meetingId = meetingId;
    this.recordingId = recordingId;
    this.sampleRate = sampleRate;
    this.generation = generation;
    this.intervalId = intervalId;
    this.points = [];
    this.closed = null;
  }
  progress(inputMonoMs, sampleIndex) {
    if (this.closed || !Number.isFinite(inputMonoMs) || !Number.isSafeInteger(sampleIndex)
      || inputMonoMs < 0 || sampleIndex < 0) return false;
    const last = this.points.at(-1);
    if (last && (last.inputMonoMs >= inputMonoMs || last.sampleIndex > sampleIndex)) return false;
    this.points.push({ inputMonoMs, sampleIndex });
    return true;
  }
  close(status = 'gap', atMonoMs = Infinity) {
    this.closed = { status, atMonoMs };
  }
  context(inputMonoMs) {
    return { source: 'live_recording', recordingId: this.recordingId,
      audioOffsetMs: null, coverage: 'pending', generation: this.generation,
      intervalId: this.intervalId, inputMonoMs, epoch: 1 };
  }
  resolve(entry) {
    const base = { meetingId: this.meetingId, recordingId: this.recordingId,
      source: 'live_recording', generation: this.generation, intervalId: this.intervalId,
      inputMonoMs: entry.inputMonoMs };
    if (entry.meetingId !== this.meetingId || entry.recordingId !== this.recordingId
      || entry.generation !== this.generation || entry.intervalId !== this.intervalId) {
      return { status: 'missing', reason: 'wrong-recording-interval' };
    }
    if (this.closed && entry.inputMonoMs >= this.closed.atMonoMs) return { status: this.closed.status };
    const points = this.points;
    const exact = points.find(p => p.inputMonoMs === entry.inputMonoMs);
    if (exact) return { ...base, status: 'valid', coverage: 'valid',
      audioOffsetMs: Math.round(exact.sampleIndex * 1000 / this.sampleRate) };
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      if (a.inputMonoMs < entry.inputMonoMs && entry.inputMonoMs < b.inputMonoMs) {
        const sample = a.sampleIndex + (b.sampleIndex - a.sampleIndex)
          * (entry.inputMonoMs - a.inputMonoMs) / (b.inputMonoMs - a.inputMonoMs);
        return { ...base, status: 'valid', coverage: 'valid',
          audioOffsetMs: Math.round(sample * 1000 / this.sampleRate) };
      }
    }
    if (this.closed) return { status: this.closed.status };
    return { status: 'pending', reason: 'awaiting-next-mapping-point' };
  }
}
