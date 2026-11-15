# Checkpoint · 08-export

- Owner: G08 — xuất DOCX, TXT, Markdown, CSV
- Nhánh duy nhất: `gemini/20261115-08-export` · Baseline: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- **Trạng thái: READY_FOR_REVIEW — PoC độc lập đã hoàn thiện và kiểm thử bằng nguồn GitHub; chưa nghiệm thu ứng dụng tích hợp.** Chưa gọi DONE chung khi Windows/Word và HTTP-origin chưa thử.
- **Code SHA: `82d93899e953f78baf0a41914866115c89ebdc7e`** — gồm exporter, 55 unit tests, fixture, demo, consumer/stress scripts và README.
- **Tested SHA: `82d93899e953f78baf0a41914866115c89ebdc7e`** — chạy từ các byte file lấy tại nhánh GitHub, từng file được so `git hash-object` với Git blob. Đây **không phải clean remote checkout** vì container không phân giải được DNS github.com.
- Evidence HEAD sau báo cáo/log Round 2: `515e9dbe5f90925dd6231f8ee758859f2662eace` (sau Code SHA chỉ bổ sung tài liệu/log, không đổi mã đã test).
- Môi trường: Debian Linux 13 · Node 22.16.0 · Python 3.13 · Pandoc 3.1.11.1 · Chromium 144.0.7559.96 · LibreOffice 25.2.3.2.
- Fixture: [NoteDocument tiếng Việt tổng hợp](../../../../poc/08-export/fixture.json), không có âm thanh họp hoặc dữ liệu nhạy cảm.

Entrypoint: [08-export](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/08-export.md) · [COMMON](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md) · [TRACKER G00](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/TRACKER.md)

## Đã triển khai và khắc phục lỗi

- [`exporter.mjs`](../../../../poc/08-export/exporter.mjs): 4 định dạng, Unicode Việt, heading, bold+italic đồng thời, Markdown escape/list lồng nhau, DOCX Word native numbering, dòng trống/hardbreak, nhãn mốc nguồn/offset và trường chưa liên kết; TXT/MD/CSV/DOCX sạch hoặc kèm mốc.
- Khắc phục 5 nhóm lỗi: Markdown bullet chưa đúng GFM; danh sách lồng và reset ordinal; bold+italic; false unlinked khi hardBreak/mốc dính chữ; XML ký tự cấm và DOCX numbering/nhãn mốc. Lỗi trước đây được xác minh bằng test mới trong phạm vi G08.
- [`index.html`](../../../../poc/08-export/index.html): demo chọn chế độ và tải 4 tệp; [`generate.mjs`](../../../../poc/08-export/generate.mjs) tạo **8 mẫu** trên một fixture. [README](../../../../poc/08-export/README.md) mô tả API, lệnh chạy và các giới hạn tích hợp.
- Thêm [20 edge tests](../../../../poc/08-export/edge.test.mjs), [Chromium smoke](../../../../poc/08-export/browser-smoke.py), [đọc định dạng thật](../../../../poc/08-export/verify-formats.py).
- Đã xem diff baseline → HEAD: chỉ có `poc/08-export/**` và checkpoint này; **không sửa COMMON/nhánh khác, không merge main, không deploy**.

## Bằng chứng PASS / NOT_RUN

| Hạng mục / lệnh | Trạng thái | Bằng chứng và phạm vi |
|---|---|---|
| `node test.mjs` | **PASS 20/20** | Regression nguyên bản, chạy lại đúng blob Git |
| `node edge.test.mjs` | **PASS 20/20** | Unicode, Mark, lista lồng, XML, CSV quote/CRLF; mới sau fix |
| `node generate.mjs` | **PASS 8/8 file** | DOCX/TXT/MD/CSV × sạch/kèm mốc từ cùng fixture |
| `python verify-formats.py` | **PASS 2/2 chế độ** | ZIP CRC/XML DOCX, CSV parser nghiêm ngặt, TXT Unicode, Pandoc đọc Markdown GFM |
| `python browser-smoke.py` | **PASS 9/9 (Chromium với in-memory shim)** | 8 lần tải Blob trùng byte Node; một ca lỗi JSON; **không phải chạy site qua HTTP** |
| `python-docx` mở DOCX | **PASS 2/2** | Đọc heading và numbering OOXML |
| LibreOffice mở/render 2 DOCX → PDF/PNG, kiểm ảnh trực quan | **PASS 2/2** | Hai tài liệu mỗi tài liệu 1 trang, tiếng Việt và định dạng/mốc rõ, không cắt/chồng chữ |
| Windows + Microsoft Word/Excel thực | **NOT_RUN** | Không có Windows/Office trong môi trường này |
| Chrome/Edge trên Windows tải từ HTTP origin | **NOT_RUN** | Browser sandbox bị chặn `ERR_BLOCKED_BY_ADMINISTRATOR` khi mở localhost/file/data, nên không đánh tráo shim thành E2E |
| `git clone` và clean remote checkout GitHub | **NOT_RUN** | DNS github.com không phân giải; dùng nguồn GitHub connector và kiểm SHA từng Git blob thay thế |
| TC36 trên ứng dụng tích hợp Gói 1.5/1.6 | **NOT_RUN** | Chưa có bản tích hợp được giao/đủ cổng |
| Test tài liệu thực rất dài / browser Windows / Word MS | **NOT_RUN** | Nhiệm vụ kiểm sau trên máy thích hợp |

**Log thật:** [QA_RUN_20261115.log](../../../../poc/08-export/evidence/QA_RUN_20261115.log) · [QA_RENDER_20261115.log](../../../../poc/08-export/evidence/QA_RENDER_20261115.log) · [Báo cáo chi tiết](../../../../poc/08-export/evidence/QA_20261115.md).

**TC36 PoC:** PASS qua LibreOffice/Python DOCX readers trên fixture, hai chế độ. **TC36 ứng dụng tích hợp / Word Windows: NOT_RUN**, không suy diễn PASS từ PoC.

## Giới hạn và bàn giao tích hợp

1. `.mochop` gồm audio, manifest và liên kết tương tác thuộc G07; bốn file văn bản không thay backup.
2. `linked=true` trong CSV chỉ chứng minh Mark có recordingId và offset hợp lệ, **không** xác nhận audio được flush/committed. Mốc hiển thị nguyên media offset, không sửa bởi pre-roll.
3. PoC dùng OOXML writer tự chứa, chưa thử `docx.js` trên sản phẩm. DOCX không có hành vi bấm chữ phát âm thanh.
4. Gói 1.5/1.6 cần nối `Meeting.title` + `readNoteDocument`, UI download, safe filename, kiểm lớn, bảo vệ spreadsheet-formula từ nguồn không tin cậy, Word/Excel Windows, Chrome/Edge từ HTTP origin và tích hợp với bảo quản dữ liệu. Đây là các việc ngoài PoC đơn lẻ, **không chặn việc G00 xét duyệt PoC**.

## Kết luận bàn giao

- Phạm vi code, fixture, test, báo cáo và demo G08 đã **commit/push** đúng nhánh.
- **PoC độc lập: READY_FOR_REVIEW (55/55 Node PASS, output/readers/browser shim và LibreOffice Calc PASS).**
- **Ứng dụng tích hợp/triển khai: NOT_RUN, chưa nghiệm thu.**
- Không có WIP chưa push trong mã được sở hữu; checkpoint này là bản bàn giao để G00 cập nhật TRACKER của G00.


## Round 2 — kiểm tra TRACKER G00 và hoàn thiện (15/11/2026)

- Đã đọc TRACKER của G00 mới nhất tại thời điểm bắt đầu vòng này (G00 HEAD `18e1d8c23c27a03aeeae5a8ec59db2c7533e0510`): **không có ADD mới riêng G08**, vẫn cần exact SHA, Word/Chrome/Edge và timestamp/CSV/Markdown/TXT.
- Từ code HEAD G08 `3d9fc2b034ab70699ffc1124536a9b967d0070aa` đầu vòng, đã sửa và push:
  1. **Markdown HTML từ dữ liệu dán:** escape `&<>` trước render để `<script>` không thành HTML chạy.
  2. **CSV formula injection:** mặc định vô hiệu hóa text có tiền tố `=+-@` (cả khi có khoảng trắng/điều khiển ở trước) bằng dấu nháy đơn trước giá trị CSV; opt-out `csvFormulaPolicy:'raw'` chỉ dùng với dữ liệu tin cậy. **Giới hạn:** nội dung CSV dạng raw bị thay có chủ đích ở ô nguy cơ, nhưng NoteDocument JSON nguồn không bị sửa.
  3. **`orderedList.attrs.start`**: giữ đúng số đầu khác 1 ở TXT/Markdown và DOCX OOXML `startOverride`; render DOCX start=7 cho ra 7, 8 đúng.
- **Mã và test được commit:** [exporter](../../../../poc/08-export/exporter.mjs), [security 15 tests](../../../../poc/08-export/security.test.mjs), [consumer safety](../../../../poc/08-export/consumer-safety.py), [stress](../../../../poc/08-export/stress.mjs), [package scripts](../../../../poc/08-export/package.json), [README cập nhật](../../../../poc/08-export/README.md).
- **Run chính thức cùng đúng Git blob:** Linux Debian 13; Node 22.16.0; npm 10.9.2; Python 3.13.5; LibreOffice 25.2.3.2; Pandoc 3.1.11.1; Chromium 144.0.7559.96; UTC `2026-11-15T11:44:18Z`.
- **`npm test`: PASS 55/55** (20 regression gốc + 20 edge + 15 security), exit 0. **`npm run generate`: PASS 8 file** (4 định dạng × 2 chế độ), exit 0.
- **`npm run test:formats`: PASS 2/2** bằng ZIP/XML/CSV parser, Pandoc, TXT; **`npm run test:consumers`: PASS** HTML text không chạy trong Pandoc, CSV an toàn thành string trong LibreOffice Calc; negative control `csvFormulaPolicy:'raw'` được Calc nhập thành formula `=1+1` như dự kiến.
- **`npm run test:stress`: PASS** fixture tổng hợp **10.000 đoạn**, 4 định dạng và 10.000 mốc nguyên; run khoảng 311,7 ms, RSS tại cuối 156,74 MiB trên Linux Node, **không là số liệu thiết bị thật/Windows hay peak RSS**.
- **`npm run test:browser`: PASS 9/9 Chromium in-memory shim**, 8 lượt Blob tương đương byte Node + lỗi JSON. **HTTP-origin browser: NOT_RUN** vì URLBlocklist/ERR_BLOCKED_BY_ADMINISTRATOR.
- **DOCX TC36 PoC: PASS** cả sạch/kèm mốc mở bằng LibreOffice, render 1 trang mỗi file và kiểm ảnh trực quan: tiếng Việt, heading, bold/italic, danh sách và nhãn mốc rõ; sample start=7 cũng hiện đúng. **MS Word Windows: NOT_RUN**; **ứng dụng tích hợp: NOT_RUN**.
- **Git exact source:** đối chiếu 13/13 Git blob SHA từ connector với `git hash-object` file đã test, **PASS**. `git clone` remote checkout: **NOT_RUN** do DNS, không đánh tráo việc dựng file đúng blob thành clean clone.
- [Bằng chứng stdout Round2](../../../../poc/08-export/evidence/QA_ROUND2_20261115.log) · [Báo cáo QA cập nhật](../../../../poc/08-export/evidence/QA_20261115.md).
- Diff baseline tới HEAD sau vòng này: **chỉ `poc/08-export/**` và checkpoint `08-export.md`**, không chạm COMMON/worker khác, không merge/deploy.

**Đánh giá:** G08 **READY_FOR_REVIEW**; PoC độc lập đã giải quyết các nhiệm vụ khả thi trong môi trường này. Các tiêu chí Word/Excel Windows, HTTP-origin Chrome/Edge, clean remote checkout và nghiệm thu tích hợp vẫn **NOT_RUN**, phải làm khi có môi trường thực. **Không tuyên bố DONE cho ứng dụng tích hợp.**
