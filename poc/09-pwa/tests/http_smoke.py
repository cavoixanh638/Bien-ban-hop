"""No browser needed: exercise actual HTTP static nested base-path, not SW behavior."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from functools import partial
from tempfile import TemporaryDirectory
from urllib.request import urlopen
from threading import Thread
import shutil

ROOT = Path(__file__).resolve().parents[1]
NESTED = Path('Bien-ban-hop/poc/09-pwa')


def main():
    with TemporaryDirectory(prefix='poc09-http-smoke-') as temp:
        path = Path(temp) / NESTED
        shutil.copytree(ROOT, path, ignore=shutil.ignore_patterns('tests', '.pytest_cache', '__pycache__'))
        handler = partial(SimpleHTTPRequestHandler, directory=temp)
        server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            base = f'http://127.0.0.1:{server.server_port}/{NESTED.as_posix()}/'
            for asset in ['', 'app.js', 'lease.js', 'recording-session.js', 'autosave-session.js',
                          'maintenance-retry.js', 'migration-core.js', 'sw.js', 'manifest.webmanifest']:
                with urlopen(base + asset, timeout=5) as result:
                    assert result.status == 200, asset
                    body = result.read()
                    assert len(body) > 10, asset
                    print(f'PASS nested HTTP 200: {asset or "index.html"}, {len(body)} bytes')
        finally:
            server.shutdown()
            server.server_close()
            thread.join(3)


if __name__ == '__main__':
    main()
