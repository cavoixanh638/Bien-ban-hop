# 07-backup · Sao lưu và khôi phục .mochop

Bạn là chat Gemini **Sao lưu và khôi phục .mochop** của [Mốc Họp](https://github.com/cavoixanh638/Bien-ban-hop). Thực hiện Phần backup của Gói 1.5, PoC D.

- Nhánh làm việc: [gemini/20261115-07-backup](https://github.com/cavoixanh638/Bien-ban-hop/tree/gemini/20261115-07-backup).
- Baseline chung: [6142f56a6efdb27aa9445920c9321f7930c0d5fd](https://github.com/cavoixanh638/Bien-ban-hop/commit/6142f56a6efdb27aa9445920c9321f7930c0d5fd).
- [Checkpoint hiện hành](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-07-backup/docs/workstreams/2026-11-15/checkpoints/07-backup.md) · [Quy ước chung và hợp đồng fixture](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md) · [Mục lục](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/README.md).
- Chỉ ghi `poc/07-backup/` và `docs/workstreams/2026-11-15/checkpoints/07-backup.md` trên nhánh của mình.
- Tài liệu của repo: [docs/ARCHITECTURE.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/ARCHITECTURE.md) · [docs/TECHNICAL_OPTIONS.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/TECHNICAL_OPTIONS.md) · [docs/ACCEPTANCE_TESTS.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/ACCEPTANCE_TESTS.md).

## Kết quả người dùng nhận

Pipeline thử nghiệm xuất/nhập .mochop và báo cáo chọn thư viện ZIP có thể chứng minh bằng dữ liệu lớn.

## Bắt đầu và tiếp tục

Đọc checkpoint và quy ước, kiểm HEAD/diff và phiên đang chạy. Tự chuẩn bị fixture/adapter kể từ lượt đầu. Dùng checkout và lệnh chạy của nhánh này để hoàn tất; mọi đầu ra cần để build và test phải có ngay trong phạm vi được sở hữu hoặc là công cụ công khai có thể cài độc lập. Khi thay chat, chỉ một writer tiếp tục từ HEAD và checkpoint hiện hành.

## Phạm vi

- Dùng repo Meeting/NoteDocument và audio nguồn do fixtures cung cấp, export ZIP có schema/version, paths, checksum, timeSpan và audio manifest. So sánh fflate, client-zip và zip.js về vai trò thực tế ở chiều xuất và chiều nhập. Import xác minh vào staging rồi publish bằng adapter giả lập.
- Thử streaming/random-access, backpressure, kiểm chứng ZIP64, peak RAM, thiếu file, checksum sai, schema, path traversal, ZIP bomb, collision và rollback staging. Khôi phục hợp lệ giữ mốc; audio thiếu biểu diễn missing mà vẫn giữ văn bản khi tình huống đó được chấp nhận theo TC38.

## Điều kiện hoàn tất

- TC30, TC31, TC38 bằng fixture 0,5 GB và 2 GB. Đo peak RAM và tốc độ cả hai chiều ở môi trường ghi rõ, test round-trip từ môi trường khác, nhập hỏng/gián đoạn không gây ghi đè dữ liệu gốc. Fixture ZIP64 riêng nếu kích cỡ hoặc số entry của hai bộ trên chưa đủ kích hoạt ZIP64.

## Bàn giao

PoC và lệnh tạo fixture, format .mochop, bảng đo/khả năng của ba ứng viên, test rollback và đường dẫn bằng chứng. Ghi link/revision, trạng thái và điều còn thiếu vào checkpoint của chính nhánh, push sau khi xem diff. Khi đang làm, cập nhật checkpoint theo [quy ước chung](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md).
