# Checkpoint · G06-notes — 15/11/2026

- Chủ sở hữu: G06 (Meeting / NoteDocument / EditJournal / IndexedDB)
- Nhánh duy nhất: `gemini/20261115-06-notes`
- Baseline chung: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- HEAD tiếp quản: `ed272d05620f9ede0a908197b0c0aa4844f249f7`; đã đọc TRACKER của G00 (bản `a9ae1f054d260fef848f391077c29c39c54c148a`), bổ sung test exact SHA/IndexedDB/reopen/crash.
- **Code SHA:** `4dcc4625f8640d79a8a8d3674710cf5f0a2465ef` (commit cuối thay đổi code/test runner; README/evidence/checkpoint sau đó không thay mã)
- **Tested SHA:** `4dcc4625f8640d79a8a8d3674710cf5f0a2465ef` — kiểm từng Git blob file chạy trùng đúng blob tại SHA này
- **Trạng thái:** `IN_PROGRESS / BROWSER_GATE_NOT_RUN`, PoC logic được bàn giao, **chưa DONE** vì chưa kiểm môi trường IndexedDB browser thật.
- Tổng test: **Node Linux: PASS 22 / FAIL 0**; **Chromium Linux test: NOT_RUN** (policy), **Windows Chrome/Edge: NOT_RUN**, **sản phẩm tích hợp: NOT_RUN**.

Entrypoint: [06-notes](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/06-notes.md) · [COMMON](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md) · [TRACKER G00](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/TRACKER.md)

## Mã đã hoàn thành thuộc quyền sở hữu G06

1. [`notes.mjs`](../../../../poc/06-notes/notes.mjs): repository IndexedDB 3 store (Meeting, NoteDocument, EditJournal), migration non-destructive schema0→1, chống downgrade schema mới, save `expectedRevision` CAS, journal snapshot chung transaction, chỉ trả ACK trên `oncomplete`, handling abort/blocked/versionchange. Giữ nguyên ProseMirror JSON và timeSpan marks.
2. Search tiếng Việt: chuẩn hóa dấu + ánh xạ offset về **UTF-16 gốc**, text nodes kề nhau không tự thêm khoảng trắng, paragraphs có ký tự xuống dòng; trả vị trí/độ dài để demo highlight đúng.
3. Autosave: sửa bug mất chỉnh sửa khi có edit mới trong lúc save pending; single-flight drain, maxWait 1500ms không bị mỗi keystroke reset, khởi chạy 350ms debounce, không bao giờ trả `saved` khi commit lỗi hoặc conflict; không release lease khi còn dirty/in-flight.
4. Mock lease có owner token để stale release không thu hồi lease mới. Mock audio-reference veto chặn xóa meeting có tham chiếu không được phép; không chạm file audio thật.
5. [Demo](../../../../poc/06-notes/index.html): tạo/đổi tên/mở/xóa/tìm/cuộn kết quả theo vị trí; chặn chuyển/tạo mới nếu autosave lỗi; bảo vệ tài liệu rich-text/timeSpan (textarea demo chỉ sửa plain-text); xử lý trường hợp xóa bị veto.
6. [`notes.test.mjs`](../../../../poc/06-notes/notes.test.mjs) (9 ca), [`notes.regression.test.mjs`](../../../../poc/06-notes/notes.regression.test.mjs) (13 ca), [`fake-idb.mjs`](../../../../poc/06-notes/fake-idb.mjs), [`bench_autosave.mjs`](../../../../poc/06-notes/bench_autosave.mjs), [`browser_smoke.py`](../../../../poc/06-notes/browser_smoke.py).

## Bằng chứng và phép đo

- [**TAP log gốc 22/22 PASS**](../../../../poc/06-notes/evidence/20261115-node22.tap) · [**Báo cáo kiểm thử + benchmark + browser-attempt**](../../../../poc/06-notes/evidence/20261115-node22-browser.md)
- Lệnh thực: `node --test --test-reporter=tap notes.test.mjs notes.regression.test.mjs` → **exit 0**, 22 PASS / 0 FAIL / 0 skipped, **945.26486 ms**.
- Môi trường: Node v22.16.0, Linux x86_64, Python 3.13.5. Source và test nằm trong thư mục mới được dựng sạch; từng SHA bằng `git hash-object` trùng GitHub: `notes.mjs=77c952dd`, `notes.test.mjs=442a859a`, `notes.regression.test.mjs=89373454`, `fake-idb.mjs=31523a6b`, `bench_autosave.mjs=ca37a616`, `browser_smoke.py=d6d5643a`. **Không gọi đây là clean Git clone:** container không phân giải được `github.com` qua DNS.
- Nội dung test PASS: CRUD/rename/delete/reopen memory; Unicode Vietnamese/marks/timeSpan round-trip; search offset; expectedRevision conflict; state dirty/saving/saved; concurrent flush; edit trong lúc save; stop dirty; mock lease stale release; quota/index-failure & rollback; legacy schema; 2 kết nối transaction fake concurrent CAS; mock crash discard unconfirmed; shared NoteDocument; audio delete veto.
- Benchmark chạy `node bench_autosave.mjs` → **exit 0**; 36 edits / 3.080s, 2 revision commit, phần cuối `ghi chú 35` tồn tại; **max 1.526s / P95 1.526s** unconfirmed trên fixture Node với fake commit delay 3ms/step, không phải số liệu browser/Windows hoặc bảo đảm <=2s trong mọi điều kiện.
- Chạy thử `CHROMIUM_EXECUTABLE=/usr/bin/chromium python browser_smoke.py` → **exit 2; NOT_RUN**, Chromium 144.0.7559.96 chạy được nhưng `Page.goto: net::ERR_BLOCKED_BY_ADMINISTRATOR at http://127.0.0.1:42633/`. Chính sách chặn ngay ở HTTP localhost trước khi đánh giá mã JS; không có bằng chứng pass của IndexedDB browser.

## Mapping TC và giới hạn

| Kiểm thử | PASS fixture / source | NOT_RUN thực tế |
|---|---|---|
| TC29 autosave | Node CAS + journal atomic ACK, dirty state, late edits, rollback, retry, mock crash | IndexedDB browser thực, quota thật, hard kill, hồi phục trong Chrome/Edge và cửa sổ `2s dưới tải |
| TC35 schema migration | Node schema 0 → 1, giữ data trước commit, không hạ schema mới | IndexedDB version migration thật, rollbacks do browser upgrade lỗi |
| TC32 giao tiếp liên quan | Mock in-process lease/stale release, 2 kết nối fake CAS | Web Locks hai tab, browser lifecycle/stale tab thực (thuộc luồng 09) |
| Liên kết/backup/audio | NoteDocument JSON/timeSpan và adapter stub PASS | End-to-end Editor 01, OPFS 03, Backup 07; không thuộc mã sở hữu G06 |

Các bài cần Windows, thiết bị thật, kiểm browser thực tế **luôn NOT_RUN**, không lấy fake-IDB hoặc Node làm bằng chứng PASS thay thế.

## Điều còn lại và đường chạy

1. Ở môi trường Chrome/Edge cho phép truy cập localhost: `cd poc/06-notes && python browser_smoke.py`; chạy smoke real IndexedDB, lưu browser/version/OS, output, exact tested SHA, test thêm browser kill thực và quota thật, đo cửa sổ chưa xác nhận dưới tải.
2. Tích hợp Editor 01 với cùng ProseMirror JSON và migrate; 03 xử lý file audio, 09 cung cấp exclusive writer lock đa tab. Khi tích hợp cần có release/cancellation logic và kiểm reference deletion dưới cùng giao thức, không phụ thuộc code worker khác ở PoC G06.
3. Chỉ đổi trạng thái DONE độc lập khi browser gate đạt hoặc có quyết định nghiệm thu có bằng chứng; không gộp main/deploy.

**Review diff:** Các thay đổi trên nhánh chỉ thuộc `poc/06-notes/` và checkpoint này. Không sửa COMMON, TRACKER, tài liệu hệ thống chung, nhánh khác. Dữ liệu hoàn toàn tổng hợp; không có audio thật hoặc credential.

WIP/chưa push: **không**. Chặn bên ngoài: Chromium navigation policy trong môi trường kiểm thử này.
