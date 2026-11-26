"""Smoke tests against independent DOCX, CSV, TXT and Markdown consumers."""
import csv
import io
from pathlib import Path
import shutil
import subprocess
from xml.etree import ElementTree
from zipfile import ZipFile

BASE = Path(__file__).resolve().parent
subprocess.run(['node', 'generate.mjs'], cwd=BASE, check=True, capture_output=True)
for mode in ('clean', 'with-marks'):
    docx = BASE / 'samples' / f'meeting-{mode}.docx'
    with ZipFile(docx) as package:
        assert package.testzip() is None
        files = set(package.namelist())
        required = {'[Content_Types].xml','_rels/.rels','word/document.xml','word/styles.xml', 'word/numbering.xml','word/_rels/document.xml.rels'}
        assert required <= files, required - files
        for name in required:
            ElementTree.fromstring(package.read(name))
        xml = package.read('word/document.xml').decode('utf-8')
        assert 'Hải Phòng' in xml and '<w:numPr>' in xml and 'w:val="Heading2"' in xml
        assert ('rec-01@' in xml) == (mode == 'with-marks')
    csv_bytes = (BASE/'samples'/f'meeting-{mode}.csv').read_bytes()
    assert csv_bytes.startswith(b'\xef\xbb\xbf') and b'\r\n' in csv_bytes
    csv_rows = list(csv.reader(io.StringIO(csv_bytes.decode('utf-8-sig'), newline=''),strict=True))
    assert len({len(row) for row in csv_rows}) == 1
    assert csv_rows[0][-1] == ('linked' if mode == 'with-marks' else 'text')
    assert any('Tiếng Việt: trường' in cell for row in csv_rows for cell in row)
    assert 'Hải Phòng' in (BASE/'samples'/f'meeting-{mode}.txt').read_text(encoding='utf-8')
    if not shutil.which('pandoc'):
        print('NOT_RUN Pandoc markdown consumer (not installed)')
    else:
        html = subprocess.check_output(['pandoc','-f','gfm','-t','html',str(BASE/'samples'/f'meeting-{mode}.md')],text=True)
        for token in ('<h2 ','<strong>','<em>','<ul>','<ol'):
            assert token in html, (mode,token)
    print('PASS formats:',mode)
print('TOTAL 2 modes PASS (DOCX ZIP/XML; strict CSV; TXT; Pandoc when available)')
