#!/usr/bin/env python3
"""Opt-in Linux Chromium event probe (synthetic keyboard; NOT editor/Windows IME evidence).

Requires Python Playwright installed and a local Chrome/Chromium binary.
Never logs key characters, clipboard contents, or user text.
"""
import json
import os
import platform
import shutil
from collections import Counter
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'evidence' / 'linux-chromium-native-input.json'

def run():
    # The sandbox disallows even localhost HTTP. Embed only the exact pure
    # safeKeyboardKey function from our source into an about:blank probe.
    policy = (ROOT / 'src' / 'policy.mjs').read_text(encoding='utf-8')
    start = policy.index('export function safeKeyboardKey(')
    end = policy.index('export function normalizeContext(', start)
    safe_fn = policy[start:end].replace('export function', 'function', 1)
    html = (ROOT / 'tests' / 'browser-native-event-probe.html').read_text(encoding='utf-8')
    html = html.replace("import { safeKeyboardKey } from '../src/policy.mjs';", safe_fn)
    html = html.replace('<script type="module">', '<script>')
    binary = os.environ.get('CHROMIUM_BIN') or shutil.which('chromium') or shutil.which('google-chrome')
    if not binary:
        raise RuntimeError('Chrome/Chromium executable unavailable')
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=binary, headless=True, args=['--no-sandbox'])
        page = browser.new_page()
        page.set_content(html)
        page.locator('#probe').click()
        page.keyboard.type('truong', delay=30)
        page.keyboard.press('Backspace')
        page.keyboard.type('g', delay=30)
        page.keyboard.press('Space')
        page.keyboard.type('tieng', delay=30)
        events = page.evaluate('window.__probe.events')
        input_len = page.evaluate('window.__probe.length()')
        version = browser.version
        browser.close()
    kinds = Counter(e['kind'] for e in events)
    if not kinds['beforeinput'] or not kinds['input'] or not any(
        e['kind'] == 'keydown' and e.get('key') == 'Backspace' for e in events
    ):
        raise AssertionError('Missing expected keyboard/beforeinput/input/Backspace sequence')
    if any(e.get('key') not in (None, '[printable]', '[other]', 'Backspace', 'Delete', 'Enter', 'Escape', 'Tab',
                                    'Insert', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End',
                                    'PageUp', 'PageDown', 'Control', 'Alt', 'Meta', 'Shift', 'Process', 'Dead',
                                    'Unidentified', 'Compose') for e in events):
        raise AssertionError('Trace privacy violation')
    result = {
        'schemaVersion': 1, 'kind': 'native-contenteditable-event-baseline',
        'evidenceScope': 'Linux Chromium / Playwright synthetic keyboard; NO Tiptap editor and NO Windows UniKey/EVKey',
        'os': platform.platform(), 'browser': f'Chromium {version}',
        'script': 'python3 scripts/browser-native-event-probe.py',
        'scenario': 'synthetic ASCII letters + Backspace/Insert; no native Windows IME',
        'eventCount': len(events), 'kinds': dict(kinds), 'finalLengthOnly': input_len,
        'events': events,
    }
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in result.items() if k != 'events'}, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    run()
