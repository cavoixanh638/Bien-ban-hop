# Mốc Họp V1.2 — PoC 08-export

Công cụ xuất tài liệu ProseMirror JSON sang **DOCX, TXT, Markdown và CSV**, mỗi loại có **bản sạch** và **bản kèm mốc**. Đây là PoC **độc lập**, không dùng mã/fixture của luồng khác. `.mochop` và việc khôi phục audio thuộc luồng 07.

## Chạy thử trên máy bất kỳ

Yêu cầu: Node.js >=18. Không cần `npm install`, không cần mạng để chạy exporter/test gốc.

```sh
cd poc/08-export
node test.mjs               # 20 bài regression ban đầu
node edge.test.mjs          # 20 bài bổ sung: Unicode, nested list, mark, XML
node generate.mjs           # 8 file dưới samples/
python verify-formats.py    # DOCX ZIP/XML, CSV parser, Markdown Pandoc nếu có
```

Kiểm thử trình duyệt Chromium thật (tùy chọn, yêu cầu Python Playwright và Chromium):

```sh
python -m pip install playwright
python -m playwright install chromium
python browser-smoke.py     # 8 lần tải Blob + 1 lỗi đầu vào, shim trong bộ nhớ
```

Chạy giao diện demo trực tiếp bằng trình duyệt hỗ trợ module ES và localhost:

```sh
python -m http.server 8000
# Mở http://127.0.0.1:8000/index.html, chọn 2 chế độ và tải từng định dạng.
```

**Phân biệt kiểm thử:** `browser-smoke.py` dùng Chromium thực nhưng thay import và fetch fixture bằng shim trong `about:blank`. Nó xác nhận download Blob, byte-for-byte với Node, **không chứng minh** HTTP origin, Service Worker hay download trên Windows. Máy hiện hành chặn Chromium mở localhost/file/data qua chính sách quản trị, nên bài HTTP-origin là `NOT_RUN`.

## Hợp đồng sử dụng

```js
import {exportAll, exportDOCX, exportTXT, exportMarkdown, exportCSV, mime} from './exporter.mjs';
const input = {document: noteDocument, title: 'Họp điều hành', includeTimestamps: true};
const outputs = exportAll(input);  // txt/md/csv: string; docx: Uint8Array
```

`document` nhận NoteDocument `{noteDocumentId,revision,schemaVersion,content:{type:'doc',content:[...]}}` hoặc ProseMirror `{type:'doc',content:[...]}`. Exporter **chỉ đọc** tài liệu; mọi trạng thái âm thanh được suy ra từ manifest sau này ở tầng ứng dụng, không ghi vào Mark.

- **DOCX:** Office Open XML/ZIP thật; tiếng Việt, heading, bold, italic, heading outline, danh sách gạch đầu dòng/đánh số dạng *Word numbering*, hard break và dòng trống. Mốc trong bản có mốc hiển thị màu xám, không chứa chức năng nhấp để phát âm thanh.
- **TXT:** chữ gốc, dấu xuống dòng/danh sách và nhãn mốc theo lựa chọn; không thể giữ đậm/nghiêng.
- **Markdown:** heading, bold/italic đồng thời, escaping ký tự dán, hard break, danh sách lồng nhau GFM; mốc là chuỗi literal được escape để không biến thành cú pháp Markdown.
- **CSV:** UTF-8 BOM, CRLF, quoted field và quote-double, một hàng cho mỗi text run. Các cột cơ bản: `meetingTitle,blockIndex,blockType,headingLevel,listType,text`; nếu bật mốc, có thêm `anchorId,recordingId,audioOffsetMs,typedAt,source,linked`. `audioOffsetMs` là ms media **gốc**, không áp dụng pre-roll. `linked` chỉ nói Mark chứa recordingId+offset hợp lệ, **không** khẳng định media đã ghi/đã flush.
- **Unlinked:** bản kèm mốc ghi `[không liên kết âm thanh]` cho vùng chưa có vị trí media; không tạo mốc âm thanh giả. Bản sạch không thêm nhãn/mốc.

## Bằng chứng, giới hạn, bàn giao

Xem `evidence/QA_20261115.md` và checkpoint tại `docs/workstreams/2026-11-15/checkpoints/08-export.md` để biết SHA, lệnh chạy, PASS/NOT_RUN và môi trường.

PoC dùng OOXML writer tự chứa (không dùng thư viện `docx.js` dù là ứng viên trong TECHNICAL_OPTIONS); Word trên Windows và Chrome/Edge trên Windows vẫn `NOT_RUN`. Bản TXT/DOCX/CSV/Markdown **không** thay được backup `.mochop` chứa âm thanh và Mark gốc. Chưa kiểm tài liệu rất lớn, công thức CSV từ nguồn không tin cậy cần chính sách bảo vệ spreadsheet khi tích hợp, chưa nối IndexedDB, UI chính, tên file theo cuộc họp và API `readNoteDocument` của sản phẩm. Không được coi PoC PASS là nghiệm thu ứng dụng tích hợp.
