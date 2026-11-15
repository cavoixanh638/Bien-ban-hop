# Checkpoint · 06-notes

- Chủ sở hữu: 06-notes — một writer, nhánh `gemini/20261115-06-notes`
- Baseline chung: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- HEAD ban đầu: `7a1939b58405c4e1706b235593d9e05d38f08da4`
- Code commit trước checkpoint cuối: `ca66224c097f3f0def3c2a08e07e199c947c6fbb`
- Trạng thái: **IN_PROGRESS — partial tests PASS, browser verification NOT_RUN**
- Tested code SHA: `ca66224c097f3f0def3c2a08e07e199c947c6fbb` (cùng phiên bản tệp `notes.mjs` tại `a8395c2d48143c7e3bd8958d516b6808eda2c65d`)
- Kiểm thử: **9 PASS / 0 FAIL (synthetic memory fixture / JavaScript V8 harness)**. Chưa chạy Node CLI / trình duyệt IndexedDB thực.

Entrypoint: [06-notes](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/06-notes.md) · [COMMON](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md)

## Đã làm và đã push

1. [`poc/06-notes/notes.mjs`](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-06-notes/poc/06-notes/notes.mjs): IndexedDB Meeting/NoteDocument/EditJournal, repository interface, save với expectedRevision, ACK sau transaction completed, journal snapshot, migration đọc schema 0 không ghi đè dữ liệu cũ, từ chối schema tương lai.
2. `search()` toàn văn tiếng Việt không dấu, kết quả có `meetingId`, `noteDocumentId`, snippet và text offset điều hướng. Giữ nguyên JSON ProseMirror, text/marks/timeSpan ở vòng đọc-ghi.
3. Autosave debounce 350 ms và maxWait timer 1500 ms; status `dirty/saving/saved/error/conflict`. Mock lease `acquire(meetingId)` / `release()`; audio reference adapter `canDelete` và `onDelete`; không sở hữu âm thanh thật.
4. [Demo HTML](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-06-notes/poc/06-notes/index.html): tạo, đổi tên, mở, xóa, tìm và mở kết quả, gõ ghi chú, tự lưu. Textarea demo không giả làm editor ProseMirror; nếu tài liệu có marks thì khóa sửa để tránh mất liên kết.
5. [`notes.test.mjs`](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-06-notes/poc/06-notes/notes.test.mjs): 9 ca logic với fixture tổng hợp. [README/runbook](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-06-notes/poc/06-notes/README.md) ghi lệnh chạy và ranh giới tích hợp.

## Evidence (môi trường và kết quả thực)

- Runner: JavaScript V8 Code Mode, thực thi nguyên văn các body test từ `notes.test.mjs` trên source `notes.mjs`, thay `node:test` / `node:assert` bằng harness tương đương; memory transaction adapter (không dùng IndexedDB browser).
- PASS 9/9: CRUD/reopen; Unicode/marks/timeSpan round-trip và tìm tiếng Việt; revision conflict; write-fail rollback; mock writer lease và ACK; retry failed autosave; schema 0 migration bất biến trước khi commit; schema mới không downgrade; audio-delete veto.
- FAIL 0/9. Không có test failures còn mở ở memory fixture.
- TC29 **PARTIAL PASS (logic fixture)**: ACK và status; **NOT_RUN trên IndexedDB trình duyệt**.
- TC35 **PARTIAL PASS (logic fixture)**: legacy migration; **NOT_RUN IndexedDB upgrade thực và crash/reopen**.
- TC32 lock hai tab: **NOT_RUN**, chỉ mock lease một JS runtime.
- Mục tiêu cửa sổ mất chữ chưa xác nhận ≈2 giây: timer config 1.5 giây được khai báo, **chưa đo thực nghiệm**; có thể dài hơn vì transaction latency/browser throttling.
- Kiểm thử `node --test notes.test.mjs` từ clone sạch: **NOT_RUN**; lệnh có trong README.
- Windows Chrome/Edge, quota thật, kill/reload trình duyệt, browser persistence, CI/PR tích hợp: **NOT_RUN**.

## Review diff / phạm vi

Diff so baseline chỉ có năm file thuộc `poc/06-notes/` và checkpoint riêng. Không sửa docs chung, thư mục worker khác, không động vào baseline hoặc PR của người khác. Không có dữ liệu họp thật, audio hoặc credential.

## Còn thiếu để đạt DONE

1. Clone HEAD nhánh độc lập và chạy `node --test notes.test.mjs`, lưu output/log và SHA thực.
2. Dùng Chrome/Edge thực qua HTTP origin, kiểm IndexedDB trên reopen, race concurrent tabs, quota/index error và crash; đo 2 giây trên browser thực.
3. Review contract adapter lease với 09 và audio deletion với 03; kiểm TC29/TC35 phần văn bản trong tích hợp thật sau khi Gói 1.1 đạt cổng.
4. Không đánh dấu toàn gói 1.5 hoặc sản phẩm PASS khi những ca trên chưa chạy.

WIP/chưa push: — · Chặn bên ngoài: browser-test runtime trong phiên này không có; các adapter độc lập đã bàn giao để tiếp tục.
