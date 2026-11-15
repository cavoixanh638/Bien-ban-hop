# Checkpoint · G07-backup — tiếp tục 15/11/2026

- **Owner:** G07 Sao lưu/khôi phục .mochop. **Branch:** `gemini/20261115-07-backup`. Baseline: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`.
- **Trạng thái:** **PARTIAL / READY_FOR_REVIEW phần reference PoC; NOT_DONE theo entrypoint**. Không gọi Gói 1.5 hoặc V1.2 tích hợp PASS.
- **Code SHA (sau fix):** [`4b6ebd2b26dc35ab9a7e60455ff7bb1c85e776a6`](https://github.com/cavoixanh638/Bien-ban-hop/commit/4b6ebd2b26dc35ab9a7e60455ff7bb1c85e776a6).
- **Tested SHA:** `4b6ebd2b26dc35ab9a7e60455ff7bb1c85e776a6` **theo đối chiếu 5/5 blob SHA GitHub trùng byte nguồn đã chạy `npm test`**; lưu ý **clean remote checkout: NOT_RUN** vì terminal không phân giải GitHub DNS.
- **Evidence/HEAD trước checkpoint:** [`8b505ffe84090eed25d9357a75edbfd635d6e4b0`](https://github.com/cavoixanh638/Bien-ban-hop/commit/8b505ffe84090eed25d9357a75edbfd635d6e4b0), 6/6 blob báo cáo/log khớp. Checkpoint commit cuối cùng ghi ở lịch sử nhánh.
- **Môi trường:** Linux Debian 13 x86_64, Node v22.16.0, Python v3.13.5, fixture tổng hợp; không có audio họp thật. Chrome/Edge Windows và máy vật lý khác: NOT_RUN.

## G00 TRACKER và nhiệm vụ mới

- Đã kiểm TRACKER của G00 cả lần cuối: blob SHA `5392405ee4b941b8d483d4a27950acd8e74ddb1d`. **Không có ADD mới riêng cho G07.** Phần còn thiếu vẫn là đo ba package npm thật, browser/OPFS, chuyển máy và D13. G00 chưa cho tích hợp/merge/deploy.
- Khi kiểm chủ động phát hiện lỗi riêng của G07: **`manifest.json` bị sửa byte nhưng CRC trung tâm không đổi vẫn được JS import trước khi vá** (`TAMPER_REPRODUCED_AND_ACCEPTED`). Sửa `mochop-web.mjs/readLimited()` để so kích thước và CRC32 theo luồng **trước parse/staging/publish**. Thêm negative regression không để stage hoặc index sót.
- Cứng hóa path: JS + Python chặn `CON`, `NUL`, `COM1`, `LPT9`, dấu `:` (Windows alternate stream), dấu cách/chấm cuối tên, Unicode không NFC; không đổi COMMON.md.

## Test trên đúng byte nguồn của Code SHA

| Phạm vi | Status | Bằng chứng và ghi chú |
|---|---|---|
| JS ZIP64 streaming, checksum, malicious archive, rollback, missing audio, backpressure | **26/26 PASS — fixture Node** | `poc/07-backup/logs/npm-test-exact-git-blobs-20261115.txt`; gồm 3 subcase CRC/length manifest và Windows path mới |
| Python oracle, ZIP/checksum/rollback/Windows path | **14/14 PASS — fixture Python** | Cùng log, không phải browser |
| Python → Node / Node → Python | **2/2 PASS** | Cùng log; hai runtime trên một máy Linux, **không phải** hai máy |
| 0,5 GiB xuất/nhập | **PASS reference từ vòng trước** | 13,669/12,392 s; peak Node RSS 120.410.112 B, `logs/bench-node-512MiB-final.json`; đo trên Code SHA cũ `d9ed3ca5`, không giả là bench của `4b6e` |
| 2 GiB xuất/nhập | **PASS reference từ vòng trước** | 51,349/50,074 s; peak Node RSS 99.033.088 B, `logs/bench-node-2GiB-final.json`; Code SHA cũ `d9ed3ca5` |
| ZIP64 65.536 entry + Python parser | **PASS định dạng từ vòng trước** | 6,323 s, Python đọc đủ entry; không cố import 65k vì guard 10k |
| **ZIP64 một audio entry 4 GiB + 1 byte** | **PASS Node reference vòng này** | 4.294.967.297 B, ZIP 4.294.969.754 B, xuất **102,081 s**, khôi phục **106,843 s**, peak RSS **72.871.936 B**, peak chunk 256 KiB, missing=0; `logs/bench-node-zip64-single4GiB-20261115.json` |

**Chú thích SHA của benchmark >4GiB:** khởi động sau vá CRC nhưng trước thay đổi chỉ-riêng-kiểm-tên NFC trong `fileName`; logic ZIP64/manifest giống source sau push. Vì vậy bài này là PASS cho đường dữ liệu tham chiếu ở bản chạy, **không** tuyên bố full exact-commit performance. Test 26+14+2 đã chạy trên source byte-identical với commit `4b6ebd2`.

## NOT_RUN / cổng nghiệm thu còn thiếu

1. **fflate@0.8.3 / client-zip@2.5.1 / @zip.js/zip.js@2.25.0 thực:** `npm view`/`npm install` tiếp tục `EAI_AGAIN registry.npmjs.org`; adapter và bench script có sẵn nhưng **cả 3 ứng viên, ZIP64 cross-library, peak RAM/backpressure thật: NOT_RUN**. Chưa có package-lock integrity. Không mạo nhận các số Node reference là benchmark package.
2. **Chrome/Edge/Windows + browser OPFS/IndexedDB/staging/crash/quota:** Chromium Playwright bị policy `ERR_BLOCKED_BY_ADMINISTRATOR` trước điều hướng, **NOT_RUN**. Mã browser adapter sẵn nhưng chưa có xác nhận thực địa.
3. **Khôi phục trên thiết bị/máy khác:** NOT_RUN. Python ↔ Node cùng Linux không thay được bài vật lý.
4. **Nghiệm thu app tích hợp/TỔNG Gói 1.5:** NOT_RUN, vì chỉ PoC theo COMMON, không sửa repo/app luồng khác.
5. **Thử ZIP64 >4 GiB bằng cả ba thư viện**, ngắt điện/crash thật, bảo vệ quota và tốc độ Windows: NOT_RUN.

## Cổng TC30, TC31, TC38

- **TC30:** PASS fixture Python↔Node (text/marks/checksum/audio), app browser và cross-machine **NOT_RUN**.
- **TC31:** PASS reference 512MiB/2GiB, ZIP64 65.536 entry và >4GiB một entry; ba ứng viên npm/browser/Windows **NOT_RUN**.
- **TC38:** PASS fixture thiếu audio giữ nguyên text/timeSpan, app UI/OPFS thực **NOT_RUN**.
- **D13 thư viện ZIP:** **OPEN**; chưa thể chọn production khi thiếu số đo thư viện thật.

## Các đường dẫn bàn giao

- Mã: `poc/07-backup/zip-stream.mjs`, `mochop-web.mjs`, `mochop.py`, `test-web.mjs`, `test_mochop.py`; adapters `candidates.mjs`, `browser-opfs.mjs`.
- Hướng dẫn: [`README.md`](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-07-backup/poc/07-backup/README.md). Số đo/giới hạn: [`RESULTS.md`](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-07-backup/poc/07-backup/RESULTS.md).
- Trace: `logs/npm-test-exact-git-blobs-20261115.txt`, `logs/source-blobs-after-fix.txt`, `logs/bench-node-zip64-single4GiB-20261115.json`.
- Phạm vi diff xác nhận chỉ `poc/07-backup/` và checkpoint này; không đụng COMMON/TRACKER/nhánh khác, không merge main, không deploy.

**Bước cần môi trường ngoài:** có npm và browser được phép thì chạy `npm install --include=optional --ignore-scripts && npm test`, sau đó ba candidate với `node bench-candidates.mjs --candidate ... --bytes 536870912|2147483648`, kiểm ZIP64 độc lập và cross-device restore, ghi đúng tested SHA/version/RAM. Trước khi có bằng chứng, vẫn giữ **NOT_DONE**.

## Tiếp tục sau kiểm tra TRACKER của G00 — 15/11/2026

- **TRACKER đã đọc:** blob `bae8bf111fe13633f7734be08bf8231586539293`. G00 **không giao ADD mới** cho G07, vẫn yêu cầu benchmark ba gói thật, ZIP64 và kiểm Windows/browser/máy khác. Chỉ xử lý phần an toàn có thể chứng minh độc lập, không làm lại benchmark 512MiB/2GiB đã PASS.
- **Code SHA mới:** [`eea265dc25c99d277cce2bbf2e13e1c496d87bc8`](https://github.com/cavoixanh638/Bien-ban-hop/commit/eea265dc25c99d277cce2bbf2e13e1c496d87bc8).
- **Tested source SHA:** `eea265dc25c99d277cce2bbf2e13e1c496d87bc8` **theo 8/8 Git blob SHA trùng byte local được test**. Không phải clean Git clone; lệnh clone từ terminal vẫn không chạy được vì DNS.
- **Thử mới:** `npm test` = **31/31 JavaScript PASS** (26 test reference giữ nguyên + **5 test guard dùng mock Zip producer**), **14/14 Python PASS**, **2/2 Python↔Node interop PASS**. Node 22.16.0 / Python 3.13.5 / Debian Linux 13. Log: [`logs/npm-test-fflate-zip32-guard-20261115.txt`](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-07-backup/poc/07-backup/logs/npm-test-fflate-zip32-guard-20261115.txt). **Không phải PASS của package npm fflate/zip.js/client-zip thực**.
- **Phát hiện/khắc phục:** kiểm [mã nguồn tag `fflate@0.8.3`](https://github.com/101arrowz/fflate/blob/v0.8.3/src/index.ts), blob `8460f8d29ec0a9597ccc0895dabcf933a33df9b3`: `Zip` + `ZipPassThrough` ghi EOCD/classic 32-bit sizes/offset, không sinh ZIP64 footer. Tại `poc/07-backup/candidates.mjs`, `ClassicZip32Budget` nay **chặn trước khi xuất nếu từ 65.535 entry** (giữ 0xffff là ZIP64 sentinel) và **abort sink nếu tổng output vượt 0xfffffffe byte**, không để caller báo backup thành công hoặc giữ file dở. Bài test kiểm giới hạn bằng mock có inject, không chứng minh trực tiếp runtime fflate.
- **Bằng chứng đọc source:** [`logs/fflate-v0.8.3-source-audit.md`](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-07-backup/poc/07-backup/logs/fflate-v0.8.3-source-audit.md); npm probe mới: [`logs/npm-candidate-probe-20261115.txt`](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-07-backup/poc/07-backup/logs/npm-candidate-probe-20261115.txt) (`EAI_AGAIN registry.npmjs.org`).
- **PASS giữ nguyên theo SHA cũ:** JS ZIP64 reference 512MiB/2GiB, 65.536 entry, 4GiB+1 entry; không gán số benchmark đó cho `eea265d` hoặc thư viện npm, không chạy lại bài lớn không bị tác động.
- **NOT_RUN bắt buộc:** benchmark 512MiB và 2GiB trên chính `fflate@0.8.3`, `client-zip@2.5.1`, `@zip.js/zip.js@2.25.0` (cài package/lockfile integrity); test browser OPFS/IndexedDB/Chrome/Edge/Windows, quota/crash, khôi phục máy thứ hai, clean remote checkout, app tích hợp. **D13 vẫn OPEN, G07 vẫn PARTIAL / NOT_DONE**.
- **Phạm vi diff:** chỉ `poc/07-backup/` và checkpoint `07-backup.md`. Không sửa COMMON, TRACKER, nhánh khác, không merge/main/deploy.
