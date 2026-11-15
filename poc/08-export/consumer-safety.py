"""Consumer-level security/format smoke: LibreOffice Calc and Pandoc.

No user files or audio: everything is synthetic and created in a temporary directory.
NOTE: LibreOffice Calc is NOT equivalent to Microsoft Excel for production sign-off.
"""
from pathlib import Path
import shutil
import subprocess
import tempfile

BASE = Path(__file__).resolve().parent


def main():
    with tempfile.TemporaryDirectory(prefix='moc-hop-08-safety-') as tmp:
        root = Path(tmp)
        input_csv = root / 'safety.csv'
        dangerous_csv = root / 'raw.csv'
        markdown = root / 'safety.md'
        node = """import {exportCSV,exportMarkdown} from './exporter.mjs';
import {writeFileSync} from 'node:fs';
const doc={type:'doc',content:[
 {type:'paragraph',content:[{type:'text',text:'=1+1'}]},
 {type:'paragraph',content:[{type:'text',text:'@SUM(1,1)'}]},
 {type:'paragraph',content:[{type:'text',text:'  +1+2'}]},
 {type:'paragraph',content:[{type:'text',text:'Dữ liệu tiếng Việt <script>alert(1)</script> & Bình thường'}]}
]};
const title='Bảo vệ CSV';
writeFileSync(process.argv[1],exportCSV({document:doc,title}));
writeFileSync(process.argv[2],exportCSV({document:doc,title,csvFormulaPolicy:'raw'}));
writeFileSync(process.argv[3],exportMarkdown({document:doc,title}));
"""
        subprocess.run(
            ['node', '--input-type=module', '-e', node, str(input_csv), str(dangerous_csv), str(markdown)],
            cwd=BASE, check=True, text=True, capture_output=True,
        )
        if shutil.which('pandoc'):
            page = subprocess.run(
                ['pandoc', '-f', 'gfm', '-t', 'html', str(markdown)],
                check=True, text=True, capture_output=True,
            ).stdout
            assert '<script>' not in page and '&lt;script&gt;' in page
            assert '&amp; Bình' in page and 'thường' in page
            print('PASS Pandoc: pasted HTML remains text, no active script tag')
        else:
            print('NOT_RUN Pandoc (not installed)')

        soffice = shutil.which('soffice') or shutil.which('libreoffice')
        try:
            from openpyxl import load_workbook
        except ImportError:
            load_workbook = None
        if not soffice or not load_workbook:
            print('NOT_RUN LibreOffice Calc consumer (soffice/openpyxl not available)')
            return
        outdir = root / 'out'
        outdir.mkdir()
        cmd = [
            soffice,
            f'-env:UserInstallation={ (root / "lo-profile").as_uri() }',
            '--headless', '--convert-to', 'xlsx', '--outdir', str(outdir),
            str(input_csv), str(dangerous_csv),
        ]
        run = subprocess.run(cmd, capture_output=True, text=True, timeout=50)
        if run.returncode != 0:
            raise RuntimeError(f'LibreOffice conversion failed: {run.stderr} {run.stdout}')
        actual_safe = outdir / 'safety.xlsx'
        actual_raw = outdir / 'raw.xlsx'
        assert actual_safe.is_file() and actual_raw.is_file(), run.stdout

        def read_values(path):
            workbook = load_workbook(path, data_only=False, read_only=True)
            sheet = workbook.active
            sheet.reset_dimensions()
            rows = list(sheet.iter_rows(values_only=False))
            return [(row[5].value, row[5].data_type) for row in rows[1:]]

        safe_cells = read_values(actual_safe)
        raw_cells = read_values(actual_raw)
        assert safe_cells[0] == ("'=1+1", 's'), safe_cells
        assert raw_cells[0] == ('=1+1', 'f'), raw_cells
        assert all(t == 's' for _, t in safe_cells), safe_cells
        print('PASS LibreOffice Calc: CSV safe mode reads 4 text fields, no formula cell')
        print('PASS LibreOffice Calc negative control: raw opt-out imported a formula for =1+1')


if __name__ == '__main__':
    main()
