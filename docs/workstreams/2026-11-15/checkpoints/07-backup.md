# Checkpoint · G07-backup — 15/11/2026

- **Nhánh (duy nhất):** `gemini/20261115-07-backup`; baseline `6142f56a6efdb27aa9445920c9321f7930c0d5fd`.
- **Trạng thái:** **IN_PROGRESS / READY_FOR_REVIEW phần PoC độc lập, CHƯA DONE theo entrypoint**. Không có nghiệm thu ứng dụng tích hợp/Gói 1.5.
- **Code SHA:** [`d9ed3ca5783ffe746016966880e5321282ae9be6`](https://github.com/cavoixanh638/Bien-ban-hop/commit/d9ed3ca5783ffe746016966880e5321282ae9be6).
- **Tested source SHA:** `d9ed3ca5783ffe746016966880e5321282ae9be6` **theo đối chiếu 19/19 Git blob SHA khớp byte với mã local đã chạy**, không phải kết quả `git clone` sạch từ remote; riêng bước `clean checkout`: **NOT_RUN** (container không phân giải được DNS GitHub).
- **Môi trường:** Debian GNU/Linux 13 x86_64; Node 22.16.0; Python 3.13.5; Chromium 144.0.7559.96 bị policy chặn điều hướng; fixture tổng hợp, không dùng bản ghi họp thực.
- **Phạm vi diff:** chỉ `poc/07-backup/` và checkpoint này; không chỉnh COMMON.md, TRACKER.md, nhánh khác; không merge/deploy.

## Kết quả PASS trên PoC độc lập

| Bài | Lệnh/đầu vào | Actual / evidence |
|---|---|---|
| JavaScript core ZIP64 + staging | `npm test` → `node --test test-web.mjs` | **23/23 PASS**, `logs/npm-test-local-final.txt`: CRC32/SHA256, ProseMirror timeSpan, checksum, schema, traversal, zip bomb, casefold/collision, missing audio, abort/quota, rollback, hai writer, slow sink |
| Python oracle | `npm test` → `python3 -m unittest -v test_mochop.py` | **13/13 PASS**, `logs/npm-test-local-final.txt` (bao gồm khóa/publish song song) |
| Khả năng đọc chéo | `npm test` → `python3 interop-check.py` | **2/2 PASS**: Python zipfile → Node staging/restore; Node ZIP64 → Python zipfile/testzip/restore; `logs/interop-cross-runtime.json` (hai runtime cùng Linux, **không phải hai máy**) |
| 0,5 GiB | `node bench.mjs --bytes 536870912 --output logs/bench-node-512MiB-final.json` | **PASS**; xuất **13,669s**, khôi phục **12,392s**, ZIP **536.873.368 B**, peak RSS Node **120.410.112 B**; `logs/bench-node-512MiB-final.json` |
| 2 GiB | `node bench.mjs --bytes 2147483648 --output logs/bench-node-2GiB-final.json` | **PASS**; xuất **51,349s**, khôi phục **50,074s**, ZIP **2.147.486.105 B**, peak RSS Node **99.033.088 B**; `logs/bench-node-2GiB-final.json` |
| ZIP64 bắt buộc riêng | `node bench.mjs --zip64-count 65536` + Python zipfile đọc lại | **PASS định dạng ZIP64**: **65.536 entry**, ZIP64 EOCD, Python đọc được toàn bộ; **6,323s**; `logs/bench-zip64-65536.json`, `logs/zip64-python-cross.txt`. Không phải test thành công import 65k entry (giới hạn an toàn 10k) |
| Bounded streaming/backpressure mock | 256 KiB/chunk, slow sink trong test | **PASS mock:** một lần ghi bất đồng bộ chờ tại mỗi thời điểm; không suy ra backpressure thực của ba thư viện khác |

Kiểm thử đã chạy từ các tệp local với SHA Git object được liệt kê ở `poc/07-backup/logs/source-blob-shas.txt`. GitHub API kiểm blob SHA **19/19 khớp**, không phụ thuộc suy đoán code tương đương. Peak RSS là **Node process Linux**, không phải RAM Chrome/Edge/OPFS. Dữ liệu 512MiB/2GiB là byte giả tổng hợp, không phải PCM hợp lệ. `RESULTS.md` ghi lệnh, giới hạn và biên bản đo.

## Đã tạo mã và fixture tự chủ, không đợi worker khác

- `zip-stream.mjs`: writer ZIP64 STORED streaming, ZIP64 Central Directory/random-access reader, CRC32/SHA256, 256 KiB read chunks; sửa lookup tên O(N²) thành Set để đáp ứng 65k entry.
- `mochop-web.mjs`: export/import hợp đồng COMMON, schema/version, manifest, checksum, bounded metadata, staging/publish/rollback, TC38 audio missing giữ nguyên note/timeSpan.
- `node-adapter.mjs`: stage file và index hard-link atomic chống hai import ghi đè; `browser-opfs.mjs` + `browser-run.mjs`: adapter OPFS và IndexedDB index atomic tự chứa cho bài browser.
- `mochop.py` + `test_mochop.py`: Python reference tăng cường chống collision/path và publish lock.
- `candidates.mjs` + `bench-candidates.mjs`: mã adapter dùng package thật `fflate@0.8.3`, `client-zip@2.5.1`, `@zip.js/zip.js@2.25.0` đã pin version trong `package.json`, không đổi nhãn sang fake; `client-zip` chỉ xuất, phải ghép zip.js để nhập. **Runtime các adapter này chưa có PASS**.
- `README.md`, `RESULTS.md`, test, scripts tạo fixture/benchmark, log lỗi môi trường và tệp hash nguồn có trên nhánh.

## NOT_RUN / chặn bên ngoài — điều kiện chưa đáp ứng để báo DONE

1. **TC31 ba thư viện thật:** `npm install` / `npm view` lỗi `EAI_AGAIN registry.npmjs.org`; **fflate / client-zip / zip.js benchmark cả hai chiều 0,5–2 GiB: NOT_RUN**. Adapter có mã nhưng chưa chạy, thiếu package-lock integrity. Xem `logs/npm-probe.stderr`.
2. **Browser OPFS/IndexedDB thật:** Chromium Playwright bị `ERR_BLOCKED_BY_ADMINISTRATOR` ngay từ navigation HTTPS/localhost/file, không tải được PoC. **TC30/31/38 trên browser: NOT_RUN**; xem `logs/browser-blocked.stderr`. Chạy lại `python3 browser-check.py` trên origin thật, Chrome/Edge Windows.
3. **ZIP64 >4 GiB một entry, quota/browser crash, worker queue dài, bảo mật ZIP đa định dạng và resume khi interrupted:** **NOT_RUN** trên browser/thiết bị.
4. **Restore máy khác Windows Chrome/Edge:** **NOT_RUN**. Python↔Node PASS là tương thích khác runtime cùng máy Linux, không thay thế kiểm thực địa.
5. **Clean remote checkout `npm test`: NOT_RUN** do GitHub DNS trong terminal; byte-identical source từ GitHub đã được kiểm 19/19 blob SHA, nhưng cần người có checkout trực tiếp lặp test.
6. **Tích hợp với meeting repo/IndexedDB/OPFS thật của app:** **NOT_RUN**; dùng fixture độc lập như COMMON yêu cầu.

## Trạng thái các TC

- **TC30:** **PASS trên fixture ZIP64 + Python↔Node; app/browser/máy khác NOT_RUN.**
- **TC31:** **PASS reference JS Node 0,5/2 GiB + ZIP64 count; NOT_RUN ba library benchmark và browser/Windows.**
- **TC38:** **PASS fixture** thiếu audio được phép, Mark/văn bản giữ nguyên; **app/browser NOT_RUN.**
- **Nghiệm thu G07 theo entrypoint:** **NOT DONE**, vì không có bằng chứng chạy ba ứng viên npm và môi trường khác; tuyệt đối không nâng trạng thái thành PASS của sản phẩm.

**Bước tiếp:** trên môi trường có npm và browser được phép: `cd poc/07-backup && npm install --include=optional --ignore-scripts && npm test`, sau đó `node bench-candidates.mjs --candidate fflate|client-zip|zip.js --bytes 536870912` (lặp `2147483648`), `python3 browser-check.py`, thử ZIP64 >4 GiB và chuyển gói qua máy khác. Khi đó đối chiếu peak RAM/backpressure/ZIP64 và quyết định D13, ghi Code/Tested SHA mới, không kế thừa PASS không đúng SHA.
