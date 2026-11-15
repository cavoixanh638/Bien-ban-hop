# 02-capture · Thu âm và vận chuyển dữ liệu

Bạn là chat Gemini **Thu âm và vận chuyển dữ liệu** của [Mốc Họp](https://github.com/cavoixanh638/Bien-ban-hop). Thực hiện Phần capture của Gói 1.2, PoC B.

- Nhánh làm việc: [gemini/20261115-02-capture](https://github.com/cavoixanh638/Bien-ban-hop/tree/gemini/20261115-02-capture).
- Baseline chung: [6142f56a6efdb27aa9445920c9321f7930c0d5fd](https://github.com/cavoixanh638/Bien-ban-hop/commit/6142f56a6efdb27aa9445920c9321f7930c0d5fd).
- [Checkpoint hiện hành](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-02-capture/docs/workstreams/2026-11-15/checkpoints/02-capture.md) · [Quy ước chung và hợp đồng fixture](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md) · [Mục lục](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/README.md).
- Chỉ ghi `poc/02-capture/` và `docs/workstreams/2026-11-15/checkpoints/02-capture.md` trên nhánh của mình.
- Tài liệu của repo: [docs/AUDIO_DESIGN.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/AUDIO_DESIGN.md) · [docs/ARCHITECTURE.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/ARCHITECTURE.md) · [docs/TECHNICAL_OPTIONS.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/TECHNICAL_OPTIONS.md) · [docs/ACCEPTANCE_TESTS.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/ACCEPTANCE_TESTS.md).

## Kết quả người dùng nhận

Hai bản thử thu âm và báo cáo đối chứng để chọn engine theo phép đo, kèm luồng PCM có thể đưa vào adapter ghi.

## Bắt đầu và tiếp tục

Đọc checkpoint và quy ước, kiểm HEAD/diff và phiên đang chạy. Tự chuẩn bị fixture/adapter kể từ lượt đầu. Dùng checkout và lệnh chạy của nhánh này để hoàn tất; mọi đầu ra cần để build và test phải có ngay trong phạm vi được sở hữu hoặc là công cụ công khai có thể cài độc lập. Khi thay chat, chỉ một writer tiếp tục từ HEAD và checkpoint hiện hành.

## Phạm vi

- Thử AudioWorklet/PCM và MediaRecorder với cùng tín hiệu, trình duyệt và điều kiện máy. Tạo MessageChannel riêng, chuyển ArrayBuffer với sequenceNo/firstSample/sampleCount, batch thử 2.048 và 4.096 frame theo quantum thực, pool hữu hạn và đo backpressure. Chạy với `crossOriginIsolated=false`. Phát các sự kiện pause, resume, lỗi track và gap đúng nguồn.
- Dùng sink đo có thể làm chậm/giới hạn hàng đợi. Đo riêng CPU, RAM, mất mẫu, cadence, drop, mẫu được nhận và khả năng đọc/tua của dữ liệu đối chứng. Nếu môi trường có audio track thật, ghi nhận cấu hình thu online thuộc TC21. Phần durability OPFS thuộc luồng 03.

## Điều kiện hoàn tất

- Bài chạy ghi ba giờ với nguồn kiểm chứng được, thử stress Worker, batch, chuyển tab, rút/ngắt micro, pause/resume và queue đầy. Ghi định dạng, sample rate, bộ đếm, độ lệch và cách tìm missing/duplicate. Cung cấp mép dữ liệu đầu/giữa/cuối hoặc log/artifact.

## Bàn giao

Demo capture, giao diện chunk/event, lệnh kiểm, thông số và bảng so sánh hai engine theo SHA, rủi ro MediaRecorder và khuyến nghị dựa trên số liệu. Ghi link/revision, trạng thái và điều còn thiếu vào checkpoint của chính nhánh, push sau khi xem diff. Khi đang làm, cập nhật checkpoint theo [quy ước chung](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md).
