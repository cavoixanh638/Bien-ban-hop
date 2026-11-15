import copy
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

from mochop import BackupError, clean_path, export_archive, import_archive, make_fixture

class MochopTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        make_fixture(self.root/'source', 2*1024*1024)
        self.archive = self.root/'backup.mochop'
        export_archive(self.root/'source', self.archive)

    def rewrite(self, modify):
        changed=self.root/'changed.mochop'
        with zipfile.ZipFile(self.archive) as original, zipfile.ZipFile(changed,'w',allowZip64=True) as out:
            for item in original.infolist():
                data=original.read(item.filename)
                result=modify(item.filename,data)
                if result is not None:
                    out.writestr(item.filename,result)
        return changed

    def assert_no_publish(self, archive, **opts):
        with self.assertRaises((BackupError, zipfile.BadZipFile, KeyError, ValueError)):
            import_archive(archive,self.root/'repo',**opts)
        repo=self.root/'repo'
        self.assertFalse((repo/'meeting-demo').exists())
        self.assertFalse(any(p.name.startswith('.mochop-stage-') for p in repo.iterdir()))

    def test_roundtrip_marks_and_audio(self):
        result=import_archive(self.archive,self.root/'repo')
        self.assertEqual([],result['missingAudio'])
        for path in ['note.json','meeting.json','audio-manifest.json','audio/segment-1.pcm']:
            self.assertEqual((self.root/'source'/path).read_bytes(),(self.root/'repo/meeting-demo'/path).read_bytes())

    def test_collision_never_overwrites(self):
        import_archive(self.archive,self.root/'repo')
        path=self.root/'repo/meeting-demo/note.json'
        before=hashlib.sha256(path.read_bytes()).hexdigest()
        with self.assertRaises(BackupError):
            import_archive(self.archive,self.root/'repo')
        self.assertEqual(before,hashlib.sha256(path.read_bytes()).hexdigest())
        self.assertFalse(any(p.name.startswith('.mochop-stage-') for p in (self.root/'repo').iterdir()))

    def test_missing_audio_text_survives(self):
        bad=self.rewrite(lambda name,data: None if name.endswith('.pcm') else data)
        self.assert_no_publish(bad)
        result=import_archive(bad,self.root/'repo',allow_missing_audio=True)
        self.assertEqual(['audio/segment-1.pcm'],result['missingAudio'])
        actual=json.loads((self.root/'repo/meeting-demo/audio-manifest.json').read_text('utf-8'))
        self.assertEqual('missing',actual['segments'][0]['completionState'])
        note=json.loads((self.root/'repo/meeting-demo/note.json').read_text('utf-8'))
        self.assertEqual(12345,note['content']['content'][0]['content'][0]['marks'][0]['attrs']['audioOffsetMs'])

    def test_checksum_mismatch_rolls_back(self):
        bad=self.rewrite(lambda name,data: data[:100]+b'X'+data[101:] if name.endswith('.pcm') else data)
        self.assert_no_publish(bad)

    def test_schema_rejected(self):
        def change(name,data):
            if name=='manifest.json':
                j=json.loads(data);j['formatVersion']=999;return json.dumps(j).encode()
            return data
        self.assert_no_publish(self.rewrite(change))

    def test_traversal(self):
        bad=self.root/'traversal.mochop'
        with zipfile.ZipFile(self.archive) as original, zipfile.ZipFile(bad,'w') as out:
            for name in original.namelist():out.writestr(name,original.read(name))
            out.writestr('../escape','x')
        self.assert_no_publish(bad)
        self.assertFalse((self.root/'escape').exists())

    def test_zip_bomb_ratio(self):
        bad=self.root/'bomb.mochop'
        with zipfile.ZipFile(bad,'w',compression=zipfile.ZIP_DEFLATED) as out:
            out.writestr('huge.txt',b'0'*1000000)
            out.writestr('manifest.json','{}')
        self.assert_no_publish(bad)

    def test_casefold_collision(self):
        bad=self.root/'collision.mochop'
        with zipfile.ZipFile(self.archive) as original, zipfile.ZipFile(bad,'w') as out:
            for name in original.namelist():out.writestr(name,original.read(name))
            out.writestr('NOTE.JSON','x')
        self.assert_no_publish(bad)

    def test_truncated_zip(self):
        bad=self.root/'truncated.mochop';bad.write_bytes(self.archive.read_bytes()[:-128])
        self.assert_no_publish(bad)

    def test_invalid_audio_manifest_reference(self):
        def change(name,data):
            if name=='audio-manifest.json':
                j=json.loads(data);j['segments'][0]['filePath']='audio/not-in-manifest.pcm';return json.dumps(j).encode()
            return data
        # This damages both checksum and reference, independently must reject.
        self.assert_no_publish(self.rewrite(change))

    def test_two_concurrent_restore_calls_never_overwrite(self):
        repo=self.root/'repo'
        def run():
            try:
                return ('PASS',import_archive(self.archive,repo))
            except BackupError as exc:
                return ('REJECTED',str(exc))
        with ThreadPoolExecutor(max_workers=2) as executor:
            results=list(executor.map(lambda _:run(),range(2)))
        self.assertEqual(['PASS','REJECTED'],sorted([r[0] for r in results]))
        self.assertTrue((repo/'meeting-demo/note.json').is_file())
        self.assertEqual([],list(repo.glob('.restore-lock-*')))

    def test_missing_note_disallowed_even_with_missing_audio_opt_in(self):
        bad=self.rewrite(lambda name,data:None if name=='note.json' else data)
        self.assert_no_publish(bad,allow_missing_audio=True)

    def test_manifest_casefold_alias_rejected(self):
        def mutate(name,data):
            if name=='manifest.json':
                j=json.loads(data)
                duplicate=copy.deepcopy(next(x for x in j['files'] if x['path']=='note.json'))
                duplicate['path']='NOTE.JSON'
                j['files'].append(duplicate)
                return json.dumps(j).encode()
            return data
        self.assert_no_publish(self.rewrite(mutate))


    def test_reject_windows_paths(self):
        unsafe = ['audio/CON', 'audio/nul.wav', 'audio/COM1.a', 'audio/LPT9',
                  'audio/file:secret', 'audio/trailing.', 'audio/trailing ',
                  'audio/flag?x', 'audio/f*ile', 'audio/e\u0301.pcm']
        for name in unsafe:
            with self.subTest(name=name), self.assertRaises(BackupError):
                clean_path(name)

if __name__ == '__main__':
    unittest.main(verbosity=2)
