# Checkpoint · 08-export

- Chủ sở hữu: Gemini 08-export
- Nhánh: `gemini/20261115-08-export`
- Baseline: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- Code HEAD được kiểm diff: `1ccf8860819c45f7e72e4474ef87aeda9d428f5f`
- Trạng thái: **IN_PROGRESS — code đã push, còn kiểm chứng lại đúng SHA**
- Tested SHA Git: **NOT_RUN** (không coi run cục bộ thuộc một commit khác là đã test Git HEAD)
- Môi trường bản cục bộ: Linux, Node 22.16.0, Python 3.13.5, LibreOffice headless
- Fixture: ProseMirror NoteDocument, tiếng Việt tổng hợp, không có audio họp thật

## Đã bàn giao trên GitHub

- [Exporter](../../../../poc/08-export/exporter.mjs): DOCX dạng OOXML ZIP, TXT, Markdown, CSV; 2 chế độ `includeTimestamps`.
- [Fixture](../../../../poc/08-export/fixture.json): heading, bold/italic, list, dòng trống, Unicode, dấu đặc biệt, linked/unlinked.
- [Test](../../../../poc/08-export/test.mjs): 20 tình huống; [generate](../../../../poc/08-export/generate.mjs) tạo 8 mẫu; [demo](../../../../poc/08-export/index.html) tải 4 loại; [README](../../../../poc/08-export/README.md) gồm lệnh/adapter/giới hạn.
- So diff baseline → HEAD: chỉ thay đổi `poc/08-export/` và checkpoint của luồng, không sửa file luồng khác.
- Các file mẫu 8 đầu ra đã được sinh/đóng gói trong bản PoC cục bộ cho người dùng; trên Git có `generate.mjs` để tái tạo chứ không commit binary DOCX.

## Bằng chứng đã chạy (bản cục bộ trước khi biên tập để push)

- `node test.mjs`: **PASS 20/20** với fixture tổng hợp (Unicode/quoting/CRLF/linked/unlinked/modes/ZIP).
- Python zipfile + lxml kiểm 2 DOCX: **PASS**, nội dung và tiếng Việt khớp.
- LibreOffice headless render DOCX có mốc: **PASS** một trang, đã kiểm ảnh hiển thị, không thấy thiếu dấu/tràn nội dung.
- **Code trên GitHub được biên tập khi chuyển lên:** không được phép coi PASS trên bản cục bộ là PASS của commit `1ccf886`; cần test lại từ clean checkout.
- Microsoft Word trên Windows: **NOT_RUN**; Chrome/Edge thật để xác nhận 4 lần download: **NOT_RUN**. TC36 tích hợp: **NOT_RUN**.

## Giới hạn và quyết định

- PoC dùng ZIP/OOXML tự chứa, không phải docx.js vì môi trường runtime hiện không tải được npm; đây là ứng viên PoC, chưa quyết định engine production.
- CSV là bản theo từng text run, có các cột mốc gốc; `linked` chỉ có tọa độ Mark hợp lệ, không đồng nghĩa audio đã committed/phát được.
- Bản kèm mốc in `[không liên kết âm thanh]` cho vùng unlinked; không suy diễn trạng thái manifest.
- DOCX dùng bullet/ordered bằng prefix text; chưa dùng semantic Word numbering.
- Word/DOCX không thay .mochop và không thể click nghe lại.

## Tiếp theo

1. Clone đúng `gemini/20261115-08-export`, chạy `cd poc/08-export && node test.mjs && node generate.mjs`; lưu run log và tested SHA.
2. Kiểm DOCX vừa sinh bằng Word/LibreOffice và CSV bằng bảng tính thực; test demo Chrome/Edge.
3. Đưa kết quả/giới hạn còn thiếu vào checkpoint, rồi giao tổng chỉ huy nối `readNoteDocument`, UI lựa chọn, tên file an toàn và test tích hợp.

WIP chưa push: không; đã commit source/fixture/test/demo. Chưa merge, chưa DONE.
