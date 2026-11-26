"""Headless Chromium Blob/download smoke without network (in-memory page shim).
Requires: python -m pip install playwright; python -m playwright install chromium.
The HTTP-hosted demo and Windows Word must still be tested separately.
"""
import json
import os
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright

BASE = Path(__file__).resolve().parent
subprocess.run(['node', 'generate.mjs'], cwd=BASE, check=True, capture_output=True)
html = (BASE / 'index.html').read_text(encoding='utf-8')
# Chromium in this execution environment blocks even localhost/file navigations.
# Use the exact UI handler and exporter with only imports + fixture fetch shimmed.
html_head = html.split('<script type="module">', 1)[0] + '</body></html>'
source = (BASE / 'exporter.mjs').read_text(encoding='utf-8')
source = '(()=>{' + source.replace('export function ', 'function ').replace('export const ', 'const ') + '\nwindow.PoC={exportAll,mime};})()'
ui = html.split('<script type="module">', 1)[1].split('</script>', 1)[0]
ui = ui.replace("import {exportAll,mime} from './exporter.mjs';", 'const {exportAll,mime}=window.PoC;')
ui = ui.replace("JSON.stringify(await(await fetch('./fixture.json')).json(),null,2)", 'JSON.stringify(window.FIXTURE,null,2)')
assert 'await' not in ui, 'Unexpected pending network request in UI handler'

with sync_playwright() as playwright, TemporaryDirectory() as scratch:
    launch = dict(headless=True)
    chromium = os.environ.get('CHROMIUM_PATH')
    if chromium:
        launch['executable_path'] = chromium
    elif Path('/usr/bin/chromium').exists():
        launch['executable_path'] = '/usr/bin/chromium'
    if os.geteuid() == 0 if hasattr(os, 'geteuid') else False:
        launch['args'] = ['--no-sandbox']
    browser = playwright.chromium.launch(**launch)
    page = browser.new_page(accept_downloads=True)
    errors = []
    page.on('pageerror', lambda exc: errors.append(str(exc)))
    page.set_content(html_head)
    page.evaluate('(data)=>{window.FIXTURE=data}', json.loads((BASE / 'fixture.json').read_text(encoding='utf-8')))
    page.add_script_tag(content=source)
    page.add_script_tag(content=ui)
    assert not errors, errors
    passed = 0
    for include_timestamps in (False, True):
        page.locator('#marked').set_checked(include_timestamps)
        for ext in ('docx', 'txt', 'md', 'csv'):
            with page.expect_download(timeout=12000) as request:
                page.locator(f'button[data-ext="{ext}"]').click()
            download = request.value
            stem = 'meeting-with-marks' if include_timestamps else 'meeting-clean'
            name = ('moc-hop-kem-moc' if include_timestamps else 'moc-hop-ban-sach') + '.' + ext
            assert download.suggested_filename == name
            received = Path(scratch) / name
            download.save_as(received)
            assert received.read_bytes() == (BASE / 'samples' / (stem + '.' + ext)).read_bytes()
            print('PASS Chromium Blob download:',name)
            passed += 1
    page.locator('#json').fill('{bad-json')
    page.locator('button[data-ext="txt"]').click()
    assert page.locator('#status').inner_text().startswith('Lỗi:')
    assert not errors, errors
    print('PASS Chromium malformed JSON displays an error')
    passed += 1
    browser.close()
    print(f'TOTAL {passed} PASS; Chromium {browser.version}; IN-MEMORY_SHIM (NOT HTTP-ORIGIN E2E)')
