# Capture 02 · Báo cáo chạy độc lập (15/11/2026)

## Môi trường

- Linux x86_64 container, Node.js `v22.16.0`, Chromium `144.0.7559.96` (headless), ffprobe có sẵn, không phải máy Windows người dùng.
- Không có micro vật lý hay audio track màn hình/thực; Chromium được quản lý bởi chính sách `URLBlocklist: ["*"]`; trang localhost chuyển sang `chrome-error://chromewebdata/` với thông báo tổ chức chặn. **Không chỉnh chính sách để chạy bài test.**
- Browser harness đã chạy và **BLOCKED_ENV** trước ca đo. CPU/RAM mỗi engine, HTMLAudioElement decode/seek, timeslice MediaRecorder, micro thật, tab visibility, TC21 = **NOT_RUN**.

## Đã chạy

| Test | Nguồn | Kết quả | Bằng chứng |
|---|---|---|---|
| 11 unit/integration case | Node pure logic + `worker_threads` MessageChannel Transferable, buffer ownership | **11 PASS / 0 FAIL** | [`unit-tests.txt`](unit-tests.txt) |
| Kiểm tra 2.048/4.096, quantum không cố định, pool, queue nghẽn, pause/resume và track ended | Fake Worklet trong Node + Worker thực | **PASS trong mô phỏng Node**, không phải AudioWorklet chạy Chrome | [`unit-tests.txt`](unit-tests.txt) |
| Duyệt index 3 giờ, 48 kHz, 518.400.000 frames, 2.048 và 4.096 | Metadata generator, không đọc/ghi PCM thật | **PASS_METADATA_ONLY** | [`virtual-3h.json`](virtual-3h.json) |
| Browser compare/timeslice/CPU/RAM/decode/seek | Chromium headless cùng host | **NOT_RUN — BLOCKED_ENV** | [`browser-results.json`](browser-results.json) |
| 3 giờ âm thanh thời gian thực | Chrome/Edge Windows | **NOT_RUN** | Thiếu môi trường và thiết bị |
| OPFS crash/quota/flush | luồng 03-opfs | **Ngoài phạm vi 02** | Không đánh PASS |

## Dữ liệu mô phỏng 3 giờ

- `48.000 Hz × 10.800 giây = 518.400.000 frames`.
- Batch **2.048** → **253.125** block metadata; batch **4.096** → **126.563** block (khối cuối partial).
- Đầu `sampleIndex=0`, giữa `259.200.000` (90 phút), cuối `518.399.999`; một hàm signature xác định cho ba vị trí, xem JSON. Không tạo dữ liệu PCM 2 GB để giả lập ghi âm.
- Dữ liệu bình thường: `receivedFrames=518400000`, `missingFrames=0`, `overlappedFrames=0`, `sequenceErrorCount=0` theo logical ledger.
- Chèn lỗi cố tình thiếu một batch và lặp một batch: phát hiện đủ `missingFrames=batchFrames`, `overlappedFrames=batchFrames`, `sequenceErrorCount=2`.
- **Chú ý**: các con số trên là phép duyệt metadata/logic mẫu, không phải tốc độ ghi, dung lượng file, sample dropout thực, CPU/RAM hay tín hiệu ghi nhận trong Chrome. Không thể dùng chúng để quyết định engine production.

## Tình trạng TC và kiến nghị

- **TC12:** Worklet/transfer trên Node PASS đối với logic; ghi 3 giờ thực và xác minh phát/tua **NOT_RUN**.
- **TC13:** pause/resume trên mock + worker PASS; drift Chrome thật **NOT_RUN**.
- **TC14:** unavailable/track-ended logic PASS; ngắt micro vật lý **NOT_RUN**.
- **TC15/19:** OPFS durability/crash/quota cần luồng 03; **NOT_RUN** trong capture.
- **TC17:** khung `sampleIndex/inputMonoMs` được xuất, chưa hiệu chuẩn latency/cross-clock/dẫn liệu beep thực; **NOT_RUN**.
- **TC21:** audio online chỉ hợp lệ nếu có audio track thật trên nền tảng cụ thể; **NOT_RUN**.

Tạm giữ AudioWorklet/PCM làm ứng viên ưu tiên để tiếp tục đo vì có kiểm soát số frame và gap; MediaRecorder giữ làm đối chứng độc lập. Không chốt engine hoặc Gói 1.2 DONE khi browser/wall-clock/durability chưa có chứng cứ.
