# PoC 08-export · Mốc Họp V1.2

Standalone exporter trên ProseMirror NoteDocument JSON. Sinh DOCX WordprocessingML thực, TXT, Markdown, CSV. Không phụ thuộc code từ worker khác và không làm .mochop của worker 07.

## Lệnh chạy

```sh
cd poc/08-export
node test.mjs
node generate.mjs
python -m http.server 8000
# Mở http://localhost:8000 để dùng demo tải bốn định dạng
```

Node >=18; không cần npm install. Sinh đủ 8 mẫu `samples/meeting-{clean,with-marks}.{docx,txt,md,csv}`. File nguồn được sinh và dùng độc lập.

## Hợp đồng và giới hạn

```js
import {exportAll} from './exporter.mjs';
const files=exportAll({document:noteDocument,title:'Tên cuộc họp',includeTimestamps:true});
```

- TXT: mỗi block trên một dòng, giữ dòng trống/hardbreak và danh sách.
- Markdown: heading, bold, italic, danh sách; escape văn bản có ký tự đặc biệt.
- CSV: UTF-8 BOM, CRLF, mọi ô quoted/double-quote escape; mỗi text run một dòng. Cột mặc định `meetingTitle,blockIndex,blockType,headingLevel,listType,text`; khi có mốc thêm `anchorId,recordingId,audioOffsetMs,typedAt,source,linked`. Giữ raw offset (ms); `linked` chỉ xác định Mark có tọa độ hợp lệ, **không** xác nhận audio đã được lưu hay phát được.
- DOCX: OOXML ZIP/STORE (không phải HTML đổi đuôi), heading, bold/italic, danh sách với prefix in ra, Unicode và hardbreak. DOCX không có chức năng phát audio khi click. Các danh sách là văn bản prefix, chưa dùng Word numbering semantic.
- `[không liên kết âm thanh]` trong bản kèm mốc không tự gán giờ âm thanh giả. Bản sạch không chứa metadata mốc. Văn bản xuất không thay được backup .mochop.

## Kiểm chứng và bàn giao

Bản gốc workspace cục bộ đạt Node 20/20, ZIP/XML cả hai DOCX, LibreOffice render 1 trang với tiếng Việt. **Code đã được chuyển/biên tập lên GitHub cần chạy lại kiểm thử tại đúng commit này** trước khi ghi PASS tương ứng trên checkpoint. Word Windows và Chrome/Edge thật: NOT_RUN, còn cần chạy TC36 tích hợp. Xem checkpoint của nhánh để biết tested SHA chính thức.

Tích hợp cần dây nối readMeeting/readNoteDocument, UI lựa chọn định dạng & chế độ, safe filenames, large-note tests, mở Word thật, browser downloads, và quyết định có chuyển sang thư viện docx.js hay giữ OOXML tự chứa.
