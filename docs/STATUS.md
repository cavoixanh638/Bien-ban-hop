# TRẠNG THÁI VÀ ĐIỀU PHỐI — MỐC HỌP

**Ngày khởi tạo:** 15/11/2026  
**Nguồn:** [PLAN_V1_2.md](PLAN_V1_2.md) · [Bộ nghiệm thu](ACCEPTANCE_TESTS.md)  
**Trạng thái chung:** **PLANNING / CHƯA CÓ ỨNG DỤNG ĐƯỢC NGHIỆM THU**

Tệp này **kết hợp CURRENT_STATE + WORKBOARD + sổ quyết định gọn**, không phải hồ sơ lịch sử dài. Mọi trạng thái phải có bằng chứng; **không** biến “đã lập kế hoạch” thành PASS.

## Cập nhật G00/G10 tích hợp — 17/11/2026 (không áp dụng cho `main`)

**Nhánh nguồn thực thi:** `integration/20261115-g10-v1.2`, [PR #1](https://github.com/cavoixanh638/Bien-ban-hop/pull/1) ở trạng thái **DRAFT**, không merge/deploy.

- Bản tích hợp **INTEGRATION_ALPHA** đã có mã trong `app/`, với các PoC nguồn ở `poc/`; bảng kế hoạch khởi tạo bên dưới mô tả **trạng thái trước khi triển khai**, không phản ánh mã trên nhánh này. Không nâng gói 1.1–1.6 lên PASS nghiệm thu khi chưa chạy đủ TC01–TC38 và thiết bị thật.
- Kiểm tra baseline `4ceeb9feb0ee8d16c53dfb2a478f7c23b283d3fd`: GitHub Actions [#43927628146](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/43927628146) **SUCCESS**; Node G10 34/34, Chromium dev 9/9 và production 10/10 PASS; Windows/Linux build PASS. Note follow, timeline tổng và import/export đa phiên đã tích hợp ở mức alpha.
- G00 sửa tranh chấp phát audio: commit `4183fff514fa39298d50b4e984e8f95b99b6b221`, **Code SHA = Tested SHA** cho bản sửa này. Actions [#43996623815](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/43996623815) **SUCCESS** Linux/Windows; Node G10 **37/37 PASS**, Chromium dev **9/9 PASS**, production/PWA **10/10 PASS**. Bổ sung 3 regression: dừng giữa async startup, tua liên tiếp khi lệnh cũ lỗi, chuyển cuộc họp trong khi mở reader.
- G00 gia cố kiểm tra WAV trong `app/Recording`: commit `ca66ccd3e654b972d8b1f02ea7ae445750aa1028` (**Code SHA**). So sánh dung lượng **và SHA-256** theo luồng khi tái sử dụng bản sao hoặc xảy ra race upload; không coi hai WAV cùng số byte là giống nhau. Thêm test sửa byte giữ nguyên kích thước. **Tested SHA: `ce41920c8f855fdfc04fff0b3c6c138aeadefcc8`** (chỉ khác Code SHA `ca66ccd3` ở cập nhật tài liệu STATUS). Actions [#44050264332](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44050264332) **SUCCESS** Linux/Windows; G10 unit **38/38 PASS**, Chromium dev **9/9 PASS**, production/PWA **10/10 PASS**, 0 FAIL. Run #44050166325 bị **CANCELLED** khi push tài liệu, không dùng làm bằng chứng PASS.
- **NOT_RUN / RELEASE HOLD:** UniKey/EVKey thật (Telex/VNI), micro Windows vật lý, 3 giờ ghi liên tục, sleep/mất điện/quota/crash trên máy thật, stress ZIP 0,5–2 GiB/>4 GiB trên browser, chuyển .mochop giữa 2 máy Windows vật lý, full TC01–TC38. Linux/Windows CI không thay thế các phép thử này.

**Quy tắc đọc:** trạng thái lịch sử trong các mục tiếp theo giữ nguyên để bảo toàn nền kế hoạch và quyết định kỹ thuật; khi nhận việc G00 mới phải dùng **HEAD nhánh tích hợp, PR và Actions tại SHA tương ứng** trước khi lấy kết quả bên dưới làm hiện trạng.

## 1. Đường cơ sở đã kiểm tra

- Repo: `cavoixanh638/Bien-ban-hop`, nhánh chính `main`.
- Commit tài liệu V1.2 gốc: `d12e6fe23373c31132fa61c8e0f1dd51eacfd743`.
- Bộ tài liệu đã được tinh gọn **11 → 8 tệp Markdown** tại commit `2bb1c8c3189cfb3c1401eac5a753f255f9bbda9f`; bản cũ được giữ trong lịch sử Git.
- Ngày 15/11/2026 bổ sung **tệp nghiên cứu công nghệ thứ 9:** [TECHNICAL_OPTIONS.md](TECHNICAL_OPTIONS.md) — 17 nhóm, 4 phương án/nhóm, có nguồn tham khảo và bốn gói PoC. **Đây là khuyến nghị kỹ thuật, không phải triển khai hoặc benchmark PASS.**
- Mã nguồn ứng dụng chạy thực tế: **chưa có trong repo** tại thời điểm lập status.
- PoC và chứng cứ test Gói 1.1–1.6: **chưa có**.
- Bản phát hành/PWA đã nghiệm thu: **chưa có**.
- Lần cập nhật gần nhất của tiến độ thực tế: ngày khởi tạo tệp này. Commit ghi tệp hiện hành xem lịch sử Git.

## 2. Bảng công việc

Trạng thái hợp lệ: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `READY_FOR_REVIEW`, `PASS`, `FAIL`, `DEFERRED`. **Không** tự lấy công việc của luồng AI khác hoặc đánh dấu PASS vì tài liệu đã viết xong.

| Gói | Nội dung | Trạng thái | Phụ trách | Bằng chứng/commit thực thi | Việc tiếp theo |
|---|---|---|---|---|---|
| 1.1 | Editor timeSpan, Unikey/EVKey, chỉnh sửa | NOT_STARTED | Chưa giao | Chưa có | PoC MarkSpec/coalescing + trace/test Windows |
| 1.2 | Thu âm, Worker/OPFS, checkpoint | NOT_STARTED | Chưa giao | Chưa có | Đối chứng capture + batching/MessageChannel/backpressure |
| 1.3 | Timeline, mapping, gap/pause | NOT_STARTED | Chưa giao | Chưa có | Chờ đầu ra 1.1 và 1.2 |
| 1.4 | MultiSegment Player và UI | NOT_STARTED | Chưa giao | Chưa có | PoC C1 HTMLAudio preservesPitch vs C2 Web Audio |
| 1.5 | Quản lý, autosave, backup, PWA | NOT_STARTED | Chưa giao | Chưa có | So sánh ZIP/restore/backpressure, PWA origin riêng |
| 1.6 | Tích hợp, QA, phát hành | NOT_STARTED | Chưa giao | Chưa có | TC01–TC38 và báo cáo nghiệm thu |

**Gói ưu tiên chuẩn bị:** 1.1. **Chưa có AI/nhân sự nào được giao chính thức trong bảng trên.**

## 3. Quyết định và giả thuyết kỹ thuật

| ID | Quyết định / vấn đề | Trạng thái | Cơ sở/việc xác minh tiếp |
|---|---|---|---|
| D01 | Ghi chú trung tâm, tự gắn mốc, luôn sửa được | DESIGN_ACCEPTED | Nguyên tắc sản phẩm tại PLAN, kiểm thử UX ở 1.4 |
| D02 | React + TS + Vite; Tiptap `timeSpan` | PROPOSED_FOR_POC | PoC 1.1, test marks/IME/paste |
| D03 | Trạng thái âm thanh không nằm trong timeSpan Mark | DESIGN_ACCEPTED | Audio Manifest + derived state, tích hợp 1.3 |
| D04 | Ưu tiên AudioWorklet/PCM, đối chứng MediaRecorder | OPEN | Benchmark Gói 1.2; chưa có engine production |
| D05 | OPFS + IndexedDB, Worker/checkpoint | PROPOSED_FOR_POC | Crash/quota/restore test |
| D06 | Virtual Multi-Segment Player | DESIGN_ACCEPTED | Công nghệ phát chọn sau test audio và boundary |
| D07 | Thu âm thanh hệ thống/họp online | CONDITIONAL | Test OS/browser/ứng dụng thật; không chặn lõi micro |
| D08 | PWA offline, cache/migration an toàn | DESIGN_ACCEPTED | Test nâng cấp/khôi phục ở Gói 1.5 |
| D09 | DOCX/TXT/Markdown/CSV và backup .mochop | DESIGN_ACCEPTED | Test xuất/restore trên máy khác |
| D10 | Origin phát hành riêng cho dữ liệu cuộc họp | DESIGN_PREFERRED | Chưa thiết lập DNS/HTTPS; phải xác minh origin trước dữ liệu thật |
| D11 | Thu PCM trước, cân nhắc Opus lưu lâu dài | OPEN | Chọn format sau PoC và test độ chính xác, quota, restore |
| D12 | Player nghe chậm 0,75×/0,9× phải rõ và ít biến giọng | OPEN | PoC C1 HTMLAudioElement đôi với preservesPitch vs C2 Web Audio buffer nhỏ; đo biên, cao độ, RAM; không mặc định crossfade/hybrid |
| D13 | Lựa chọn thư viện .mochop: fflate / client-zip / zip.js | OPEN | PoC nhập/xuất 0,5–2 GB, streaming hoặc random-access, backpressure, ZIP64, checksum, peak RAM; chưa chốt fflate |
| D14 | Clock input monotonic + sample/segment mapping | PROPOSED_FOR_POC | PoC 1.2–1.3, tín hiệu đo, drift/pause/gap |
| D15 | MarkSpec: inclusive:false, excludes:timeSpan, spanning:true; coalescing attrs đồng nhất | DESIGN_PREFERRED | PoC 1.1 xác minh Unikey/EVKey, model vs DOM, typedAt đầu cụm, P95/JSON/TextNode |
| D16 | AudioWorklet dùng MessageChannel riêng + transferable, batch 2.048/4.096 | PROPOSED_FOR_POC | PoC 1.2 đo buffer pool, sequence/sample count, queue backpressure, crash; chưa dùng SAB |
| D17 | playback_paused pre-roll tham khảo 5 giây, cho phép tùy chỉnh | DESIGN_PREFERRED | Thử UX 0/3/5/10 giây Gói 1.4; không thay mốc gốc |
| D18 | SharedArrayBuffer/COOP-COEP không bắt buộc ở V1.2 | DESIGN_PREFERRED | Test transferable/Worker khi crossOriginIsolated=false; chỉ xét SAB và hosting header khi PoC chứng minh cần |
| D19 | Không crossfade vô điều kiện tại ranh giới audio | DESIGN_ACCEPTED | PoC C1/C2 kiểm chứng không mất/trùng tiếng khi phát qua segment |

**DESIGN_ACCEPTED / DESIGN_PREFERRED / PROPOSED_FOR_POC / OPEN** = trạng thái chấp nhận/ưu tiên/cần thử **ở mức thiết kế**, **không** phải đã code hoặc test PASS. Mỗi quyết định chọn production phải có commit và phép đo để chuyển trạng thái; không dựa vào suy luận AI. Mọi quyết định công nghệ quan trọng sau PoC phải có commit + phép đo/test và cập nhật đúng bảng này.

## 4. Vấn đề đang chặn và rủi ro

- Chưa có kết quả chạy bộ gõ Unikey/EVKey thật trên Windows.
- Chưa có benchmark/audio crash/segment/seek để chọn engine chính thức.
- Chưa có bản chạy, CI, dữ liệu mẫu hoặc báo cáo test trên repository.
- Đã nghiên cứu sáu nhận xét kỹ thuật mới (15/11/2026), điều chỉnh thiết kế và bổ sung subcase kiểm thử **nhưng chưa có PoC PASS**. Trạng thái của mọi gói vẫn NOT_STARTED; không nhầm nghiên cứu/commit tài liệu với code hoàn thành.
- Vấn đề về nguồn thu online, quota, đa tab và PWA chưa được chứng minh bằng test.

Các nội dung trên là việc cần thử khi triển khai, **không phải lỗi đã quan sát từ một ứng dụng hiện có**.

## 5. Mẫu cập nhật gọn sau mỗi nhiệm vụ

```text
Ngày / gói / người thực hiện:
Commit SHA / branch / PR:
Phạm vi thay đổi:
Test chạy (TCxx / môi trường / log): PASS / FAIL / NOT_RUN
Quyết định mới / giới hạn:
Trạng thái gói sau cập nhật:
Việc tiếp theo và người nhận:
```

Chỉ cập nhật các dòng liên quan; không viết lại toàn bộ kế hoạch, không xóa kết quả/hồ sơ của luồng khác. Nếu cần lưu báo cáo đo dài, có thể dẫn tới GitHub Actions, PR, issue, hoặc tệp bằng chứng chuyên biệt **khi có bằng chứng thật**.

## 6. Điều kiện PASS và phát hành

PASS một gói khi toàn bộ tiêu chí liên quan có kết quả và bằng chứng; `BLOCKED`/ `READY_FOR_REVIEW` khác PASS. Trước phát hành phải kiểm tra [TC01–TC38](ACCEPTANCE_TESTS.md), ghi âm 3 giờ, bộ gõ thật, phát xuyên file, crash/backup/restore, PWA update, không còn lỗi Critical/High.

Không hứa ghi âm tiếp tục khi tab đóng hoặc máy Windows Sleep. Không đưa dữ liệu họp nhạy cảm vào repository.
