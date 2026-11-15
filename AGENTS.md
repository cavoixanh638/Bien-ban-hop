# AGENTS.md — Hướng dẫn triển khai Mốc Họp

## Thứ tự nguồn quy định

1. **docs/PLAN_V1_2.md** — phạm vi, nguyên tắc, lộ trình.
2. **docs/REQUIREMENTS.md** — luồng người dùng và UX.
3. **docs/TIMELINE_RULES.md**, **docs/DATA_MODEL.md**, **docs/ARCHITECTURE.md** — dữ liệu và hành vi kỹ thuật.
4. **docs/AUDIO_ENGINE_DECISION.md**, **docs/PLAYBACK_DESIGN.md** — quyết định còn thử nghiệm và thiết kế phát.
5. **docs/ACCEPTANCE_TESTS.md** — bằng chứng để xác nhận hoàn thành.

Nếu có mâu thuẫn, không âm thầm chọn giải pháp dễ lập trình; nêu xung đột và cập nhật đúng tài liệu sau khi được kiểm chứng.

## Những điều không được phá vỡ

- Người dùng chỉ cần **gõ tự nhiên như Word** trong cuộc họp; không phải dùng chuột để chọn nhãn/người nói/mốc.
- Mốc là thời điểm nhập, **không phải** mốc phát âm từ. Pre-roll không sửa mốc gốc.
- Không ép chuyển chế độ Xem/Sửa. Nhấp bình thường đặt con trỏ, nghe lại bằng phím tắt/Alt + nhấp/▶ ngữ cảnh.
- Mark **timeSpan** chứa liên kết tương đối ổn định; **không** đưa trạng thái audio pending/valid/missing biến động liên tục vào Mark.
- Gõ, sửa, dán, cắt, di chuyển, định dạng và Undo/Redo không được phá liên kết còn hợp lệ.
- Unikey/EVKey trên Windows phải test thực; không giả định composition events luôn xuất hiện, không dùng riêng ngưỡng 30–50 ms.
- Không tạo mốc giả ở khoảng audio missing/pause hoặc khi dán văn bản.
- Không báo đã lưu khi dữ liệu mới nằm trong queue; văn bản/audio có trạng thái lưu riêng.
- Có Virtual Timeline, manifest và player đa đoạn; phát không được nhảy nhầm khi thiếu audio.
- PWA không tự update/reload lúc ghi âm; không tự làm mất schema dữ liệu cũ.
- Không tuyên bố đã hoàn thành tính năng khi chỉ có demo UI hoặc PoC ngắn.

## Phạm vi chặt

V1.2 chỉ gồm Giai đoạn 1: editor, thu âm, timestamp, nghe lại, nhiều cuộc họp, lưu cục bộ, backup/restore, xuất. **Không** tạo AI chép lời, người nói, tóm tắt, thông báo kết luận; không thêm backend, đăng nhập hay cloud. Audio máy tính/họp online là tính năng **có điều kiện** theo trình duyệt/OS.

## Quy trình làm việc

1. Đọc đầy đủ tài liệu hiện hành, ghi nhận HEAD và phạm vi gói.
2. Làm Gói 1.1 PoC/editor trước, thu thập trace Unikey/EVKey bằng máy Windows thật.
3. Gói 1.2 so sánh AudioWorklet/PCM với MediaRecorder **bằng kết quả đo**, ghi vào AUDIO_ENGINE_DECISION.md. Không bịa benchmark hoặc mặc định WAV flush “an toàn 100%”.
4. Chốt hợp đồng Timeline/Manifest/Player; phát triển UI tối giản, lưu và backup.
5. Test đơn vị, tích hợp, e2e và test thực với file 3 giờ, crash, boundary, restore, nâng cấp PWA.
6. Sau mỗi gói: commit/checkpoint, PASS/FAIL, lỗi còn tồn tại, quyết định mới, phạm vi ảnh hưởng.
7. Không phát hành nếu còn lỗi Critical/High.

## An toàn Git và dữ liệu

Không force push/reset hoặc xóa dữ liệu đang có nếu chưa có căn cứ. Không commit âm thanh cuộc họp thật, hồ sơ bí mật, khóa hay dữ liệu cá nhân. Fixtures phải dùng dữ liệu tổng hợp/được phép. Không tự ý sửa các module đã PASS mà không chạy regression bị ảnh hưởng.

Tài liệu Markdown UTF-8, dùng đường dẫn tương đối. Giữ một nguồn quy định duy nhất cho mỗi quyết định chuyên môn, tránh sao chép và sinh xung đột.
