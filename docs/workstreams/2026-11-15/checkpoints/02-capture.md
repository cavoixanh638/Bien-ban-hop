# Checkpoint · G02 — Thu âm và vận chuyển dữ liệu

## Mốc hiện hành — 15/11/2026, sau G02-ADD-06 và G02-ADD-07

| Thuộc tính | Trạng thái |
|---|---|
| Nhánh | `gemini/20261115-02-capture` |
| **Code SHA** | **`41bff1062b467f4343be70f77d53d35c81213dd0`** |
| **Tested SHA / phạm vi** | **`41bff1062b467f4343be70f77d53d35c81213dd0` (đúng byte Git blob trong V8 mocks)**; Node clean checkout mới **NOT_RUN** |
| Kết quả mới | **PASS 24/24 V8 controlled tests**, gồm 16 ca liên quan cũ + 8 ca bổ sung; **0 FAIL** |
| Test Node lịch sử | **36/36 PASS** ở Code SHA **`0083a670e5537952899afb247949bc71442b46b8`**; KHÔNG tự chuyển thành 44/44 PASS cho mã mới |
| Trạng thái PoC | **PARTIAL / HOLD_REAL_BROWSER_AND_WINDOWS / NOT DONE** |
| Môi trường | Code Mode V8 với adapter giả lập; không phải Node/Chromium/Windows/micro thiết bị thật |
| Bản nguồn và log | [README](../../../../poc/02-capture/README.md) · [V8 regression evidence](../../../../poc/02-capture/evidence/add06-add07-v8.md) |
| WIP/chưa push | **Không**: commit mã và evidence đã push. Checkpoint commit riêng ngay sau |
| Ranh giới | Chỉ `poc/02-capture/` và checkpoint này; KHÔNG sửa COMMON/TRACKER/nhánh khác; KHÔNG merge/deploy |

**G00 giao mới từ TRACKER.md:** `G02-ADD-06` và `G02-ADD-07`. Các ADD-01..05 **không mở lại**; chỉ tái kiểm 16 ca đã bị ảnh hưởng do sửa clock/controller.

### G02-ADD-06 — PASS logic, browser NOT_RUN

- `CaptureClockMapper.resolveInput(1000)` ở mốc `progress(48000, t=1000)`: trả `valid, sampleIndex=48000`, không còn `unlinked`.
- `resolveInput(1500)` khi điểm cuối `t=1000`: trả `pending` kèm `inputMonoMs`, `recordingId` và `source`, không dự đoán giả sample/frame. `queueInput(1500, 'note-1500')` giữ trong hàng đợi giới hạn, sau `progress(96000,t=2000)` `takeInputResolutions()` trả `valid,sampleIndex=72000`.
- Regression PASS cho pause trước progress, stop ngay sau điểm cuối, stop có duy nhất một calibration point, sink/pool gap và unavailable. Trạng thái không thể khôi phục giải quyết fail-closed, không tự chọn nearest sample.
- Chỉ adapter memory 1.024 pending anchors; không có update timeSpan Mark hoặc journal autosave. G01/G04 integration với `typedAt` và revision thuộc đợt được giao riêng, **NOT_RUN**.

### G02-ADD-07 — PASS logic, browser permission thực NOT_RUN

- `CaptureComparison.stop()` hủy **await** của phiên Start khi quyền `getUserMedia/getDisplayMedia` chưa có phản hồi. Vì API trình duyệt không hỗ trợ hủy chắc chắn, kết quả ghi `permissionPendingCleanup:true`, `resourcesReleased:false`, không báo release giả.
- Ngay khi lời nhắc trả về muộn, listener độc lập cleanup toàn bộ audio/video tracks đúng một lần; denial muộn cũng xử lý. **Không** mở context/MediaRecorder hoặc phát sự kiện Start sau hủy. Stop idempotent; không cho Start lại khi prompt cũ còn treo.
- UI `index.html`: Stop vẫn dùng được khi `starting`; nút Start bị khóa trong `permission_pending_cleanup`, mở lại sau `permission-settled` và xác nhận cleanup.
- Reproducer deferred permission không bao giờ settle, grant muộn, deny muộn, double Start, display video+audio track: **PASS** trong V8 mock. Chưa đo prompt Chrome/Edge/Windows thật: **NOT_RUN**.

### Bài chạy và giới hạn — không nhầm loại PASS

| Mục | Status | Bằng chứng / lý do |
|---|---|---|
| Source-blob controlled V8 `clock-mapper.test.mjs` + `lifecycle.test.mjs` | **PASS 24/24** | [evidence/add06-add07-v8.md](../../../../poc/02-capture/evidence/add06-add07-v8.md), Git SHA chính xác |
| Phép đo metadata 3h 518.400.000 frame | **PASS_METADATA_ONLY** (kết quả cũ) | [virtual-3h-run.txt](../../../../poc/02-capture/evidence/virtual-3h-run.txt); không ghi 3 giờ wall-clock |
| `npm test` Node trên **SHA mới** (44 test khai báo) | **NOT_RUN** | Không truy cập được GitHub private repo bằng git clone trong container hiện tại; cần checkout sạch/Node 22; không gọi PASS chỉ vì mock V8 |
| Browser AudioWorklet/MediaRecorder, `crossOriginIsolated=false`, queue/Worker stress | **NOT_RUN** | Chromium container quản trị `URLBlocklist:["*"]` chặn localhost; [browser-results](../../../../poc/02-capture/evidence/browser-results.json) |
| TC12 3h liên tục, browser CPU/RAM + sample/seek đầu-giữa-cuối | **NOT_RUN** | Không có bài chạy wall-clock + Windows Chrome/Edge/micro thật |
| TC14 rút mic vật lý, TC17 clock latency thật, TC21 audio online track | **NOT_RUN** | Thiếu thiết bị và quyền ghi online thực |
| OPFS durability + journal/quota/crash | **NOT_RUN (thuộc G03)** | Chỉ ACK trả buffer của G02, không suy ra durable ACK |

**Điều kiện DONE chưa đủ:** Chạy `npm test && npm run test:virtual3h` đúng checkout/Code SHA sau sửa (và lưu stdout); trên Windows Chrome/Edge kiểm 2 engine cùng nguồn, 2048/4096, pause/gap/tab, rút micro, prompt quyền không settle, stress Worker và queue đầy; thu **3 giờ theo đồng hồ thực**, đo CPU/RAM/PCM frame/WebM sample/seek đầu-giữa-cuối. Không chọn engine production hoặc báo Gói 1.2 PASS trước số liệu thực.

---

## Lịch sử checkpoint và bằng chứng trước vòng ADD-06/07

**Bản chốt vòng sửa theo G00 TRACKER — 15/11/2026**

| Trường | Giá trị |
|---|---|
| Owner | G02-capture; duy nhất nhánh `gemini/20261115-02-capture` |
| Baseline | `6142f56a6efdb27aa9445920c9321f7930c0d5fd` |
| Code SHA | **`0083a670e5537952899afb247949bc71442b46b8`** |
| Tested SHA | **`0083a670e5537952899afb247949bc71442b46b8` — exact source-blob equivalent**, kiểm 20/20 file mã/test khớp SHA từ Git tree (không phải `git clone` checkout có metadata) |
| Bằng chứng SHA | `26eb4bf8812227f67b4f5b68277bfa6c02b0bdea` — `poc/02-capture/evidence/verified-tree-round2.md` |
| Trạng thái | **PARTIAL / NEEDS_BROWSER_AND_WINDOWS_EVIDENCE; NOT DONE**; không nghiệm thu Gói 1.2 hay ứng dụng tích hợp |
| Runtime | Linux x86_64, Node.js v22.16.0, Chromium headless 144.0.7559.96; không có thiết bị micro hoặc Windows Chrome/Edge thật |
| Code/tests WIP | **NONE** — các tệp mã, test, evidence đã push; không merge main/deploy |

Entrypoint: [02-capture](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/02-capture.md) · [TRACKER của G00](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/TRACKER.md) · [COMMON cố định](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md).

## Mã đã sửa sau review G00

| Tracker | Xử lý | Kết quả kiểm độc lập |
|---|---|---|
| **G02-ADD-01** Start/Stop và permission race | Lifecycle `idle → starting → capturing → stopping → stopped/failed`; token/cancel sau các async setup, Stop trước getUserMedia grant, không đè phiên nếu double-start; cleanup track đã grant dù start bị cancel; UI disable Start ngay click | **PASS** Node deferred permission/Start/Stop/track-ended; Windows prompt **NOT_RUN** |
| **G02-ADD-02** Stop fail/timeout bỏ cleanup | `finally` fail-closed cho stream, oscillator, context, recorder, worker/port; Stop idempotent, lỗi sink drain, media.stop reject/timeout; không báo saved giả | **PASS** Node fault injection; browser worker crash/quota **NOT_RUN** |
| **G02-ADD-03** mapping input/PCM | START ACK Worklet, điểm định kỳ và stop theo render `contextTimeSec + sampleIndex`, hiệu chuẩn bằng `AudioContext.getOutputTimestamp`; khoảng paused/gap/unavailable riêng, không cộng wall-clock pause vào media | **PASS** Node delayed event 3 giây, drift +100ppm, pause 10 giây; độ trễ hardware mic/TC17 thật **NOT_RUN** |
| **G02-ADD-04** cấp phát vô hạn | Batch chỉ 2048 hoặc 4096, pool 2–64, channels 1–2, ceiling toàn pool ≤2 MiB; validate recordingId/port/finite values trước allocation, lỗi `invalid-configuration` | **PASS** Node 0 allocations với invalid 0/127/-1/float/NaN/1e8 và pool/channel invalid; AudioWorklet browser **NOT_RUN** |
| **G02-ADD-05** streaming 3h | `stream-spool.mjs` có bounded queue 8MiB/32 chunks, append một WebM container liên tục vào OPFS chẩn đoán, retained prefix giới hạn; 3h browser runner dùng marker tín hiệu mỗi phút, kiểm mẫu phút90 và full-file seeks | **PASS** Node synthetic spool/quota/backpressure; WebM/OPFS/full-file seek và recording 3h browser thực **NOT_RUN** |

## Test và bằng chứng

| Case | Lệnh/fixture | Kết quả | Vật chứng |
|---|---|---|---|
| Unit/fault injection + Worker `MessagePort` transfer | `cd poc/02-capture && npm test` | **PASS 36/36, FAIL 0, skipped 0; exit 0** | [unit-tests-round2.txt](../../../../poc/02-capture/evidence/unit-tests-round2.txt) |
| Source byte verification | 20 file source/test copy vào source-only folder trống, so sánh `git hash-object` với Git tree Code SHA, chạy `npm test` trong folder đó | **PASS 20/20 SHA, PASS 36/36; exit 0**; *clean Git checkout thực* **NOT_RUN** | [verified-tree-round2.md](../../../../poc/02-capture/evidence/verified-tree-round2.md) |
| Virtual metadata 3h | `npm run test:virtual3h`, 48 kHz × 10.800 s | **PASS_METADATA_ONLY**, 518.400.000 frame, sequence/gap/duplicate; **không** ghi âm 3h thực | [virtual-3h-run.txt](../../../../poc/02-capture/evidence/virtual-3h-run.txt) |
| Chrome synthetic quick | `npm run test:browser -- --quick` | **NOT_RUN / BLOCKED_ENV** (managed Chromium `URLBlocklist: ["*"]` từ chối `localhost`), 0 PASS / 0 FAIL / 1 NOT_RUN, exit 2 | [browser-run.txt](../../../../poc/02-capture/evidence/browser-run.txt) |
| Chrome 3 giờ wall-clock + real CPU/RAM/cadence/seek | `npm run test:browser -- --three-hours` | **NOT_RUN**: browser policy + thiếu Windows + 3 giờ thời gian thực; không suy PASS từ 3h metadata | [run-report.md](../../../../poc/02-capture/evidence/run-report.md) |
| Micro physical unplug, online audio track TC21, Windows Chrome/Edge | thiết bị thật | **NOT_RUN** | thiết bị/môi trường chưa có |
| OPFS durability, journal, crash/quota phục hồi | luồng G03; adapter G02 chỉ gửi PCM + events/ACK recycle | **NOT_RUN** ở G02; chưa tích hợp G03 | Hợp đồng COMMON |

- Node đã chạy trên nguồn cô lập với **20/20 Git blob SHA trùng Code SHA**. Vì không có credential mạng để clone private repo vào container, không được mô tả đó là `git checkout` remote. Verified/tested *source content* chính xác; chỉ metadata checkout thật `NOT_RUN`.
- MediaRecorder `timeslice` **không bảo đảm fragment phát độc lập**; full WebM diagnostic `durable:false` ngay cả khi file đóng, chưa có journal/flush chắc chắn. Worklet ACK buffer recycle **khác** `committedThroughSampleExclusive` sau OPFS flush.
- Mapping context render time → input monotonic không đo hardware mic input latency; các khoảng thiếu từ sink/track/gap không được nội suy thành media valid.
- PCM diagnostic giữ WAV prefix tối đa 8 giây và summary first/mid/end; chưa phải nguồn PCM đủ ba giờ để tua toàn phiên. Không chọn engine production khi chưa có dữ liệu Chrome/Edge đối chứng thật.

## Tiếp tục đến điều kiện DONE

1. Trên Windows Chrome/Edge với origin localhost/HTTPS được phép: chạy 2 engine với **cùng source**, cả batch 2048 và 4096, `crossOriginIsolated=false`; stress Worker/queue, pause-resume, tab hidden, track-ended, rút micro, lấy CPU/RAM/received/drop/cadence và bản WAV/WebM đối chứng.
2. Chạy **ba giờ wall-clock** với tín hiệu đã biết, ghi format/sample-rate, logs/mép đầu giữa cuối, full WebM seek đầu/phút90/cuối; định lượng missing/duplicate và giới hạn thiết bị. Khi chưa đạt không báo DONE G02.
3. TC21 online audio thực chỉ PASS trên các cấu hình có audio track; nếu không có/không thể thử ghi rõ UNSUPPORTED/NOT_RUN. G03 tự kiểm durability, không gọi ACK recycle là ACK committed.
4. Quyết định engine dựa trên số liệu browser, không từ unit fixture. G01 gate và tích hợp ứng dụng thuộc giai đoạn sau.

**Lịch sử:** bản đầu `6898ec9b` 11/11 unit; checkpoint `8a9780cf` PARTIAL; tiếp nhận ADD-01..05 tại `9f120caa`; code sửa `0083a670`, test 36/36; chứng thực nội dung `26eb4bf8`. Không sửa COMMON.md, TRACKER.md hay bất kỳ nhánh nào khác.
