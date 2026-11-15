# Checkpoint · 04-timeline · 15/11/2026

- **Owner:** G04 — Timeline và ánh xạ mốc; chỉ ghi `poc/04-timeline/` + checkpoint này
- **Branch:** `gemini/20261115-04-timeline`
- **Baseline:** `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- **Trạng thái:** **DONE — PoC độc lập bằng fixture**, không phải nghiệm thu Gói 1.3 tích hợp
- **Code SHA:** `f093cfcf387ae1e8265ccb1a8921e1f3c10af568` (HEAD chứa toàn bộ mã, test, log và README)
- **Tested SHA:** `f093cfcf387ae1e8265ccb1a8921e1f3c10af568` — đúng Git tree trong `poc/04-timeline/`, xác minh Git blob + subtree SHA trước và sau test
- **Tested Git tree SHA:** `a8b3c75fd37f79250b11c57bb9a42bb2ec0f7b2f` (remote GitHub = local `git write-tree` đúng từng blob/mode)
- **Unit fixture:** **PASS 33/33, FAIL 0**, gồm 16 ca nguyên vẹn và 17 ca bổ sung; Node.js `v22.16.0`, Linux x86_64, npm `10.9.2`
- **TypeScript:** **PASS** `tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext timeline.ts`, TypeScript 5.8.3
- **Synthetic measurement:** **PASS** 48 kHz/+100ppm max `0.5207 ms`, P95 `0.4746 ms`; 44,1 kHz/−80ppm max `0.609977 ms`, P95 `0.473575 ms`. Mỗi kịch bản 1.082 mốc, mục tiêu max ≤1.000 ms; đúng segment ở toàn bộ vị trí đã đo.
- **Browser / micro Windows / decoder / OPFS / tích hợp TC:** **NOT_RUN**; không nâng trạng thái bài fixture thành PASS thiết bị thật.

Entrypoint: [04-timeline](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/04-timeline.md) · [COMMON](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md) · [TRACKER G00](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/TRACKER.md)

## Mã và kết quả bàn giao

1. [Thư viện TypeScript](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-04-timeline/poc/04-timeline/timeline.ts): `validateManifest`, `inputToSample`, `sampleToMedia`, `meetingToMedia`, `resolve`, `createLiveAnchor`, `createPlaybackAnchor`, `playbackTarget`.
2. [Bộ test gốc 16 ca](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-04-timeline/poc/04-timeline/timeline.test.ts) và [17 hồi quy mới](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-04-timeline/poc/04-timeline/timeline.extended.test.ts): boundary nửa kín, pause/gap, manifest lỗi, sai recording, segment pending/missing/corrupt/unsupported, playback seek/pause, drift, clock rollback và nguồn imported.
3. [Tự sinh phép đo](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-04-timeline/poc/04-timeline/measure-fixture.mjs) và [expected/actual JSON](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-04-timeline/poc/04-timeline/evidence/synthetic-measurement.json): 2 × 1.082 mốc từ đồng hồ mẫu tổng hợp (20 giây record + 3 giây pause + 20 giây record); chỉ đo thuật toán, không phải tín hiệu micro thực.
4. [Log và receipt](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-04-timeline/poc/04-timeline/evidence/TEST_LOG.md): môi trường, Git tree, TAP excerpt, typecheck, kết quả đo, giới hạn `NOT_RUN`.
5. [README](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-04-timeline/poc/04-timeline/README.md): API, cách chạy độc lập, hướng dẫn lặp lại phép đo với thiết bị thật.

## Xử lý phát hiện từ G00 và kiểm tra an toàn

- Phân biệt **meetingMs** và **audioOffsetMs**: `resolve` chỉ dùng `mediaStartMs/mediaEndMs` + `segmentRefs`, không so media offset với meeting interval. Có hồi quy độc lập cho lỗi G05: media `1805000` thuộc `seg-006` valid dù meeting `1805000` paused. **Không sửa file luồng 05**.
- Pre-roll không chỉ kiểm điểm đầu/cuối mà rà toàn bộ đường phát; qua missing/pending/corrupt hoặc gap meeting dù media nén liên tục thì trả `preRollStatus='blocked'`, `preRollReason`, bắt đầu tại mốc gốc. Pause chủ động với audio liên tục vẫn có thể đi qua. Mark gốc không đổi.
- Clock pause có thể giữ nguyên `sampleIndex`; cho phép plateau có mốc mono tăng, cấm nội suy audio trong plateau. Resume ánh xạ đúng segment, không cộng thời gian pause.
- Sửa bẫy *fractional mediaStartMs* ở 44,1 kHz: chuyển Mark về mili giây nguyên **trong cùng segment**, thay vì làm tròn sang file kề; nếu đoạn quá ngắn không có số ms nguyên, trả `unsupported` rõ lý do.
- Resolver yêu cầu recorded interval xác thực, không cho phát đoạn file mồ côi dù `completionState=complete`. Mốc pending giữ nguyên và suy ra valid khi manifest hoàn tất.
- Thử **3 giờ virtual index**, 36 segment × 5 phút 48 kHz, biên đầu/cuối đều đúng. Không sinh 3 giờ audio thật.
- Các tệp độc lập, không import fixture/code nhánh khác, không đợi kết quả luồng khác. Không sửa COMMON, không merge `main`, không deploy.

## Cách tái kiểm chứng nguồn đúng GitHub

Tại lúc xác minh, GitHub HEAD `f093cfcf...` có subtree `poc/04-timeline/` SHA `a8b3c75f...`. Toàn bộ 8 file được đưa vào index cục bộ từ blob đã kiểm SHA và có `git write-tree` khớp tuyệt đối với GitHub, sau đó `git checkout-index --all --prefix=...` sang **thư mục sạch** và chạy `npm run verify` + typecheck. `npm run verify` ở đây chạy 33/33 PASS và báo cáo JSON hash `67286b0ac23a525ffe1dd84317a7dd70a66546cb` đúng file GitHub. **Giới hạn:** môi trường không phân giải được `github.com` cho `git clone`; đây là clean materialization của Git subtree được xác thực, **không** phải full remote network clone.

## NOT_RUN / việc đợt tích hợp phải thực hiện

1. Thu micro thực Windows/Chrome/Edge, đo clock nhập↔frame thực, sample drop, jitter, drift sau suspend/wake, độ trễ mic và độ chính xác so với impulse được hiệu chuẩn.
2. Kết nối thật với G02/G03/G05, bảo đảm `completionState='complete'` chỉ sau **committedThroughSampleExclusive** + journal/checksum; test PCM, OPFS crash/quota và decoder seek, gap audio thật, C1/C2 0,75×/0,9×.
3. Nghiệm thu tích hợp TC13–TC18/22/24/27/28 và ghi nhận Windows/browser phiên bản, audio device, exact code/test SHA, P95/max error, waveform/log.
4. Nếu đồng hồ monotonic reset/đổi epoch, phải tạo epoch/recording mapping mới; không nối tuyến tính qua reset. Provisional pending anchor cần được đối soát khi nhận sample metadata thực.

**Quyết định:** Hoàn tất đầy đủ entrypoint ở **mức PoC độc lập**. **Không** báo Gói 1.3 của ứng dụng tích hợp hay sản phẩm V1.2 PASS. **WIP:** không. **External blocker PoC:** không; thiết bị/live và integration thuộc giai đoạn sau.
