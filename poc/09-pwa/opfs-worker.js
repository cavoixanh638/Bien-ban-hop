// Small synthetic payloads, not audio. Worker-only OPFS persistence.
const sane = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id);
async function target(meetingId, create) {
  if (!sane(meetingId)) throw new Error('Invalid meeting ID');
  if (!navigator.storage?.getDirectory) throw new Error('OPFS unavailable in this browser');
  const root = await navigator.storage.getDirectory();
  const folder = await root.getDirectoryHandle('poc09-fixture', { create });
  return folder.getFileHandle(meetingId + '.bin', { create });
}
async function append(meetingId, data) {
  const file = await target(meetingId, true);
  const bytes = new Uint8Array(data);
  if (file.createSyncAccessHandle) {
    const handle = await file.createSyncAccessHandle();
    try {
      const before = handle.getSize();
      const written = handle.write(bytes, { at: before });
      if (written !== bytes.byteLength) throw new Error('Partial OPFS write, no committed ACK');
      handle.flush();
      return handle.getSize();
    } finally { handle.close(); }
  }
  // Fallback remains explicit and commits only after close().
  const before = (await file.getFile()).size;
  const stream = await file.createWritable({ keepExistingData: true });
  try { await stream.seek(before); await stream.write(bytes); await stream.close(); }
  catch (error) { await stream.abort().catch(() => {}); throw error; }
  return (await file.getFile()).size;
}
async function stat(meetingId) {
  try { return (await (await target(meetingId, false)).getFile()).size; }
  catch (error) { if (error.name === 'NotFoundError') return 0; throw error; }
}
self.onmessage = async event => {
  const { requestId, action, meetingId, payload } = event.data || {};
  try {
    const bytes = action === 'append' ? await append(meetingId, payload) : action === 'stat' ? await stat(meetingId) : (() => { throw new Error('Unknown action'); })();
    self.postMessage({ requestId, ok: true, bytes });
  } catch (error) {
    self.postMessage({ requestId, ok: false, error: String(error?.message || error) });
  }
};
