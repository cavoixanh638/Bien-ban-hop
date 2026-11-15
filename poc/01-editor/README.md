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

`npm run test:unit` chạy **toàn bộ** `tests/*.test.mjs` với Node built-in, không cần cài dependency. Bốn nhóm gồm: pure policy, StepMap inverse mapping, `InputTracker` thực với ProseMirror-* **mock** (không phải thư viện Tiptap), và validator trace. Browser e2e chỉ là chuỗi nhập **synthetic**. Khi cài không được gói do mạng, **không ghi test build/browser PASS**. Các phụ thuộc được ghim phiên bản trong `package.json`; lockfile chưa sinh trong môi trường offline. Tạo/commit lockfile ở bước chạy được npm registry trên Windows trước khi chốt gate.

Phép thử HTML `contenteditable` độc lập (không khởi chạy Tiptap) có thể chạy trong Python Playwright + Chromium đã cài:

```sh
python3 scripts/browser-native-event-probe.py
# ghi kết quả event đã lược ký tự vào evidence/linux-chromium-native-input.json
```

Phép thử này chỉ xác nhận **trình duyệt Linux nhận beforeinput/input/Backspace không cần composition với phím giả lập**; không chứng minh behavior của Tiptap, UniKey hay EVKey và không được dùng làm PASS TC03.

## Interface cho tích hợp

- `src/policy.mjs`: pure functions `normalizeContext`, `makeAnchor`, `sameAnchor`, `shouldCoalesce`, `shouldRetainWordAnchor`, `getJsonMetrics`.
- `src/tracker.mjs`:
  - `TimeSpan` — MarkSpec `{ inclusive:false, excludes:'timeSpan', spanning:true }` và attrs đầy đủ `{anchorId, recordingId, audioOffsetMs, typedAt, source, schemaVersion:1}`.
  - `new InputTracker({ meetingId, recordingIds, getAudioContext(monotonicMs), clock? })`: audio adapter trả `{source, recordingId?, audioOffsetMs?, coverage?, epoch?}`. Context thật do luồng Timeline/Audio tích hợp sau, không import code luồng khác.
  - `createTrackingExtension(tracker)` — plugin ProseMirror theo dõi selection, beforeinput/input/composition, StepMap, history, clipboard.
  - `readAnchorAtCursor(editor.state, allowedRecordingIds?)` → `{status:'linked'|'unlinked'|'mixed'|'ambiguous', anchor?, candidates?, left?, right?}`. **Khuyến nghị truyền `Set` recordingId của cuộc họp**; lúc đó foreign/invalid mark bị loại, không phát nhầm nguồn. Không truyền allow-list thì chỉ kiểm tra cấu trúc Mark chứ không thể chứng minh cùng meeting. Ở biên hai nguồn khác nhau **hoặc linked/unlinked** trả `ambiguous` để không phát nhầm mốc của chữ liền kề.
- `src/step-changes.mjs`: pure StepMap adapter chuẩn hóa tọa độ OldState/FinalState cho transaction nhiều bước và nhiều transaction. Không lấy `oldFrom` step-local nhầm làm vị trí trên tài liệu gốc.
- `editor.getJSON()` trả **native ProseMirror NoteDocument**; demo xuất fixture `{noteDocumentId, revision, schemaVersion, content}`.
- `window.__mochop` chỉ là **harness của PoC**, không phải API production.

## Quy tắc có trong PoC

1. Gõ mới có recording hợp lệ → timeSpan theo audio context giả. Không có coverage, gap/missing hoặc nguồn không được phép → `source:'unlinked'`, `recordingId` và `audioOffsetMs` null. Text nhập ngoài → `source:'paste'` nhưng không tạo thời điểm phát ngôn.
2. Cùng cụm được gộp khi các điều kiện khoảng cách, word boundary, vị trí con trỏ, recording/source, epoch/gap khớp. Tất cả sáu attrs khi gộp **phải** giống nhau. `typedAt` ghi ở đầu cụm, không cập nhật cho mỗi chữ. Cấu hình mặc định: ≤1.2 s giữa input, ≤1.8 s từ đầu cụm, ≤24 ký tự.
3. `Backspace + Insert` nhanh trong cùng vùng từ, thay dấu ở cùng từ, sửa ký tự ngắn trong chữ cũ ưu tiên giữ anchor cũ **chỉ khi vùng từ có provenance đồng nhất**. Vùng chọn giao nhiều Mark không được kế thừa Mark đầu tiên. Không chặn input (`filterTransaction` không sử dụng). Composition có thể tạm bỏ mark và xử lý ở `compositionend`; phải xác minh Windows thực.
4. Định dạng bold/italic, sửa và Undo/Redo dựa transaction ProseMirror (Undo/Redo phải xóa `active`, `pendingDeletion`, `pendingPaste` trước khi đọc diff); dán nội bộ có custom clipboard MIME và token khó đoán cùng session, so khớp plain text, lấy lại **Slice gốc bất biến trong bộ nhớ editor** chứ không tin HTML có thể bị thay đổi. HTML sao chép ra hệ điều hành **không chứa** các thuộc tính `timeSpan` (tránh lộ recording ID/offset); dán ngoài/cross-meeting không được tin `timeSpan` trong HTML, rơi về paste-unlinked. Nếu browser làm mất MIME/token, **fallback không liên kết** thay vì đoán nguồn. Paste pending bị xóa khi người dùng thực hiện trước-input khác.
5. `timeSpan` không chứa `valid/pending/missing` động. Nếu audio bị xóa sau khi gõ, resolver ở luồng Timeline sẽ suy trạng thái; editor không tự đổi Mark.

**Giới hạn cần kiểm thực tế:** Heuristic không chứng minh được ý mới so với sửa từ ở mọi tình huống. Backspace burst rất nhanh có thể là thao tác người dùng (false-positive); việc không có composition, dán Word, undo history, clipboard MIME và đặc tính Chromium phải thử với máy Windows thật. Không tuyên bố 100% bảo toàn nếu chưa có trace/diff nguồn. DOM `spanning:true` không đồng nghĩa hai TextNode tự gộp trong JSON. Bộ đếm `timeSpanRuns` tính cụm theo toàn bộ attrs, phân biệt `markedTextNodes` và `domTimeSpanWrappers`; bảng metrics được cập nhật tối đa khoảng 1 lần/giây (hoặc khi bấm đo lại) để tránh lặp serialization dài theo mỗi lần gõ.

## Thu evidence Windows thật — điều kiện gate bắt buộc

1. `npm install && npm run dev`; mở bản local trên **Windows thật**, không dùng giả lập. Ghi build Windows, CPU/RAM, Chrome/Edge phiên bản; UniKey/EVKey bản cài thật, kiểu gõ Telex/VNI, cấu hình xử lý dấu và tự động sửa dấu.
2. Chạy đủ **4 tổ hợp UniKey×Telex, UniKey×VNI, EVKey×Telex, EVKey×VNI**; ở mỗi tổ hợp gõ `trường`, `tiếng`, sửa dấu muộn (`truo...` rồi đổi), gõ nhanh/chậm, chữ cũ, giữa hai Mark, bold/italic, cut/paste, Undo/Redo. Thu cả tình huống input thực **không có** `compositionstart/end` và chứa chuỗi `Backspace+Insert`. Ghi kết quả đúng/sai của ký tự và anchor trước/sau.
3. Gõ liên tục **120 giây không Enter** trong một đoạn. Đồng thời giữ audio fixture chạy và nhiều khoảng dừng ngắn, xác minh có nhiều anchor trong cùng paragraph; so mốc đầu/giữa/cuối với thời điểm fixture. Không dùng nút nhập dữ liệu tổng hợp thay thế thao tác gõ.
4. Bật nút giả lập tải nặng 15 giây trong PoC, tiếp tục gõ sửa; thử thêm với ứng dụng thực chạy nền và ghi rõ cấu hình tải. Xem lỗi gõ, mốc sai, lag. Thu metric JSON/TextNode/DOM wrapper, P95 `beforeinput→requestAnimationFrame` (proxy đo UI), P95 append và kích thước JSON trên đoạn dài; **ngưỡng mong muốn P95 <100 ms** trên máy đo, chưa chứng minh.
5. Điền **Windows build thực, Chrome/Edge phiên bản và phiên bản IME** (không có giá trị mặc định) ở panel bên phải rồi bấm **Tải trace đã lược nội dung gõ** và **Xuất NoteDocument JSON**. Trace có `summary` đầu/cuối, số mốc, khoảng thời gian, trạng thái composition/backspace; đã lược `event.data` và text nhập, nhưng vẫn **tự kiểm trước khi chia sẻ**. Chạy `npm run trace:check -- path/to/trace.json`, công cụ sẽ từ chối trường sự kiện lạ/có ký tự thô hoặc summary không khớp. Tạo bảng so sánh các anchorId/source/audioOffsetMs trước-sau edit/Undo/Redo. **Không commit NoteDocument họp thật hoặc trace chưa kiểm nhạy cảm**. Chỉ reviewer xác nhận log có nguồn IME thực và không mất dữ liệu mới có quyền chuyển trạng thái gate.

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

## Kiểm thử bổ sung G00 (lượt tiếp theo)

- Đã rà lại HEAD `71595a60` và tracker G00: yêu cầu cấp thiết là điền lại Code SHA/Tested SHA cho mã mới, **chưa thể vượt cổng Windows**.
- Regression unit bổ sung cho đúng ba lỗi: (i) undo/redo không để burst cũ sống sau lịch sử, (ii) cursor đúng biên linked/unlinked phải `ambiguous`, (iii) xuất HTML clipboard không chứa metadata nguồn âm thanh. Bổ sung E2E spec kiểm hai tình huống sau; **spec Playwright hiện NOT_RUN** do npm registry không có.
- Xem log ngắn và lệnh chạy trong `evidence/node22-45-summary.md`; test fixture mới chạy 45/45 trên Node 22.16.0 (Linux).
- Cần Windows Chrome/Edge và UniKey/EVKey Telex/VNI thật, không được thay bằng policy fixture hoặc chromium ASCII.

## G01-ADD-01 — Mốc gõ trong lúc đồng hồ audio đang chờ hiệu chuẩn

**Đã triển khai PoC, không thay đổi hợp đồng `timeSpan`.** Nếu `getAudioContext(inputMonoMs)` trả `coverage:'pending'` cho `live_recording` và có `recordingId`, `generation`, `intervalId` hợp lệ, văn bản vẫn nhận Mark 6 thuộc tính với `source:'unlinked'`, `recordingId:null`, `audioOffsetMs:null`. Một `PendingLinkJournal` **riêng ngoài NoteDocument** giữ `anchorId`, `typedAt` và thời điểm mono bắt đầu cụm, recording, generation/interval và độ dài vùng chữ. Dữ liệu này **không** được đưa vào trace IME hoặc clipboard.

- Khi adapter clock sau đó xác minh bracket/đúng điểm cuối của **cùng khoảng ghi**, gọi `tracker.finalizePendingLinks(entry => resolver(entry))`. Resolver phải trả `{status:'valid',coverage:'valid',meetingId,recordingId,source:'live_recording',generation,intervalId,inputMonoMs,audioOffsetMs}`; mọi trường identity phải bằng pending entry. Clock fixture ở `fixtures/pending-clock.mjs` chỉ nội suy giữa hai điểm đồng bộ đã nhận, không ngoại suy, không nối qua pause/gap.
- Finalization tìm **một cụm chữ liên tục** đúng `anchorId` + toàn bộ attrs gốc, có số ký tự đã theo dõi; nếu đã xóa, tách hai vùng do copy, thay đổi mark, đổi cuộc họp/recording hoặc vùng văn bản khác biệt thì **không liên kết**, không nhảy sang audio gần nhất. Các thao tác sửa dấu làm thay đổi độ dài trong cùng anchor được bù đúng theo giao dịch, `typedAt` và `inputMonoMs` ban đầu không bị sửa.
- Clock refinement đặt `addToHistory:false` và chỉ `complete` journal **sau dispatch thành công**. Undo/Redo chữ vẫn do ProseMirror history quản lý. Không gán trạng thái audio động `pending/valid` vào Mark. Đây là adapter độc lập, G00 quyết định tích hợp với G02/G04/G06 bằng `COMMON.md`, không import worker khác.
- `tracker.exportPendingState()` cung cấp sidecar JSON riêng để lưu cạnh revision của NoteDocument; `tracker.restorePendingState(sidecar, editor.state.doc)` kiểm tra cùng meeting, same Mark và count trước khi cho phép resolve sau offline/reopen. **Không** nhét sidecar vào NoteDocument; không tải/trust sidecar từ clipboard bên ngoài. Hợp đồng commit atomically và khôi phục durable của G06 chỉ thực hiện tại đợt tích hợp.
- Demo: chọn **Coverage → Chờ xác nhận clock (fixture)**, gõ ghi chú, xem `timeSpan` còn unlinked nhưng `pendingAnchors>0`; bấm **Xác nhận điểm clock kế tiếp** để hoàn tất mốc. Đổi sang gap trước khi nhận điểm sẽ giữ text unlinked. Có nút xuất pending journal **riêng** để xem cấu trúc fixture; không chứa ký tự ghi chú.
- Regression: `npm run test:unit` trong `poc/01-editor/` và nhóm `tests/pending-links.test.mjs`, `tests/tracker-adapter.test.mjs`. Browser E2E cases mới trong `tests/editor.spec.mjs` **chưa chạy** vì môi trường không có npm registry. Kiểm thử UniKey/EVKey thật Windows **NOT_RUN**, không gọi TC01–TC11 PASS từ Node.

**Giới hạn chủ động:** Không có bằng chứng mapping nào khi app offline thì pending phải giữ nguyên và text chưa nghe lại được; không cố đoán offset hoặc hồi tố xuyên paused/gap. Trạng thái audio hợp lệ khi phát vẫn phải được resolver Audio Manifest xác minh độc lập.
