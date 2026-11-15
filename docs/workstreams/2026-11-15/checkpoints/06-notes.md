# Checkpoint · 06-notes

- Chủ sở hữu: 06-notes (một writer trên nhánh riêng)
- Nhánh: `gemini/20261115-06-notes`
- Baseline: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- HEAD kiểm tra lúc tiếp quản: `7a1939b58405c4e1706b235593d9e05d38f08da4` (ahead baseline 1 commit, chỉ có checkpoint ban đầu)
- Trạng thái: IN_PROGRESS
- Code SHA: — · Tested SHA: —
- Kiểm thử: NOT_RUN · Môi trường/run: chưa chạy

Entrypoint: [06-notes](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/06-notes.md) · [Hợp đồng đóng băng](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md)

Đích cuối: PoC độc lập quản lý/tìm kiếm cuộc họp, autosave IndexedDB chỉ xác nhận sau commit, mở lại tài liệu còn nguyên ProseMirror JSON/timeSpan.

## Đã làm
- Đọc entrypoint, COMMON, AGENTS, PLAN, ARCHITECTURE, ACCEPTANCE_TESTS và STATUS baseline.
- Kiểm nhánh so baseline; chưa có code `poc/06-notes/`, không kế thừa PASS.
- Đặt ranh giới: data/fixture/lease giả trong luồng này; không sửa code của 01, 03, 07, 09.

## Đang thực hiện
1. Triển khai IndexedDB Meeting, NoteDocument, EditJournal, migration và audio-reference mock adapter.
2. Tự lưu có expectedRevision và ACK transaction, lease interface, lỗi ghi/xung đột.
3. Demo tạo/mở/đổi tên/xóa/tìm văn bản Việt và điều hướng; test tự động TC29 và phần text TC35.
4. Chạy test từ module độc lập, ghi log và số liệu unconfirmed window; kiểm diff, commit.

## Còn thiếu
- Toàn bộ code, run và evidence; chưa xác nhận TC29/TC35.
- Kiểm trình duyệt Windows/Chrome/Edge thật và tích hợp với các luồng khác (ngoài phạm vi bàn giao PoC độc lập).

WIP/chưa push: code chưa viết · Chặn bên ngoài: không có đối với fixture/kiểm thử độc lập.
