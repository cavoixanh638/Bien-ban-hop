# G07 — Sao lưu và khôi phục `.mochop` (PoC độc lập)

**Phạm vi:** `poc/07-backup/` và checkpoint nhánh `gemini/20261115-07-backup`. Không phải ứng dụng tích hợp. Gói 1.5 và bản phát hành V1.2 chưa được nghiệm thu.

Đây là **hai stack độc lập** để kiểm chứng định dạng và cách khôi phục:

1. `mochop.py` + `test_mochop.py`: oracle Python `zipfile`, chunk 1 MiB, ZIP64-aware, metadata/checksum, staging và khóa liên tiến trình. Không phải browser engine.
2. `zip-stream.mjs` + `mochop-web.mjs`: writer **ZIP64 STORED** streaming bằng WHATWG Streams, SHA-256 + CRC32 tính dần, reader Central Directory random access từng chunk <=256 KiB; kiểm dữ liệu trước khi publish. Không cần cài npm để chạy Node tests. Chỉ hỗ trợ ZIP method 0, không hỗ trợ deflate/encryption/multidisk. Tác giả PoC tự viết, **không phải** một trong ba ứng viên thư viện cần so sánh.

Các adapter thật nằm trong `candidates.mjs`, dùng **đúng package** `fflate@0.8.3`, `client-zip@2.5.1`, `@zip.js/zip.js@2.25.0` (khai báo exact version trong `package.json`, không dùng giả lập dưới cùng tên). Trong môi trường chưa cài được npm thì mã adapter có sẵn nhưng runtime các thư viện ấy là **NOT_RUN**, không được lấy benchmark ZIP độc lập làm benchmark của chúng. `client-zip` chỉ có chiều xuất; phải ghép reader khác (ở đây: zip.js) để khôi phục.

## Chạy nhanh từ chính thư mục này

```sh
cd poc/07-backup
npm test                       # 26 Node tests + 14 Python tests + 2 kiểm tra đọc chéo runtime
node bench.mjs --bytes 536870912 --output logs/bench-node-512MiB.json
node bench.mjs --bytes 2147483648 --output logs/bench-node-2GiB.json
node bench.mjs --zip64-count 65536 --output logs/bench-zip64-65536.json
# ZIP64: single audio entry 4 GiB + 1 byte; allocate >=9 GiB temporary disk
node bench.mjs --bytes 4294967297 --output logs/bench-zip64-single4GiB.json
python3 browser-check.py --bytes 1048576 --output logs/chromium-1MiB.json
```

Lệnh browser cần Chromium, Playwright Python, origin HTTPS/localhost không bị policy chặn. Trong môi trường kiểm thử hiện tại, trình duyệt trả `ERR_BLOCKED_BY_ADMINISTRATOR`, do đó **không có PASS browser/OPFS**, mặc dù mã adapter OPFS/IndexedDB đã viết tại `browser-opfs.mjs` và `browser-run.mjs`.

Thử thư viện npm **khi có registry/lockfile được cấp**:

```sh
npm install --include=optional --ignore-scripts
node bench-candidates.mjs --candidate fflate --bytes 536870912 --output logs/fflate-512MiB.json
node bench-candidates.mjs --candidate client-zip --bytes 536870912 --output logs/clientzip-512MiB.json
node bench-candidates.mjs --candidate zip.js --bytes 536870912 --output logs/zipjs-512MiB.json
# Lặp lại từng ứng viên với --bytes 2147483648
```

`bench-candidates.mjs` dùng exporter tương ứng và **zip.js importer chung** để so sánh đối xứng, không giả vờ client-zip có unzip. Cần bổ sung benchmark fflate `Unzip` chuyên biệt, phạt chậm I/O, quota/worker và thử ZIP64 >4GiB. Chưa có `package-lock.json` do registry không thể truy cập; các bản đã pin theo số phiên bản chứ chưa ghi integrity hash. Không được chốt thư viện production từ khả năng trên giấy.

## Định dạng `.mochop` v1 thử nghiệm

ZIP UTF-8 (hoặc ASCII hợp lệ), đường dẫn `/` tương đối, không có tên OPFS tuyệt đối:

| ZIP path | Nội dung |
|---|---|
| `meeting.json` | `{meetingId,title,noteDocumentId,recordingIds,schemaVersion}` |
| `note.json` | `NoteDocument` với ProseMirror JSON và Mark `timeSpan` nguyên bản, revision |
| `audio-manifest.json` | Recording ID, mappingPoints, segments, intervals (pause/gap/recorded) |
| `audio/<segment>.pcm` | Dữ liệu audio nguồn; fixture là **byte tổng hợp**, không phải PCM âm thanh thật |
| `manifest.json` | `{format:'mochop',formatVersion:1,schemaVersion:1,appVersion,meetingIds,files:[{path,size,sha256}]}`; ghi cuối ZIP |

Ở JS, file data và manifest được ZIP64 writer stream qua sink có backpressure; CRC-32 có trong Central Directory; SHA256 từng file trong `manifest.json`. Không cần đọc cả `.mochop` vào RAM. Reader lấy Central Directory, kiểm tất cả đường dẫn/schema/size/collision rồi đọc **từng entry** theo offset; kiểm số byte thực, SHA256 và CRC32 trước khi publish. `timeSpan`/`typedAt`/`audioOffsetMs` **không bị rewrite**. Khi người dùng chấp nhận thiếu audio, phân đoạn thiếu có `completionState:'missing'` và `missingReason`, văn bản/Mark giữ nguyên.

## Atomic publish / rollback

- **Node reference:** `node-adapter.mjs` lưu file vào thư mục staging `stages/<UUID>`, flush; dùng `fs.link(pendingIndex,index/<meetingId>.json)` để công bố **con trỏ một cách nguyên tử, không thay thế ID có sẵn**. Hai importer đồng thời cùng ID: chỉ một thành công; staging thất bại bị xóa. File đã commit không bị ghi đè. Nếu crash trước index transaction có thể còn stage mồ côi, cần GC có lease/TTL.
- **Browser adapter:** `browser-opfs.mjs` ghi stage trong OPFS rồi `IndexedDB.objectStore.add` record ID → stageId bằng transaction readwrite; chỉ công bố sau xác thực checksum. Thất bại hủy stage, collision không ghi đè. Cần thử thật trên Chrome/Edge và thiết kế GC orphan trước product.
- **Python reference:** staging cùng filesystem + cooperative exclusive lock qua O_EXCL và rename; không thay thế ID đã tồn tại khi mọi writer dùng adapter. Khác với IndexedDB pointer, đây chưa phải bảo vệ đầy đủ trước tiến trình bên ngoài không tuân thủ khóa.

## An toàn dữ liệu — giới hạn rõ ràng

Import giới hạn 10.000 entry, 8 GiB tổng kích thước khai báo/đã ghi, ratio 200:1, manifest <=1 MiB, metadata JSON đọc từng file tối đa theo fixture; chặn path tuyệt đối, drive-letter, backslash, `..`, tên Windows reserved (`CON`/`NUL`/`COM1`...), tên có `:` (alternate stream), dấu cách/chấm ở cuối, Unicode NFD/non-NFC, trùng tên theo casefold/lower, symlink, directory, file lạ, schema không hỗ trợ, thiếu metadata, thiếu audio khi chưa cấp phép, checksum/CRC sai, stream abort và ghi đè meeting. Không tự động phát nguồn audio gần nhất khi file thiếu.

**Các giới hạn trước product:** module JS tự viết chỉ ZIP STORED và không thử với corpus ZIP độc hại diện rộng; client-zip/fflate/zip.js chưa chạy; bảo vệ dữ liệu trong OPFS/IndexedDB thật chưa xác minh; browser Linux bị chặn, Windows/Edge/máy khác **NOT_RUN**; thiếu benchmark cổng quota, lỗi ngủ máy, file nguồn đang được ghi đồng thời; ZIP64 >4GiB một file đã PASS trên Node reference, chưa có Python/zip.js cross-runtime >4GiB; storage adapter mock và logic cần nối Gói 1.1/1.2/1.3 sau khi tích hợp.

## Hồ sơ bằng chứng

`RESULTS.md`, `logs/npm-test-exact-git-blobs-20261115.txt`, `logs/bench-node-{512MiB,2GiB}-final.json`, `logs/bench-zip64-65536.json`, `logs/zip64-python-cross.txt`, `logs/interop-cross-runtime.json`, `logs/browser-blocked.stderr`, `logs/npm-probe.stderr`.

Tài liệu ứng viên: [fflate README](https://github.com/101arrowz/fflate), [client-zip README](https://github.com/Touffy/client-zip), [zip.js docs](https://gildas-lormeau.github.io/zip.js/).

## Lượt kiểm tiếp 15/11/2026 — tính toàn vẹn manifest

Một bản ZIP được sửa byte trong `manifest.json` nhưng giữ CRC trong Central Directory **đã từng được nhận nhầm** bởi JavaScript importer (reproducer trước vá: `TAMPER_REPRODUCED_AND_ACCEPTED`). Đã sửa `readLimited()` để kiểm độ dài, CRC32 của toàn bộ manifest **trước khi JSON.parse/stage**. Test regression trong `test-web.mjs` cố ý sửa chuỗi appVersion với độ dài không đổi và chứng minh import từ chối, không tạo staging hoặc ghi meeting. Cùng đó đồng bộ bộ lọc tên an toàn Windows với Python oracle. Các bài test, benchmark mới và những hạn chế chưa chạy ghi tại `RESULTS.md`. 

**CRC/SHA256 bảo vệ tính toàn vẹn trước hư hỏng vô tình, không xác thực người gửi.** Kẻ tấn công có khả năng sửa cả dữ liệu và tính lại CRC/SHA256 vẫn có thể tạo archive hợp lệ; cần cơ chế chữ ký/xác thực riêng nếu sản phẩm yêu cầu chống giả mạo chủ động.

**Lưu ý so sánh:** `fflate@0.8.3` có [báo cáo ZIP64 `unzipSync` dùng kích thước sai](https://github.com/101arrowz/fflate/issues/298); không dùng `unzipSync` với archive không tin cậy. `zip.js` yêu cầu kiểm `uncompressedSize` trước khi giải nén; adapter `.mochop` phải giữ giới hạn trước staging. Tài liệu/cảnh báo này không thay thế thử package thật trên Windows/Chrome/Edge.
