# Checkpoint · 04-timeline

- Chủ sở hữu: worker 04-timeline, một writer
- Nhánh: `gemini/20261115-04-timeline`
- Baseline: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- Trạng thái: **READY_FOR_REVIEW — independent fixture PoC complete**; integrated/live validation **NOT_RUN**
- Code revision (đã push): `8410cc2774d054c9d6161476dbd0c36698e452fc`
- Tested snapshot: local matching PoC source and tests; **chưa chạy test từ clean remote checkout tại SHA nói trên**
- Kiểm thử cục bộ: **16 PASS / 0 FAIL**; `npm test`; Node.js 22.16.0/Linux, Node experimental TS strip; test không cần npm install
- Dữ liệu đo: synthetic 48 kHz, +100ppm clock drift, 271 điểm (bước 37ms), expected <=1000ms, actual max error **0.508ms** (millisecond-rounded test)
- Thiết bị live/Windows/Chrome/Edge, thời gian hệ thống thực tế: **NOT_RUN**

Entrypoint: [04-timeline](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/04-timeline.md) · [Hợp đồng](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md)

## Đã làm

- [Thư viện thuần TS](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-04-timeline/poc/04-timeline/timeline.ts) gồm `inputToSample`, `sampleToMedia`, `meetingToMedia`, `resolve`, `createLiveAnchor`, `createPlaybackAnchor`, `playbackTarget`, `validateManifest`.
- Không dùng wall time để suy ra media; nội suy clock theo điểm đo mẫu, đối chiếu meeting timeline. Không ngoại suy ngoài vùng calibration, trả pending hoặc unsupported có lý do.
- Bảo toàn recordingId/typedAt/anchor và mốc nhập ở media; pause/gap/missing/unsupported/unlinked không tự thay bằng file gần nhất; pending sau flush suy ra thành valid từ manifest mới.
- `valid` trả segmentId, filePath, localOffsetMs và nguyên offset/recording; pre-roll 0–30s chỉ trên playback, không sửa anchor.
- [16 fixture tests](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-04-timeline/poc/04-timeline/timeline.test.ts): biên đầu/cuối nửa kín, pause, gap, segment thiếu/hỏng, wrong-source, hai recording, seek/pause file nhập, mismatch meeting/clock, invalid metadata, drift và pending→valid.
- [README/reproduction](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-04-timeline/poc/04-timeline/README.md): lệnh Node, expected/actual, cách lặp lại với thiết bị live.
- Diff đã xem qua `baseline...branch`: chỉ checkpoint 04 và `poc/04-timeline/`; không ghi đè worker khác. 9 commit kể từ baseline trước khi cập nhật checkpoint này.

## Bằng chứng

- Lệnh: `cd poc/04-timeline && npm test`.
- Local TAP (Node 22.16.0, Linux): `tests 16; pass 16; fail 0; duration ~181ms`.
- Synthetic measurement printed: `SYNTHETIC_MEASURE expected <=1000ms; actual maxErrorMs=0.508; count=271; source=synthetic sample clock`.
- Bằng chứng trên chỉ chứng minh phép tính với fixture; không chứng minh latency thực mic/editor, PCM flush, seek decoder hoặc chất lượng file sau crash.

## Còn thiếu / bàn giao tích hợp

1. **NOT_RUN** đo InputTracking clock ↔ sample thu micro thật trên Windows Chrome/Edge; sample impulse có ground truth, kiểm drift/suspend, jitter, decoder và committed sample range.
2. **NOT_RUN** nối adapter với capture/OPFS/editor/player, kiểm TC13–TC18/22/24/27/28 trong ứng dụng tích hợp; thử nhiều recording/clock epoch sau sleep.
3. Chưa có CI/clean checkout test trên GitHub SHA; có thể chạy `npm test` trong folder từ checkout sạch để xác nhận.

**Ranh giới:** PoC độc lập hoàn tất trên fixture, không đánh dấu Gói 1.3 tích hợp hoặc sản phẩm V1.2 PASS. Không import hay chờ code các luồng khác. Không force push.

WIP/chưa push: — · Chặn bên ngoài: thiết bị live và adapter tích hợp nằm ở giai đoạn tiếp theo.
