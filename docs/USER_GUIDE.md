# HƯỚNG DẪN SỬ DỤNG DỰ KIẾN — V1.2

> **Chưa có WebApp V1.2 đã được triển khai và nghiệm thu.** Đây là hướng dẫn hành vi mục tiêu; phím tắt cụ thể sẽ được xác nhận khi test Windows.

## Ghi chú trực tiếp

1. Trên Chrome/Edge Windows, tạo cuộc họp, đặt hoặc giữ tên mặc định.
2. Cho phép micro, kiểm tra trạng thái lưu và bấm Bắt đầu ghi.
3. Gõ như Word. **Không cần** tạo ghi chú, chọn nhãn/người nói, bấm đánh dấu hoặc Lưu.
4. Ngừng gõ rồi tiếp tục, hoặc gõ một đoạn rất dài: hệ thống vẫn tự lấy mốc khi từng phần nội dung được nhập.
5. Dừng ghi khi cuộc họp kết thúc; trang văn bản vẫn sửa được.

**Mốc là thời điểm bạn gõ, không phải thời điểm người nói bắt đầu câu.** Nghe lại có thể lùi 5 giây theo mặc định.

## Nghe lại

- Nhấp thường đặt con trỏ và sửa văn bản.
- Alt + nhấp, phím tắt ở con trỏ hoặc nút ▶ ngữ cảnh để nghe từ vùng chữ. Phím chính thức phải qua kiểm thử bộ gõ Việt/Windows.
- Có thể tua, đổi tốc độ, lặp A–B và thay độ lùi. Không cần chuyển chế độ Xem/Sửa.
- Văn bản không có audio hoặc mốc vào gap sẽ không phát nhầm đoạn khác; ứng dụng thông báo lý do.

## Dùng bản ghi có sẵn

Nhập MP3/WAV/WebM/M4A khi trình duyệt đọc được. Khi nghe và gõ, mốc lấy theo vị trí đang phát. Tạm dừng để gõ giữ mốc pause; tua đến chỗ mới rồi gõ lấy vị trí mới.

## Quản lý và sao lưu

Ứng dụng dự kiến tự lưu văn bản/âm thanh cục bộ, nhưng dữ liệu có thể bị xóa nếu người dùng xóa dữ liệu website. **Định kỳ xuất gói .mochop** ra vị trí khác ngoài trình duyệt. DOCX/TXT/Markdown/CSV là bản xuất nội dung, không thay thế gói có âm thanh và metadata để phục hồi tương tác nghe lại.

## Sự cố

Micro mất tín hiệu, quota đầy hoặc ghi file lỗi phải được cảnh báo. Browser/tab đóng hoặc Windows Sleep thì ghi âm không tiếp tục; chỉ phần đã lưu hợp lệ mới có thể khôi phục. Screen Wake Lock không bảo đảm ngăn mọi trạng thái Sleep. Không đưa ghi âm họp nhạy cảm lên GitHub khi chưa được phép.

Hướng dẫn này phải được cập nhật bằng ảnh và thao tác **thực tế** sau Gói 1.6.
