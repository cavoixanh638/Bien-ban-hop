# Checkpoint · 09-pwa

- Chủ sở hữu: Gemini 09-pwa
- Nhánh: `gemini/20261115-09-pwa`
- Baseline: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- Trạng thái: **READY_FOR_REVIEW (mã PoC độc lập đã bàn giao; runtime browser NOT_RUN)**
- **Code SHA / Tested source SHA:** `46e82448d03c710eef8f1feeb74fb073d9b13737`. Test chạy trên source local đồng nội dung các file đã đẩy; đã xác minh `app.js` SHA blob `7398242c5e63ecbd298ab487ed4eebd4474b1b18` và `tests/RESULTS.md` blob `141f0c73f2615b4e76740d7b1e7543c64682ba58` bằng GitHub fetch.
- Kiểm thử: **10/10 PASS (Node v22.16.0, mock logic)**; **browser Chromium/Playwright NOT_RUN** do chính sách quản trị chặn `http://127.0.0.1` (`net::ERR_BLOCKED_BY_ADMINISTRATOR`). GitHub Pages và Windows Chrome/Edge: **NOT_RUN**.
- Commit mã: [46e82448](https://github.com/cavoixanh638/Bien-ban-hop/commit/46e82448d03c710eef8f1feeb74fb073d9b13737).
- Demo nguồn: [poc/09-pwa/](https://github.com/cavoixanh638/Bien-ban-hop/tree/gemini/20261115-09-pwa/poc/09-pwa).
- Chi tiết test: [tests/RESULTS.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-09-pwa/poc/09-pwa/tests/RESULTS.md); hướng dẫn chạy và tích hợp: [README.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-09-pwa/poc/09-pwa/README.md).
- Entrypoint: [09-pwa](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/09-pwa.md) · [COMMON.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md).

## Đã làm

1. Đọc và bám theo entrypoint, COMMON, AGENTS, PLAN, ARCHITECTURE, TECHNICAL_OPTIONS, ACCEPTANCE_TESTS và STATUS. Tiếp quản nhánh từ checkpoint NOT_STARTED; xác minh diff với baseline và không có mã worker trước đó.
2. Viết PoC static offline không phụ thuộc luồng khác trong `poc/09-pwa/`: manifest, icon PNG/SVG, Service Worker chỉ cache app-shell, base-path/scope tương đối; trang fixture với văn bản ProseMirror JSON/timeSpan và dummy OPFS bytes.
3. Adapter Web Locks dùng một exclusive writer theo `meetingId`, chỉ một tab được ghi; khóa shared maintenance bảo vệ mọi phiên writer; nâng cấp/migration phải xin exclusive maintenance; BroadcastChannel chỉ gửi trạng thái, không cho phép ghi.
4. Fixture IndexedDB compare-and-swap revision, chỉ hiển thị `Saved` sau `transaction.complete`. Worker/OPFS chỉ ACK sau flush/close; phản ứng lỗi, không báo saved giả.
5. Kiểm soát lifecycle PWA: không `skipWaiting` mặc định, không tự reload, chặn kích hoạt khi một tab còn writer, cache tách khỏi dữ liệu; giữ old shell cache. Migration v1→v2 atomic transaction có snapshot, kiểm timeSpan/recording và refuse unknown/mixed schema. Dùng transferable ArrayBuffer và Dedicated Worker, không cần SAB hoặc `crossOriginIsolated=true`.
6. Viết 10 test Node/mock (`npm test`), kết quả **10 PASS / 0 FAIL**, kèm âm tính: lock bị tranh, thiếu Web Locks, schema sai, dữ liệu mốc sai, worker short write, SW chưa được phép activate. Thêm 7 browser scenario Playwright có server localhost và nâng phiên bản v1→v2 trong copy tạm: 2 tab, tab đóng/crash, offline+OPFS, update đang thu, migration atomic, conflict, base path/cache.
7. **Đã commit/push lên đúng nhánh** và xem GitHub compare: nhánh ahead baseline 4 commit (gồm 3 checkpoint/code trước đây), đúng 22 file mới dưới `poc/09-pwa/` và checkpoint, không đổi tài liệu/luồng khác. Không force-push, merge main, deploy Pages hoặc DNS.

## Bằng chứng

- Môi trường unit: Node `v22.16.0`; lệnh `cd poc/09-pwa && npm test`; output: `# tests 10; # pass 10; # fail 0`, thời gian cuối 105–116 ms.
- Môi trường browser đã thử: Chromium 144.0.7559.96 trong container, chính sách `URLBlocklist: ["*"]`. Playwright chặn ngay ở điều hướng localhost trước khi vào test; không bỏ qua/chỉnh chính sách máy. Kết quả thực địa browser: **NOT_RUN**.
- Fixture: `meeting-poc09-01`, `rec-poc09-001`, `anchor-001`; không có ghi âm họp thật. PoC mô phỏng ghi âm, không dùng mic.
- Cross-origin isolation/origin: logic không dùng SAB và có bài kiểm trên Chrome chờ chạy để xác nhận `crossOriginIsolated=false`. Chưa được chứng minh trên GitHub Pages thực. Shared `*.github.io` origin không phải vùng lưu dữ liệu thực; ưu tiên dedicated HTTPS origin.

## Còn thiếu / HOLD trước khi chốt DONE

- Chạy **7 browser Playwright scenarios** trên Chrome/Edge không có URL policy chặn localhost; ghi browser version, ảnh/trace, kết quả từng TC32–TC35, sửa nếu phát hiện runtime issue.
- Test thực tế Windows Chrome/Edge: tab crash/lock release, offline reload, SW waiting update đang ghi, migrate dữ liệu phiên bản cũ giữ notes/Mark/OPFS; chỉ kết luận browser PASS khi đo.
- Thử bản GitHub Pages HTTPS/base path và origin riêng **khi được ủy quyền triển khai**, ghi scope/HTTP header và `crossOriginIsolated`; không ghi PASS Pages dựa localhost/mock.
- Tích hợp encoder/recording status thật, journal/manifest recovery và external backup thuộc đợt khác. PoC này không chứng minh bản ghi micro 3 giờ, quota hoặc an toàn dữ liệu của app tích hợp.

## Tiếp theo cho tổng chỉ huy / lượt tiếp quản

1. Checkout SHA `46e82448...`; chạy `npm test` trong `poc/09-pwa/`. Tất cả test fixture tự chứa, không đợi luồng khác.
2. Khi có Chrome/Edge được phép mở localhost, chạy `python -m pytest -q poc/09-pwa/tests/test_pwa.py`, đối chiếu testcase với `tests/RESULTS.md`; test fail phải sửa trên nhánh này, không nâng trạng thái trước.
3. Sau khi nghiệm thu runtime, báo kết quả cho 00-command để ráp adapter; giữ đóng băng COMMON và không sửa tracker của 00.

WIP/chưa push: **không** · Chặn bên ngoài: browser localhost bị URLBlocklist; live Windows/Pages chưa được cấp môi trường.
