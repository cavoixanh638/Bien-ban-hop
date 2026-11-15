# 03-opfs · Ghi OPFS, checkpoint và khôi phục audio

Bạn là chat Gemini **Ghi OPFS, checkpoint và khôi phục audio** của [Mốc Họp](https://github.com/cavoixanh638/Bien-ban-hop). Thực hiện Phần durability của Gói 1.2, PoC B.

- Nhánh làm việc: [gemini/20261115-03-opfs](https://github.com/cavoixanh638/Bien-ban-hop/tree/gemini/20261115-03-opfs).
- Baseline chung: [6142f56a6efdb27aa9445920c9321f7930c0d5fd](https://github.com/cavoixanh638/Bien-ban-hop/commit/6142f56a6efdb27aa9445920c9321f7930c0d5fd).
- [Checkpoint hiện hành](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-03-opfs/docs/workstreams/2026-11-15/checkpoints/03-opfs.md) · [Quy ước chung và hợp đồng fixture](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md) · [Mục lục](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/README.md).
- Chỉ ghi `poc/03-opfs/` và `docs/workstreams/2026-11-15/checkpoints/03-opfs.md` trên nhánh của mình.
- Tài liệu của repo: [docs/AUDIO_DESIGN.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/AUDIO_DESIGN.md) · [docs/ARCHITECTURE.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/ARCHITECTURE.md) · [docs/ACCEPTANCE_TESTS.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/ACCEPTANCE_TESTS.md).

## Kết quả người dùng nhận

Worker ghi OPFS và bộ đối chiếu file/manifest có thể phục hồi phần đã xác nhận lưu sau các lỗi giả lập.

## Bắt đầu và tiếp tục

Đọc checkpoint và quy ước, kiểm HEAD/diff và phiên đang chạy. Tự chuẩn bị fixture/adapter kể từ lượt đầu. Dùng checkout và lệnh chạy của nhánh này để hoàn tất; mọi đầu ra cần để build và test phải có ngay trong phạm vi được sở hữu hoặc là công cụ công khai có thể cài độc lập. Khi thay chat, chỉ một writer tiếp tục từ HEAD và checkpoint hiện hành.

## Phạm vi

- Sinh stream PCM deterministic theo COMMON.md. Worker nhận chunk và ghi OPFS, duy trì checkpoint/header/byte length/sample count. Duy trì manifest journal riêng cho audio, xác nhận durable coverage sau flush và cập nhật/đối chiếu theo thứ tự; test crash giữa hai bước OPFS/IndexedDB.
- Thử file dở, header/kích thước sai, mất/trùng sequence, lỗi Worker và thiếu quota. Dữ liệu đủ hợp lệ được giữ, thiếu thì biểu diễn interval/reason. Meeting/NoteDocument và kho ZIP nằm ở luồng khác.

## Điều kiện hoàn tất

- Chứng minh đọc/seek phần hợp lệ từ bộ dữ liệu tổng hợp tương đương ba giờ, đo write/flush và peak memory. Kiểm crash trước/sau flush, checkpoint dở, mất file, byte thừa, hết dung lượng và mở lại. Dẫn log của committed coverage và phần bị mất để đánh giá mục tiêu khoảng 10 giây chưa xác nhận lưu.

## Bàn giao

Worker + test deterministic, layout file/manifest metadata, checkpoint và reconcile report có committed sample/byte ranges. Ghi link/revision, trạng thái và điều còn thiếu vào checkpoint của chính nhánh, push sau khi xem diff. Khi đang làm, cập nhật checkpoint theo [quy ước chung](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md).
