# G00 · Bàn giao sẵn sàng tích hợp Mốc Họp V1.2 — 15/11/2026

> Đây là **kế hoạch/cổng bàn giao**, **không phải lệnh đã merge, deploy hay nghiệm thu PASS**. Sau 10 luồng PoC, `main` vẫn HEAD `6142f56a6efdb27aa9445920c9321f7930c0d5fd`, `docs/STATUS.md` là PLANNING. Chưa tồn tại nhánh/PR tích hợp tại thời điểm kiểm.

## 1. Snapshot để pin source (KHÔNG được thay Code SHA bằng HEAD tài liệu)

| Luồng | HEAD quan sát | Code/fixture đã có chứng cứ | Trạng thái quyết định |
|---|---|---|---|
| G00 | `8bf2a251` | `bd08496a`, V8 harness 17/17 | Node đúng checkout NOT_RUN |
| G01 | `dfb0b1fe` | `4e9283ee`, Node 75/75 | G01-ADD-01 sửa PoC; **gate Windows IME/HOLD** |
| G02 | `4ceb8049` | `41bff106`, V8 24/24 mới; Node 36/36 **SHA cũ** | ADD-06/07 sửa PoC; Node mới/browser/3h NOT_RUN |
| G03 | `3add589c` | `58cdba99`, Node 25/25 | Browser OPFS/crash/quota NOT_RUN |
| G04 | `6681cdb1` | `f093cfcf`, Node TS 33/33 | **DONE PoC fixture**, không phải runtime |
| G05 | `153db7d1` | `17e1b6f3`, Node 10/10 + Chromium synthetic 10/10 | Giọng chậm + sample-loopback trên Windows NOT_RUN |
| G06 | `62248128` | `4dcc4625`, Node 22/22 | IndexedDB browser/multitab/crash NOT_RUN |
| G07 | `032c6a8f` | `eea265dc`, Node 31/31 + Python 14/14 + interop 2/2 | D13 OPEN, ba npm ZIP candidates chưa benchmark |
| G08 | `b6b21b5e` | `82d93899`, Node 55/55 + LibreOffice | MS Word/Excel Windows NOT_RUN |
| G09 | `d5383f0d` | `2a0f68d8`, Node 28/28 + HTTP 9/9 | Browser real SW/offline/locks/migration NOT_RUN |

HEAD nêu trên là snapshot đọc từ remote; cần kiểm lại ngay trước tích hợp. Worker code và evidence ở nhánh riêng; **không có 9 thay đổi độc lập nào đã merge vào `main`**. Trạng thái runtime chính thức TC01–TC38: **NOT_RUN**, không cộng PASS mock thành PASS production.

## 2. Quyết định “có việc mới cho worker hay không?”

- **G01:** không mở ADD mới. PendingLinkJournal G01-ADD-01 đã sửa ở PoC. Nhưng đang HOLD gate 1.1 do thiếu npm Tiptap build, Playwright và **UniKey/EVKey × Telex/VNI trên Windows** (gõ 120 giây không Enter, sửa dấu muộn, Undo/Redo, copy/paste, P95 <100ms, TextNode/Mark/DOM/JSON). Không gọi G01 DONE.
- **G02:** không mở lại ADD-06/07. V8 controlled 24/24 là test trên mã mới; 36/36 Node thuộc SHA `0083a670` cũ. Cần `npm test` trên SHA `41bff106` (44 test khai báo) và thử browser/micro 3h thật.
- **G07:** không mở ADD mới. Có mã guard ZIP32 cho fflate; benchmark 0.5/2 GiB + >4 GiB đã chạy trên **native reference**, không phải candidate. Khi npm có mạng, chạy `fflate`, `client-zip`, `@zip.js/zip.js` bản pin 0.5/2GiB, ZIP64, restore qua zip.js, đo RAM, backpressure, checksum, lỗi CRC và quota. D13 vẫn OPEN.
- **G03/04/05/06/08/09:** mã/fixture có thể bàn giao; phần lớn còn **browser hoặc Windows runtime**. Không yêu cầu làm lại các unit test PASS nếu chưa đổi mã.

## 3. Điều kiện để bắt đầu tích hợp code (đợt riêng, sau khi có ủy quyền)

1. **Pin commit** và tạo nhánh tích hợp *riêng* từ main (không merge nhánh PoC lên main trực tiếp, không overwrite worker branches); lập inventory dependencies, license và các source adapters. Giữ `COMMON.md` đóng băng cho vòng PoC, ghi vấn đề mới bằng quyết định tích hợp versioned.
2. **Tạo một ứng dụng React/TS/Vite + Tiptap/PWA thật** với thin adapters và giao diện ghi chú là trung tâm (gõ như Word, Mark tại cụm, bấm nghe chính xác; thao tác thường không cần chuột). Không ghép 9 trang demo bằng iframe; chuyển module dùng chung, API/thời gian/provenance có contract.
3. **Dây nối bắt buộc:** G01 typedAt/anchor + pending sidecar → G02 clock/sample/queue → G04 meeting↔media resolver → G03 segment/OPFS durable commit → G05 player. G06 lưu note revision và pending sidecar cùng bảo đảm khôi phục; G07 backup cả provenance, manifest, missing audio; G09 Web Locks/IDB/SW update gate; G08 xuất định dạng. Dừng ngay khi source sai hoặc báo saved giả.
4. **Lỗ hổng giao diện cần kiểm tại tích hợp (chưa là lỗi worker):** G02 `queueInput` trả sampleIndex/status/recordingId, **không** tự cấp đủ `meetingId/generation/intervalId/coverage/audioOffsetMs` cho G01 `PendingLinkJournal.prepare()`. Thin adapter G00 phải gắn metadata có nguồn đáng tin, quy đổi `sampleIndex → mediaOffsetMs`, đối chiếu manifest/commit, giữ token chống stale, kiểm phiên họp, không bịa sample từ wall clock. Tạo cross-worker test pending t=1500→valid và Pause/gap/missing/stop/Undo/Redo/cross-meeting trong cùng app.
5. **Gates tiền nghiệm thu:** điều kiện G01 Windows IME cần **PASS trước khi gọi giao diện editor đạt**; G07 D13 lựa chọn ZIP chưa chốt khi thiếu benchmark; G02 engine PCM/MediaRecorder và G05 C1/C2 chưa chốt production khi thiếu đo thiết bị. Có thể dựng **bản tích hợp thử nghiệm nội bộ** để tiến hành kiểm khi các cổng đang HOLD, nhưng không được gọi bản đó `PASS`/phát hành công khai.

## 4. Ma trận thử nghiệm thực địa theo mức độ rủi ro

| Nhóm | Test quyết định GO/NO-GO trên bản tích hợp |
|---|---|
| **Ghi chú nguồn gốc — TC01–11/37** | Windows Chrome/Edge, UniKey + EVKey, Telex + VNI, 120 giây cùng đoạn, giữ mốc ngay cả khi clock pending/đổi dấu, không phát nhầm cuộc họp |
| **Capture + OPFS — TC12–21** | AudioWorklet/MediaRecorder cùng nguồn; 2048/4096, 3h **wall-clock** thật, CPU/RAM/drop/samples; Pause, unplug mic, quota, crash, journal; ACK recycle ≠ ACK durable |
| **Timeline + Player — TC22–28** | Mốc đúng recording/segment, 04:58→05:02 và 90/170 phút, gap/pending/missing; seek, A–B, pre-roll 0/3/5/10, C1/C2 sample loopback, giọng 0.75×/0.9× |
| **Persistence + ZIP — TC29–32/38** | Autosave revision, multi-tab exclusive writer, dirty save before release, restore missing audio, rollback manifest CRC, ZIP 0.5–2GiB/ZIP64, browser OPFS, máy thứ hai |
| **PWA + Export — TC33–36** | Offline, SW update không reload khi ghi, schema migration rollback, DOCX Word và CSV Excel trên Windows |
| **Security/negative controls** | intentionally wrong source, fake saved ACK, dual writer, zip traversal/CRC/ZIP bomb, direct SW activation while recording; phải fail-closed |

**Ghi nhận bắt buộc:** mỗi case có `Code SHA | Tested SHA | OS/browser/IME/device | scenario | expected/actual | log/trace | PASS/FAIL/NOT_RUN`. Bất kỳ mục chưa chạy hoặc chạy mock đều không phải PASS runtime. Không merge main/deploy trước khi có phê duyệt và không còn Critical/High trên bản tích hợp.

## 5. Công việc còn lại G00 trong đợt hiện tại

- Chạy lại `poc/00-contract-tests` bằng Node từ checkout sạch đúng GitHub SHA (17 tests), lưu test log; trước đó chỉ có V8 shim.
- Xác nhận tự động mọi owner HEAD/tested SHA + diff trước khi lấy mã; `TRACKER.md` cập nhật mới nhất, các mục lịch sử phía dưới không dùng làm snapshot hiện tại.
- Khi được yêu cầu bắt đầu tích hợp: tạo branch mới và một workboard tích hợp có từng cổng; không nhập main/deploy khi chỉ mới có các PoC.

**Cổng kết luận hôm nay:** **SOURCE_HANDOFF_READY / INTEGRATED_APP_NOT_STARTED / RELEASE_HOLD**.
