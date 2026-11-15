# 08-export · Xuất DOCX, TXT, Markdown và CSV

Bạn là chat Gemini **Xuất DOCX, TXT, Markdown và CSV** của [Mốc Họp](https://github.com/cavoixanh638/Bien-ban-hop). Thực hiện Phần công cụ xuất của Gói 1.5.

- Nhánh làm việc: [gemini/20261115-08-export](https://github.com/cavoixanh638/Bien-ban-hop/tree/gemini/20261115-08-export).
- Baseline chung: [6142f56a6efdb27aa9445920c9321f7930c0d5fd](https://github.com/cavoixanh638/Bien-ban-hop/commit/6142f56a6efdb27aa9445920c9321f7930c0d5fd).
- [Checkpoint hiện hành](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-08-export/docs/workstreams/2026-11-15/checkpoints/08-export.md) · [Quy ước chung và hợp đồng fixture](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md) · [Mục lục](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/README.md).
- Chỉ ghi `poc/08-export/` và `docs/workstreams/2026-11-15/checkpoints/08-export.md` trên nhánh của mình.
- Tài liệu của repo: [docs/PLAN_V1_2.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/PLAN_V1_2.md) · [docs/ARCHITECTURE.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/ARCHITECTURE.md) · [docs/TECHNICAL_OPTIONS.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/TECHNICAL_OPTIONS.md) · [docs/ACCEPTANCE_TESTS.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/ACCEPTANCE_TESTS.md).

## Kết quả người dùng nhận

Bốn định dạng xuất đọc được bằng công cụ đích, có bản sạch và bản kèm mốc theo phạm vi V1.2.

## Bắt đầu và tiếp tục

Đọc checkpoint và quy ước, kiểm HEAD/diff và phiên đang chạy. Tự chuẩn bị fixture/adapter kể từ lượt đầu. Dùng checkout và lệnh chạy của nhánh này để hoàn tất; mọi đầu ra cần để build và test phải có ngay trong phạm vi được sở hữu hoặc là công cụ công khai có thể cài độc lập. Khi thay chat, chỉ một writer tiếp tục từ HEAD và checkpoint hiện hành.

## Phạm vi

- Đầu vào NoteDocument JSON, tiêu đề cuộc họp, phần text/marks và lựa chọn xuất. Viết exporter và demo tải bốn định dạng, hỗ trợ chữ Việt, heading, bold/italic, danh sách, dòng trống, đánh dấu mốc theo tùy chọn. Dùng docx.js như ứng viên, thử tài liệu mở bằng ứng dụng đích.
- Chỉ đọc Mark và dữ liệu fixture. So sánh kiểu mốc/trường CSV với kế hoạch, kiểm quoting/dòng mới, nội dung dán có ký tự đặc biệt, vùng không liên kết và tiếng Việt. `.mochop` là miền 07.

## Điều kiện hoàn tất

- TC36 và smoke test TXT/Markdown/CSV. Mở DOCX thật nếu môi trường có Word/ứng dụng đọc DOCX, đối chiếu tiếng Việt/định dạng. Kiểm hai chế độ xuất trên cùng fixture, lập danh sách tính năng cấp ứng dụng còn cần tích hợp.

## Bàn giao

Exporter, file mẫu tổng hợp cho cả bốn định dạng, lệnh chạy/test, kết quả mở/đối chiếu, giới hạn môi trường quan sát. Ghi link/revision, trạng thái và điều còn thiếu vào checkpoint của chính nhánh, push sau khi xem diff. Khi đang làm, cập nhật checkpoint theo [quy ước chung](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md).
