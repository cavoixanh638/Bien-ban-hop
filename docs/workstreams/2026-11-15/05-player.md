# 05-player · Phát nhiều đoạn và nghe chậm

Bạn là chat Gemini **Phát nhiều đoạn và nghe chậm** của [Mốc Họp](https://github.com/cavoixanh638/Bien-ban-hop). Thực hiện Gói 1.4, PoC C.

- Nhánh làm việc: [gemini/20261115-05-player](https://github.com/cavoixanh638/Bien-ban-hop/tree/gemini/20261115-05-player).
- Baseline chung: [6142f56a6efdb27aa9445920c9321f7930c0d5fd](https://github.com/cavoixanh638/Bien-ban-hop/commit/6142f56a6efdb27aa9445920c9321f7930c0d5fd).
- [Checkpoint hiện hành](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-05-player/docs/workstreams/2026-11-15/checkpoints/05-player.md) · [Quy ước chung và hợp đồng fixture](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md) · [Mục lục](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/README.md).
- Chỉ ghi `poc/05-player/` và `docs/workstreams/2026-11-15/checkpoints/05-player.md` trên nhánh của mình.
- Tài liệu của repo: [docs/AUDIO_DESIGN.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/AUDIO_DESIGN.md) · [docs/TIMELINE_RULES.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/TIMELINE_RULES.md) · [docs/TECHNICAL_OPTIONS.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/TECHNICAL_OPTIONS.md) · [docs/ACCEPTANCE_TESTS.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/ACCEPTANCE_TESTS.md).

## Kết quả người dùng nhận

Hai player PoC và quyết định có bằng chứng về khả năng tua, nghe chậm và phát nối đoạn trên một timeline.

## Bắt đầu và tiếp tục

Đọc checkpoint và quy ước, kiểm HEAD/diff và phiên đang chạy. Tự chuẩn bị fixture/adapter kể từ lượt đầu. Dùng checkout và lệnh chạy của nhánh này để hoàn tất; mọi đầu ra cần để build và test phải có ngay trong phạm vi được sở hữu hoặc là công cụ công khai có thể cài độc lập. Khi thay chat, chỉ một writer tiếp tục từ HEAD và checkpoint hiện hành.

## Phạm vi

- Thử C1 hai HTMLAudioElement đệm trước, dùng preservesPitch, và C2 Web Audio với các cửa sổ PCM nhỏ đã lập lịch. Đọc resolver fixture và cung cấp một playback UI riêng gồm play/pause, seek, 0,5–2× và A–B; nhận yêu cầu phát tại anchor, giữ nguyên mốc khi thử pre-roll.
- Dùng audio tổng hợp/được phép, so sánh trên cùng fixture. Đo biên nguyên bản; tránh crossfade vô điều kiện, tránh load/decode cả bản ghi dài, giải phóng buffer và Blob URL. Bao gồm trạng thái thiếu audio và keyboard/cursor trigger bằng fixture.

## Điều kiện hoàn tất

- Đo biên 04:58→05:02, seek phút 90/170, A–B qua biên, gap/missing, peak RAM, độ trễ seek và giọng ở 0,75×/0,9×. Kiểm click thường đặt con trỏ và thao tác nghe tách riêng trên demo có editor giả lập. Kiểm xung đột với editor chính và bộ gõ khi ráp bản ứng dụng.

## Bàn giao

Hai PoC C1/C2, phiên bản trình duyệt, fixture, report gap/drop/lặp/cao độ/RAM và adapter playback được đề xuất. Ghi link/revision, trạng thái và điều còn thiếu vào checkpoint của chính nhánh, push sau khi xem diff. Khi đang làm, cập nhật checkpoint theo [quy ước chung](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md).
