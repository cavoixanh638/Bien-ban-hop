# Checkpoint · 08-export

- Owner: G08 — xuất DOCX, TXT, Markdown, CSV
- Nhánh duy nhất: `gemini/20261115-08-export` · Baseline: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- **Trạng thái: READY_FOR_REVIEW — PoC độc lập đã hoàn thiện và kiểm thử bằng nguồn GitHub; chưa nghiệm thu ứng dụng tích hợp.** Chưa gọi DONE chung khi Windows/Word và HTTP-origin chưa thử.
- **Code SHA: `209e9cd1af164ecc0fb5968417add8e2262dde97`**
- **Tested SHA: `209e9cd1af164ecc0fb5968417add8e2262dde97`** — chạy từ các byte file lấy tại nhánh GitHub, từng file được so `git hash-object` với Git blob. Đây **không phải clean remote checkout** vì container không phân giải được DNS github.com.
- Evidence HEAD sau khi ghi log và báo cáo: `bf5fe7448b2e514e2e6c65154cb2cf0ffa39f3da` (chỉ bổ sung tài liệu/log sau Code SHA).
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
- **PoC độc lập: READY_FOR_REVIEW (40/40 Node PASS, output/readers/browser shim PASS).**
- **Ứng dụng tích hợp/triển khai: NOT_RUN, chưa nghiệm thu.**
- Không có WIP chưa push trong mã được sở hữu; checkpoint này là bản bàn giao để G00 cập nhật TRACKER của G00.

