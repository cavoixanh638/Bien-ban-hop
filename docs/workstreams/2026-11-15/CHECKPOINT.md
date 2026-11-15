# Checkpoint · 00-command

- Chủ sở hữu: ChatGPT tiếp quản luồng Gemini 00-command (writer duy nhất cho nhánh này)
- Nhánh: `gemini/20261115-00-command`
- Baseline: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- HEAD đầu lượt (đã đọc): `6feb6d9d30cc9e3f7800507794f25757ee0ddc97` (ahead baseline 2 commit, chỉ thêm docs/workstreams)
- Trạng thái: **IN_PROGRESS — fixture contract harness**
- Code SHA: chưa có · Tested SHA: chưa có
- Kiểm thử: **NOT_RUN**; môi trường dự kiến: Linux, Node.js v22.16.0, npm 10.9.2 (chưa phải Windows/Chrome/Edge)
- Phạm vi ghi: `poc/00-contract-tests/`, `docs/workstreams/2026-11-15/CHECKPOINT.md`, `docs/workstreams/2026-11-15/TRACKER.md`.

Entrypoint: [00-command.md](00-command.md) · [COMMON.md](COMMON.md).

## Xác minh ban đầu

- Đọc entrypoint, COMMON, AGENTS, PLAN, STATUS, ACCEPTANCE_TESTS, ARCHITECTURE, TIMELINE_RULES, AUDIO_DESIGN.
- Nhánh chưa có `poc/00-contract-tests/`; checkpoint và tracker trước tiếp quản đều NOT_STARTED.
- Trong đợt fixture: **không** sửa hợp đồng đóng băng, không lấy code từ 9 worker, không tích hợp lên `main`/đưa ứng dụng vào production.
- Chỉ xem worktree qua GitHub Git-tree/API ở đầu lượt; chưa clone được nhánh riêng tại môi trường lúc này. Sau khi tạo code sẽ kiểm đúng SHA/tập file và chạy lại từ thư mục tự chứa.

## Đang thực hiện

1. Tự xây fixtures tiếng Việt/NoteDocument/timeSpan, multi-recording manifest có segment, pause/gap/missing/pending và clock/sample mapping.
2. Tạo reference adapters, hợp đồng xác thực provenance playback, save/revision/lease, PCM/checkpoint, restore/backup và cập nhật PWA giả lập.
3. Tạo negative tests bắt lỗi source sai/saved giả/hai writer; ma trận TC01–TC38 và runbook tích hợp Gói 1.1–1.6.

## Chưa có bằng chứng (NOT_RUN)

- TC01–TC38 **runtime**, Windows Unikey/EVKey, Chrome/Edge, ghi thật 3 giờ, OPFS/quota/crash, phát đa segment không mất tiếng, ZIP 0,5–2 GB, offline/PWA/service worker thực tế.
- 9 worker: phải đọc từng checkpoint/HEAD trước khi cập nhật tracker; không đánh dấu PASS theo suy đoán.

WIP/chưa push: sẽ cập nhật sau kiểm code và commit. Chặn bên ngoài: không có cho bộ fixture; runtime cần thiết bị, browser và mã worker ở đợt tích hợp.
