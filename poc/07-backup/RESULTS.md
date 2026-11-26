# G07 — Biên bản kiểm thử PoC, 15/11/2026

Trạng thái: **PoC JS ZIP64 tham chiếu PASS cho fixture đã chạy; ba thư viện npm/browser thực tế NOT_RUN; tổng nhiệm vụ G07 CHƯA DONE**. Không suy diễn thành Gói 1.5 PASS hoặc nghiệm thu V1.2.

## Môi trường và lệnh

- Debian GNU/Linux 13 x86_64 (container); Node v22.16.0; Python 3.13.5; Chromium 144.0.7559.96 (không điều hướng được do chính sách admin). `npm test`, `node bench.mjs`, `python3 interop-check.py`, `python3 browser-check.py`.
- Chỉ fixture **tổng hợp**, sinh từ stream 256 KiB lặp pattern xorshift, không có cuộc họp thật và **không phải PCM audio hợp lệ**. Nội dung NoteDocument tiếng Việt và `timeSpan(anchorId,recordingId,audioOffsetMs=12345,typedAt,source,schemaVersion)` đúng COMMON.md.
- Archive ZIP_STORED không nén, SHA256/CRC32 tính dần; peak RSS lấy cả Node `process.memoryUsage()` và GNU `/usr/bin/time -f %M`. OS cache và filesystem local ảnh hưởng tốc độ. Không đo CPU/latency Windows.
- Bằng chứng thực thi nằm ở `logs/`, cần đối chiếu Git blob SHA / Tested SHA sau khi push. Không nhập dữ liệu thật.

## Kết quả đã quan sát — JS reference, không phải 3 thư viện npm

| Fixture | Xuất ZIP | Khôi phục staging | Kích thước ZIP | Peak RSS Node | Peak heap Node | Trạng thái |
|---|---:|---:|---:|---:|---:|---|
| 0,5 GiB = 536.870.912 B | **13,669 s** | **12,392 s** | 536.873.368 B | 120.410.112 B | 12.210.440 B | PASS |
| 2 GiB = 2.147.483.648 B | **51,349 s** | **50,074 s** | 2.147.486.105 B | 99.033.088 B | 20.680.512 B | PASS |

Các số trên là **lần đo cuối sau sửa lỗi tra cứu entry O(N²)** và bổ sung kiểm thử âm tính, bằng cùng nguồn local được tải lên GitHub. Log: `logs/bench-node-512MiB-final.json`, `logs/bench-node-2GiB-final.json`; GNU `/usr/bin/time` peak RSS lần lượt 118.356 KiB và 96.712 KiB. Các phép đo chỉ đại diện lần chạy Linux Node tham chiếu, không thay cho so sánh 3 package. Kiểm thử **23/23 Node + 13/13 Python + 2/2 interop PASS** trên cùng mã cục bộ; mã nguồn đã push cần được đối chiếu Git blob SHA để xác nhận tương đương. Chưa kiểm **clone remote sạch** do DNS kết nối GitHub trong shell bị chặn. 

`ZipStoreWriter` output peak chunk 262.144 B. Stream sink ghi lần lượt `await writable.write`; test sink chậm kiểm **peak 1 write bất đồng bộ** đang đợi, không phải chứng cứ queue backpressure của thư viện ngoài. Kiểm cả file: checksum mỗi entry trong ZIP manifest đối chiếu khi restore, note/marks/audio manifest JSON khớp, audio length khớp. Kiểm abort stream và lỗi ghi: không trả thành công giả.

## ZIP64 và tương thích độc lập

- **65.536 entry** (mỗi entry 0 byte) chạy trên JS ZIP64 writer, Central Directory parser đọc lại 65.536, 12.451.938 bytes, 6,323 s; peak RSS 99.028.992 B. Python `zipfile` kiểm lại 65.536 và thấy ZIP64 EOCD signature. *Chỉ test định dạng/reader với maxEntries nới riêng; không import PoC vì guard an toàn 10.000 entry.*
- **Python → Node**: xuất bằng `zipfile`, Node đọc Central Directory, staging/publish, giữ `timeSpan`; PASS.
- **Node → Python**: writer ZIP64, Python `zipfile.testzip` CRC PASS, Python staging import và giữ mốc; PASS.
- **Một entry >4 GiB**: PASS Node reference ở phép đo mới bên dưới (cũng có bài 65.536 entry ZIP64 tách biệt).

## Test hành vi âm tính và khôi phục

- Node `test-web.mjs`: **23/23 PASS** trên local code, gồm SHA256 vector qua boundary, CRC32 chuẩn, archive round-trip, TC38 missing audio optional/strict, thay đổi bytes và checksum, schema, path traversal, ZIP bomb, name collision, atomic publish hai writer, rollback khi stream abort/quota, mismatch meeting ID, file lạ, unknown method và symlink, slow sink backpressure. Log `logs/npm-test-local-final.txt`.
- Python `test_mochop.py`: **13/13 PASS**; thực thi từ local code sau thêm cooperative lock. Log `logs/npm-test-local-final.txt`.
- Browser OPFS/IndexedDB: adapter và script có sẵn, nhưng Playwright Chromium điều hướng localhost/HTTPS/file:// trả **`ERR_BLOCKED_BY_ADMINISTRATOR`** trước khi tải trang, do đó NOT_RUN, không đánh dấu TC30/31/38 browser PASS.

## So sánh ứng viên — khả năng và mức bằng chứng

| Ứng viên pin version | Chiều xuất | Chiều nhập | ZIP64 | Đo 0,5 / 2 GiB trên chính package | Kết luận |
|---|---|---|---|---|---|
| `fflate` 0.8.3 | `Zip` + `ZipPassThrough`, **ZIP32 output only** theo source tag; guard mới giới hạn 4GiB/65.534 entry | Có `Unzip` streaming, PoC ghép zip.js reader | **Không có ZIP64 writer** theo kiểm mã tĩnh; chưa kiểm package runtime | **NOT_RUN** | Không chọn cho backup vượt ZIP32; benchmark gói nhỏ vẫn NOT_RUN |
| `client-zip` 2.5.1 | Có `makeZip` ReadableStream, adapter generator + SHA256 | **Không có unzip**, phải ghép reader zip.js | Tác giả công bố hỗ trợ ZIP64 | **NOT_RUN** | Không thể là engine nhập độc lập |
| `zip.js` 2.25.0 | `ZipWriter`, `zip64` | `ZipReader`, Central Directory + stream entry | Công bố ZIP64 | **NOT_RUN** | Ứng viên cần kiểm thử ưu tiên, chưa chốt |
| **JS ZIP64 STORED tham chiếu** (tự viết, không phải ứng viên) | ZIP64 streaming | Central Directory reader, staging | 65.536 entry PASS | **PASS Node fixture**, browser NOT_RUN | Oracle kiểm chứng schema và rollback |

Nguồn tính năng ứng viên: https://github.com/101arrowz/fflate · https://github.com/Touffy/client-zip · https://gildas-lormeau.github.io/zip.js/ . Đây là đánh giá vai trò từ tài liệu/adapter, **không phải số đo**. Npm registry tại container trả `EAI_AGAIN registry.npmjs.org`; không cài được bản pin hay chạy trực tiếp ba thư viện. `npm-probe.stderr` ghi lý do. Chưa có quyết định D13 từ kết quả đo thực.

## TC và phạm vi còn lại

| TC | PoC độc lập | App tích hợp | Điều kiện chưa đủ |
|---|---|---|---|
| TC30 | **PASS trên fixture Python ↔ Node** | NOT_RUN | Bản app, IndexedDB+OPFS trên browser và khôi phục máy thứ hai |
| TC31 | **PASS reference 0,5/2 GiB, ZIP64-count và entry >4 GiB** | NOT_RUN | Benchmark đúng ba ứng viên npm, ZIP64 cross-library, Windows Chrome/Edge/peak RAM thực/quota |
| TC38 | **PASS missing-audio fixture** | NOT_RUN | Resolve/UI của app thực, browser OPFS staging, kiểm thực địa |

**Không báo DONE cho G07** cho tới khi benchmark ba package thực, kiểm backpressure/import ZIP64 và browser/restore môi trường khác đạt theo entrypoint. Không merge, deploy hoặc sửa COMMON/TRACKER.

## Tiếp tục 15/11/2026 — G00 không giao ADD mới cho G07, đã tìm lỗi CRC cần vá

- G00 TRACKER mới nhất được kiểm tra: SHA blob `e4d613ac6af6ed58a1d257fac6405379a878d9dc`; G07 vẫn chặn ở package benchmark thật, browser và restore máy khác. Không thay kết quả đã PASS của benchmark 0,5/2GiB cũ.
- **Phát hiện mới (FAIL trước vá):** chỉnh byte cuối chuỗi `appVersion` trong nội dung `manifest.json` mà không cập nhật CRC ở Central Directory, ZIP/JSON vẫn hợp lệ và importer JS cũ **đã trả về thành công** (`TAMPER_REPRODUCED_AND_ACCEPTED`).
- **Sửa và chạy lại:** `mochop-web.mjs/readLimited`: bắt buộc số byte manifest khớp Central Directory và tính CRC32 streaming ngay trước parse; abort trước khi tạo staging nếu lệch. `zip-stream.mjs/fileName` và Python `clean_path` đồng bộ chặn tên Windows không an toàn và Unicode không chuẩn. Regression mới kiểm manifest CRC giả, khai báo chiều dài không đúng, Windows path; đã kiểm lại test tích hợp tự chủ.
- Test local sau vá: **26/26 Node JS PASS**, **14/14 Python PASS**, **2/2 tương thích hai runtime PASS**, `logs/npm-test-after-integrity-fix.txt`; Linux Node 22.16.0/Python 3.13.5. Test browser Windows/Edge vẫn **NOT_RUN**.
- Bản vá chỉ thay tiền kiểm manifest/path; phép đo 0,5/2GiB cũ vẫn là kết quả PASS nguồn trước vá, **không được tự gắn vào SHA mới**.
- Npm tiếp tục lỗi DNS `EAI_AGAIN registry.npmjs.org`; ba adapter `fflate/client-zip/zip.js` vẫn **NOT_RUN**, không được chốt thư viện từ dữ liệu reference.

### Đối chiếu bổ sung tài liệu ứng viên (chưa phải benchmark)

- `client-zip` 2.5.1 ghi rõ chỉ làm ZIP, không có unzip; tác giả mô tả ZIP64 từ phiên bản 2: https://www.npmjs.com/package/client-zip . Vì vậy phải đánh giá cặp **client-zip xuất + zip.js nhập** thay vì coi client-zip là giải pháp khôi phục hoàn chỉnh.
- `zip.js` 2.25.0 công bố `ZipReader`, `ZipWriter`, streaming và khuyến cáo giới hạn `uncompressedSize` **trước** khi giải nén dữ liệu không tin cậy: https://newreleases.io/project/npm/%40zip.js/zip.js/release/2.25.0 . Adapter đã có kiểm metadata và giới hạn trước stage, nhưng tính đúng trong runtime thư viện là NOT_RUN.
- `fflate` 0.8.3 vá một số lỗi ZIP64; vẫn có [issue #298](https://github.com/101arrowz/fflate/issues/298) báo `unzipSync` có thể cấp phát gần 4 GiB từ metadata ZIP64 lỗi. Không sử dụng `unzipSync` để import gói không tin cậy; đường nhập PoC hiện ghép zip.js và có guard trước khi đọc. Đây là **báo cáo bên ngoài, chưa xác minh chạy tại chỗ**, không phải benchmark hoặc kết luận thư viện đã bị loại.

### ZIP64 >4 GiB single entry — phép đo mới

- Command: `node bench.mjs --bytes 4294967297 --output logs/bench-node-zip64-single4GiB-20261115.json` (EXIT 0), archive+staging trong ổ local; xóa toàn bộ dữ liệu lớn sau khi kiểm.
- **PASS Node reference**: audio giả **4.294.967.297 byte** (= 4 GiB + 1 byte); ZIP **4.294.969.754 byte**; xuất **102,081 s**, import staged **106,843 s**; `missingAudio=[]`, note/manifest/audio size khớp. Peak RSS Node **72.871.936 byte (~69,5 MiB)**, peak JS heap **20.767.712 byte**, peak mỗi chunk **262.144 byte**.
- Log: `logs/bench-node-zip64-single4GiB-20261115.json` + `.stdout`/`.stderr`. Dữ liệu là byte giả, không phải file ghi âm thật; không dùng làm benchmark thư viện npm.
- Benchmark này khởi chạy sau **vá CRC manifest** nhưng trước chỉnh sửa chỉ-phần-path của `fileName` (bổ sung NFC), vì vậy **không gán sai nó là phép đo trên chính xác toàn bộ SHA GitHub sau cùng**. Phần CRC/ZIP64 streaming được chạy thực. Bộ unit/regression chạy lại trên source đã push có hash 5/5 khớp.
- **Đã kiểm thêm đúng source vừa push:** `npm test` tại local byte-identical với 5 Git blob của commit `4b6ebd2b26dc35ab9a7e60455ff7bb1c85e776a6`: **26/26 Node + 14/14 Python + 2/2 interop PASS**; stdout `logs/npm-test-exact-git-blobs-20261115.txt`, đối chiếu SHA tại `logs/source-blobs-after-fix.txt`. `git clone` trực tiếp từ GitHub bằng shell: NOT_RUN vì DNS.
- Tình trạng thực địa/ba candidate: **NOT_RUN**, không gọi Gói 1.5 DONE.

## Bổ sung kiểm mã nguồn fflate@0.8.3 — không phải benchmark package (15/11/2026)

- G00 mới nhất **không mở ADD mới cho G07**; cổng tồn đọng vẫn npm/browser/Windows. Shell kiểm lại `npm view fflate@0.8.3` trả `EAI_AGAIN registry.npmjs.org`; không giả lập kết quả thư viện thực.
- Đã đọc trực tiếp tag `v0.8.3` [fflate/src/index.ts](https://github.com/101arrowz/fflate/blob/v0.8.3/src/index.ts) qua GitHub: hàm `wzh` viết size/offset bằng `wbytes` 32-bit; `wzf` viết số entry/EOCD legacy; `Zip.e()` tạo footer legacy. Do đó xuất >4GiB một entry hoặc >=65.535 entry **không có ZIP64 writer**, dù thư viện có thể đọc vài biến thể ZIP64. Đây là **kết luận tĩnh về code version**, không phải số đo lỗi runtime.
- Bổ sung `ClassicZip32Budget` cho adapter `exportWithFflate`: kiểm số file trước `import('fflate')`, kiểm tổng byte output gồm central directory/EOCD ngay trước khi gửi sink; ngưỡng an toàn `0xfffffffe`, `65535` entry. Chạm ngưỡng => lỗi tường minh + abort output, không gọi export thành công. Test riêng với producer giả có lỗi giới hạn, **mock PASS** không đếm như `fflate` thật.
- Chưa thay đổi engine reference ZIP64: các benchmark 512MiB/2GiB, 4GiB+1 cũ vẫn thuộc Tested SHA đã ghi, không chạy lại và không chuyển số liệu sang `fflate`.
