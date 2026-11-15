# Checkpoint · 03-opfs — tiếp tục ngày 15/11/2026

- Owner / branch: G03 OPFS — `gemini/20261115-03-opfs`.
- Baseline: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`.
- **Status: READY_FOR_REVIEW (PoC độc lập, KHÔNG phải nghiệm thu OPFS/ứng dụng tích hợp)**. Không tuyên bố DONE khi cổng browser OPFS và Windows vẫn NOT_RUN.
- **Code SHA: `58cdba99afd1d2d3308b9996013766876eff88c1`** (toàn bộ mã, test và evidence trước commit checkpoint này).
- **Tested SHA: `58cdba99afd1d2d3308b9996013766876eff88c1` — xác minh nội dung byte-identical**, xem giới hạn checkout bên dưới.
- **Exact clean `git clone` checkout từ remote: NOT_RUN** do container không resolve được `github.com`; thay thế đã đối chiếu `git hash-object` cục bộ với 19 blob SHA ở Git-tree G03 đúng HEAD nêu trên, bao gồm toàn bộ executable files, tests, package, docs/log. Chạy Node trên chính các byte nguồn có blob SHA trùng commit; không suy diễn rằng lệnh `git clone` thành công.
- Đối chiếu diff baseline→HEAD: chỉ `poc/03-opfs/**` và checkpoint này, không sửa `COMMON.md`, tracker G00 hay nhánh khác. Không merge/deploy.

Entrypoint [03-opfs](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/03-opfs.md) · [COMMON](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md) · [README PoC](https://github.com/cavoixanh638/Bien-ban-hop/tree/gemini/20261115-03-opfs/poc/03-opfs) · [Evidence](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-03-opfs/poc/03-opfs/EVIDENCE.md).

## Đã sửa và triển khai

1. **Sửa lỗi mất dữ liệu đang ghi**: `readSample()` trước flush không gọi destructive reconcile/truncate. Đoạn chưa commit là `pending`, `reconcile()` từ chối chạy lúc có pending writes; phần cũ đã commit vẫn đọc được.
2. **Seek tối ưu**: một lần full CRC reconciliation khi reopen; mỗi seek tiếp theo xác minh header và CRC của chunk được truy cập, không quét lại toàn bộ 3 giờ. Kiểm CRC lại khi file bị sửa *sau* reopen, trả `missing` có reason.
3. **Bảo toàn recovery**: báo committed sample/byte ranges, gap/missing/unavailable với lý do; không nối nguồn audio sai. Truncate byte dư chưa journal, sửa WAV header khi đủ dữ liệu, không ghi tiếp vào segment hỏng/mất, không tự nâng orphan thành committed.
4. **Worker và journal**: Dedicated Worker RPC tuần tự hóa append/flush, tách `bufferReleased` ACK khỏi `committedThroughSampleExclusive` ACK; OPFS SyncAccessHandle flush trước transaction IndexedDB. `IDBJournal.add` bảo vệ `init` không vô ý ghi đè recordingId đã có; lỗi init dọn tài nguyên.
5. **Hợp đồng**: PCM f32le deterministic, 300s WAV segments, per-chunk `firstSample/sequenceNo/sampleCount/CRC32/byteOffset`; Audio Manifest `recorded/gap/unavailable` không bịa media offsets cho gap. Không import code của worker khác.
6. **Fixture/tài liệu/run**: `test.mjs`, `test-extended.mjs`, `test-worker.mjs`, `node-worker-harness.mjs`, `bench.mjs`, `probe-wav.mjs`, `browser-test.html`, `README.md`, `EVIDENCE.md`, logs đã push.

## Kết quả PASS (đúng môi trường được nêu)

| Nhóm | Kết quả | Môi trường, lệnh, chứng cứ |
|---|---|---|
| Deterministic fault/CRC/ack/recovery | **PASS 25/25**, FAIL 0 | Node v22.16.0/Linux x64; `npm test`; [TAP](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-03-opfs/poc/03-opfs/logs/node-tests.tap). Gồm 3 bài thật sự terminate/reopen Node Worker thread, filesystem fsync + JSON journal mock (không phải browser Worker/IDB). |
| 3h @ 48 kHz synthetic | **PASS**, 518,400,000 sample / 2,073,600,000 PCM byte, 36 segment, 2160 committed range, **0 unavailable/gap**, seek 4/4 valid | `npm run bench`, Node filesystem fsync + **memory journal**, không phải OPFS thật. [Log 48k](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-03-opfs/poc/03-opfs/logs/bench-48k.txt) |
| Latency và RAM của benchmark 48k | **MEASURED**, write P95 8.102ms, flush P95 5.539ms, seek P95 4.868ms (**n=4**), peak RSS 89.7MiB; full recovery CRC ~9847ms | Accelerated synthetic workload ~31.4s wall-time; không phải 3h real-time ghi micro; giới hạn kiểm thử rõ trong [EVIDENCE](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-03-opfs/poc/03-opfs/EVIDENCE.md). |
| Chưa xác nhận lưu theo cadence mock | **MEASURED max 5.0s** PCM pending / ~960,000 bytes; không bảo đảm bound khi CPU/OS/browser đình trệ | 5s chunks + flush sau mỗi chunk, Node mock, không phải proof ~10s dưới stress. |
| WAV header decoder | **PASS** ffprobe xác nhận 1.000s stereo 48k `pcm_f32le` | `node probe-wav.mjs`; [log](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-03-opfs/poc/03-opfs/logs/probe-wav.json). |
| 3h quick 1k | **PASS** | `npm run bench:quick`; [log](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-03-opfs/poc/03-opfs/logs/bench-1k.txt). Không thay benchmark 48k. |

## Chưa chạy / NOT_RUN

- **NOT_RUN Windows Chrome/Edge thật**: AudioWorklet live→Worker→OPFS, 3h wall-clock, browser PCM read/seek, storage browser CPU/RAM, WAV playback thật.
- **NOT_RUN browser OPFS + IndexedDB**: `browser-test.html` được chuẩn bị để thử crash giữa OPFS flush và IDB commit, reopen, discard tail và tiếp tục ghi; Chromium 144 (Linux container) chặn mọi navigation `localhost/file/data:` với `ERR_BLOCKED_BY_ADMINISTRATOR`. [Log blocker](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-03-opfs/poc/03-opfs/logs/browser-attempt.md).
- **NOT_RUN quota browser thực, kill browser/tab thật, Windows sleep và mất điện**. Fake quota và Node Worker terminate là **PASS simulation**, không thay các cổng này.
- **NOT_RUN clean remote checkout `git clone`** (không có kết nối mạng container). Đã kiểm Git blob equality, không tự gọi đó là clone sạch.
- **NOT_RUN toàn TC12–TC21 trên app tích hợp**, vì PoC chưa lắp với 02 capture, 04 timeline, 05 player, 09 lock/PWA.

## Hướng dẫn tiếp tục / điều kiện chốt

1. Trên Windows Chrome và Edge, chạy `poc/03-opfs/browser-test.html` từ localhost/HTTPS và ghi lại browser version, committed/unavailable ranges, quota/Worker failure logs.
2. Chạy phiên thu PCM 3h **theo thời gian thực** với AudioWorklet/transferable, đo queue/backpressure, CPU/RAM/flush lag; kiểm mục tiêu phần chưa ACK khoảng 10 giây trong tải nặng, không dựa riêng vào cadence mock 5 giây.
3. Kiểm mất nguồn/tab/browser thực, lập bằng chứng TC12/15/18/19; báo thiếu/rủi ro theo quyền và thiết bị. Không có giao dịch atomic OPFS+IDB; không hứa chống mất điện tuyệt đối.
4. G00 chỉ xét tích hợp khi các gate liên quan đủ. PoC G03 không tự merge, deploy hoặc cập nhật STATUS chung.

WIP/chưa push: **không** (đối chiếu Git-tree và diff xong). Những bài cần môi trường khác vẫn **NOT_RUN**, không ghi PASS giả.
