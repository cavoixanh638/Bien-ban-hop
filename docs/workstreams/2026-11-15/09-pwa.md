# 09-pwa · PWA offline, cập nhật và khóa đa tab

Bạn là chat Gemini **PWA offline, cập nhật và khóa đa tab** của [Mốc Họp](https://github.com/cavoixanh638/Bien-ban-hop). Thực hiện Phần nền tảng của Gói 1.5, PoC D.

- Nhánh làm việc: [gemini/20261115-09-pwa](https://github.com/cavoixanh638/Bien-ban-hop/tree/gemini/20261115-09-pwa).
- Baseline chung: [6142f56a6efdb27aa9445920c9321f7930c0d5fd](https://github.com/cavoixanh638/Bien-ban-hop/commit/6142f56a6efdb27aa9445920c9321f7930c0d5fd).
- [Checkpoint hiện hành](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-09-pwa/docs/workstreams/2026-11-15/checkpoints/09-pwa.md) · [Quy ước chung và hợp đồng fixture](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md) · [Mục lục](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/README.md).
- Chỉ ghi `poc/09-pwa/` và `docs/workstreams/2026-11-15/checkpoints/09-pwa.md` trên nhánh của mình.
- Tài liệu của repo: [docs/PLAN_V1_2.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/PLAN_V1_2.md) · [docs/ARCHITECTURE.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/ARCHITECTURE.md) · [docs/TECHNICAL_OPTIONS.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/TECHNICAL_OPTIONS.md) · [docs/ACCEPTANCE_TESTS.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/6142f56a6efdb27aa9445920c9321f7930c0d5fd/docs/ACCEPTANCE_TESTS.md).

## Kết quả người dùng nhận

Một trang PoC offline với Service Worker và exclusive writer lock, có thể cập nhật an toàn khi trạng thái ghi âm đang hoạt động.

## Bắt đầu và tiếp tục

Đọc checkpoint và quy ước, kiểm HEAD/diff và phiên đang chạy. Tự chuẩn bị fixture/adapter kể từ lượt đầu. Dùng checkout và lệnh chạy của nhánh này để hoàn tất; mọi đầu ra cần để build và test phải có ngay trong phạm vi được sở hữu hoặc là công cụ công khai có thể cài độc lập. Khi thay chat, chỉ một writer tiếp tục từ HEAD và checkpoint hiện hành.

## Phạm vi

- Sở hữu PoC web riêng, SW/manifest/cache, base path/scope, và adapter Web Locks/BroadcastChannel cho lease theo meeting. Demo có fixture trạng thái thu, Worker/OPFS nhỏ và app phiên bản trước/sau. Tab bận giữ bảo vệ dữ liệu, release lock khi đóng và phối hợp trạng thái giữa tab.
- Tách app-shell cache khỏi dữ liệu. Offline sau lần tải đầu, kiểm kích hoạt bản cập nhật khi an toàn, thao tác reload có chủ ý, migration harness, quyền thu hồi và `crossOriginIsolated=false`. Ghi phương án origin tách biệt trên HTTPS; test local/địa chỉ thử đã được ủy quyền.

## Điều kiện hoàn tất

- TC32–TC35 theo phần PWA: hai tab tranh quyền, tab writer đóng/crash, offline reload, phiên thu đang chạy khi có SW mới, lần mở sau nâng cấp giữ dữ liệu fixture, base path chuẩn. Chỉ ghi môi trường GitHub Pages PASS nếu đã đo trên đó hoặc ghi rõ điều kiện thực tế đang thiếu.

## Bàn giao

Demo và config, bộ test hai context/tab và offline/update, contract writer lease, kết quả và hướng dẫn tích hợp cho app. Ghi link/revision, trạng thái và điều còn thiếu vào checkpoint của chính nhánh, push sau khi xem diff. Khi đang làm, cập nhật checkpoint theo [quy ước chung](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md).
