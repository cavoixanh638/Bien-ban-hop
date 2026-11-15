# Tracker Gemini · Mốc Họp V1.2

Writer duy nhất: Gemini 00. [Mục lục](README.md) · [Hợp đồng](COMMON.md) · [Checkpoint điều phối](CHECKPOINT.md)

Baseline `6142f56a6efdb27aa9445920c9321f7930c0d5fd`. Trạng thái dòng này là tình trạng bàn giao độc lập của luồng. Trạng thái gói sản phẩm do `docs/STATUS.md` quản lý. Đợt tích hợp: **chưa bắt đầu**. Các SHA rút gọn cột Code là HEAD quan sát gần nhất (riêng 04 là code revision theo checkpoint); **không** suy ra tested SHA. Thời điểm quan sát: 15/11/2026. Trạng thái test V8 00 dùng shim Node và SHA-256, không thay thế `npm test` từ clean remote checkout.

| Owner | Checkpoint | Trạng thái | Code SHA | Tested SHA | Test | Bằng chứng / việc còn thiếu |
|---|---|---|---|---|---|---|
| Gemini 00-command | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/CHECKPOINT.md) | READY_FOR_REVIEW | `b136a897` | — | V8: 17/17; Node remote NOT_RUN | Standalone harness + TC_MATRIX + runbook; local analog Node 16/16; clean checkout Node pending |
| Gemini 01-editor | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-01-editor/docs/workstreams/2026-11-15/checkpoints/01-editor.md) | IN_PROGRESS | `633759a7` | — | NOT_RUN | Checkpoint reported setup; Windows UniKey/EVKey pending |
| Gemini 02-capture | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-02-capture/docs/workstreams/2026-11-15/checkpoints/02-capture.md) | IN_PROGRESS | `5c107a59` | — | NOT_RUN | Checkpoint reported setup; PCM live/3h Windows pending |
| Gemini 03-opfs | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-03-opfs/docs/workstreams/2026-11-15/checkpoints/03-opfs.md) | IN_PROGRESS | `831d68c1` | — | NOT_RUN | Checkpoint reported setup; OPFS crash/quota pending |
| Gemini 04-timeline | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-04-timeline/docs/workstreams/2026-11-15/checkpoints/04-timeline.md) | READY_FOR_REVIEW | `8410cc27` | — | local Node 16/16 | Fixture PoC; clean SHA and integrated/live NOT_RUN |
| Gemini 05-player | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-05-player/docs/workstreams/2026-11-15/checkpoints/05-player.md) | IN_PROGRESS | `ff8efae7` | — | NOT_RUN | Checkpoint reported setup; C1/C2 waveform/audio pending |
| Gemini 06-notes | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-06-notes/docs/workstreams/2026-11-15/checkpoints/06-notes.md) | IN_PROGRESS | `7d07613d` | — | NOT_RUN | Checkpoint reported setup; IndexedDB runtime pending |
| Gemini 07-backup | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-07-backup/docs/workstreams/2026-11-15/checkpoints/07-backup.md) | IN_PROGRESS | `e09da35f` | — | NOT_RUN | Checkpoint reported setup; large ZIP/restore pending |
| Gemini 08-export | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-08-export/docs/workstreams/2026-11-15/checkpoints/08-export.md) | IN_PROGRESS | `c2330a22` | — | NOT_RUN | Checkpoint reported setup; DOCX real Word pending |
| Gemini 09-pwa | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-09-pwa/docs/workstreams/2026-11-15/checkpoints/09-pwa.md) | IN_PROGRESS | `3f77fd56` | — | NOT_RUN | Checkpoint reported setup; browser offline/SW pending |

## Giao lại theo bằng chứng

Ghi owner, lỗi và diff/run liên quan, đường dẫn file được phép sửa, yêu cầu và điều kiện kiểm lại. Mọi dòng chờ dữ liệu worker trong tracker chỉ thể hiện trạng thái tiến độ. Bộ kiểm thử hợp đồng của 00 tự hoàn thành với fixture.

## Đợt tích hợp tiếp theo

Kiểm cổng Gói 1.1 và bằng chứng thực trên từng SHA. Chốt các adapter và lựa chọn kỹ thuật bằng kết quả thử. Sau khi được giao đợt tích hợp, ghi SHA tích hợp, TC01–TC38, lỗi Critical/High và chứng cứ đủ điều kiện bàn giao.

## Sự kiện và điểm kiểm chứng 15/11/2026

- **00**: baseline `6142f56`, nhánh riêng từ `6feb6d9`; tạo độc lập `contracts.mjs`, `harness.test.mjs`, `package.json`, `README.md`, `TC_MATRIX.md`, `INTEGRATION_RUNBOOK.md`. HEAD mã/hướng dẫn `b136a897`; bản GitHub đã parse được; test logic 17/17 chạy lại trên nội dung đã fetch bằng JavaScript V8 với shim, trong khi test Node 16/16 là nguồn tương đương chạy cục bộ nhưng **không phải cùng file/SHA**. Chính xác các file GitHub bằng Node/clean checkout: NOT_RUN do môi trường container không kết nối github.com.
- **04**: checkpoint mới nhất xác nhận standalone TypeScript fixture test 16/16 trên Linux Node 22, revision code `8410cc27`, chưa có clean SHA test hay test live.
- **01/02/03/05/06/07/08/09**: checkpoint hiện hành ghi IN_PROGRESS và chưa có bằng chứng runtime để ghi PASS; các HEAD quan sát được đã ghi cột trên. Worker có thể tiếp tục commit sau thời điểm quan sát; kiểm lại trước tích hợp.

## Giao việc cụ thể / không đổi COMMON

- **Owner 00**, `poc/00-contract-tests/`: chạy `npm test` từ **clean checkout** nhánh `gemini/20261115-00-command`; kỳ vọng 17/17, ghi đúng SHA, Node/OS, stdout/log. Nếu FAIL, sửa chỉ file trong thư mục 00 và chạy lại. Đây là cổng còn thiếu để DONE độc lập.
- **Owner 01-editor**, `poc/01-editor/`: cung cấp trace UniKey/EVKey Telex/VNI thật (không composition cũng có thể xảy ra) với cùng đoạn 2 phút và marks đầu/cuối. Expected: chữ/mốc không mất, test TC01–TC11; Windows/Chrome/Edge vẫn NOT_RUN khi chưa kiểm.
- **Owner 02-capture + 03-opfs**, chỉ tại `poc/02-capture/` và `poc/03-opfs/`: đối chiếu `sequenceNo/firstSample/sampleCount`, ACK transfer vs flush+journal, crash/quota và mất micro. Expected: không công bố committed nếu mới queued; chứng minh bằng log/WAV header/trạng thái manifest.
- **Owner 05-player**, `poc/05-player/`: đo C1/C2 qua biên 04:58→05:02 và 0,75×/0,9×, tránh khẳng định gapless chỉ vì bước source logic.
- **Owner 07-backup**, `poc/07-backup/`: kiểm streaming ZIP 0,5–2 GB, path traversal/checksum/staging, ZIP64 và restore thiếu audio, đo RAM/backpressure.
- **Owner 09-pwa**, `poc/09-pwa/`: kiểm lock stale writer, SW update không reload khi ghi và migration rollback.

### Đề xuất cần xét lúc tích hợp (không chỉnh hợp đồng đóng băng)

1. **Pre-roll qua vùng không phát được**: reference mock fallback về anchor khi `start` missing/pending; production phải xác định rõ UX khi pre-roll đi qua gap/pending/segment missing, không âm thầm nhảy qua nguồn sai. Giữ `audioOffsetMs` gốc.
2. **Writer token**: hợp đồng `acquire(meetingId)` chỉ hứa `release()`; reference mock dùng identity token để chống stale release/save sau lease được tái cấp. Đề nghị thẩm định với IndexedDB/Web Locks adapter thực.
3. **Media interval ở gap**: địa chỉ Mark luôn media offset, trong khi paused/gap có meeting time riêng và có thể không có media range; đặt hàm resolve theo `meetingMs` riêng, không đánh tráo các loại time. Kiểm thêm gap xen giữa hai recorded media liên tục.
