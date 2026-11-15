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
- **Một entry >4 GiB**: NOT_RUN; hai bộ 0,5/2 GiB không tự kích hoạt giới hạn 4 GiB. Bài 65.536 entry là fixture ZIP64 tách biệt.

## Test hành vi âm tính và khôi phục

- Node `test-web.mjs`: **23/23 PASS** trên local code, gồm SHA256 vector qua boundary, CRC32 chuẩn, archive round-trip, TC38 missing audio optional/strict, thay đổi bytes và checksum, schema, path traversal, ZIP bomb, name collision, atomic publish hai writer, rollback khi stream abort/quota, mismatch meeting ID, file lạ, unknown method và symlink, slow sink backpressure. Log `logs/npm-test-local-final.txt`.
- Python `test_mochop.py`: **13/13 PASS**; thực thi từ local code sau thêm cooperative lock. Log `logs/npm-test-local-final.txt`.
- Browser OPFS/IndexedDB: adapter và script có sẵn, nhưng Playwright Chromium điều hướng localhost/HTTPS/file:// trả **`ERR_BLOCKED_BY_ADMINISTRATOR`** trước khi tải trang, do đó NOT_RUN, không đánh dấu TC30/31/38 browser PASS.

## So sánh ứng viên — khả năng và mức bằng chứng

| Ứng viên pin version | Chiều xuất | Chiều nhập | ZIP64 | Đo 0,5 / 2 GiB trên chính package | Kết luận |
|---|---|---|---|---|---|
| `fflate` 0.8.3 | Có API `Zip` + `ZipPassThrough`; adapter trong `candidates.mjs` | Có `Unzip` streaming nhưng chưa nối vào verified staging; PoC ghép zip.js reader | Cần xác minh >4GiB và giới hạn thực tế | **NOT_RUN** | Không chốt |
| `client-zip` 2.5.1 | Có `makeZip` ReadableStream, adapter generator + SHA256 | **Không có unzip**, phải ghép reader zip.js | Tác giả công bố hỗ trợ ZIP64 | **NOT_RUN** | Không thể là engine nhập độc lập |
| `zip.js` 2.25.0 | `ZipWriter`, `zip64` | `ZipReader`, Central Directory + stream entry | Công bố ZIP64 | **NOT_RUN** | Ứng viên cần kiểm thử ưu tiên, chưa chốt |
| **JS ZIP64 STORED tham chiếu** (tự viết, không phải ứng viên) | ZIP64 streaming | Central Directory reader, staging | 65.536 entry PASS | **PASS Node fixture**, browser NOT_RUN | Oracle kiểm chứng schema và rollback |

Nguồn tính năng ứng viên: https://github.com/101arrowz/fflate · https://github.com/Touffy/client-zip · https://gildas-lormeau.github.io/zip.js/ . Đây là đánh giá vai trò từ tài liệu/adapter, **không phải số đo**. Npm registry tại container trả `EAI_AGAIN registry.npmjs.org`; không cài được bản pin hay chạy trực tiếp ba thư viện. `npm-probe.stderr` ghi lý do. Chưa có quyết định D13 từ kết quả đo thực.

## TC và phạm vi còn lại

| TC | PoC độc lập | App tích hợp | Điều kiện chưa đủ |
|---|---|---|---|
| TC30 | **PASS trên fixture Python ↔ Node** | NOT_RUN | Bản app, IndexedDB+OPFS trên browser và khôi phục máy thứ hai |
| TC31 | **PASS reference 0,5/2 GiB và ZIP64-count** | NOT_RUN | Benchmark đúng ba ứng viên npm, ZIP64 >4GiB, Windows Chrome/Edge/peak RAM thực/quota |
| TC38 | **PASS missing-audio fixture** | NOT_RUN | Resolve/UI của app thực, browser OPFS staging, kiểm thực địa |

**Không báo DONE cho G07** cho tới khi benchmark ba package thực, kiểm backpressure/import ZIP64 và browser/restore môi trường khác đạt theo entrypoint. Không merge, deploy hoặc sửa COMMON/TRACKER.
