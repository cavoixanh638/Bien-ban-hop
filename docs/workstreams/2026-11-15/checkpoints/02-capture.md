# Checkpoint · G02 — Thu âm và vận chuyển dữ liệu

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
| **G02-ADD-03** mapping input/PCM | START ACK Worklet, điểm định kỳ và stop theo render `contextTimeSec + sampleIndex`, hiệu chuẩn bằng `AudioContext.getOutputTimestamp`; khoảng paused/gap/unavailable riêng, không cộng wall-clock pause vào media | **PASS** Node delayed event 3 giây, drift ±100ppm, pause 10 giây; độ trễ hardware mic/TC17 thật **NOT_RUN** |
| **G02-ADD-04** cấp phát vô hạn | Batch chỉ 2048 hoặc 4096, pool 2–64, channels 1–2, ceiling toàn pool ≤2 MiB; validate recordingId/port/finite values trước allocation, lỗi `invalid-configuration` | **PASS** Node 0 allocations với invalid 0/127/-1/float/NaN/1e8 và pool/channel invalid; AudioWorklet browser **NOT_RUN** |
| **G02-ADD-05** streaming 3h | `stream-spool.mjs` có bounded queue 8MiB/32 chunks, append một WebM container liên tục vào OPFS chẩn đoán, retained prefix giới hạn; 3h browser runner dùng marker tín hiệu mỗi phút, kiểm mẫu phút90 và full-file seeks | **PASS** Node synthetic spool/quota/backpressure; WebM/OPFS/full-file seek và recording 3h browser thực **NOT_RUN** |

## Test và bằng chứng

| Case | Lệnh/fixture | Kết quả | Vật chứng |
|---|---|---|---|
| Unit/fault injection + Worker `MessagePort` transfer | `cd poc/02-capture && npm test` | **PASS 36/36, FAIL 0, skipped 0; exit 0** | [unit-tests-round2.txt](../../../poc/02-capture/evidence/unit-tests-round2.txt) |
| Source byte verification | 20 file source/test copy vào source-only folder trống, so sánh `git hash-object` với Git tree Code SHA, chạy `npm test` trong folder đó | **PASS 20/20 SHA, PASS 36/36; exit 0**; *clean Git checkout thực* **NOT_RUN** | [verified-tree-round2.md](../../../poc/02-capture/evidence/verified-tree-round2.md) |
| Virtual metadata 3h | `npm run test:virtual3h`, 48 kHz × 10.800 s | **PASS_METADATA_ONLY**, 518.400.000 frame, sequence/gap/duplicate; **không** ghi âm 3h thực | [virtual-3h-run.txt](../../../poc/02-capture/evidence/virtual-3h-run.txt) |
| Chrome synthetic quick | `npm run test:browser -- --quick` | **NOT_RUN / BLOCKED_ENV** (managed Chromium `URLBlocklist: ["*"]` từ chối `localhost`), 0 PASS / 0 FAIL / 1 NOT_RUN, exit 2 | [browser-run.txt](../../../poc/02-capture/evidence/browser-run.txt) |
| Chrome 3 giờ wall-clock + real CPU/RAM/cadence/seek | `npm run test:browser -- --three-hours` | **NOT_RUN**: browser policy + thiếu Windows + 3 giờ thời gian thực; không suy PASS từ 3h metadata | [run-report.md](../../../poc/02-capture/evidence/run-report.md) |
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
