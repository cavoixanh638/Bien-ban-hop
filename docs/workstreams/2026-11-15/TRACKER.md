# Tracker Gemini · Mốc Họp V1.2

Writer duy nhất: Gemini 00. [Mục lục](README.md) · [Hợp đồng](COMMON.md) · [Checkpoint điều phối](CHECKPOINT.md)

Baseline `6142f56a6efdb27aa9445920c9321f7930c0d5fd`. Trạng thái dòng này là tình trạng bàn giao độc lập của luồng. Trạng thái gói sản phẩm do `docs/STATUS.md` quản lý. Đợt tích hợp: **chưa bắt đầu**. Cột `HEAD` là snapshot nhánh được quan sát khi kiểm tra, **không** suy ra tested SHA. Cột Tested SHA để — nếu chưa có bằng chứng chạy đúng checkout tại SHA. Thời điểm quan sát: 15/11/2026. Trạng thái test V8 00 dùng shim Node và SHA-256, không thay thế `npm test` từ clean remote checkout.

| Owner | Checkpoint | Trạng thái | HEAD | Tested SHA | Test | Bằng chứng / việc còn thiếu |
|---|---|---|---|---|---|---|
| Gemini 00-command | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/CHECKPOINT.md) | READY_FOR_REVIEW | `89e88347` | — | V8 shim 17/17; clean Node NOT_RUN | Harness độc lập đã push; thiếu Node chạy từ checkout đúng SHA |
| Gemini 01-editor | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-01-editor/docs/workstreams/2026-11-15/checkpoints/01-editor.md) | IN_PROGRESS | `d8ca16fa` | — | Node policy 23/23 local | Tiptap build/Playwright/IME Windows NOT_RUN |
| Gemini 02-capture | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-02-capture/docs/workstreams/2026-11-15/checkpoints/02-capture.md) | IN_PROGRESS | `5c107a59` | — | NOT_RUN | Chưa có poc/02-capture/ trên HEAD; cần commit demo + PCM/capture test |
| Gemini 03-opfs | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-03-opfs/docs/workstreams/2026-11-15/checkpoints/03-opfs.md) | IN_PROGRESS | `e23593ba` | — | Node reference 10/10 local | Simulation 3h @1kHz; exact GitHub SHA/OPFS browser NOT_RUN; seek ~1.5s |
| Gemini 04-timeline | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-04-timeline/docs/workstreams/2026-11-15/checkpoints/04-timeline.md) | READY_FOR_REVIEW | `7a20de0e` | — | Node TS fixture 16/16 local | PoC độc lập; clean checkout SHA và capture live NOT_RUN |
| Gemini 05-player | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-05-player/docs/workstreams/2026-11-15/checkpoints/05-player.md) | IN_PROGRESS | `b9ac38fa` | — | Node reference 9/9 local | BUG: resolve nhầm meetingMs vs audioOffsetMs; fixture thiếu media range/segmentRefs; browser C1/C2 NOT_RUN |
| Gemini 06-notes | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-06-notes/docs/workstreams/2026-11-15/checkpoints/06-notes.md) | IN_PROGRESS | `ed272d05` | — | V8 memory fixture 9/9 | IndexedDB browser + two-tab/quota/crash NOT_RUN |
| Gemini 07-backup | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-07-backup/docs/workstreams/2026-11-15/checkpoints/07-backup.md) | IN_PROGRESS | `80af80db` | — | Python ref 10/10 local | 512MiB/2GiB benchmark Python không thay được 3 ZIP JS; clean SHA/browser NOT_RUN |
| Gemini 08-export | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-08-export/docs/workstreams/2026-11-15/checkpoints/08-export.md) | IN_PROGRESS | `9b71d4d9` | — | Node ref 20/20 local | Mã GitHub đã sửa sau run; cần test exact SHA, Word/Chrome/Edge |
| Gemini 09-pwa | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-09-pwa/docs/workstreams/2026-11-15/checkpoints/09-pwa.md) | IN_PROGRESS | `3f77fd56` | — | NOT_RUN | Chưa có poc/09-pwa/ trên HEAD; cần commit service worker/lock/migration + test |

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

## Rà soát HEAD trực tiếp sau bàn giao — 15/11/2026

Đã đối chiếu Git-tree ở đúng HEAD của cả 10 nhánh, checkpoint độc lập và các artifact thực sự có trên GitHub, không tính đường dẫn chỉ xuất hiện trong tài liệu là code có sẵn. Tại lúc rà soát:
- **Có file PoC trên GitHub:** 00, 01, 03, 04, 05, 06, 07, 08.
- **Chưa có thư mục PoC trên GitHub:** 02-capture, 09-pwa. Hai luồng này vẫn IN_PROGRESS, chưa có mã bàn giao để review.
- **04** READY_FOR_REVIEW fixture; **00** READY_FOR_REVIEW nhưng còn thiếu Node clean checkout. **01/03/05/06/07/08** có mã, có kiểm thử một phần trên tham chiếu/synthetic nhưng chưa đủ nghiệm thu. Không có gói thực địa PASS.

### 05-player — lỗi được tái hiện trên đúng nguồn GitHub (cần sửa, ưu tiên cao)

- Owner: **05-player**; file được phép sửa: `poc/05-player/player.js`, `poc/05-player/player.test.js`, `README.md` và checkpoint `05-player.md`. Tested source: blob Git `15ef45b5abf5712b90cdd81d04820d7f60c9f8f6`; HEAD khi kiểm `b9ac38fa9e99be9349df6403713ba274f39ef981`.
- **Reproducer:** `resolve(ID, 1805000)` hiện trả `{status:'gap', reason:'pause'}` trong khi `seg-006` có `mediaStartMs=1800000`, `completionState='complete'` và chứa mốc audio này. `resolve()` dùng `meetingStartMs` và `meetingEndMs` để kiểm một `audioOffsetMs`: trộn **Meeting Timeline** với **Media Timeline**. Ba recorded intervals trong fixture không có `mediaStartMs/mediaEndMs/segmentRefs` như COMMON yêu cầu.
- **Yêu cầu:** bổ sung interval media ranges và references đúng cho segment, biểu diễn pause/gap bằng meeting timeline riêng; resolve media offsets chỉ qua media ranges và segment refs có trạng thái. Khi thiếu coverage đúng nguồn, trả `gap/missing` có lý do; không tự chọn file gần nhất. Sửa test hiện tại đang dựa vào nhầm lẫn và thêm test media=1805000 valid khi có coverage, meeting pause=1805000 không phát, mapping sau resume, audio gap thật, source sai và qua biên.
- **Cách kiểm:** `cd poc/05-player && npm test` đúng tested SHA; fixture dùng `04-timeline.validateManifest` hoặc kiểm hợp đồng tương đương và chạy đối chiếu adapter; sau đó browser playback/underrun/0.75x/0.9x trên Windows. **Không** đánh dấu C1/C2 PASS trước waveform/giọng thực. Tình trạng hiện tại: **FAIL logic theo COMMON trên source hiện hành**, chưa chấm lỗi ở playback runtime.

### Điều kiện tiếp tục cho các chủ sở hữu khác

- **00-command:** chạy chính xác `npm test` 17/17 từ clean HEAD; lưu stdout, Node version và tested SHA trước khi DONE.
- **01-editor:** `poc/01-editor/` chạy `npm install; npm run build; npm run test:e2e` trên Windows Chrome/Edge; bốn tổ hợp UniKey/EVKey × Telex/VNI, 120 giây nhập không Enter, trace; không hạ cổng Gói 1.1.
- **02-capture:** bổ sung `poc/02-capture/` trên nhánh; tạo AudioWorklet/PCM vs MediaRecorder, 2048/4096 frame, ACK pool vs durable, Chrome headless synthetic, sau đó đo 3h wall-clock thật.
- **03-opfs:** từ exact Git SHA chạy `npm test && npm run bench`, đo 48 kHz thay vì chỉ 1 kHz, browser OPFS crash/quota thật; seek ~1.5s synthetic cần profiling và tối ưu phạm vi xác minh CRC.
- **04-timeline:** chạy `npm test` ở checkout sạch đúng SHA đã push, giữ kết quả 16/16 chỉ là fixture; tích hợp mapping đầu vào thực với 02/03 và nguồn audio qua 05 (sau khi 05 sửa).
- **06-notes:** `node --test notes.test.mjs` trên exact SHA; browser IndexedDB durable transaction, autosave commit ACK, multi-tab conflict, crash/reopen.
- **07-backup:** Python reference là oracle; vẫn cần `fflate/client-zip/zip.js` hoặc các JS adapters pinned và benchmark browser 0.5–2GiB, bounded RAM, ZIP64, thiếu file/checksum và restore máy khác.
- **08-export:** test lại exact Git source qua `node test.mjs && node generate.mjs`; mở DOCX trên MS Word, kiểm CSV/Markdown/TXT và trạng thái timestamp.
- **09-pwa:** bổ sung `poc/09-pwa/` và kiểm Web Locks/SW offline/update/migration; không reload khi ghi, `crossOriginIsolated=false`.

**Ưu tiên điều phối:** (1) 05 sửa lỗi timeline sai nguồn/false gap; (2) 02 và 09 phải có mã nguồn thực; (3) 01 qua cổng Windows IME; (4) 00/04/03/06/08/07 chốt lại exact SHA và chạy môi trường phù hợp; (5) sau đủ gate mới tích hợp, chưa merge/deploy.
