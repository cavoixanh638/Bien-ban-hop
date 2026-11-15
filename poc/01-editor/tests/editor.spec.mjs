import { test, expect } from '@playwright/test';

const getRuns = page => page.evaluate(() => {
  const doc = window.__mochop.editor.getJSON();
  const runs = [];
  const visit = node => {
    if (node.type === 'text') runs.push({ text: node.text, marks: node.marks || [],
      anchor: (node.marks || []).find(m => m.type === 'timeSpan')?.attrs || null });
    for (const child of node.content || []) visit(child);
  };
  visit(doc);
  return runs;
});
const timed = runs => runs.filter(r => r.anchor);
const unique = runs => new Set(timed(runs).map(r => r.anchor.anchorId));

async function setOffset(page, ms) {
  await page.locator('#offset').evaluate((el, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, ms);
}

async function openEditor(page) {
  await page.goto('/');
  await page.locator('.tiptap').click();
}

test('TC01 / native DOM input: new text receives timeSpan without pressing Save', async ({ page }) => {
  await openEditor(page);
  await page.keyboard.type('Ghi chu hop');
  await expect.poll(async () => unique(await getRuns(page)).size).toBeGreaterThan(0);
  const runs = await getRuns(page);
  expect(timed(runs)[0].anchor.recordingId).toBe('demo-recording-01');
});

test('TC02 / same paragraph: context change and space create more than one anchor', async ({ page }) => {
  await openEditor(page);
  await page.keyboard.type('thong tin ');
  await setOffset(page, 95000);
  await page.locator('.tiptap').click();
  await page.keyboard.press('End');
  await page.keyboard.type('noi dung moi');
  const runs = await getRuns(page);
  expect(unique(runs).size).toBeGreaterThanOrEqual(2);
  expect(await page.locator('.tiptap p').count()).toBe(1);
});

test('TC04 / synthetic Backspace+Insert: word keeps its earlier anchor', async ({ page }) => {
  await openEditor(page);
  await page.keyboard.type('truong');
  const before = (await getRuns(page)).find(r => r.anchor)?.anchor.anchorId;
  await page.keyboard.press('Backspace');
  await page.keyboard.type('g'); // synthetic keyboard, NOT UniKey or EVKey
  const runs = await getRuns(page);
  expect(runs.map(r => r.text).join('')).toBe('truog');
  expect(runs.filter(r => r.text.includes('g')).length).toBeGreaterThan(0);
  expect(runs.filter(r => r.text.includes('g')).every(r => r.anchor?.anchorId === before)).toBe(true);
});

test('TC05 / historical small correction: no reassignment to new audio context', async ({ page }) => {
  await openEditor(page);
  await page.keyboard.type('trung');
  const before = (await getRuns(page)).find(r => r.anchor)?.anchor.anchorId;
  await setOffset(page, 240000);
  await page.locator('.tiptap').click();
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.type('o');
  const runs = await getRuns(page);
  expect(runs.filter(r => r.text.includes('o')).some(r => r.anchor?.anchorId === before)).toBe(true);
});

test('TC06 / new idea inside old marked text: new context anchor', async ({ page }) => {
  await openEditor(page);
  await page.keyboard.type('Dau tien va sau');
  const previous = unique(await getRuns(page));
  await setOffset(page, 350000);
  await page.locator('.tiptap').click();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.type(' noi dung moi ');
  const after = unique(await getRuns(page));
  expect([...after].some(value => !previous.has(value))).toBe(true);
});

test('TC08 / Undo and Redo: text and anchor provenance restore together', async ({ page }) => {
  await openEditor(page);
  await page.keyboard.type('abc ');
  const before = await getRuns(page);
  await page.keyboard.type('def');
  const withDef = await getRuns(page);
  await page.keyboard.press('ControlOrMeta+z');
  expect((await getRuns(page)).map(r => r.text).join('')).not.toContain('def');
  await page.keyboard.press('ControlOrMeta+Shift+z');
  expect(await getRuns(page)).toEqual(withDef);
  expect(before.length).toBeGreaterThan(0);
});

test('TC09 / bold, italic do not drop anchor', async ({ page }) => {
  await openEditor(page);
  await page.keyboard.type('van ban');
  const before = unique(await getRuns(page));
  await page.keyboard.press('ControlOrMeta+a');
  await page.locator('#bold').click();
  await page.locator('#italic').click();
  expect(unique(await getRuns(page))).toEqual(before);
  expect((await getRuns(page)).some(r => r.marks.some(m => m.type === 'bold'))).toBe(true);
});

test('TC10 / untrusted paste: no fabricated audioOffsetMs', async ({ page }) => {
  await openEditor(page);
  // ClipboardEvent with synthetic DataTransfer is NOT evidence of native clipboard UI.
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData('text/plain', 'external words');
    data.setData('text/html', '<p>external words</p>');
    window.__mochop.editor.view.dom.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData: data, bubbles: true, cancelable: true,
    }));
  });
  const runs = await getRuns(page);
  expect(runs.some(r => r.text.includes('external'))).toBe(true);
  expect(timed(runs).filter(r => r.text.includes('external')).every(r =>
    r.anchor.audioOffsetMs === null && r.anchor.recordingId === null)).toBe(true);
});

test('TC11 / metrics: JSON, model runs, DOM wrapper and latency samples', async ({ page }) => {
  await openEditor(page);
  await page.keyboard.type('mot hai ba bon nam sau bay tam chin muoi');
  const metrics = await page.evaluate(() => window.__mochop.metrics());
  expect(metrics.characters).toBeGreaterThan(25);
  expect(metrics.textNodes).toBeGreaterThanOrEqual(1);
  expect(metrics.domTimeSpanWrappers).toBeGreaterThanOrEqual(1);
  expect(metrics.jsonBytes).toBeGreaterThan(50);
  expect(metrics.samples).toBeGreaterThan(0);
});


test('TC07 / in-session clipboard retains source via explicit trusted MIME', async ({ page }) => {
  await openEditor(page);
  await page.keyboard.type('Noi dung goc');
  const original = (await getRuns(page)).find(r => r.anchor)?.anchor;
  await page.evaluate(() => {
    const { editor } = window.__mochop;
    editor.commands.setTextSelection({ from: 1, to: 5 });
    const data = new DataTransfer();
    editor.view.dom.dispatchEvent(new ClipboardEvent('copy', {
      clipboardData: data, bubbles: true, cancelable: true,
    }));
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.view.dom.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData: data, bubbles: true, cancelable: true,
    }));
  });
  await expect.poll(async () => (await getRuns(page)).map(r => r.text).join('').length).toBeGreaterThan(12);
  expect((await getRuns(page)).some(r => r.anchor?.anchorId === original.anchorId)).toBe(true);
});

test('TC07 / tampered copied HTML cannot change the audio provenance', async ({ page }) => {
  await openEditor(page);
  await page.keyboard.type('Nguon goc');
  const source = (await getRuns(page)).find(r => r.anchor)?.anchor;
  await page.evaluate(() => {
    const editor = window.__mochop.editor;
    editor.commands.setTextSelection({ from: 1, to: 6 });
    const data = new DataTransfer();
    editor.view.dom.dispatchEvent(new ClipboardEvent('copy', {
      clipboardData: data, bubbles: true, cancelable: true,
    }));
    // The custom token still names an in-memory copy, but HTML is untrusted.
    data.setData('text/html', '<p>forged replacement</p>');
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.view.dom.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData: data, bubbles: true, cancelable: true,
    }));
  });
  await expect.poll(async () => (await getRuns(page)).map(r => r.text).join('')).toContain('Nguon gocNguon');
  const runs = await getRuns(page);
  expect(runs.every(r => !r.text.includes('forged'))).toBe(true);
  expect(runs.some(r => r.anchor?.anchorId === source.anchorId)).toBe(true);
});

test('TC06 / selection spanning two different anchors never inherits either original', async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() => {
    const { editor } = window.__mochop;
    const base = { recordingId: 'demo-recording-01', typedAt: 1794750000000,
      source: 'live_recording', schemaVersion: 1 };
    const doc = editor.schema.nodeFromJSON({ type: 'doc', content: [{ type: 'paragraph', content: [
      { type: 'text', text: 'ab', marks: [{ type: 'timeSpan', attrs: { ...base, anchorId: 'a', audioOffsetMs: 1000 } }] },
      { type: 'text', text: 'cd', marks: [{ type: 'timeSpan', attrs: { ...base, anchorId: 'b', audioOffsetMs: 2000 } }] },
    ] }] });
    editor.view.dispatch(editor.state.tr.replaceWith(0, editor.state.doc.content.size, doc.content)
      .setMeta('mochop:mark-applied', true));
    editor.commands.setTextSelection({ from: 2, to: 4 });
    editor.view.focus();
  });
  await setOffset(page, 255000);
  await page.evaluate(() => window.__mochop.editor.view.focus());
  await page.keyboard.type('X');
  const runs = await getRuns(page);
  const replacement = runs.find(r => r.text.includes('X'))?.anchor;
  expect(replacement).toBeTruthy();
  expect(['a', 'b']).not.toContain(replacement.anchorId);
  expect(replacement.audioOffsetMs).toBeGreaterThanOrEqual(255000);
});

test('TC10 / cross-meeting clipboard metadata never creates foreign audio link', async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData('text/plain', 'ngoai cuoc hop');
    data.setData('text/html', `<p><span data-time-anchor-id=\"foreign\" data-time-recording-id=\"foreign-rec\" data-time-offset-ms=\"111\" data-time-typed-at=\"1794750000000\" data-time-source=\"live_recording\" data-time-schema-version=\"1\">ngoai cuoc hop</span></p>`);
    data.setData('application/x-mochop-slice+json', JSON.stringify({
      meetingId: 'different-meeting', token: 'forged-token', schemaVersion: 1,
    }));
    window.__mochop.editor.view.dom.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData: data, bubbles: true, cancelable: true,
    }));
  });
  const runs = await getRuns(page);
  expect(runs.some(r => r.text.includes('ngoai'))).toBe(true);
  expect(runs.filter(r => r.text.includes('ngoai')).every(r => r.anchor?.recordingId === null)).toBe(true);
});
