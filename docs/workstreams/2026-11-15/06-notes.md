# 06-notes · Cuộc họp, tìm kiếm và tự lưu văn bản

Bạn là chat Gemini **Cuộc họp, tìm kiếm và tự lưu văn bản** của [Mốc Họp](https://github.com/cavoixanh638/Bien-ban-hop). Thực hiện Phần dữ liệu văn bản của Gói 1.5.

- Nhánh làm việc: [gemini/20261115-06-notes](https://github.com/cavoixanh638/Bien-ban-hop/tree/gemini/20261115-06-notes).
- Baseline chung: [6142f56a6efdb27aa9445920c9321f7930c0d5fd](https://github.com/cavoixanh638/Bien-ban-hop/commit/6142f56a6efdb27aa9445920c9321f7930c0d5fd).
- [Checkpoint hiện hành](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-06-notes/docs/workstreams/2026-11-15/checkpoints/06-notes.md) · [Quy ước chung và hợp đồng fixture](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md) · [Mục lục](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/README.md).
- Chỉ ghi `poc/06-notes/` và `docs/workstreams/2026-11-15/checkpoints/06-notes.md` trên nhánh của mình.
- Tài liệu của repo: [docs/PLAN_V1_2.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/PLAN_V1_2.md) · [docs/ARCHITECTURE.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/ARCHITECTURE.md) · [docs/ACCEPTANCE_TESTS.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/ACCEPTANCE_TESTS.md).

## Kết quả người dùng nhận

Một module quản lý và tìm cuộc họp, có autosave IndexedDB xác nhận revision và khôi phục được tài liệu sau mở lại.

## Bắt đầu và tiếp tục

Đọc checkpoint và quy ước, kiểm HEAD/diff và phiên đang chạy. Tự chuẩn bị fixture/adapter kể từ lượt đầu. Dùng checkout và lệnh chạy của nhánh này để hoàn tất; mọi đầu ra cần để build và test phải có ngay trong phạm vi được sở hữu hoặc là công cụ công khai có thể cài độc lập. Khi thay chat, chỉ một writer tiếp tục từ HEAD và checkpoint hiện hành.

## Phạm vi

- Làm kho Meeting, NoteDocument, revision và EditJournal, demo tạo/đổi tên/mở/xóa, tìm toàn văn và điều hướng kết quả. Dùng JSON ProseMirror có `timeSpan` tổng hợp; dữ liệu đi qua round-trip nguyên vẹn. Xóa cuộc họp tôn trọng tham chiếu audio qua adapter giả.
- Định nghĩa interface writer lease để dùng mock lease tách khỏi khóa đa tab thật của 09. Test snapshot/journal, xác nhận chỉ sau transaction thành công, xung đột revision, mở lại, lược bỏ commit chưa xác nhận, lỗi quota/index và fixture schema cũ. Lưu âm thanh thuộc 03; khôi phục cả gói thuộc 07.

## Điều kiện hoàn tất

- Bài TC29 và phần dữ liệu văn bản của TC35. Đối chiếu kết quả tìm và round-trip text/marks/dấu tiếng Việt, phiên bản cũ, crash và write-fail. Đo cửa sổ dữ liệu chưa xác nhận lưu để đánh giá mục tiêu khoảng 2 giây.

## Bàn giao

Kho IndexedDB đọc/ghi, demo quản lý/tìm kiếm, fixture migrations, contract lease và kết quả test. Ghi link/revision, trạng thái và điều còn thiếu vào checkpoint của chính nhánh, push sau khi xem diff. Khi đang làm, cập nhật checkpoint theo [quy ước chung](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md).
