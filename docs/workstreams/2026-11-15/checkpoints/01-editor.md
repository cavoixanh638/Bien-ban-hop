# Checkpoint · 01-editor — Gói 1.1 / PoC A

- **Owner/nhánh duy nhất:** `01-editor`, `gemini/20261115-01-editor`
- **Baseline chung:** `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- **HEAD bắt đầu lượt mới:** `71595a60626396fa07f04e539c12c9e7fb0da675`
- **Code SHA:** `78aa598d423bba2ebc3bba3562e6bcbea2c2f644`
- **Tested SHA (mã chính; blob-equivalent 4/4):** `78aa598d423bba2ebc3bba3562e6bcbea2c2f644` — Node test đã chạy trên bản local có 4 tệp source/test đổi mới **khớp chính xác Git blobs SHA** ở commit, không phải chạy qua `git clone`/Node sạch đúng SHA. Các tệp còn lại kế thừa từ 41 tests tại HEAD cũ.
- **Test:** **PASS 45/45**, 0 FAIL, exit 0, Linux x86_64, Node 22.16.0; `node --check` src/tests/scripts PASS. E2E Tiptap NOT_RUN; Windows IME NOT_RUN.
- **Trạng thái:** `IN_PROGRESS / GATE_1_1_HOLD`; **chưa DONE hoặc READY_FOR_REVIEW**.

[Entrypoint](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/01-editor.md) · [COMMON.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md) · [TRACKER G00](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/TRACKER.md).

## Đã đọc G00 và giải quyết phần mới

TRACKER hiện hành blob `e4d613ac6af6ed58a1d257fac6405379a878d9dc` ghi G01 thiếu Code SHA/Tested SHA mới khi code đã đạt 41 mock tests; bổ sung thông tin SHA trên checkpoint này. G00 **không giao bug runtime Editor cụ thể mới**; cổng thiếu là `npm install/build/test:e2e` trên browser và UniKey/EVKey Windows thực.

Đã tự rà ra và sửa ba vấn đề trong `poc/01-editor/`:
1. **Undo/Redo:** việc lọc transaction history trong collector xảy ra trước reset burst; giờ phát hiện `history$` **trước** collectTextChanges, xóa active, pendingDeletion, pendingPaste, lastIntent. Test đảm bảo gõ sau Undo dùng audio context mới, không kế thừa mốc cũ.
2. **Mốc tại con trỏ:** tại ranh giới linked/unlinked hoặc linked/foreign-invalid, không chọn ngầm mốc bên cạnh; trả `ambiguous`, UI hướng dẫn đặt con trỏ trong chữ. Đầu thực của tài liệu vẫn trả mốc liên kết hợp lệ.
3. **Clipboard:** HTML gửi ra ứng dụng ngoài strip `data-time-*`; copy trong cùng phiên giữ nguyên immutable ProseMirror Slice trong token store, dán nội bộ không bị đánh tráo audio metadata. Hai browser E2E specs mới đã viết nhưng NOT_RUN.

## Bằng chứng

| Bài | Kết quả | Nguồn |
|---|---|---|
| `npm run test:unit` | **PASS 45/45** | Node v22.16.0, Linux, bản local trùng Git blob của tệp thay đổi; [log tóm tắt](../../../../poc/01-editor/evidence/node22-45-summary.md) |
| `node --check` source + test + scripts | **PASS** | Node 22.16.0 |
| `npm install --offline --package-lock-only` | **FAIL do môi trường `ENOTCACHED`** | Không có cache `@playwright/test` |
| `npm run build` / Tiptap Playwright E2E | **NOT_RUN** | Npm registry không phân giải DNS; không xác nhận runtime |
| Linux Chromium native input (lượt trước) | PASS phạm vi ASCII event baseline, 56 events | **Không phải** Tiptap/Windows/IME thật |
| Windows Chrome/Edge UniKey × Telex/VNI và EVKey × Telex/VNI | **NOT_RUN** | Không có Windows hoặc IME được cấp quyền |
| 120 giây nhập thật không Enter + Backspace/Insert, sửa dấu muộn, paste Word, Undo/Redo, máy tải nặng | **NOT_RUN** | Không thể chứng minh từ fixture |
| P95 editor <100ms + TextNode/Mark/DOM/JSON dài trên máy Windows | **NOT_RUN** | Chưa có browser runtime |

**TC01–TC11 tổng thể: chưa nghiệm thu; giữ NOT_RUN/HOLD.** Các bài fixture PASS không thay điều kiện thực địa. Mốc và nguồn audio trong PoC đều synthetic.

## Liên kết/tài liệu

- [Demo / README](../../../../poc/01-editor/README.md), [policy](../../../../poc/01-editor/src/policy.mjs), [tracker](../../../../poc/01-editor/src/tracker.mjs), [Playwright](../../../../poc/01-editor/tests/editor.spec.mjs), [ma trận TC01–TC11](../../../../poc/01-editor/evidence/RESULTS.md).
- [TAP log trước đây 41/41](../../../../poc/01-editor/evidence/node22-41-tests.tap); [45/45 summary](../../../../poc/01-editor/evidence/node22-45-summary.md).

## Phần việc còn thiếu / cách chạy khi có môi trường Windows

Tại checkout sạch nhánh `gemini/20261115-01-editor`:

```sh
cd poc/01-editor
npm install
npm run test:unit
npm run build
npx playwright install chromium
npm run test:e2e
npm run dev
```

Sau đó thử **Windows Chrome và Edge**, đủ **UniKey/EVKey × Telex/VNI**, gõ thật 120 giây không Enter; chữ `trường`, `tiếng`, đổi dấu muộn, gõ nhanh/chậm, Backspace+Insert không composition, tải nặng, định dạng, cut/paste nội bộ/ngoài/cross-meeting, Undo/Redo. Thu trace đã lược ký tự, marks đầu/giữa/cuối, P95, TextNode/Mark/DOM/JSON bytes, thông tin phiên bản Windows/browser/IME. Test lỗi phải sửa trước khi xét READY_FOR_REVIEW.

- **Hạn chế:** lịch sử ProseMirror và IME thật chưa chạy; heuristic burst vẫn có nguy cơ false positive. Copy nếu trình duyệt loại custom MIME sẽ trở thành unlinked (fail closed). Browser typed text không thể kiểm với Node mocks.
- **Ranh giới:** không sửa G00 TRACKER/COMMON, STATUS, nhánh khác; không merge `main`, không deploy.
- **Working tree/diff:** đã xem trước push code `78aa598d423bba2ebc3bba3562e6bcbea2c2f644`, chỉ 4 file trong `poc/01-editor/`; commit tài liệu này chỉ sửa checkpoint + README/RESULTS + thêm log tóm tắt.
- **WIP/chưa push:** không sau khi commit tài liệu thành công.
