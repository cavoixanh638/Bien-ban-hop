# 04-timeline · Timeline và ánh xạ mốc

Bạn là chat Gemini **Timeline và ánh xạ mốc** của [Mốc Họp](https://github.com/cavoixanh638/Bien-ban-hop). Thực hiện Gói 1.3, PoC bằng fixture.

- Nhánh làm việc: [gemini/20261115-04-timeline](https://github.com/cavoixanh638/Bien-ban-hop/tree/gemini/20261115-04-timeline).
- Baseline chung: [6142f56a6efdb27aa9445920c9321f7930c0d5fd](https://github.com/cavoixanh638/Bien-ban-hop/commit/6142f56a6efdb27aa9445920c9321f7930c0d5fd).
- [Checkpoint hiện hành](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-04-timeline/docs/workstreams/2026-11-15/checkpoints/04-timeline.md) · [Quy ước chung và hợp đồng fixture](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md) · [Mục lục](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/README.md).
- Chỉ ghi `poc/04-timeline/` và `docs/workstreams/2026-11-15/checkpoints/04-timeline.md` trên nhánh của mình.
- Tài liệu của repo: [docs/ARCHITECTURE.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/ARCHITECTURE.md) · [docs/TIMELINE_RULES.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/TIMELINE_RULES.md) · [docs/AUDIO_DESIGN.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/AUDIO_DESIGN.md) · [docs/ACCEPTANCE_TESTS.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/ACCEPTANCE_TESTS.md).

## Kết quả người dùng nhận

Thư viện TypeScript ánh xạ đồng hồ nhập, thời gian cuộc họp và media, có thể trả đúng segment/local offset hoặc trạng thái thiếu.

## Bắt đầu và tiếp tục

Đọc checkpoint và quy ước, kiểm HEAD/diff và phiên đang chạy. Tự chuẩn bị fixture/adapter kể từ lượt đầu. Dùng checkout và lệnh chạy của nhánh này để hoàn tất; mọi đầu ra cần để build và test phải có ngay trong phạm vi được sở hữu hoặc là công cụ công khai có thể cài độc lập. Khi thay chat, chỉ một writer tiếp tục từ HEAD và checkpoint hiện hành.

## Phạm vi

- Dùng fixture `recordingId`, điểm clock↔sample, intervals và segments. Cài mapping monotonic↔media, meeting↔media và resolver cho anchor. Hỗ trợ ghi live, file nhập đang phát/pause/seek, nhiều nguồn, pending, gap, missing, unsupported và unlinked với mốc gốc giữ nguyên.
- Thiết kế clock drift và timing theo số mẫu/metadata thực. Đầu ra resolver có đủ thông tin cho player theo contract, giữ lý do trạng thái. `preRollMs` chỉ phục vụ playback. Đo trên fixture tự sinh để hoàn tất luồng này; đo mapping với thiết bị live thuộc đợt tích hợp.

## Điều kiện hoàn tất

- Test biên đầu/cuối segment, pause/gap, đoạn hỏng, hai phiên/nguồn, file nhập seek rồi gõ, lệch đồng hồ, pending thành valid, và test sai nguồn. Đo sai lệch trên tín hiệu tổng hợp với mục tiêu ≤1 giây; nêu rõ cách lặp lại bài đo với record thật.

## Bàn giao

Thư viện thuần, resolver API, fixture và kết quả mapping với expected/actual theo SHA. Ghi link/revision, trạng thái và điều còn thiếu vào checkpoint của chính nhánh, push sau khi xem diff. Khi đang làm, cập nhật checkpoint theo [quy ước chung](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md).
