# Checkpoint · 03-opfs

- Chủ sở hữu: chat 03-opfs
- Nhánh: `gemini/20261115-03-opfs`
- Baseline: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- Trạng thái: IMPLEMENTED_AWAITING_EXACT_SHA_AND_BROWSER_VALIDATION (không gọi DONE)
- HEAD mã và evidence trước checkpoint: `e998a9ac343c9696d74c00ff2b87c48ef0818915`
- Code SHA: `e998a9ac343c9696d74c00ff2b87c48ef0818915`
- Tested SHA: **—** (bài test đã chạy trên bản prototype local tương đương logic, không phải checkout chính xác GitHub)
- Node deterministic simulation: local **PASS 10/10**, Node v22.16.0; exact pushed SHA **NOT_RUN**
- Synthetic 3h Node benchmark: local **PASS** quan sát dữ liệu và sample seek; browser/Windows thật **NOT_RUN**
- Git diff từ baseline: đúng phạm vi `poc/03-opfs/` và checkpoint này; không sửa file worker khác.

Entrypoint: [03-opfs](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/03-opfs.md) · [COMMON](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md)

## Đã làm và push
- `poc/03-opfs/core.mjs`: PCM f32le -> WAV IEEE float32 segments, offset/sample sequence, chunk CRC32, flush -> journal transaction, crash fault injection, reconcile + committed byte/sample ranges + missing/gap/repair.
- `poc/03-opfs/adapters.mjs`: OPFS SyncAccessHandle/IDB thật và memory adapters độc lập.
- `poc/03-opfs/worker.mjs`: Dedicated Worker RPC `init/append/flush/reconcile/seek/manifest/metrics/close`.
- `poc/03-opfs/test.mjs`: 10 deterministic tests, không phụ thuộc worker khác.
- `poc/03-opfs/node-adapter.mjs`, `bench.mjs`: benchmark fsync 3h tổng hợp; `browser-test.html`: smoke trong browser.
- `README.md` và `EVIDENCE.md`: lệnh chạy, schema/layout, dữ liệu và giới hạn minh bạch.

## Kết quả local (không áp cho exact committed SHA)
- 10/10 test pass trong ~475 ms, các fault: crash sau flush trước journal, sau journal, header hỏng, checksum, file ngắn/mất, thiếu/trùng sequence, quota và lỗi journal.
- 3h tổng hợp @1 kHz mono, 43.2 MB PCM, 36 segment, 10,800,000 sample committed, 0 unavailable, seek đầu/giữa/cuối valid; fsync backend Node + journal giả.
- Wall ~11.91 s (simulation), sampled peak RSS ~60 MiB, 1,319 flush, write 282.78 ms, flush 812.94 ms, journal 924.33 ms; pending tối đa 8.192s theo cấu hình test, không chứng minh ở 48 kHz. Seek ~1.5–1.6 s vì recheck mọi CRC.
- Cổng OPFS browser Windows Chrome/Edge, thiết bị thật, quota browser, kill browser, 48k 3h, real CPU/peak memory và exact checkout vẫn **NOT_RUN**.

## Điều chưa đạt trước DONE
1. Clone nhánh, chạy `cd poc/03-opfs && npm test && npm run bench`, ghi exact tested SHA, sửa ngay các lỗi nếu có.
2. Chạy `browser-test.html` qua localhost/HTTPS trên Chrome và Edge, lấy bằng chứng OPFS/IDB thật. Lần thử Chromium headless trong môi trường hiện tại không có kết quả ổn định; không gắn PASS.
3. Đo workload 48 kHz thực theo TC12/15/18/19, quota thật, shutdown/reopen, WAV playback, p95 seek/flush, giới hạn ~10 giây.
4. Tối ưu seek checksum toàn manifest và journal snapshot khi dữ liệu lớn; kiểm cơ chế mở file chỉ một writer (thuộc luồng 09 khi tích hợp).

## Cảnh báo an toàn
Khoảng chưa có ACK journal không được xem là durable. CRC32 chỉ kiểm lỗi vô ý. OPFS và IndexedDB không atomic; không hứa chắc chắn chống mất điện. Không gắn PASS Gói 1.2/TC12–TC21 từ PoC fixture.

WIP/chưa push: — · Chặn bên ngoài: kiểm thực tế Windows Chrome/Edge và exact checkout chưa có bằng chứng.
