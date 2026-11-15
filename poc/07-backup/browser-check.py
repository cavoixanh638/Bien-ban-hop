"""Run real Chromium OPFS/IndexedDB exercise via localhost. No npm required."""
import argparse
import http.server
import json
from pathlib import Path
import socketserver
import threading
import time
from playwright.sync_api import sync_playwright

HERE=Path(__file__).resolve().parent
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(HERE),**kwargs)
    def log_message(self,*args):pass
class Server(socketserver.ThreadingMixIn,http.server.HTTPServer):pass

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--bytes',type=int,default=1048576)
    parser.add_argument('--output',default=None)
    parser.add_argument('--timeout-ms',type=int,default=300000)
    options=parser.parse_args()
    server=Server(('127.0.0.1',0),Handler)
    threading.Thread(target=server.serve_forever,daemon=True).start()
    url='https://mochop-local.example/browser.html'
    started=time.monotonic()
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-gpu'])
            context=browser.new_context()
            page=context.new_page()
            page.set_default_timeout(options.timeout_ms)
            errors=[]
            page.on('pageerror',lambda e: errors.append(str(e)))
            def route_asset(route):
                relative=route.request.url.split('mochop-local.example/',1)[-1].split('?',1)[0]
                file=HERE/relative
                if not file.is_file() or not file.resolve().is_relative_to(HERE):route.abort();return
                mime='text/javascript' if file.suffix=='.mjs' else 'text/html' if file.suffix=='.html' else 'text/plain'
                route.fulfill(path=str(file),content_type=mime)
            page.route('https://mochop-local.example/**',route_asset)
            page.goto(url)
            data=page.evaluate('async bytes => (await import("/browser-run.mjs")).run({bytes})', options.bytes)
            data.update({'environment':'Linux headless Chromium, OPFS and IndexedDB, localhost','elapsedWallSeconds':round(time.monotonic()-started,3),'pageErrors':errors})
            if errors:raise RuntimeError(str(errors))
            if options.output:Path(options.output).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
            print(json.dumps(data,ensure_ascii=False,indent=2))
            context.close();browser.close()
    finally:server.shutdown()
if __name__=='__main__':main()
