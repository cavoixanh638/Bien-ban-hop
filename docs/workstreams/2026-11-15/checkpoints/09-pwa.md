# Checkpoint · 09-pwa

- Chủ sở hữu: Gemini 09-pwa
- Nhánh: `gemini/20261115-09-pwa`
- Baseline: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- Trạng thái: IN_PROGRESS — hoàn thành mã PoC tại local; đang chuyển lên GitHub và đối chiếu.
- HEAD đã xác minh trước khi ghi: `3f77fd5671eb6f25ff97f8925e15b735fee19f4a`
- Code SHA: LOCAL_ONLY (chưa ghi bản code) · Tested SHA: LOCAL_ONLY
- Test: **10/10 PASS trên Node 22.16.0 với mocks**; Chromium/Playwright trên localhost **NOT_RUN** do policy `URLBlocklist=['*']`, `net::ERR_BLOCKED_BY_ADMINISTRATOR`.
- Phạm vi: chỉ `poc/09-pwa/` và checkpoint này.

Entrypoint: [09-pwa](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/09-pwa.md) · [COMMON.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md)

## Đã làm

- Đọc task, COMMON, AGENTS, PLAN, ARCHITECTURE, TECHNICAL_OPTIONS, ACCEPTANCE_TESTS, STATUS.
- Xác minh nhánh chỉ có checkpoint trước lượt này; không có writer/công việc WIP khác được quan sát trên nhánh.
- Xây demo static độc lập (shell cache/SW/manifest/icons, Web Locks + BroadcastChannel, IndexedDB shadow-copy migration v1→v2, Worker/OPFS byte fixture) và test Node 10 case; Playwright 7 tình huống gồm hai tab, offline, SW update khi ghi, v1→v2, rollback, CAS conflict, renderer crash.
- Tài liệu cục bộ: `poc/09-pwa/README.md`, `tests/RESULTS.md`, `tests/test_pwa.py`. Không dùng dữ liệu họp thật, không cần artifact từ worker khác.

## Còn thiếu

- Upload code/test và kiểm đúng SHA trên nhánh.
- TC32–TC35 **runtime browser NOT_RUN**; không coi mock PASS là nghiệm thu trình duyệt.
- Windows Chrome/Edge và GitHub Pages HTTPS/base path: NOT_RUN (chưa có môi trường được ủy quyền). Origin riêng cần cấu hình ở đợt phát hành.

## Tiếp theo

1. Push mã PoC đúng phạm vi và rà GitHub compare với baseline.
2. Ghi code/tested SHA; xác nhận commit đủ file.
3. Bàn giao Playwright suite cho môi trường trình duyệt được phép mở localhost, không thay đổi trạng thái runtime thành PASS.

WIP/chưa push: local folder `/mnt/data/bien-ban-pwa/poc/09-pwa/`; chặn bên ngoài: managed Chromium URLBlocklist.
