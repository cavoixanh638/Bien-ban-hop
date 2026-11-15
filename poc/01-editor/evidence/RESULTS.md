# Chứng cứ tiếp tục PoC 01-editor — 15/11/2026

**Phạm vi:** riêng `poc/01-editor/`, branch `gemini/20261115-01-editor`. Đã đọc `TRACKER.md` G00; không có bug logic riêng 01 mới được xác nhận ở tracker. Yêu cầu còn thiếu là Tiptap/Vite/Playwright runtime, 4 tổ hợp UniKey/EVKey × Telex/VNI Windows, 120s không Enter, P95 và so sánh đầy đủ marks. **Không có chứng cứ đủ để PASS Gói 1.1.**

## Xuất xứ và cách chạy

- **HEAD đầu lượt:** `f3b5a436ea8b9a3735156391dca16281b28e9205`. Đối chiếu 15/15 blob SHA-1 kiểu Git `git hash-object` của PoC hiện có với tree GitHub tại HEAD: trùng.
- **Source mới / Tested SHA:** cập nhật ở checkpoint sau khi GitHub commit (các bài dưới đây chạy trực tiếp bản local nguồn mới rồi đối chiếu SHA Git blob trước push; không tuyên bố clone GitHub được).
- **Runtime Node:** Linux `Linux-6.18.57-x86_64`, Node `v22.16.0`, npm `10.9.2`. Đã chạy `npm run test:unit`; stdout đầy đủ tại [`node22-41-tests.tap`](node22-41-tests.tap). **41/41 PASS**, 0 fail, exit 0. Kiểm cú pháp `node --check` toàn bộ `src/*.mjs tests/*.mjs scripts/*.mjs`: PASS. Python script compile: PASS.
- **Bốn loại unit test:** (1) pure provenance policy; (2) StepMap synthetic cho nhiều bước/transaction; (3) actual `InputTracker` adapter chạy với ProseMirror-like mocks (không phải Tiptap runtime); (4) validator trace redacted có ca âm tính. Không lấy mock làm bằng chứng editor runtime.
- **Linux browser baseline:** Python Playwright + **Chromium 144.0.7559.96** trên Linux (chạy `python3 scripts/browser-native-event-probe.py`). `contenteditable` thu **56 sự kiện** (14 keydown, 14 beforeinput, 14 input, 14 keyup), có `Backspace`, không có composition trong chuỗi **Playwright gõ ASCII giả lập**. Output không có nội dung được gõ: [`linux-chromium-native-input.json`](linux-chromium-native-input.json). Đây **không phải** Tiptap/Windows/IME gõ thật, chỉ là đường đối chứng browser event.
- **Mạng:** `git ls-remote` không phân giải được `github.com` và sandbox không có gói Tiptap/Vite/Playwright Node; `npm install`, `npm run build`, `npm run test:e2e`: **NOT_RUN**. Chromium Python event probe không tương đương `npm run test:e2e`.
- **Windows thật:** UniKey/EVKey Telex/VNI, Chrome/Edge, gõ 120 giây, máy tải nặng, clipboard Word/web, P95 editor, TextNode/DOM dưới IME, browser Tiptap: **NOT_RUN**.

## Các thay đổi được kiểm qua fixture

1. `src/step-changes.mjs` dịch ngược `oldFrom/oldTo` qua các StepMap trước đó; tránh đọc vùng từ trên tọa độ step-local sau nhiều lần thay chữ.
2. `src/tracker.mjs` không lấy mốc đầu tiên khi chọn hoặc chèn qua nhiều mốc; chỉ giữ anchor từ cũ nếu toàn vùng từ có mark đồng nhất. Đọc mốc tại con trỏ nhận thêm `allowedRecordingIds` để từ chối foreign recording.
3. Clipboard dùng token ngẫu nhiên, so khớp text, dùng **Slice bản gốc đã lưu trong phiên** để ngăn thay HTML làm sai nguồn; dán ngoài/khác cuộc họp hoặc dán bị sửa fallback unlinked. Hủy pending paste khi nhận một `beforeinput` khác.
4. Policy từ chối timeSpan thiếu `anchorId/typedAt`, loại `recordingId` trái source và attrs bất hợp lệ. JSON metrics phân biệt số text nodes, tổng mark instances, logical timeSpan runs (tất cả attrs) và DOM wrappers.
5. Bỏ recompute JSON/DOM toàn tài liệu ở từng render frame, giới hạn khoảng 1 lần/giây hoặc bấm đo lại. Chưa có số liệu P95 Tiptap thực.
6. Trace có summary đầu/cuối, không ghi phím in được; checker từ chối key lộ chữ, field bất ngờ, count/anchor mismatch; biểu mẫu metadata bỏ placeholder giả.

## Ma trận TC01–TC11

| TC | Unit/mocks hiện có | Linux Chromium native-event baseline | Tiptap + Playwright | Windows IME thực | Gate |
|---|---|---|---|---|---|
| TC01 nhập tự neo | PASS fixture | Chỉ DOM events | NOT_RUN | NOT_RUN | **NOT_RUN** |
| TC02 120s một đoạn | PASS synthetic cadence, không phải 120s | Không đo 120s | NOT_RUN | NOT_RUN | **NOT_RUN** |
| TC03 UniKey/EVKey Telex/VNI | PASS trace validator (không phải IME) | ASCII, không composition | NOT_RUN | NOT_RUN | **NOT_RUN** |
| TC04 sửa dấu | PASS pure/mock, Backspace+Insert | Backspace + insert ASCII | NOT_RUN | NOT_RUN | **NOT_RUN** |
| TC05 sửa chữ cũ | PASS mock 12s vs 95s | Không có audio | NOT_RUN | NOT_RUN | **NOT_RUN** |
| TC06 chèn/sửa giữa Mark | PASS mock mixed mark + StepMap | Không có timeSpan | NOT_RUN | NOT_RUN | **NOT_RUN** |
| TC07 cut/copy/paste nội bộ | PASS mock local Slice và forgery | Không kiểm paste | NOT_RUN | NOT_RUN | **NOT_RUN** |
| TC08 Undo/Redo | PASS policy/history-skip mock | Không kiểm history PM | NOT_RUN | NOT_RUN | **NOT_RUN** |
| TC09 định dạng | PASS model metrics/format-skip mock | Không kiểm format PM | NOT_RUN | NOT_RUN | **NOT_RUN** |
| TC10 paste ngoài/cross meeting | PASS policy/mock/trace privacy | Không kiểm paste | NOT_RUN | NOT_RUN | **NOT_RUN** |
| TC11 dài/fragment/P95 | PASS metrics logic, mock | Event counts only | NOT_RUN | NOT_RUN | **NOT_RUN** |

## Risk và tiếp tục

- **Cần test thực:** Tiptap appendTransaction + history grouping, compositionend/DOM reconciliation với UniKey/EVKey; browser clipboard MIME trên Chrome/Edge; vấn đề chữ định dạng khi nhập mới; hiệu năng P95 long document; paste nội bộ nhiều paragraph và khi browser lọc custom MIME.
- Heuristic Backspace rồi nhập nhanh trong cùng từ vẫn có thể false-positive; khi nhiều mốc cắt qua cùng từ không cố giữ mốc vì có thể sai source. Không nhầm `timeSpanRuns` model với số DOM `span`.
- Nguồn audio giả lập; không có audio/video họp thật trong repo. Không thay đổi G00 `COMMON.md` hoặc nhánh khác; không merge/deploy.
- **Kết luận: IN_PROGRESS.** Code và fixture độc lập được cải thiện, cần 4 ca Windows IME thật và browser Tiptap qua gate mới `READY_FOR_REVIEW`.

## Bổ sung sau G00 TRACKER / hồi quy 45 tests

- HEAD input từ Github: `71595a60626396fa07f04e539c12c9e7fb0da675`; G00 yêu cầu cập nhật Code/Tested SHA bị lệch.
- Lỗi sửa mới phát hiện bằng thử âm tính: `append()` trả trước khi reset trạng thái Undo/Redo vì collector đã lọc transaction `history$`; hậu quả `active/pendingDeletion/pendingPaste` có thể còn sót, khiến văn bản gõ sau Undo thừa hưởng mốc cũ. Đã đưa history reset lên đầu; unit chứng minh reset và mốc mới sau history.
- Cursor đúng biên chữ có link và chữ không link trước kia trả linked dù không biết bên nào; giờ trả `ambiguous`, tương tự biên giữa nguồn hợp lệ/foreign-invalid, tránh nghe nhầm đoạn.
- Sao chép ra HTML hệ điều hành trước kia mang thuộc tính `data-time-*` (recording/offset/anchor). Giờ xóa timeSpan ở phần HTML nhưng vẫn giữ ProseMirror Slice gốc theo token cục bộ cho thao tác di chuyển đáng tin cậy; nhánh paste ngoài/cross-meeting vẫn unlinked.
- Node fixture 45/45 PASS, 0 FAIL, exit 0, Linux Node v22.16.0. Cú pháp source/test PASS. Log ngắn: [`node22-45-summary.md`](node22-45-summary.md). **Không** đổi TC01–TC11 tổng thể sang PASS.
- Tiptap/Vite/Playwright NOT_RUN: `npm install --offline --package-lock-only` thất bại `ENOTCACHED` vì `@playwright/test` không có cache; DNS github.com/registry.npmjs.org không phân giải. Windows IME 4 tổ hợp + 120s gõ thật và P95 vẫn NOT_RUN.

## G01-ADD-01 — Bằng chứng logic chưa thay cổng thực địa

Phát hiện của G00 tại `TRACKER.md` blob `bae8bf111fe13633f7734be08bf8231586539293`: nguồn âm thanh `pending` do clock chưa có mapping point kế tiếp từng bị biến thành `unlinked` mà không còn provenance. Bản PoC mới giữ dữ liệu tại `PendingLinkJournal` ngoài Mark và có kịch bản t=1500 ms → pending → valid 1500 ms khi t=2000 đến. Mark trước khi xác minh không mang offset giả. Các trường hợp đổi dấu, Undo, copy đôi, xóa, source sai, pause/gap/stop, mở lại offline và thay meeting đều có Node regression.

**Phân loại:** Node unit fixture PASS theo log `evidence/g01-add01-node-tests.tap` (Code SHA ghi tại checkpoint sau push). Browser Tiptap/Vite/Playwright E2E: **NOT_RUN**; Windows UniKey/EVKey × Telex/VNI, 120s, tải nặng, latency P95: **NOT_RUN**. TC01–TC11 tổng thể **HOLD**. Không đụng COMMON, G00 tracker hoặc dữ liệu luồng khác.
