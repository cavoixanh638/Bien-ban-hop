# PoC A — Mốc Họp 1.1 (Editor + timeSpan + IME)

**Phạm vi riêng của 01-editor.** Bản này thử Tiptap 3.33.1/ProseMirror, không thu âm, không cung cấp player và chưa tự lưu bền vững. Không nhập dữ liệu cuộc họp thật. Toàn bộ dữ liệu và audio context trong demo là **synthetic fixture**.

## Chạy độc lập từ nhánh 01-editor

Yêu cầu Node 20.19+ / 22+ và trình duyệt Chrome hoặc Edge mới. Tại `poc/01-editor/`:

```sh
npm install
npm run dev
# http://127.0.0.1:5173/
npm run test:unit
npx playwright install chromium
npm run test:e2e
npm run build
```

`npm run test:unit` dùng Node built-in và có thể chạy trước `npm install`. Browser e2e chỉ là chuỗi nhập **synthetic**. Khi cài không được gói do mạng, **không ghi test build/browser PASS**. Các phụ thuộc được ghim phiên bản trong `package.json`; lockfile chưa sinh trong môi trường offline. Tạo/commit lockfile ở bước chạy được npm registry trên Windows trước khi chốt gate.

## Interface cho tích hợp

- `src/policy.mjs`: pure functions `normalizeContext`, `makeAnchor`, `sameAnchor`, `shouldCoalesce`, `shouldRetainWordAnchor`, `getJsonMetrics`.
- `src/tracker.mjs`:
  - `TimeSpan` — MarkSpec `{ inclusive:false, excludes:'timeSpan', spanning:true }` và attrs đầy đủ `{anchorId, recordingId, audioOffsetMs, typedAt, source, schemaVersion:1}`.
  - `new InputTracker({ meetingId, recordingIds, getAudioContext(monotonicMs), clock? })`: audio adapter trả `{source, recordingId?, audioOffsetMs?, coverage?, epoch?}`. Context thật do luồng Timeline/Audio tích hợp sau, không import code luồng khác.
  - `createTrackingExtension(tracker)` — plugin ProseMirror theo dõi selection, beforeinput/input/composition, StepMap, history, clipboard.
  - `readAnchorAtCursor(editor.state)` → `{status:'linked'|'unlinked'|'mixed'|'ambiguous', anchor?, candidates?, left?, right?}`. Ở biên hai nguồn trả `ambiguous` (không tự phát nhầm đoạn).
- `editor.getJSON()` trả **native ProseMirror NoteDocument**; demo xuất fixture `{noteDocumentId, revision, schemaVersion, content}`.
- `window.__mochop` chỉ là **harness của PoC**, không phải API production.

## Quy tắc có trong PoC

1. Gõ mới có recording hợp lệ → timeSpan theo audio context giả. Không có coverage, gap/missing hoặc nguồn không được phép → `source:'unlinked'`, `recordingId` và `audioOffsetMs` null. Text nhập ngoài → `source:'paste'` nhưng không tạo thời điểm phát ngôn.
2. Cùng cụm được gộp khi các điều kiện khoảng cách, word boundary, vị trí con trỏ, recording/source, epoch/gap khớp. Tất cả sáu attrs khi gộp **phải** giống nhau. `typedAt` ghi ở đầu cụm, không cập nhật cho mỗi chữ. Cấu hình mặc định: ≤1.2 s giữa input, ≤1.8 s từ đầu cụm, ≤24 ký tự.
3. `Backspace + Insert` nhanh trong cùng vùng từ, thay dấu ở cùng từ, sửa ký tự ngắn trong chữ cũ ưu tiên giữ anchor cũ. Không chặn input (`filterTransaction` không sử dụng). Composition có thể tạm bỏ mark và xử lý ở `compositionend`; phải xác minh Windows thực.
4. Định dạng bold/italic, sửa và Undo/Redo dựa transaction ProseMirror; dán nội bộ có custom clipboard MIME và token cùng session giữ nguồn hợp lệ. Dán ngoài/cross-meeting không được tin `timeSpan` trong HTML, rơi về paste-unlinked. Nếu browser làm mất MIME/token, **fallback không liên kết** thay vì đoán nguồn.
5. `timeSpan` không chứa `valid/pending/missing` động. Nếu audio bị xóa sau khi gõ, resolver ở luồng Timeline sẽ suy trạng thái; editor không tự đổi Mark.

**Giới hạn cần kiểm thực tế:** Heuristic không chứng minh được ý mới so với sửa từ ở mọi tình huống. Backspace burst rất nhanh có thể là thao tác người dùng (false-positive); việc không có composition, dán Word, undo history, clipboard MIME và đặc tính Chromium phải thử với máy Windows thật. Không tuyên bố 100% bảo toàn nếu chưa có trace/diff nguồn. DOM `spanning:true` không đồng nghĩa hai TextNode tự gộp trong JSON.

## Thu evidence Windows thật — điều kiện gate bắt buộc

1. `npm install && npm run dev`; mở bản local trên **Windows thật**, không dùng giả lập. Ghi build Windows, CPU/RAM, Chrome/Edge phiên bản; UniKey/EVKey bản cài thật, kiểu gõ Telex/VNI, cấu hình xử lý dấu và tự động sửa dấu.
2. Chạy đủ **4 tổ hợp UniKey×Telex, UniKey×VNI, EVKey×Telex, EVKey×VNI**; ở mỗi tổ hợp gõ `trường`, `tiếng`, sửa dấu muộn (`truo...` rồi đổi), gõ nhanh/chậm, chữ cũ, giữa hai Mark, bold/italic, cut/paste, Undo/Redo. Thu cả tình huống input thực **không có** `compositionstart/end` và chứa chuỗi `Backspace+Insert`. Ghi kết quả đúng/sai của ký tự và anchor trước/sau.
3. Gõ liên tục **120 giây không Enter** trong một đoạn. Đồng thời giữ audio fixture chạy và nhiều khoảng dừng ngắn, xác minh có nhiều anchor trong cùng paragraph; so mốc đầu/giữa/cuối với thời điểm fixture. Không dùng nút nhập dữ liệu tổng hợp thay thế thao tác gõ.
4. Bật nút giả lập tải nặng 15 giây trong PoC, tiếp tục gõ sửa; thử thêm với ứng dụng thực chạy nền và ghi rõ cấu hình tải. Xem lỗi gõ, mốc sai, lag. Thu metric JSON/TextNode/DOM wrapper, P95 `beforeinput→requestAnimationFrame` (proxy đo UI), P95 append và kích thước JSON trên đoạn dài; **ngưỡng mong muốn P95 <100 ms** trên máy đo, chưa chứng minh.
5. Điền toàn bộ metadata ở panel bên phải rồi bấm **Tải trace đã lược nội dung gõ** và **Xuất NoteDocument JSON**. Trace đã lược `event.data` và text nhập, nhưng vẫn **tự kiểm trước khi chia sẻ**. Chạy `npm run trace:check -- path/to/trace.json`. Tạo bảng so sánh các anchorId/source/audioOffsetMs trước-sau edit/Undo/Redo. Chỉ reviewer xác nhận log có nguồn IME thực và không mất dữ liệu mới có quyền chuyển trạng thái gate.

Các phím in được (kể cả ký tự Việt) được lược thành `[printable]`; chỉ các phím điều khiển (Backspace, Delete, mũi tên...) còn tên để phân tích IME.

Trace có thể được sinh trong demo trên máy không phải Windows; kiểm tra cấu trúc trace **không chứng minh** đã chạy bộ gõ thật. `testEnvironment` là trường nhập tay, cần đối chiếu screenshot/cấu hình. Cần ghi cả các kết quả FAIL và nguyên nhân.

## Kiểm thử tương ứng

| TC | Kiểm thử hiện có | Trạng thái chứng cứ |
|---|---|---|
| 01 | Node contract & Playwright DOM type | Unit PASS; browser NOT_RUN |
| 02 | Node mô phỏng 120 thao tác, Playwright nhiều anchor một đoạn | Unit PASS; gõ 120 giây thật NOT_RUN |
| 03 | Trace UI cho UniKey/EVKey × Telex/VNI, Backspace+Insert | Windows thật NOT_RUN |
| 04 | Node Unicode + same-word/rapid burst, Playwright sửa | Unit PASS; browser/IME thật NOT_RUN |
| 05 | Node historical edit, Playwright sửa chữ cũ | Unit PASS; browser NOT_RUN |
| 06 | Node context boundaries, Playwright chèn giữa | Unit PASS; browser NOT_RUN |
| 07 | Node allow-list, Playwright clipboard nội bộ | Unit PASS; browser/native clipboard NOT_RUN |
| 08 | Node full attrs equality, Playwright Undo/Redo | Unit PASS; browser NOT_RUN |
| 09 | Node mixed bold marks, Playwright định dạng | Unit PASS; browser NOT_RUN |
| 10 | Node paste-unlinked, Playwright external/cross-meeting | Unit PASS; browser NOT_RUN |
| 11 | Node metrics/P95, Playwright DOM metrics | Unit PASS; real P95/large document NOT_RUN |

Chi tiết kiểm thử hiện có: [`evidence/RESULTS.md`](evidence/RESULTS.md). **Tất cả TC01–TC11 tổng thể vẫn NOT_RUN/CHƯA NGHIỆM THU** vì chưa có đủ thử nghiệm browser/Windows. Không dùng Unit PASS để đánh dấu Gói 1.1 PASS.
