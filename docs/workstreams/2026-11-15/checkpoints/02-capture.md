# Checkpoint · 02-capture

- Chủ sở hữu: worker 02-capture · Thu âm và vận chuyển dữ liệu
- Nhánh: `gemini/20261115-02-capture`
- Baseline: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- Trạng thái: **PARTIAL / BROWSER_BLOCKED** (PoC mã nguồn đã bàn giao, **không DONE**, chưa đủ tiêu chí nghiệm thu)
- Code SHA: `6898ec9b11c296427f11479c31514ecda13a08b4`
- Tested code: nội dung 18 tệp trong commit trên; Node.js 22.16.0
- Kết quả: **11/11 PASS** Node unit/integration; metadata 3 giờ **PASS_METADATA_ONLY**; Chromium browser benchmark **NOT_RUN — BLOCKED_ENV**.
- Môi trường: Linux x86_64; Chromium headless 144.0.7559.96 có quản trị URLBlocklist `["*"]`, chặn localhost. **Không phải Windows Chrome/Edge thực**; không có micro/online audio track thật.

Entrypoint: [02-capture](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/02-capture.md) · [COMMON](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md).

## Đã làm / code bàn giao

1. [Mã PoC + demo](https://github.com/cavoixanh638/Bien-ban-hop/tree/gemini/20261115-02-capture/poc/02-capture): AudioWorklet f32le mono → MessageChannel riêng → Worker, pool ArrayBuffer hữu hạn, batch 2.048/4.096, runtime quantum length, `sequenceNo/firstSample/sampleCount`, pause/resume/unavailable/gap, queue/burn/delay, ACK tái sử dụng khác ACK durability.
2. MediaRecorder đối chứng cùng source node, MIME runtime, timeslice, kiểm đọc/seek qua browser runner khi môi trường cho phép; demo nguồn tổng hợp, micro, display audio có track.
3. [README vận hành](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-02-capture/poc/02-capture/README.md), [báo cáo chạy](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-02-capture/poc/02-capture/evidence/run-report.md), [unit log](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-02-capture/poc/02-capture/evidence/unit-tests.txt), [virtual-3h](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-02-capture/poc/02-capture/evidence/virtual-3h.json), [browser-blocker](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-02-capture/poc/02-capture/evidence/browser-results.json).
4. Test Node chạy `cd poc/02-capture && npm test`: 11 PASS, 0 FAIL. `node tests/virtual-3h.mjs`: 518.400.000 frame/10.800 giây theo **metadata**, 253.125 batch 2.048 hoặc 126.563 batch 4.096; phép chèn thiếu/trùng được nhận diện.
5. `npm run test:browser -- --quick`: công cụ thực thi, nhưng browser bị chính sách chặn khi truy cập localhost; exit 2, **0 browser PASS, 0 FAIL, 1 NOT_RUN**. Chính sách được phát hiện trực tiếp từ trang lỗi Chrome, không thay đổi/chọc qua policy.

## Các phần còn thiếu để DONE

- Thu **3 giờ thời gian thực** và phát/tua toàn bộ file ở đầu/giữa/cuối, mẫu đối chứng, CPU/RAM/batch cadence và mất mẫu trên Windows Chrome/Edge thật; hiện **NOT_RUN**.
- Browser benchmark cả hai engine **cùng nguồn** và các case chuyển tab, worker stress, nghẽn hàng đợi, pause/resume, track-ended/micro rút vật lý; hiện **NOT_RUN**.
- Đo/đối chiếu decode/seek WebM blob toàn phần và fragment; không được mặc định timeslice độc lập; **NOT_RUN**.
- TC21 audio online từ track thực; **NOT_RUN** do thiếu Windows và nguồn.
- OPFS flush/journal/recovery/quota thuộc luồng 03, **không báo đã hoàn tất ở 02**.
- Chưa đủ số liệu để kết luận lựa chọn engine; tạm ưu tiên Worklet cho phép đo tiếp theo, giữ MediaRecorder đối chứng.

## Tiếp quản

Chỉ một writer tại nhánh này; tiếp tục từ HEAD hiện hành. Không chờ output luồng khác để chạy PoC riêng. Dùng `poc/02-capture/package.json` và lệnh trong README; chạy trên Windows Chrome/Edge có quyền localhost/HTTPS; lưu kết quả/thông số/log ở `poc/02-capture/evidence/`, cập nhật checkpoint đúng tested SHA. Không tự động đổi kết quả fixture sang nghiệm thu ứng dụng.

WIP/chưa push: **none** · Chặn bên ngoài: browser policy trong container, Windows/micro/screen audio thật và bài thu 3 giờ wall-clock.
