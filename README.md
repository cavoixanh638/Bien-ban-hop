# Mốc Họp — Biên bản họp

Repository riêng cho tài liệu và mã nguồn **Mốc Họp**: trình soạn thảo ghi chú có mốc âm thanh tự động.

> **Trạng thái ngày 15/11/2026:** Mới hoàn thiện **kế hoạch V1.2**, chưa triển khai và chưa nghiệm thu WebApp. Mọi giao diện/quy trình dưới đây đều là đặc tả dự kiến.

## Tài liệu

- **[Kế hoạch tổng thể V1.2](docs/PLAN_V1_2.md)** — nguồn phạm vi chính thức, thay thế các bản V1.0 và V1.1.
- [Yêu cầu và luồng sử dụng](docs/REQUIREMENTS.md)
- [Kiến trúc kỹ thuật](docs/ARCHITECTURE.md)
- [Mô hình dữ liệu](docs/DATA_MODEL.md)
- [Quy tắc liên kết thời gian, gõ tiếng Việt và chỉnh sửa](docs/TIMELINE_RULES.md)
- [Phương án thử nghiệm/chọn bộ ghi âm](docs/AUDIO_ENGINE_DECISION.md)
- [Thiết kế phát âm thanh đa đoạn](docs/PLAYBACK_DESIGN.md)
- [Bộ tiêu chí nghiệm thu TC01–TC38](docs/ACCEPTANCE_TESTS.md)
- [Hướng dẫn sử dụng dự kiến](docs/USER_GUIDE.md)
- [Quy tắc làm việc cho AI/Codex](AGENTS.md)

## Nguyên tắc sản phẩm

**Ghi chú là trung tâm.** Người dùng gõ như Word; mọi phần chữ mới nhập khi có nguồn âm thanh phù hợp được gắn mốc tự động, không cần tạo ghi chú, chọn nhãn, gán người nói hoặc bấm Lưu. Nhấp thường dùng để sửa văn bản; nghe lại qua phím tắt/Alt + nhấp/nút ▶ ngữ cảnh, không phải chuyển Xem/Sửa. Mốc phản ánh thời điểm gõ, không phải căn chỉnh lời nói.

Ghi âm nhiều giờ phải lưu định kỳ, có thể khôi phục phần đã lưu; hệ thống cho phép nghe liền mạch qua nhiều file và sao lưu độc lập ngoài trình duyệt.

## Lộ trình

Gói 1.1 Editor/Mark → 1.2 Thu âm/lưu → 1.3 Timeline → 1.4 Phát/UI → 1.5 Quản lý/backup → 1.6 Nghiệm thu/phát hành.

**Ngoài phạm vi V1.2:** AI chép lời, AI người nói, AI tóm tắt và soạn thông báo kết luận, backend và cloud bắt buộc.

Không đưa file ghi âm họp thật hoặc thông tin nhạy cảm vào GitHub. Các quyết định chưa kiểm thử phải ghi rõ là **chưa chốt**.
