# Checkpoint · 05-player — PoC C1/C2

- Chủ sở hữu: 05-player (một writer); chỉ ghi `poc/05-player/` và checkpoint này.
- Nhánh: `gemini/20261115-05-player`; baseline: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`.
- **Code SHA:** `17e1b6f317b1989b194f90dd00fc687d263debdb` (phiên bản code, README và script benchmark đã kiểm).
- **Tested SHA:** `17e1b6f317b1989b194f90dd00fc687d263debdb` — từng Git blob của 8 tệp chạy đều khớp GitHub; kiểm lại từ thư mục nguồn độc lập sạch. Không thể `git clone` trực tiếp vì container không phân giải được github.com; **không được mô tả đây là clean Git remote checkout**.
- Log SHA provenance: `poc/05-player/evidence/exact-source-verification.json`. Sau Tested SHA chỉ commit các tệp evidence và checkpoint, không sửa source/runtime.
- **Trạng thái:** `STANDALONE_POC_VERIFIED_LINUX / HOLD_WINDOWS_AUDIO_AND_INTEGRATION`. Bản app tích hợp, Gói 1.4 và nghiệm thu sản phẩm **chưa PASS; chưa DONE**.
- Phiên chạy: 15/11/2026, Linux 6.18.57 x86_64, Node v22.16.0, Chromium Headless 144.0.7559.96; Python 3.13.5. Âm thanh tổng hợp PCM16 mono 16kHz, không sử dụng audio họp thật.

## Các việc đã sửa theo TRACKER của G00

1. **Đã sửa lỗi sai miền thời gian:** `resolve(ID,1805000)` bây giờ `valid/seg-006`; `meetingToMedia(ID,1805000)` trả `gap/paused`; meeting 1.815.000ms → media 1.805.000ms. Có converter ngược, không trộn `meetingMs` và `audioOffsetMs`.
2. Manifest fixture 36 đoạn có `mediaStartMs/mediaDurationMs/sampleStart/sampleCount/completionState`; recorded intervals có `mediaStartMs/mediaEndMs/segmentRefs` đầy đủ, non-recorded gap/pause có `segmentRefs:[]`. `validateManifest()` kiểm phạm vi, sample count và refs, không import G04.
3. Gap meeting 60:10–60:25 không còn tạo false gap trong media. Thêm **audio gap thực** `[7.420.000,7.422.000)` trong cùng seg-024 để kiểm player chặn chính xác; `missing seg-020`, pending, wrong source và khoảng chưa có coverage không fallback.
4. C1 chỉ sinh WAV clip hợp lệ, hai HTMLAudioElement/preload, `preservesPitch=true`, giải phóng URL không còn gắn với audio; không crossfade. C2 AudioContext lên lịch PCM 160ms với lookahead 750ms, giới hạn tại media gap và log underrun; không decode 3h.
5. UI play/pause, seek, tốc độ 0,5–2×, A–B qua segment, pre-roll 0/3/5/10 (có 15/30), Alt+Click/Ctrl+Alt+P/▶, click thường giữ editor/cursor, bỏ shortcut khi composition. Pre-roll qua gap/missing trả blocked và **không thay Mark gốc**.

## Ma trận bằng chứng (đúng source SHA)

| Nhóm | Trạng thái | Actual / bằng chứng |
|---|---|---|
| 36 segment/3h PCM, manifest/segmentRefs/meeting↔media, lỗi G00 | **PASS** | `node --test player.test.js` tại source SHA: 10/10, exit 0 |
| 04:58→05:02; seek 90/170; A–B, click thường và Alt+Click; missing/gap | **PASS (Chromium synthetic)** | `browser_smoke.py` 10/10, không có JS page error, log browser-smoke.json |
| C1 seek phút 90 / 170 | **PASS (measured, one run)** | ~521,9ms / 534,6ms trong Linux Chromium; phụ thuộc CPU/generate WAV, không cam kết latency production |
| C1 boundary 300.000ms; tap audio | **PASS (limited resolution)** | Event chuyển đoạn; tap ScriptProcessor 16ms thấy 0 silent block giữa tín hiệu có năng lượng trong run; **không đủ kết luận sample drop/duplicate bằng 0** |
| C2 boundary, stop ở gap nội bộ | **PASS (synthetic)** | C2 tại 300.000ms; no underrun trong run; không lên lịch qua gap media 7.420.000ms |
| Cao độ 0,75× và 0,9× (synthetic tone) | **PASS (FFT synthetic)** | C1 220Hz/220Hz; C2 165Hz/198Hz; chỉ phản ánh tone, không phải đánh giá nghe giọng nói |
| Bộ nhớ, nhiều đoạn và seek xa | **PASS (limited stress)** | 17 seek trên media 3h ảo, C1 max 2 Blob URL; RSS snapshot cao nhất nhóm Chromium PID **293.765.120 byte** (~280,2 MiB), không phải peak của phiên phát 3h |
| Browser full 3-hour wall-clock peak RAM/quota/tab background/CPU throttle | **NOT_RUN** | Chưa đo phiên nghe thật liên tục 3h |
| PCM sample-level gap/drop/duplicate qua audio loopback thiết bị ngoài | **NOT_RUN** | Event-level/16ms block không chứng minh mẫu chính xác |
| Giọng người 0,75×/0,9×, nghe bằng tai và so sánh chủ quan | **NOT_RUN** | Chỉ có sine-tone tổng hợp, không được gọi PASS âm sắc giọng |
| Windows Chrome/Edge + UniKey/EVKey thực | **NOT_RUN** | Không có Windows/IME trong môi trường chạy |
| ProseMirror/timeSpan, OPFS thật và ứng dụng tích hợp | **NOT_RUN** | Bàn giao PoC độc lập, chưa kết nối nhánh khác |

Không có FAIL còn mở trong bộ Node/browser synthetic cuối. **Lượt benchmark chạy gộp đầu tiên timeout (NOT_RUN cho lượt đó), chạy riêng lại PASS** cùng source SHA; ghi đúng trong `exact-source-verification.json`.

## File bàn giao, môi trường và cách tái hiện

- Mã và hướng dẫn: https://github.com/cavoixanh638/Bien-ban-hop/tree/gemini/20261115-05-player/poc/05-player
- Fixture/manifest/resolver: `player.js`, `timeline.js`; test: `player.test.js`; demo: `index.html`; automation: `browser_smoke.py`, `browser_benchmark.py`; không phụ thuộc code/fixture G04.
- Bằng chứng: `evidence/node-test.tap`, `evidence/browser-smoke.json`, `evidence/synthetic-benchmark.json`, `evidence/exact-source-verification.json`.
- Lệnh: `cd poc/05-player && npm test` (Node 22) và `python3 browser_smoke.py && python3 browser_benchmark.py` (Linux Playwright/Chromium, numpy, psutil). Test browser dùng `about:blank + data:` ES module để tránh DNS/localhost chặn, vẫn chạy trên engine Chromium thật.
- Các blob đã đối chiếu nằm trong `exact-source-verification.json`; không có credential hay audio cá nhân.

## Quyết định kỹ thuật và bước còn thiếu

**Chưa chốt production adapter.** Đề nghị C1 là ứng viên *thử giọng thật trên Windows trước*, vì giữ cao độ tone ở 0,75/0,9×; C2 là đối chứng cho đồng hồ nối mẫu nhưng thay pitch khi giảm tốc. C1 dùng `ended` để chuyển có thể khựng; C2 giữ lịch PCM nhưng phải đo underrun và giới hạn decoder trong ứng dụng thật. Không dùng crossfade vô điều kiện.

Để đạt điều kiện hoàn tất cuối của entrypoint: chạy Windows Chrome/Edge thực, nghe và đo lời nói ở 0,75×/0,9×, audio loopback nguyên bản qua 04:58→05:02 và A–B, xác minh sample-level drop/lặp/gap, peak RAM phiên dài, thao tác click thường/Alt+Click/bàn phím với ProseMirror+IME Windows. Không đổi NOT_RUN thành PASS chỉ vì synthetic fixture đạt.

**Không sửa COMMON.md, không merge main, không deploy.**
