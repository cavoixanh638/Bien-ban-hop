# G02 capture · Báo cáo kiểm thử vòng sửa ADD-01..05 — 15/11/2026

**Phạm vi bằng chứng:** mã nguồn G02 chạy độc lập trong `poc/02-capture/` trên Linux Node.js 22.16.0. Các trường `PASS` bên dưới gắn **Node mock + worker_threads MessageChannel thật**, không thay thế Chrome AudioWorklet/Windows mic thật. `Code SHA` và `Tested SHA` được chốt trong [checkpoint 02](../../../docs/workstreams/2026-11-15/checkpoints/02-capture.md) sau khi push và đối chiếu tất cả Git blob.

## Môi trường và lệnh

```bash
cd poc/02-capture
npm test                         # 36 PASS / 0 FAIL / exit 0
npm run test:virtual3h           # PASS_METADATA_ONLY / exit 0
npm run test:browser -- --quick  # NOT_RUN/BLOCKED_ENV / exit 2
# Chỉ ở máy Windows/browser thật đã chuẩn bị:
npm run test:browser -- --three-hours
```

- Node `v22.16.0`, Linux `x86_64`, Chromium `144.0.7559.96`, server thử chạy `127.0.0.1` với `crossOriginIsolated=false` khi được phép.
- Chromium trong runtime này bị chính sách tổ chức `URLBlocklist:["*"]` chặn `localhost` (đường dẫn `chrome-error://chromewebdata/`). Bài chạy CDP 0 PASS / 0 FAIL / 1 NOT_RUN, **không vô hiệu hóa chính sách**.
- Không có Windows Chrome/Edge tương tác, micro vật lý, track chia sẻ màn hình thật. Không có phép đo CPU/RAM/cadence của hai engine trên cùng trình duyệt.

## G02-ADD — test kết quả cụ thể

| Yêu cầu | Kết quả từ nguồn độc lập | Bằng chứng | Chưa thể khẳng định |
|---|---|---|---|
| ADD-01 State/race Start–Stop | **PASS Node mock**: Stop trước grant mic, double Start, Stop trong `AudioContext.resume()`, quyền bị từ chối, track kết thúc đồng thời Stop; session không được khởi tạo sau khi đã hủy, track đóng 1 lần | `tests/lifecycle.test.mjs`, `unit-tests-round2.txt` | Prompt/UX, mic Windows thật NOT_RUN |
| ADD-02 Cleanup/reject/timeout | **PASS Node mock**: MediaRecorder.stop reject, timeout, worker final reject/không ACK, error khi Worklet attach; context/worker/track được giải phóng; Stop idempotent | `tests/lifecycle.test.mjs`, `tests/pcm-lifecycle.test.mjs` | Worker crash/OS/Browser thực NOT_RUN |
| ADD-03 Mapping | **PASS Node mock**: START ACK từ Worklet; ≥2 điểm từ `getOutputTimestamp`, event trễ 3s không dời mốc, drift +100ppm, pause 10s không tăng media sample, gap/unavailable/sink reject không nội suy, timestamp chưa hiệu chuẩn bị pending | `tests/clock-mapper.test.mjs`, `tests/pcm-lifecycle.test.mjs` | Độ trễ micro input, drift thật/TC17 ≤1s NOT_RUN |
| ADD-04 Guard cấp phát | **PASS Node V8**: invalid 0/127/-1/fraction/NaN/1e8, pool 1/65/Infinity, channels 0/3, recordingId invalid, port invalid → zero allocations và `invalid-configuration`. Giới hạn hợp lệ ≤2MiB; lỗi OOM báo đúng | `tests/unit.test.mjs` | Memory pressure AudioWorklet thực NOT_RUN |
| ADD-05 MediaRecorder spool | **PASS Node synthetic sink**: bounded queue Bytes/Chunks, rejects có đếm, xử lý lỗi quota, ghi nối đầy đủ theo đúng thứ tự dù vượt retained-prefix RAM, getFile và discard; 3h runner có mốc 90 phút | `tests/spool.test.mjs`, `tests/browser-runner.mjs` | FileSystemWritableFileStream/OPFS thật, full WebM seek/decoding 3h NOT_RUN |
| Hợp đồng ban đầu | **PASS Node**: f32le frames/bytes, quantum biến thiên, batch 2048/4096, pool overflow, Worker thread MessagePort transferable và ACK recycle ≠ durability | `tests/unit.test.mjs`, `tests/transport.test.mjs` | `AudioWorkletProcessor` chạy trên Chrome thật NOT_RUN |

### Số kiểm thử

- `npm test` **36 PASS, 0 FAIL, 0 skipped**. Xem `evidence/unit-tests-round2.txt` (stdout đầy đủ).
- `npm run test:virtual3h` trả exit 0, dữ liệu metadata 518.400.000 frame (`48.000 Hz × 10.800s`). Batch 2.048 = 253.125 block, batch 4.096 = 126.563 block (partial cuối). Injection mất/trùng được phát hiện; **không ghi hoặc phát dữ liệu PCM 3h thực**. Đọc `virtual-3h.json` và `virtual-3h-run.txt`.
- Browser `--quick` exit 2 **NOT_RUN**: xem `browser-results.json` và `browser-run.txt`; không có lý do cơ sở để chấm PASS/FAIL engine.

### Giới hạn và bất biến

1. `CaptureClockMapper` dùng `AudioContext.getOutputTimestamp()` để ánh xạ **render/output context time** sang monotonic `performance` time; **không đo được hardware microphone input latency**. Nếu timestamp không có/không hợp lệ, không phát mốc giả. Note không được suy `valid media` từ mapping nếu chưa có storage manifest/ACK.
2. `PCM worker` còn chỉ giữ WAV prefix tối đa 8 giây và mô tả đầu/mốc mục tiêu phút 90/cuối, **không thể chứng minh full PCM 3h seek**. Bài 3 giờ CLI trên browser có mã chạy nhưng chưa chạy tại đây.
3. `MediaRecorder` timeslice là mảnh của **một container**: append liên tục vào File OPFS chẩn đoán, chưa có journal/flush bảo đảm chống crash, `durable:false` kể cả sau khi đóng file. Độ chính xác seek WebM/Opus dài và vấn đề metadata duration vẫn chưa được xác minh.
4. `recycle` chỉ hoàn trả ownership của transferable `ArrayBuffer`; `committedThroughSampleExclusive:null` giữ nguyên. G03 chỉ được cấp quyền durable ACK sau khi verify flush/journal, không dùng Worker acceptance thay thế.
5. Spool max 8MB/32 blob, retained-prefix 20MB, PCM pool ≤2MiB, clock mapping cap 12000 points; tình huống queue đầy được báo thiếu chứ không tự tạo silence/audio. Các counter/summary là các đối tượng thực đã kiểm trên Node, không phải benchmark CPU/RAM Windows.

## Kết luận

**G02-ADD-01..04 được sửa và có regression PASS Node độc lập. ADD-05 có streaming diagnostic PoC + negative tests PASS Node nhưng hiệu quả/seek thực chưa đo.** Không chốt AudioWorklet hay MediaRecorder làm production, không báo DONE G02/TC12/TC17/TC21/ứng dụng tích hợp. Ưu tiên tiếp theo là Windows Chrome/Edge: browser synthetic short + stress, ngắt micro vật lý, chuyển tab, audio online conditional, và chạy 3h wall-clock từ nguồn có marker với full WebM seek và đối chứng sample/audio duration.
