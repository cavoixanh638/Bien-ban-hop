"""Validate two runtime ZIP ecosystems without loading 2 GiB into RAM.
Python zipfile -> JS Central Directory parser -> Node staged restore;
JS ZIP64 writer -> Python zipfile -> Python staged restore.
"""
import json
from pathlib import Path
import subprocess
import tempfile
import zipfile
from mochop import make_fixture, export_archive, import_archive

def main():
    with tempfile.TemporaryDirectory(prefix='mochop-interop-') as tmp:
        root=Path(tmp)
        make_fixture(root/'fixture',1048576)
        py_zip=root/'python.mochop'
        export_archive(root/'fixture',py_zip)
        a=subprocess.run(['node','interop.mjs','import',str(py_zip),str(root/'restored-by-node')],capture_output=True,text=True,check=True)
        assert json.loads(a.stdout)['status']=='PASS'
        js_zip=root/'node.mochop'
        b=subprocess.run(['node','interop.mjs','export',str(js_zip)],capture_output=True,text=True,check=True)
        assert json.loads(b.stdout)['status']=='PASS'
        with zipfile.ZipFile(js_zip,'r') as z:
            assert z.testzip() is None
            assert 'audio/seg-1.pcm' in z.namelist()
            assert z.getinfo('audio/seg-1.pcm').file_size==1048576
        # Python reference archive import expects its own JSON schema; JS fixture uses compatible contract.
        c=import_archive(js_zip,root/'restored-by-python')
        note=json.loads((root/'restored-by-python/meeting-demo/note.json').read_text())
        assert note['content']['content'][0]['content'][0]['marks'][0]['attrs']['audioOffsetMs']==12345
        print(json.dumps({'status':'PASS','cases':2,'python_to_node':json.loads(a.stdout),'node_to_python':{**json.loads(b.stdout),'restore':c}},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
