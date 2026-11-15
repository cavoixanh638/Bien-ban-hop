"""Unit tests: run python3 -m unittest -v test_mochop.py."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
import zipfile
from mochop import BackupError,export_archive,import_archive,fixture

class BackupTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        fixture(self.root/'source',2*1024*1024)
        self.archive=self.root/'backup.mochop'
        export_archive(self.root/'source',self.archive)

    def modify(self,change):
        output=self.root/'modified.mochop'
        with zipfile.ZipFile(self.archive) as src,zipfile.ZipFile(output,'w') as dst:
            for name in src.namelist():
                data=change(name,src.read(name))
                if data is not None: dst.writestr(name,data)
        return output

    def reject(self,archive,**opts):
        with self.assertRaises((BackupError,ValueError,KeyError,zipfile.BadZipFile)):
            import_archive(archive,self.root/'repo',**opts)
        repo=self.root/'repo'
        self.assertFalse((repo/'meeting-demo').exists())
        self.assertFalse(any(p.name.startswith('.mochop-stage-') for p in repo.iterdir()))

    def test_roundtrip(self):
        import_archive(self.archive,self.root/'repo')
        for name in ['meeting.json','note.json','audio-manifest.json','audio/segment-1.pcm']:
            self.assertEqual((self.root/'source'/name).read_bytes(),(self.root/'repo/meeting-demo'/name).read_bytes())

    def test_no_overwrite(self):
        import_archive(self.archive,self.root/'repo')
        path=self.root/'repo/meeting-demo/note.json'
        original=hashlib.sha256(path.read_bytes()).digest()
        with self.assertRaises(BackupError):
            import_archive(self.archive,self.root/'repo')
        self.assertEqual(original,hashlib.sha256(path.read_bytes()).digest())
        self.assertFalse(any(p.name.startswith('.mochop-stage-') for p in (self.root/'repo').iterdir()))

    def test_missing_audio_TC38(self):
        missing=self.modify(lambda name,data: None if name.endswith('.pcm') else data)
        self.reject(missing)
        result=import_archive(missing,self.root/'repo',allow_missing_audio=True)
        self.assertEqual(['audio/segment-1.pcm'],result['missingAudio'])
        audio=json.loads((self.root/'repo/meeting-demo/audio-manifest.json').read_text())
        self.assertEqual('missing',audio['segments'][0]['completionState'])
        note=json.loads((self.root/'repo/meeting-demo/note.json').read_text())
        mark=note['content']['content'][0]['content'][0]['marks'][0]
        self.assertEqual(12345,mark['attrs']['audioOffsetMs'])

    def test_bad_checksum(self):
        self.reject(self.modify(lambda name,data: data[:100]+b'X'+data[101:] if name.endswith('.pcm') else data))

    def test_bad_schema(self):
        def change(name,data):
            if name=='manifest.json':
                obj=json.loads(data);obj['formatVersion']=999
                return json.dumps(obj).encode()
            return data
        self.reject(self.modify(change))

    def test_traversal(self):
        p=self.root/'traversal.mochop'
        with zipfile.ZipFile(self.archive) as src,zipfile.ZipFile(p,'w') as dest:
            for name in src.namelist():dest.writestr(name,src.read(name))
            dest.writestr('../outside','evil')
        self.reject(p)
        self.assertFalse((self.root/'outside').exists())

    def test_bomb(self):
        p=self.root/'bomb.mochop'
        with zipfile.ZipFile(p,'w',compression=zipfile.ZIP_DEFLATED) as z:
            z.writestr('bomb',b'X'*1000000)
            z.writestr('manifest.json','{}')
        self.reject(p)

    def test_duplicate_casefold(self):
        p=self.root/'duplicate.mochop'
        with zipfile.ZipFile(self.archive) as src,zipfile.ZipFile(p,'w') as dst:
            for name in src.namelist():dst.writestr(name,src.read(name))
            dst.writestr('NOTE.JSON',b'foo')
        self.reject(p)

    def test_truncated(self):
        p=self.root/'truncated.mochop'
        p.write_bytes(self.archive.read_bytes()[:-128])
        self.reject(p)

    def test_manifest_audio_reference(self):
        def change(name,data):
            if name=='audio-manifest.json':
                obj=json.loads(data);obj['segments'][0]['filePath']='audio/absent.pcm'
                return json.dumps(obj).encode()
            return data
        self.reject(self.modify(change))

if __name__=='__main__': unittest.main(verbosity=2)
