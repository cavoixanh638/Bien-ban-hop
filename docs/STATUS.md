# TRẠNG THÁI VÀ ĐIỀU PHỐI — MỐC HỌP

**Ngày khởi tạo:** 15/11/2026  
**Nguồn:** [PLAN_V1_2.md](PLAN_V1_2.md) · [Bộ nghiệm thu](ACCEPTANCE_TESTS.md)  
**Trạng thái chung:** **PLANNING / CHƯA CÓ ỨNG DỤNG ĐƯỢC NGHIỆM THU**

Tệp này **kết hợp CURRENT_STATE + WORKBOARD + sổ quyết định gọn**, không phải hồ sơ lịch sử dài. Mọi trạng thái phải có bằng chứng; **không** biến “đã lập kế hoạch” thành PASS.

## 1. Đường cơ sở đã kiểm tra

- Repo: `cavoixanh638/Bien-ban-hop`, nhánh chính `main`.
- Commit tài liệu V1.2 gốc: `d12e6fe23373c31132fa61c8e0f1dd51eacfd743`.
- Lần này: tinh gọn **11 → 8 tệp Markdown**; bản cũ được giữ trong lịch sử Git.
- Mã nguồn ứng dụng chạy thực tế: **chưa có trong repo** tại thời điểm lập status.
- PoC và chứng cứ test Gói 1.1–1.6: **chưa có**.
- Bản phát hành/PWA đã nghiệm thu: **chưa có**.
- Lần cập nhật gần nhất của tiến độ thực tế: ngày khởi tạo tệp này. Commit ghi tệp hiện hành xem lịch sử Git.

## 2. Bảng công việc

Trạng thái hợp lệ: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `READY_FOR_REVIEW`, `PASS`, `FAIL`, `DEFERRED`. **Không** tự lấy công việc của luồng AI khác hoặc đánh dấu PASS vì tài liệu đã viết xong.

| Gói | Nội dung | Trạng thái | Phụ trách | Bằng chứng/commit thực thi | Việc tiếp theo |
|---|---|---|---|---|---|
| 1.1 | Editor timeSpan, Unikey/EVKey, chỉnh sửa | NOT_STARTED | Chưa giao | Chưa có | PoC + trace/test Windows |
| 1.2 | Thu âm, Worker/OPFS, checkpoint | NOT_STARTED | Chưa giao | Chưa có | So sánh AudioWorklet vs MediaRecorder |
| 1.3 | Timeline, mapping, gap/pause | NOT_STARTED | Chưa giao | Chưa có | Chờ đầu ra 1.1 và 1.2 |
| 1.4 | MultiSegment Player và UI | NOT_STARTED | Chưa giao | Chưa có | Chờ hợp đồng timeline/audio |
| 1.5 | Quản lý, autosave, backup, PWA | NOT_STARTED | Chưa giao | Chưa có | Xây sau lõi, kiểm thử restore |
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

**DESIGN_ACCEPTED** = nguyên tắc/thiết kế đã chọn trong kế hoạch, **không** phải chức năng đã code hoặc test PASS. Mọi quyết định công nghệ quan trọng sau PoC phải có commit + phép đo/test và cập nhật đúng bảng này.

## 4. Vấn đề đang chặn và rủi ro

- Chưa có kết quả chạy bộ gõ Unikey/EVKey thật trên Windows.
- Chưa có benchmark/audio crash/segment/seek để chọn engine chính thức.
- Chưa có bản chạy, CI, dữ liệu mẫu hoặc báo cáo test trên repository.
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
