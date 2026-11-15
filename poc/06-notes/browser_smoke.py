"""Optional real IndexedDB smoke test with Playwright Python (no third-party app code).

Run from poc/06-notes: python browser_smoke.py
Install playwright + Chromium separately if absent. No deployment or network access needed
other than the local HTTP origin this script starts. Browser is NOT_RUN if navigation
is blocked by an administrative policy; this script never attempts to bypass it.
"""
import asyncio
import json
import os
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.async_api import async_playwright


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


async def run():
    root = Path(__file__).resolve().parent
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(root)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{server.server_port}/"
    report = {"runner": "Playwright Python, real browser IndexedDB", "origin": url}
    browser = None
    try:
        async with async_playwright() as p:
            kwargs = {"headless": True}
            if os.environ.get("CHROMIUM_EXECUTABLE"):
                kwargs["executable_path"] = os.environ["CHROMIUM_EXECUTABLE"]
            browser = await p.chromium.launch(**kwargs)
            report["browserVersion"] = browser.version
            context = await browser.new_context()
            a, b = await context.new_page(), await context.new_page()
            await a.goto(url)
            await b.goto(url)
            init = await a.evaluate("""async () => {
              const {openIndexedDB,NotesRepository}=await import('./notes.mjs');
              const name='smoke-'+crypto.randomUUID();
              const db=await openIndexedDB(name),repo=new NotesRepository(db);
              const m=await repo.createMeeting('Họp kiểm thử IndexedDB');
              const content={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Đường Nguyễn Trãi',marks:[{type:'bold'},{type:'timeSpan',attrs:{anchorId:'m-1',recordingId:'r-1',audioOffsetMs:1500,typedAt:1794720000000,source:'live_recording',schemaVersion:1}}]}]}]};
              const rev=await repo.saveNote(m.noteDocumentId,content,0);
              const roundtrip=JSON.stringify((await repo.getNote(m.noteDocumentId)).content)===JSON.stringify(content);
              db.close();return {name,noteId:m.noteDocumentId,rev,roundtrip};
            }""")
            assert init["roundtrip"] and init["rev"] == 1
            report["roundTrip"] = "PASS"
            # Run two separate pages on separate IndexedDB connections with the same expected revision.
            script = """async ({name,noteId,text}) => {
              const {openIndexedDB,NotesRepository}=await import('./notes.mjs');
              const db=await openIndexedDB(name),repo=new NotesRepository(db);
              try {const rev=await repo.saveNote(noteId,{type:'doc',content:[{type:'paragraph',content:[{type:'text',text}]}]},1);return {status:'committed',rev};}
              catch(e){return {status:e.name,message:e.message};}
              finally {db.close();}
            }"""
            ra, rb = await asyncio.gather(
                a.evaluate(script, {**init, "text": "Bản A"}),
                b.evaluate(script, {**init, "text": "Bản B"}),
            )
            assert sorted([ra["status"], rb["status"]]) == ["RevisionConflict", "committed"]
            report["twoTabConflict"] = "PASS"
            await a.reload()
            recovered = await a.evaluate("""async ({name,noteId}) => {
              const {openIndexedDB,NotesRepository}=await import('./notes.mjs');
              const db=await openIndexedDB(name),repo=new NotesRepository(db);
              const note=await repo.getNote(noteId),journal=await repo.getJournal(noteId);
              const before=note.revision;
              try {await db.run(['notes','journals'],'readwrite',async tx=>{
                await tx.put('notes',{...note,revision:999});
                throw new Error('forced rollback');
              });} catch(e) { /* expected transaction abort */ }
              const after=(await repo.getNote(noteId)).revision;
              db.close();return {before,after,journalCount:journal.length};
            }""", init)
            assert recovered == {"before": 2, "after": 2, "journalCount": 2}
            report["reopenAndAbort"] = "PASS"
            report["status"] = "PASS"
            report["limitation"] = "Browser reopen is not equivalent to SIGKILL / power loss"
            await context.close()
            await browser.close()
            return 0, report
    except Exception as e:
        report["status"] = "NOT_RUN" if "ERR_BLOCKED_BY_ADMINISTRATOR" in str(e) else "FAIL"
        report["error"] = str(e).split("\n")[0]
        try:
            if browser:
                await browser.close()
        except Exception:
            pass
        return (2 if report["status"] == "NOT_RUN" else 1), report
    finally:
        server.shutdown()


if __name__ == "__main__":
    code, evidence = asyncio.run(run())
    print(json.dumps(evidence, ensure_ascii=False, indent=2))
    sys.exit(code)
