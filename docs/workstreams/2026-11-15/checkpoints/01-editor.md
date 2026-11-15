# Checkpoint · 01-editor — Gói 1.1 / PoC A

- **Owner/nhánh:** G01, `gemini/20261115-01-editor`
- **Baseline:** `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- **HEAD khi nhận G01-ADD-01:** `a44e94bcac07b8e1c0cb49c1d31d9066e7dda313`
- **G00 TRACKER đã đọc:** blob `bae8bf111fe13633f7734be08bf8231586539293` từ nhánh `gemini/20261115-00-command` (chỉ có **G01-ADD-01** mới; vẫn giữ gate Windows)
- **Code SHA:** [`4e9283eede5a5a409a3f90c5425d6cc9f775e5a0`](https://github.com/cavoixanh638/Bien-ban-hop/commit/4e9283eede5a5a409a3f90c5425d6cc9f775e5a0)
- **Tested SHA (blob-equivalent):** `4e9283eede5a5a409a3f90c5425d6cc9f775e5a0` — chạy Node trên **bản local** và xác minh 13/13 Git blob của tệp được thêm/sửa **khớp tuyệt đối** GitHub tree của commit; các source/test còn lại giữ nguyên Git blobs đã được xác minh ở lượt trước. **Không gọi đây là test từ clean git clone.**
- **Trạng thái:** `IN_PROGRESS / GATE_1_1_HOLD`; **G01-ADD-01 đã sửa ở PoC độc lập**, chưa đạt `READY_FOR_REVIEW` hoặc `DONE` của entrypoint.
- **Unit test:** **PASS 75/75**, 0 FAIL, 0 skipped, exit 0, Linux x86_64, Node v22.16.0, npm 10.9.2; `node --check` source/tests/scripts/fixture JS **PASS**.
- **Browser/Tiptap build E2E/Windows UniKey-EVKey:** **NOT_RUN** (registry và github.com không thể phân giải DNS; không có Windows/IME thật).
- **Phạm vi sửa:** chỉ `poc/01-editor/` + checkpoint riêng này; không chỉnh `COMMON.md`, G00 tracker, worker khác, `main`, không merge/deploy.

[Entrypoint](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/01-editor.md) · [COMMON.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md) · [TRACKER G00](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/TRACKER.md)

## 1. G01-ADD-01 — Đã triển khai mã và fixture độc lập

**Nguyên nhân theo G00:** `normalizeContext({source:'live_recording',recordingId:'rec-1',audioOffsetMs:null,coverage:'pending'})` từng tạo Mark `unlinked` **mà không giữ provenance monotonic**. Khi điểm đồng hồ mới xuất hiện, không còn dữ liệu để gắn lại phần chữ đã gõ.

**Giải pháp đã push:**

1. `src/pending-links.mjs`: `PendingLinkJournal` giữ riêng `anchorId`, `typedAt`, `inputMonoMs`, `recordingId`, `generation`, `intervalId`, meeting ID và số ký tự. **Không thay schema Mark**. Khi clock chưa xác nhận, Mark vẫn có đúng 6 attrs: `source:'unlinked',recordingId:null,audioOffsetMs:null`. Không ghi status động hoặc offset giả vào NoteDocument.
2. `src/tracker.mjs`: `InputTracker` ghi sidecar tại đầu cụm khi audio context là pending và source/generation/interval rõ ràng. Trong sửa dấu Backspace+Insert/Telex/VNI mô phỏng, giữ inputMonoMs và typedAt ban đầu, cập nhật độ dài kỳ vọng. `finalizePendingLinks(resolver)` chỉ cập nhật Mark khi resolver xác nhận `valid`, cùng meeting/recording/source/generation/interval/mono, địa chỉ chữ hiện tại vẫn đủ đúng. Chỉ `complete` journal **sau dispatch**. `addToHistory:false` cho clock calibration, không coi là thao tác người dùng.
3. `src/policy.mjs`: coverage `pending` luôn tạo Mark chưa liên kết, kể cả khi raw context mang offset cũ; coalescing không vượt generation/interval của pending input.
4. `fixtures/pending-clock.mjs`: mô phỏng mapping đơn điệu 48 kHz có xác nhận điểm clock, không ngoại suy điểm cuối, không nội suy qua gap/pause, không import code G02/G04.
5. `index.html` + `src/main.mjs`: demo chọn `pending`, gõ, bấm xác nhận điểm mới; xem số pending, xuất sidecar **riêng** (không nhúng vào NoteDocument/IME trace).
6. `tests/pending-links.test.mjs`, `tests/tracker-adapter.test.mjs`, `tests/policy.test.mjs`: deterministic regressions (mốc 1.500ms pending → valid đúng ~1.500ms sau điểm t=2.000ms; điểm cuối t=1.000ms valid; giữ anchorId/typedAt; sửa dấu liên tiếp; Undo/Redo, xóa, copy trùng, foreign/cross-meeting, thay source, pause/gap/missing/stop, drift, sidecar offline/reopen, dispatch hỏng, overflow). Có thêm 2 Playwright browser cases **đã viết nhưng chưa chạy**.

**Fail-closed:** unknown recording/generation/interval, missing clock, wrong meeting, duplicate/disconnected text, edited/deleted mark, đổi meeting hoặc danh sách source bị thu hồi → không tự tạo audio link. Pending sidecar có thể khôi phục qua fixture trong cùng meeting, nhưng **chưa có bằng chứng durable IndexedDB**, việc kết nối tới G06 thuộc tích hợp G00.

## 2. Evidence và test verdict

| Bài kiểm thử | Kết quả | Bằng chứng / hạn chế |
|---|---|---|
| Node `npm run test:unit` (bao gồm 45 bài đã PASS trước + bài mới) | **PASS 75/75**, exit 0 | [TAP log](../../../../poc/01-editor/evidence/g01-add01-node-tests.tap), source tested Git blob-equiv. `4e9283eede5a5a409a3f90c5425d6cc9f775e5a0` |
| Kiểm cú pháp JS cho `src/*.mjs tests/*.mjs scripts/*.mjs fixtures/*.mjs` | **PASS** | Node v22.16.0 |
| Reproducer G00 t=1500 pending, t=2000 progress=96000 samples@48 kHz | **PASS fixture** | Mark khi pending unlinked, sau resolver valid offset=1500ms, anchorId và typedAt giữ nguyên |
| Pause/gap/missing/stop, edit/Undo/Redo, copy/cross-meeting, offline/reopen | **PASS unit/mock** | Không phải kiểm trên ứng dụng browser / storage thật |
| Linux Chromium native DOM event baseline (lượt trước) | **PASS phạm vi event ASCII 56 events** | Không phải Tiptap hay IME Windows |
| `npm install`, `npm run build`, `npm run test:e2e` Tiptap | **NOT_RUN** | Không tải được `@tiptap/*` và `@playwright/test` từ npm; DNS `registry.npmjs.org` không hoạt động |
| `git clone` + Node test từ clean checkout đúng SHA | **NOT_RUN** | DNS `github.com` không hoạt động; **không** dùng Git blob equivalence để nói clean checkout PASS |
| Windows Chrome/Edge, UniKey/EVKey × Telex/VNI, 120s không Enter, đổi dấu muộn, Backspace+Insert không composition | **NOT_RUN** | Không có Windows/UniKey/EVKey thực |
| P95 nhập thực tế <100 ms, TextNode/Mark/DOM và JSON tài liệu dài trên Windows | **NOT_RUN** | Chưa chạy browser Tiptap trên máy thử |
| **TC01–TC11 nghiệm thu đầy đủ** | **HOLD / NOT_RUN phần thực địa** | **Không** dùng 75 unit PASS thay cho gate Gói 1.1 |

## 3. Các tệp và quy trình chạy tiếp

- [PoC và demo](../../../../poc/01-editor/), [PendingLinkJournal](../../../../poc/01-editor/src/pending-links.mjs), [InputTracker](../../../../poc/01-editor/src/tracker.mjs), [clock fixture](../../../../poc/01-editor/fixtures/pending-clock.mjs).
- [Bộ test Node](../../../../poc/01-editor/tests/pending-links.test.mjs), [test browser chưa chạy](../../../../poc/01-editor/tests/editor.spec.mjs), [ma trận và kết quả](../../../../poc/01-editor/evidence/RESULTS.md), [stdout TAP](../../../../poc/01-editor/evidence/g01-add01-node-tests.tap).

```sh
git clone --single-branch --branch gemini/20261115-01-editor https://github.com/cavoixanh638/Bien-ban-hop.git
cd Bien-ban-hop/poc/01-editor
npm install
npm run test:unit
npm run build
npx playwright install chromium
npm run test:e2e
npm run dev
```

Sau đó ghi phiên bản Windows, Chrome/Edge, UniKey/EVKey, 4 cấu hình Telex/VNI, trace đã lược dữ liệu, 120 giây một đoạn, đo P95 và metrics, Undo/Redo/clipboard thật. Nếu phát hiện lỗi chữ hoặc sai nguồn thì giữ HOLD và sửa trước khi xét `READY_FOR_REVIEW`.

**WIP chưa push: không**, sau khi checkpoint được commit. **G01-ADD-01:** đã bàn giao independent PoC fixture, chỉ có tích hợp và thực địa chưa nghiệm thu.
