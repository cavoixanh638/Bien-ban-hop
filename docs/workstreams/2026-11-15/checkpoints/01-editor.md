# Checkpoint · 01-editor

- Chủ sở hữu: 01-editor (ChatGPT tiếp quản luồng)
- Nhánh ghi duy nhất: `gemini/20261115-01-editor`
- Baseline: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- HEAD kiểm tra lúc tiếp quản: `da129e0c67a393b349750a59424abbc41f32f47a` (ahead baseline 1 commit chỉ chứa checkpoint)
- Trạng thái: **IN_PROGRESS**
- Code SHA: chưa có code · Tested SHA: —
- Kiểm thử: **NOT_RUN** · Môi trường/run: đang chuẩn bị fixture độc lập

Entrypoint: [01-editor.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/01-editor.md) · [Hợp đồng chung](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md).

## Đã làm
- Đọc `COMMON.md`, `AGENTS.md`, PLAN, STATUS, ACCEPTANCE, TIMELINE_RULES và ARCHITECTURE/TECHNICAL_OPTIONS.
- Kiểm nhánh làm việc: có đúng một commit checkpoint kể từ baseline, chưa có `poc/01-editor/`; không kế thừa kết quả PASS.
- Xác định đầu vào: adapter audio giả theo NoteDocument `timeSpan` đã đóng băng; toàn bộ PoC/test/fixture đặt độc lập trong `poc/01-editor/`.

## Đang thực hiện
1. Làm schema Tiptap/ProseMirror và lớp InputTracking dựa transaction, selection, vùng từ, beforeinput/input/composition.
2. Bản demo, kịch bản test tự động TC01–TC11, trace recorder/replay fixture, đo P95 và độ phân mảnh.
3. Ghi kết quả đúng môi trường đã chạy; Windows UniKey/EVKey thực **NOT_RUN** cho tới khi có trace thiết bị thực.

## Còn thiếu để READY_FOR_REVIEW
- Code, build/test browser, log, thống kê TC01–TC11, quan sát thực UniKey/EVKey Windows Chrome/Edge với Telex/VNI gồm Backspace+Insert không composition và máy tải nặng.
- Không thay fixture thành evidence gõ bộ gõ thật.

WIP/chưa push: chưa có ở bước này · Chặn bên ngoài: không có quyền điều khiển bộ gõ Windows thật trong môi trường ChatGPT; sẽ chuẩn bị trace page và hướng dẫn thu.
