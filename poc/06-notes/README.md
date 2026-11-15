# 06-notes · Kho cuộc họp, tìm kiếm và autosave (PoC độc lập)

**Phạm vi:** Meeting / NoteDocument / EditJournal / revision; IndexedDB adapter; tìm kiếm tiếng Việt; giao diện thử quản lý cuộc họp. Không bao gồm editor Tiptap thực, thu âm OPFS, backup .mochop, đa tab Web Locks hoặc ứng dụng phát hành.

## Cách chạy

Yêu cầu Node.js >=20 cho bộ test. Từ thư mục `poc/06-notes`:

```sh
node --test --test-reporter=tap notes.test.mjs notes.regression.test.mjs
node bench_autosave.mjs
python -m http.server 8765
```

Mở `http://localhost:8765/` để dùng demo IndexedDB. Dữ liệu được cô lập theo origin (`localhost:8765` khác `127.0.0.1:8765` hoặc port khác). Không dùng `file://`.

Kiểm thử trình duyệt thật tùy chọn: cài `playwright` cho Python và Chromium; sau đó chạy `python browser_smoke.py`. Script tự mở HTTP origin localhost, thử ProseMirror round-trip, hai trang cùng ghi một revision, reload và rollback giao dịch. Biến môi trường `CHROMIUM_EXECUTABLE` trỏ đến binary Chrome/Chromium nếu cần. Script dùng dữ liệu tổng hợp và database tên ngẫu nhiên.

## Hợp đồng bàn giao

- `openIndexedDB(name, indexedDBImpl?)` tạo ba object store `meetings`, `notes`, `journals` và trả `{run(stores, mode, fn), close()}`. Mutation ghi snapshot, journal và cập nhật meeting trong cùng một transaction. `run()` chỉ trả kết quả khi `transaction.oncomplete` phát sinh, không ở `IDBRequest.onsuccess`.
- `NotesRepository`: `createMeeting`, `getMeeting`, `listMeetings`, `renameMeeting`, `deleteMeeting`, `getNote`, `getJournal`, `saveNote(noteDocumentId, content, expectedRevision, lease?)`, `search(query)`.
- Dữ liệu `NoteDocument` lưu nguyên ProseMirror JSON, gồm các `timeSpan` Mark và attributes do editor cung cấp. Không nhúng file-status vào Mark. Kết quả `search()` gồm `meetingId`, `noteDocumentId`, `snippet`, `location`, `length` theo offset UTF-16 của văn bản gốc, kể cả tìm không dấu.
- `migrateNote` đọc schema cũ (`{schemaVersion:0,text:'…'}`) thành JSON trong bộ nhớ mà không rewrite dữ liệu cũ trước khi lưu thành công; schema mới hơn bị từ chối, không downgrade. 
- `Autosave` debounce 350 ms, maxWait timer 1.500 ms kể từ lần sửa chưa lưu đầu tiên, tuần tự flush các lần sửa thêm trong khi đang commit; trạng thái `dirty/saving/saved/error/conflict`. `saved` chỉ được phát sau ACK. Nếu `dispose` mà còn dirty/in-flight, hàm báo lỗi thay vì thả lease và làm mất thay đổi. Lỗi cần retry thủ công, không tự báo thành công.
- Mock lease `acquire(meetingId) => {held,release()} | null`, dùng identity token để stale release không ảnh hưởng lease hiện tại. **Không phải khóa đa tab thật**; người tích hợp cần adapter Web Locks của 09-pwa.
- Audio adapter giả `canDelete(recordingIds, meeting)` có thể chặn xóa cuộc họp; `onDelete(recordingIds, meeting)` chỉ là hook. Audio vật lý thuộc 03-opfs. Đồng bộ tham chiếu và xử lý race với backup/restore thật thuộc đợt tích hợp.

## Demo và giới hạn

Demo dùng `textarea` để tạo **chỉ nội dung plain paragraph/text**; nếu tài liệu có Mark, heading hoặc cấu trúc ProseMirror ngoài dạng này, vùng chỉnh sửa được khóa để tránh làm mất dữ liệu. Chỉ editor của 01-editor mới được sửa văn bản giàu định dạng và mốc trong ứng dụng tích hợp.

`EditJournal` là các **snapshot đã commit**, không có log của ký tự chưa được xác nhận. Sau sự cố chỉ khôi phục đến revision hoàn tất; dữ liệu mới nhập còn dirty có thể mất. Bộ nhớ IndexedDB thuộc trình duyệt/origin, không thay cho backup ngoài trình duyệt.

## Kiểm thử và bằng chứng

Xem [báo cáo Node 22 và browser attempt](evidence/20261115-node22-browser.md) và [checkpoint G06](../../docs/workstreams/2026-11-15/checkpoints/06-notes.md) để biết Code SHA / Tested SHA / PASS / NOT_RUN.

- `notes.test.mjs`: 9 ca gốc, không chạy lại bằng V8 shim.
- `notes.regression.test.mjs`: 13 ca bổ sung về Unicode offset, autosave trong khi in-flight, writer lease, rollback/index/quota mô phỏng, schema cũ, hai kết nối race, crash giả lập và timeSpan.
- **Node Linux v22.16.0: 22/22 PASS**, files được tái tạo trong thư mục độc lập và xác minh Git blob trùng đúng với tệp trên GitHub tại Code SHA. Không thể `git clone` trực tiếp do DNS container; **không gọi đó là clean Git checkout**.
- Benchmark Node trên fixture: 36 edits / 3,08 giây, 2 revision xác nhận, max và P95 unconfirmed **1.526 ms**. Mục tiêu khoảng 2 giây **chưa được đo trên browser thật**.
- Chromium 144 trên Linux: **NOT_RUN IndexedDB browser** vì chính sách quản trị chặn localhost với `ERR_BLOCKED_BY_ADMINISTRATOR`. Windows Chrome/Edge, crash process/kill, quota thật, Web Locks hai tab và TC29/TC35 tích hợp: **NOT_RUN**.

**Tình trạng:** mã và test PoC độc lập đã commit; chưa đủ điều kiện DONE toàn bộ entrypoint khi browser IndexedDB thật còn NOT_RUN. Tuyệt đối không dùng kết quả giả lập để nhận PASS sản phẩm.
