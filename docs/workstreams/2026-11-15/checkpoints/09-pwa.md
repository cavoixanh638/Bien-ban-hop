# Checkpoint · 09-pwa

- Chủ sở hữu: Gemini 09-pwa
- Nhánh: `gemini/20261115-09-pwa`
- Baseline: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- Trạng thái: IN_PROGRESS (2026-11-15)
- Nhánh HEAD lúc tiếp quản: `713f84f31874d91455199dfa505ce5af151546e5` (ahead baseline 1 commit, chỉ checkpoint)
- Code SHA: — · Tested SHA: —
- Kiểm thử: NOT_RUN; chưa khẳng định GitHub Pages PASS.
- Phạm vi ghi: `poc/09-pwa/` và checkpoint này.

Entrypoint: [09-pwa](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/09-pwa.md) · [COMMON.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md)

## Đã làm

- Đọc task, COMMON, AGENTS, PLAN, ARCHITECTURE, TECHNICAL_OPTIONS, ACCEPTANCE_TESTS và STATUS baseline.
- Xác minh nhánh chỉ khác baseline ở checkpoint ban đầu. Không có mã `poc/09-pwa/` trước lượt này.
- Chốt đường độc lập: static PoC + manifest/SW + IndexedDB migration + Web Locks/BroadcastChannel + fixture Worker/OPFS + Playwright browser test; không import worker khác.

## Còn thiếu

- Mã PoC, test hai tab/offline/update/migration và bằng chứng runtime.
- Kiểm thử thực địa Windows Chrome/Edge và GitHub Pages HTTPS/base path.
- Origin riêng cần quyết định tên miền/HTTPS ở đợt phát hành; không dùng dữ liệu thật trên shared Pages origin.

## Tiếp theo

1. Triển khai PoC và bộ fixture độc lập, đưa test vào đúng thư mục được sở hữu.
2. Chạy TC32–TC35, kiểm soát lỗi/crash/negative case; lưu kết quả và lệnh chạy.
3. Rà diff, commit và cập nhật checkpoint theo SHA.

WIP/chưa push: chưa có · Chặn bên ngoài: chưa kiểm chứng Pages, Windows thật.
