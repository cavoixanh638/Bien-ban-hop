import './style.css';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { InputTracker, TimeSpan, createTrackingExtension, readAnchorAtCursor } from './tracker.mjs';

const id = selector => document.querySelector(selector);
const fixedMeetingId = 'demo-meeting-01';
const recordingId = 'demo-recording-01';
const demoContext = {
  source: 'live_recording', recordingId, baseOffsetMs: 45000,
  baseMono: performance.now(), coverage: 'valid', epoch: 0,
};
function setDemoContext(patch) {
  const oldOffset = getAudioContext(performance.now()).audioOffsetMs;
  Object.assign(demoContext, patch);
  if (patch.source !== undefined || patch.coverage !== undefined || patch.baseOffsetMs !== undefined) {
    demoContext.baseMono = performance.now();
    if (patch.baseOffsetMs === undefined && oldOffset !== null) demoContext.baseOffsetMs = oldOffset;
    demoContext.epoch += 1;
  }
  render();
}
function getAudioContext(monoMs) {
  const { source, coverage, baseOffsetMs, baseMono, epoch } = demoContext;
  if (source === 'unlinked' || coverage !== 'valid') return { source: 'unlinked', coverage, epoch };
  const audioOffsetMs = source === 'live_recording' || source === 'imported_playback'
    ? Math.max(0, Math.round(baseOffsetMs + monoMs - baseMono))
    : Math.max(0, Math.round(baseOffsetMs));
  return { source, recordingId, audioOffsetMs, coverage, epoch };
}

const tracker = new InputTracker({
  meetingId: fixedMeetingId,
  recordingIds: [recordingId],
  getAudioContext,
});

const editor = new Editor({
  element: id('#editor'),
  extensions: [StarterKit, TimeSpan, createTrackingExtension(tracker)],
  content: { type: 'doc', content: [{ type: 'paragraph' }] },
  autofocus: false,
  onSelectionUpdate: render,
  onUpdate: render,
  onTransaction: render,
});

function safeAnchorText(result) {
  if (!result || result.status === 'unlinked' && !result.anchor) return 'Chưa có mốc tại con trỏ';
  if (result.status === 'ambiguous') return 'Con trỏ ở ranh giới khác nguồn hoặc chữ chưa liên kết — hãy đặt vào bên trong chữ cần nghe';
  if (result.status === 'mixed') return `Vùng chọn chứa ${result.candidates.length} mốc khác nhau`;
  const a = result.anchor;
  return `${result.status === 'unlinked' ? 'Chưa liên kết audio' : `${a.recordingId} · ${(a.audioOffsetMs / 1000).toFixed(3)} s`}
Nguồn: ${a.source} · ${a.anchorId}
Bắt đầu cụm: ${new Date(a.typedAt).toLocaleString('vi-VN')}`;
}
let renderPending = false;
let forceMetrics = false;
let lastMetricsAt = -Infinity;
function render(refreshMetrics = false) {
  // Serializing the entire NoteDocument and walking every DOM text node on
  // EVERY keystroke creates avoidable latency on long, single-paragraph notes.
  forceMetrics ||= refreshMetrics === true;
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => {
    renderPending = false;
    if (editor.isDestroyed) return;
    id('#anchor-inspector').textContent = safeAnchorText(readAnchorAtCursor(editor.state, tracker.allowed));
    const now = performance.now();
    if (forceMetrics || now - lastMetricsAt >= 1000) {
      forceMetrics = false;
      lastMetricsAt = now;
      const metrics = tracker.snapshot(editor.view);
      id('#metrics').textContent = [
        `Ký tự ${metrics.characters.toLocaleString('vi-VN')} · ${metrics.uniqueAnchors} mốc`,
        `TextNode ${metrics.textNodes}, có mốc ${metrics.markedTextNodes}, DOM wrapper ${metrics.domTimeSpanWrappers}`,
        `JSON ${metrics.jsonBytes.toLocaleString('vi-VN')} bytes · P95 append ${metrics.p95AppendMs === null ? 'n/a' : metrics.p95AppendMs.toFixed(2) + ' ms'} (${metrics.samples} mẫu)`,
        `P95 beforeinput→paint proxy ${metrics.p95InputToPaintMs === null ? 'n/a' : metrics.p95InputToPaintMs.toFixed(2) + ' ms'} (${metrics.paintSamples} mẫu)`,
      ].join('\n');
    }
    const context = getAudioContext(performance.now());
    id('#context-preview').textContent = context.audioOffsetMs === undefined
      ? 'Không liên kết với audio (mô phỏng gap/mất nguồn)'
      : `Audio mẫu: ${context.source}, ${(context.audioOffsetMs / 1000).toFixed(1)} giây`;
  });
}
function updateSourceControls() {
  const source = id('#source').value;
  const coverage = id('#coverage').value;
  const newMs = Number(id('#offset').value);
  setDemoContext({ source, coverage, baseOffsetMs: newMs });
  id('#offset-value').textContent = `${(newMs / 1000).toFixed(0)} giây`;
}
id('#source').addEventListener('change', updateSourceControls);
id('#coverage').addEventListener('change', updateSourceControls);
id('#offset').addEventListener('input', updateSourceControls);

for (const [selector, command] of [
  ['#bold', 'toggleBold'], ['#italic', 'toggleItalic'],
  ['#strike', 'toggleStrike'], ['#bullet', 'toggleBulletList'],
  ['#ordered', 'toggleOrderedList'], ['#undo', 'undo'], ['#redo', 'redo'],
]) {
  id(selector).addEventListener('click', () => editor.chain().focus()[command]().run());
}
id('#paragraph').addEventListener('click', () => editor.chain().focus().setParagraph().run());
id('#heading').addEventListener('click', () => editor.chain().focus().toggleHeading({ level: 2 }).run());
function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
id('#export-document').addEventListener('click', () => downloadJson('mochop-note-fixture.json', {
  noteDocumentId: 'demo-note-01', schemaVersion: 1, revision: 0, content: editor.getJSON(),
  metadata: 'PoC export only, not durable autosave',
}));
id('#export-trace').addEventListener('click', () => {
  const os = id('#os').value.trim(), browser = id('#browser').value.trim();
  const imeVersion = id('#ime-version').value.trim();
  if (!os || !browser || !imeVersion || /điền|ghi số phiên bản|placeholder/i.test(`${os} ${browser} ${imeVersion}`)) {
    alert('Cần nhập Windows build, trình duyệt phiên bản và phiên bản IME thực tế trước khi xuất trace. Metadata tự khai không thay thế bằng chứng Windows.');
    return;
  }
  downloadJson('mochop-ime-trace-redacted.json', {
    ...tracker.exportTrace(),
    testEnvironment: {
      os, browser, ime: id('#ime').value, imeVersion,
      inputMode: id('#input-mode').value, scenario: id('#scenario').value,
      load: id('#load-state').textContent,
    },
  });
});
id('#metrics-refresh').addEventListener('click', () => render(true));
id('#start-load').addEventListener('click', () => {
  if (id('#start-load').disabled) return;
  id('#start-load').disabled = true;
  id('#load-state').textContent = 'CPU pressure simulated for 15 seconds (PoC only)';
  const end = performance.now() + 15000;
  const interval = setInterval(() => {
    const until = performance.now() + 35;
    while (performance.now() < until) Math.sqrt(Math.random() * 123456);
    if (performance.now() >= end) {
      clearInterval(interval);
      id('#start-load').disabled = false;
      id('#load-state').textContent = 'no load';
    }
  }, 130);
});

// Automation hooks are for synthetic fixtures only. They are NOT evidence of native Windows IME behavior.
window.__mochop = Object.freeze({
  editor, tracker, setDemoContext, getAudioContext,
  readAnchor: () => readAnchorAtCursor(editor.state, tracker.allowed),
  metrics: () => tracker.snapshot(editor.view),
});
render();
