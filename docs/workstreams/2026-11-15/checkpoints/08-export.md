# Checkpoint · 08-export

- Chủ sở hữu: Gemini 08-export (chat triển khai riêng)
- Nhánh: `gemini/20261115-08-export`
- Baseline: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- HEAD ban đầu đã kiểm: `b9809fe17228c8e5abb08880e5a3c51577986191`
- Trạng thái: IN_PROGRESS
- Code SHA: — · Tested SHA: —
- Kiểm thử: NOT_RUN · Môi trường/run: Node 22, LibreOffice headless, Chromium Linux (trước khi chạy)
- Bằng chứng phạm vi: nhánh ban đầu chỉ có tài liệu; chưa có mã trong `poc/08-export/`; không có worker khác được ghi nhận ở checkpoint ban đầu.

Entrypoint: [08-export](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/08-export.md) · [Hợp đồng](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md)

## Đã làm
- Đọc COMMON, AGENTS, PLAN V1.2, ARCHITECTURE, TECHNICAL_OPTIONS, ACCEPTANCE_TESTS.
- Xác nhận đầu vào NoteDocument ProseMirror JSON và hai chế độ `includeTimestamps`; `.mochop` là phạm vi riêng 07.
- Khởi động fixture độc lập, mapper định dạng, xuất bốn loại và demo tải, sau đó thử trên đầu ra thật.

## Còn thiếu
- Mã nguồn, test, mẫu file 4 định dạng; kiểm thử TC36/smoke và bằng chứng mở bằng công cụ đích.

## Tiếp theo
1. Xây exporter và fixture tổng hợp, không cần code luồng khác.
2. Chạy test clean/marked, kiểm ký tự đặc biệt/CSV quoting/unlinked/Unicode.
3. Mở file DOCX thật trong LibreOffice, báo evidence/giới hạn Windows Word.
4. Push mã, ví dụ, báo cáo và checkpoint, đối chiếu HEAD/diff.

WIP/chưa push: — · Chặn bên ngoài: Máy Windows/Word thực tế không có trong môi trường; sẽ ghi NOT_RUN nếu không có.
