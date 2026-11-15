"""Real Chromium browser PWA acceptance checks (synthetic fixtures only).

Run: python -m pytest -q tests/test_pwa.py
Chromium is looked up via CHROMIUM_PATH or Playwright's downloaded browser.
"""
import os
import re
import shutil
import tempfile
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright, expect, Error as PlaywrightError

ROOT = Path(__file__).resolve().parents[1]
PREFIX = Path('Bien-ban-hop') / 'poc' / '09-pwa'


class NoStoreHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *_args):
        pass


class FixtureServer:
    def __init__(self, root, server):
        self.root = root
        self.server = server
        self.url = f'http://127.0.0.1:{server.server_address[1]}/{PREFIX.as_posix()}/'
        self.folder = root / PREFIX

    def upgrade(self):
        sw = self.folder / 'sw.js'
        app = self.folder / 'app.js'
        assert "const VERSION = 'v1';" in sw.read_text()
        assert "const APP_VERSION = 'v1';" in app.read_text()
        sw.write_text(sw.read_text().replace("const VERSION = 'v1';", "const VERSION = 'v2';"))
        app.write_text(app.read_text().replace("const APP_VERSION = 'v1';", "const APP_VERSION = 'v2';"))


@pytest.fixture()
def server():
    with tempfile.TemporaryDirectory(prefix='poc09-') as tmp:
        target = Path(tmp) / PREFIX
        shutil.copytree(ROOT, target, ignore=shutil.ignore_patterns('tests', '__pycache__', '.pytest_cache'))
        handler = partial(NoStoreHandler, directory=tmp)
        httpd = ThreadingHTTPServer(('127.0.0.1', 0), handler)
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            yield FixtureServer(Path(tmp), httpd)
        finally:
            httpd.shutdown()
            httpd.server_close()
            thread.join(timeout=3)


@pytest.fixture()
def browser():
    with sync_playwright() as playwright:
        kwargs = dict(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
        if os.environ.get('CHROMIUM_PATH'):
            kwargs['executable_path'] = os.environ['CHROMIUM_PATH']
        elif Path('/usr/bin/chromium').exists():
            kwargs['executable_path'] = '/usr/bin/chromium'
        b = playwright.chromium.launch(**kwargs)
        try:
            yield b
        finally:
            b.close()


def open_page(context, server, meeting=None, init_script=None):
    page = context.new_page()
    if init_script:
        page.add_init_script(init_script)
    url = server.url + (f'?meeting={meeting}' if meeting else '')
    page.goto(url, wait_until='domcontentloaded')
    expect(page.get_by_test_id('save-status')).to_contain_text('Loaded revision', timeout=15000)
    page.wait_for_function('!!navigator.serviceWorker?.controller', timeout=15000)
    return page


def bytes_count(page):
    text = page.get_by_test_id('opfs-status').inner_text()
    match = re.search(r'(\d+) confirmed bytes', text)
    assert match, text
    return int(match.group(1))


def read_db(page):
    return page.evaluate("""async () => {
      const db = await new Promise((resolve, reject) => {
        const r = indexedDB.open('mochop-pwa-poc09');
        r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
      });
      const tx = db.transaction(['meetings','documents','snapshots'], 'readonly');
      const get = (store, key) => new Promise((resolve, reject) => {
        const r = tx.objectStore(store).get(key);
        r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
      });
      const meeting = await get('meetings','meeting-poc09-01');
      const document = await get('documents',meeting.noteDocumentId);
      const snapshot = await get('snapshots','meeting-poc09-01');
      db.close();
      return {meeting, document, snapshot};
    }""")


def test_tc32_two_tabs_exclusive_and_close_recovery(browser, server):
    context = browser.new_context(service_workers='allow')
    try:
        writer = open_page(context, server)
        second = open_page(context, server)
        writer.get_by_test_id('acquire').click()
        expect(writer.get_by_test_id('lease-status')).to_contain_text('WRITER (exclusive)')
        second.get_by_test_id('acquire').click()
        expect(second.get_by_test_id('save-status')).to_contain_text('Other tab owns')
        assert second.get_by_test_id('notes').is_disabled()
        writer.get_by_test_id('notes').fill('alpha fixture note - saved by writer one')
        expect(writer.get_by_test_id('save-status')).to_contain_text('Saved revision 2')
        expect(second.get_by_test_id('notes')).to_have_value('alpha fixture note - saved by writer one')
        writer.close()  # Browser releases its Web Locks even without explicit app release.
        second.get_by_test_id('acquire').click()
        expect(second.get_by_test_id('lease-status')).to_contain_text('WRITER (exclusive)')
        second.get_by_test_id('notes').fill('second writer after first closed')
        expect(second.get_by_test_id('save-status')).to_contain_text('Saved revision 3')
        assert read_db(second)['document']['revision'] == 3
        second.get_by_test_id('release').click()
        expect(second.get_by_test_id('lease-status')).to_contain_text('READ ONLY')
    finally:
        context.close()


def test_tc33_offline_reload_and_opfs_worker(browser, server):
    context = browser.new_context(service_workers='allow')
    try:
        page = open_page(context, server)
        assert page.evaluate('crossOriginIsolated') is False
        assert page.evaluate('navigator.serviceWorker.controller.scriptURL.endsWith("/sw.js")')
        expected_scope = server.url
        assert page.evaluate('navigator.serviceWorker.ready.then(r=>r.scope)') == expected_scope
        page.get_by_test_id('acquire').click()
        page.get_by_test_id('start').click()
        expect(page.get_by_test_id('recording-status')).to_contain_text('active')
        page.wait_for_timeout(800)
        first_bytes = bytes_count(page)
        assert first_bytes >= 64
        page.get_by_test_id('stop').click()
        page.get_by_test_id('release').click()
        context.set_offline(True)
        page.reload(wait_until='domcontentloaded')
        expect(page.get_by_test_id('network')).to_have_text('Offline')
        expect(page.get_by_test_id('save-status')).to_contain_text('Loaded revision')
        assert bytes_count(page) >= first_bytes
        page.get_by_test_id('acquire').click()
        page.get_by_test_id('notes').fill('Offline notes persist with no server')
        expect(page.get_by_test_id('save-status')).to_contain_text('Saved revision 2')
        page.get_by_test_id('start').click()
        expect(page.get_by_test_id('recording-status')).to_contain_text('active')
        page.get_by_test_id('stop').click()
        page.get_by_test_id('release').click()
        assert bytes_count(page) > first_bytes
        context.set_offline(False)
    finally:
        context.close()


def test_tc34_update_waits_and_never_forces_reload(browser, server):
    context = browser.new_context(service_workers='allow')
    try:
        page = open_page(context, server)
        other = open_page(context, server)
        page.get_by_test_id('acquire').click()
        page.get_by_test_id('notes').fill('Keep these notes through upgrade')
        expect(page.get_by_test_id('save-status')).to_contain_text('Saved revision 2')
        original_mark = read_db(page)['document']['content']['content'][0]['content'][0]['marks'][0]
        page.get_by_test_id('start').click()
        expect(page.get_by_test_id('recording-status')).to_contain_text('active')
        before = bytes_count(page)
        server.upgrade()
        other.get_by_test_id('check-update').click()
        other.wait_for_function('navigator.serviceWorker.ready.then(r=>!!r.waiting)', timeout=15000)
        expect(other.get_by_test_id('update-status')).to_contain_text('WAITING')
        # The other tab must be blocked by a writer that is recording elsewhere.
        other.get_by_test_id('activate').click()
        expect(other.get_by_test_id('update-status')).to_contain_text('BLOCKED')
        page.wait_for_timeout(800)
        assert bytes_count(page) > before
        expect(page.get_by_test_id('version')).to_have_text('v1')
        assert page.evaluate('navigator.serviceWorker.controller.state') == 'activated'
        page.get_by_test_id('stop').click()
        page.get_by_test_id('release').click()
        other.get_by_test_id('activate').click()
        expect(other.get_by_test_id('update-status')).to_contain_text('Update ACTIVATED', timeout=15000)
        expect(page.get_by_test_id('version')).to_have_text('v1')  # No automatic reload.
        other.get_by_test_id('reload').click()
        expect(other.get_by_test_id('version')).to_have_text('v2', timeout=15000)
        expect(other.get_by_test_id('schema-status')).to_contain_text('document schema 2')
        current = read_db(other)
        assert current['document']['revision'] == 2
        assert current['document']['content']['content'][0]['content'][0]['marks'][0] == original_mark
        assert current['snapshot']['document']['content']['content'][0]['content'][0]['marks'][0] == original_mark
        assert current['snapshot']['meeting']['schemaVersion'] == 1
        assert current['document']['schemaVersion'] == 2
        assert bytes_count(other) >= before
        # Old app cannot write a migrated document if the old tab is still open.
        page.get_by_test_id('acquire').click()
        expect(page.get_by_test_id('save-status')).to_contain_text('schema mismatch')
    finally:
        context.close()


def test_tc35_invalid_migration_is_atomic(browser, server):
    context = browser.new_context(service_workers='allow')
    try:
        page = open_page(context, server)
        page.evaluate("""async () => {
          const db = await new Promise(res => {const r=indexedDB.open('mochop-pwa-poc09');r.onsuccess=()=>res(r.result)});
          const tx = db.transaction('documents','readwrite');
          const store = tx.objectStore('documents');
          const doc = await new Promise(res=>{const r=store.get('note-meeting-poc09-01');r.onsuccess=()=>res(r.result)});
          doc.content.content[0].content[0].marks[0].attrs.recordingId='wrong-id';
          store.put(doc);
          await new Promise(res=>{tx.oncomplete=res}); db.close();
        }""")
        page.get_by_test_id('migrate').click()
        expect(page.get_by_test_id('schema-status')).to_contain_text('Migration FAILED')
        state = read_db(page)
        assert state['document']['schemaVersion'] == 1
        assert state['meeting']['schemaVersion'] == 1
        assert state['snapshot'] is None
        assert state['document']['content']['content'][0]['content'][0]['marks'][0]['attrs']['recordingId'] == 'wrong-id'
    finally:
        context.close()


def test_no_application_data_in_sw_cache_and_explicit_base_path(browser, server):
    context = browser.new_context(service_workers='allow')
    try:
        page = open_page(context, server)
        result = page.evaluate("""async () => {
          const scopes = (await navigator.serviceWorker.getRegistrations()).map(r=>r.scope);
          const names=await caches.keys();
          let entries=[];
          for (const name of names) {
            const cache=await caches.open(name);
            entries.push(...(await cache.keys()).map(req=>new URL(req.url).pathname));
          }
          return {scopes, names, entries};
        }""")
        assert result['scopes'] == [server.url]
        assert result['names'] == ['mochop-poc09-shell-v1']
        assert all(path.startswith('/Bien-ban-hop/poc/09-pwa/') for path in result['entries'])
        assert all(not path.endswith('.bin') and 'IndexedDB' not in path for path in result['entries'])
        assert any(path.endswith('/app.js') for path in result['entries'])
    finally:
        context.close()


def test_revision_conflict_never_claims_saved(browser, server):
    context = browser.new_context(service_workers='allow')
    try:
        page = open_page(context, server)
        page.get_by_test_id('acquire').click()
        expect(page.get_by_test_id('lease-status')).to_contain_text('WRITER (exclusive)')
        page.evaluate("""async () => {
          const db=await new Promise(res=>{const r=indexedDB.open('mochop-pwa-poc09');r.onsuccess=()=>res(r.result)});
          const tx=db.transaction('documents','readwrite');const store=tx.objectStore('documents');
          const doc=await new Promise(res=>{const r=store.get('note-meeting-poc09-01');r.onsuccess=()=>res(r.result)});
          doc.revision=99; store.put(doc);
          await new Promise(res=>{tx.oncomplete=res}); db.close();
        }""")
        page.get_by_test_id('notes').fill('this must not silently overwrite')
        expect(page.get_by_test_id('save-status')).to_contain_text('NOT SAVED: Revision conflict')
        assert read_db(page)['document']['revision'] == 99
        assert read_db(page)['document']['content']['content'][1]['content'][0]['text'] != 'this must not silently overwrite'
    finally:
        context.close()


def test_browser_crash_relinquishes_web_lock(browser, server):
    context = browser.new_context(service_workers='allow')
    try:
        writer = open_page(context, server)
        contender = open_page(context, server)
        writer.get_by_test_id('acquire').click()
        expect(writer.get_by_test_id('lease-status')).to_contain_text('WRITER (exclusive)')
        cdp = context.new_cdp_session(writer)
        try:
            cdp.send('Page.crash')
        except PlaywrightError:
            # A target-crashed protocol error is expected when DevTools kills the renderer.
            pass
        # A crashed tab has no live Web Lock owner; takeover uses the same Web Locks API.
        for attempt in range(12):
            contender.get_by_test_id('acquire').click()
            if 'WRITER (exclusive)' in contender.get_by_test_id('lease-status').inner_text():
                break
            contender.wait_for_timeout(250)
        expect(contender.get_by_test_id('lease-status')).to_contain_text('WRITER (exclusive)')
        contender.get_by_test_id('release').click()
    finally:
        context.close()


def test_g09_add01_release_during_deferred_first_opfs_ack(browser, server):
    """Actual browser integration of controlled ACK race; independent from other streams."""
    context = browser.new_context(service_workers='allow')
    delayed_worker_script = """(() => {
      const NativeWorker = window.Worker;
      window.__poc09AppendCalls = 0;
      window.Worker = class DelayedFirstWorker extends NativeWorker {
        postMessage(message, transfer) {
          if (message.action === 'append') {
            window.__poc09AppendCalls++;
            if (!this.__firstIntercepted) {
              this.__firstIntercepted = true;
              window.__releaseFirstAck = () => NativeWorker.prototype.postMessage.call(this, message, transfer);
              return;
            }
          }
          return NativeWorker.prototype.postMessage.call(this, message, transfer);
        }
      };
    })();"""
    try:
        writer = open_page(context, server, init_script=delayed_worker_script)
        contender = open_page(context, server)
        writer.get_by_test_id('acquire').click()
        expect(writer.get_by_test_id('lease-status')).to_contain_text('WRITER')
        writer.get_by_test_id('start').click()
        writer.wait_for_function('typeof window.__releaseFirstAck === "function"')
        expect(writer.get_by_test_id('recording-status')).to_contain_text('starting')
        writer.get_by_test_id('release').click()  # pending, cannot release lock until ACK
        contender.get_by_test_id('acquire').click()
        expect(contender.get_by_test_id('save-status')).to_contain_text('Other tab owns')
        writer.evaluate('window.__releaseFirstAck()')
        expect(writer.get_by_test_id('lease-status')).to_contain_text('READ ONLY')
        expect(writer.get_by_test_id('recording-status')).to_contain_text('idle')
        writer.wait_for_timeout(450)
        assert writer.evaluate('window.__poc09AppendCalls') == 1
        contender.get_by_test_id('acquire').click()
        expect(contender.get_by_test_id('lease-status')).to_contain_text('WRITER')
        contender.get_by_test_id('release').click()
    finally:
        context.close()


def test_g09_add03_migration_retries_on_other_meeting_release(browser, server):
    """B holding shared maintenance must postpone A migration; B release unblocks A."""
    context = browser.new_context(service_workers='allow')
    try:
        initial = open_page(context, server)
        server.upgrade()
        initial.get_by_test_id('check-update').click()
        initial.wait_for_function('navigator.serviceWorker.ready.then(r=>!!r.waiting)')
        initial.get_by_test_id('activate').click()
        expect(initial.get_by_test_id('update-status')).to_contain_text('Update ACTIVATED')
        initial.get_by_test_id('reload').click()
        expect(initial.get_by_test_id('version')).to_have_text('v2')
        # Meeting B completes migration, then owns shared maintenance / writer lock.
        other = open_page(context, server, meeting='meeting-B')
        expect(other.get_by_test_id('schema-status')).to_contain_text('document schema 2')
        other.get_by_test_id('acquire').click()
        expect(other.get_by_test_id('lease-status')).to_contain_text('WRITER')
        # New meeting A seeds v1 while running app v2, and cannot migrate yet.
        blocked = open_page(context, server, meeting='meeting-A')
        expect(blocked.get_by_test_id('schema-status')).to_contain_text('Migration postponed')
        expect(blocked.get_by_test_id('retry-migration')).to_be_visible()
        assert blocked.get_by_test_id('acquire').is_disabled()
        other.get_by_test_id('release').click()
        expect(blocked.get_by_test_id('schema-status')).to_contain_text('document schema 2', timeout=10000)
        expect(blocked.get_by_test_id('retry-migration')).to_be_hidden()
        blocked.get_by_test_id('acquire').click()
        expect(blocked.get_by_test_id('lease-status')).to_contain_text('WRITER')
        blocked.get_by_test_id('release').click()
    finally:
        context.close()


def test_g09_add04_direct_worker_activation_message_cannot_bypass_writer(browser, server):
    context = browser.new_context(service_workers='allow')
    try:
        recording = open_page(context, server)
        requester = open_page(context, server)
        recording.get_by_test_id('acquire').click()
        recording.get_by_test_id('start').click()
        expect(recording.get_by_test_id('recording-status')).to_contain_text('active')
        server.upgrade()
        requester.get_by_test_id('check-update').click()
        requester.wait_for_function('navigator.serviceWorker.ready.then(r=>!!r.waiting)')
        direct = requester.evaluate("""async () => {
          const registration = await navigator.serviceWorker.ready;
          const channel = new MessageChannel();
          return await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(Error('SW did not respond')), 10000);
            channel.port1.onmessage = e => {clearTimeout(timeout); resolve(e.data)};
            registration.waiting.postMessage({type:'REQUEST_SAFE_ACTIVATION'}, [channel.port2]);
          });
        }""")
        assert direct['accepted'] is False
        assert 'writer' in direct['reason']
        assert requester.evaluate('navigator.serviceWorker.controller.scriptURL.endsWith("/sw.js")')
        expect(requester.get_by_test_id('version')).to_have_text('v1')
        recording.get_by_test_id('stop').click()
        recording.get_by_test_id('release').click()
        requester.get_by_test_id('activate').click()
        expect(requester.get_by_test_id('update-status')).to_contain_text('Update ACTIVATED')
    finally:
        context.close()
