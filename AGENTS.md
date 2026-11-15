# AGENTS.md — Quy tắc cho ChatGPT/Codex

## 1. Thứ tự đọc và nguồn sự thật

1. [README.md](README.md): mục lục và ý nghĩa repo.
2. [docs/PLAN_V1_2.md](docs/PLAN_V1_2.md): **sản phẩm, yêu cầu, UX, phạm vi, 6 gói**.
3. [docs/STATUS.md](docs/STATUS.md): **đã làm gì, ai đang làm, kết quả và việc tiếp theo**. Đọc phiên bản mới nhất trước khi nhận việc hoặc báo hoàn thành.
4. Đọc **tài liệu chuyên trách** của đúng module: [ARCHITECTURE](docs/ARCHITECTURE.md) / [TIMELINE_RULES](docs/TIMELINE_RULES.md) / [AUDIO_DESIGN](docs/AUDIO_DESIGN.md).
5. [docs/ACCEPTANCE_TESTS.md](docs/ACCEPTANCE_TESTS.md): các TC01–TC38 và chứng cứ PASS.

Không đọc tên tệp để suy luận tính năng đã chạy. **Kế hoạch ≠ code ≠ test đã PASS ≠ bản phát hành.** Nếu dữ liệu hiện tại xung đột tài liệu, báo cụ thể và phân biệt điều đã xác minh với ý định thiết kế.

## 2. Bất biến của sản phẩm

- **Nội dung người dùng gõ là trung tâm**. Gõ như Word, mọi phần nhập có mốc tự động theo ngữ cảnh; không phải tạo thẻ, đánh dấu, chọn người nói/nhãn hay bấm Lưu.
- **Nhấp thường đặt con trỏ**; phím tắt/Alt + nhấp/▶ ngữ cảnh để nghe lại. Không bắt đổi chế độ Xem/Sửa.
- Mốc phản ánh **thời điểm gõ**, không phải chính xác lúc người khác phát âm. Pre-roll không được sửa mốc gốc.
- Mark `timeSpan` trong NoteDocument lưu liên kết tương đối ổn định; **trạng thái âm thanh thay đổi được suy ra từ Audio Manifest**, không cập nhật Mark khi flush.
- Unikey/EVKey Telex/VNI phải thử trên Windows thật, không chỉ dựa composition hay ngưỡng 30–50ms.
- Sửa, dán, cắt, format, Undo/Redo giữ link còn hợp lệ; gap/pause/missing không được phát nhầm nguồn.
- Chỉ báo “Đã lưu” khi thực sự xác nhận; âm thanh ghi định kỳ, có checkpoint và cơ chế khôi phục.
- Có Virtual Multi-Segment Player, nhiều file nhưng một timeline người dùng; sao lưu ngoài browser.
- Không update Service Worker/reload ép lúc đang ghi, không migrate phá dữ liệu cũ.
- V1.2 chỉ Giai đoạn 1, không AI, không backend/tài khoản/cloud bắt buộc.

## 3. Cách thực hiện một gói

1. Kiểm tra HEAD/trạng thái repo; đọc [STATUS](docs/STATUS.md), xác định việc đã PASS và phạm vi thực sự được giao.
2. Thực hiện thay đổi nhỏ, đo bằng test phù hợp; tránh chạy lại mọi test không bị ảnh hưởng nếu không cần.
3. Gói 1.1 phải kiểm thử `timeSpan` và bộ gõ tiếng Việt thật. Gói 1.2 phải so sánh AudioWorklet/PCM với MediaRecorder **bằng số liệu**, không bịa benchmark hoặc tuyên bố WAV an toàn tuyệt đối.
4. Ghi rõ commit SHA, test, PASS/FAIL/NOT_RUN, thiết bị, rủi ro và bước tiếp theo vào **STATUS.md**; không tự sửa PLAN để báo tiến độ.
5. Không ghi PASS khi chưa có bằng chứng, không gọi PoC/demo là sản phẩm phát hành. Lỗi mất dữ liệu, sai nguồn audio, gõ Việt lỗi hoặc sai mốc phải được xử lý trước khi phát hành.
6. Nếu nhiều AI cùng làm, cập nhật STATUS trên bản mới nhất; không ghi đè trạng thái của người khác. Công việc mã nguồn nên theo nhánh/PR trừ khi người dùng cho phép trực tiếp trên `main`.

## 4. Quy tắc tài liệu tinh gọn

- Đổi **yêu cầu/scope/UX** → PLAN_V1_2.md.
- Đổi **module/schema/hợp đồng** → ARCHITECTURE.md.
- Đổi **cách gắn mốc/IME/chỉnh sửa** → TIMELINE_RULES.md.
- Đổi **thu, lưu hoặc phát âm thanh** → AUDIO_DESIGN.md.
- Đổi **tiêu chí/test** → ACCEPTANCE_TESTS.md.
- Đổi **tiến độ, bằng chứng, quyết định đã thử/chốt** → STATUS.md.
- README chỉ làm mục lục; không tạo bản sao thứ hai của một quy định.

Không tạo thêm `SYSTEM.md`, `WORKBOARD.md`, `DATA_MODEL.md`, `AUDIO_ENGINE_DECISION.md` khi cùng nội dung đã có nguồn chính thức. Chỉ tách tệp mới nếu số lượng bằng chứng/phạm vi thực tế khiến việc tách rõ ràng có lợi.

## 5. An toàn

Không force-push/reset/xóa dữ liệu vô căn cứ. Không commit audio cuộc họp thật, bí mật, credential, file sao lưu hoặc dữ liệu cá nhân. Fixtures phải dùng dữ liệu tổng hợp hoặc được cho phép. Bảo toàn lịch sử Git của tài liệu đã hợp nhất.
