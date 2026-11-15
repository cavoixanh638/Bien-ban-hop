# Checkpoint · 08-export

- Chủ sở hữu: Gemini 08-export
- Nhánh: `gemini/20261115-08-export`
- Baseline: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- HEAD ban đầu: `b9809fe17228c8e5abb08880e5a3c51577986191`
- Trạng thái: IN_PROGRESS — LOCAL_ONLY (chưa push mã nguồn)
- Code SHA: LOCAL_ONLY; Tested SHA: LOCAL_ONLY, không phải SHA Git
- Môi trường: Node.js 22.16.0 Linux, Python 3.13.5, LibreOffice headless
- Fixture: `fixture.json`, dữ liệu tiếng Việt tổng hợp; không chứa audio họp thật

## Đã làm (trong workspace cục bộ)

- Đọc COMMON, AGENTS, PLAN V1.2, ARCHITECTURE, TECHNICAL_OPTIONS, ACCEPTANCE_TESTS.
- Xây PoC độc lập gồm `exporter.mjs` (DOCX/WordprocessingML ZIP, TXT, Markdown, CSV), `index.html` (demo tải 4 định dạng), `fixture.json`, `generate.mjs`, `test.mjs`, `README.md`.
- Sinh đủ 8 file mẫu: sạch và kèm mốc cho cả bốn định dạng.
- Node `node test.mjs`: PASS 20/20 (fixture tổng hợp, Unicode, escaping, CSV quoting/CRLF, mark/unlinked, deterministic và input không bị sửa).
- Python `zipfile.testzip()` + lxml: PASS cả 2 DOCX mẫu, đúng tiếng Việt và nội dung.
- LibreOffice mở/render DOCX có mốc thành PDF/PNG một trang: PASS kiểm tra trực quan, không thấy lỗi clipping hay thiếu dấu.
- Microsoft Word trên Windows: NOT_RUN. Browser thật Chrome/Edge tải bằng UI: NOT_RUN.
- Khác với docx.js ứng viên, PoC dùng mã OOXML tự chứa (không cần npm) để vượt qua giới hạn không tải được thư viện trong môi trường chạy; chưa kết luận thư viện production.

## Chưa hoàn tất

- **Chưa push source `poc/08-export/` lên GitHub.** Toàn bộ code và fixture chỉ nằm ở workspace cục bộ, được đóng gói thành `/mnt/data/08-export-poc.zip` cho người dùng.
- Không ghi DONE/READY_FOR_REVIEW khi repo chưa chứa source; chưa có Git code SHA hay verified clean checkout.
- Chưa có chứng cứ Microsoft Word Windows và Chrome/Edge thực tế.

## Tiếp theo

1. Đưa đầy đủ nguồn/fixture/mẫu từ ZIP vào `poc/08-export/` trên nhánh này (không đụng luồng khác).
2. Kiểm diff, commit và chạy lại `node poc/08-export/test.mjs` từ checkout sạch; cập nhật tested SHA/checkpoint.
3. Chạy TC36 trên Windows Word và kiểm thử download trên Chrome/Edge thật, ghi PASS/FAIL/NOT_RUN chính xác.
4. Giao tổng chỉ huy adapter `readNoteDocument`, tên cuộc họp, lựa chọn kèm mốc, tải file và kiểm thử tích hợp.

WIP/chưa push: source LOCAL_ONLY; nhánh checkpoint đã push. Không có dữ liệu nhạy cảm.
