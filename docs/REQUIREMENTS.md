# YÊU CẦU SẢN PHẨM — MỐC HỌP V1.2

**Trạng thái:** Đặc tả chức năng Giai đoạn 1, chưa triển khai. Nguồn phạm vi chính: [PLAN_V1_2.md](PLAN_V1_2.md).

## 1. Người dùng và mục tiêu

Người ghi biên bản trong cuộc họp trực tiếp hoặc nghe lại file đã có cần **tập trung tự ghi những nội dung quan trọng** và truy về đúng đoạn ghi âm khi cần làm rõ. Không yêu cầu ứng dụng tự nhận diện người nói, chép mọi lời hoặc kết luận thay con người.

**Luồng chính:** tạo cuộc họp → bắt đầu ghi âm → gõ như Word → dừng → nghe lại từ phần chữ → chỉnh sửa → tìm kiếm → sao lưu/xuất.

### REQ-01 — Ghi chú là trung tâm (Must)
- Một vùng soạn thảo lớn; công cụ phụ thu gọn; không tạo mỗi ý thành thẻ.
- Văn bản thường, heading, bold/italic, danh sách, thụt đầu dòng, Undo/Redo, copy/cut/paste, tìm kiếm.
- Gõ liên tục một đoạn dài không cần Enter để có nhiều mốc.
- Không bắt người dùng chọn nhãn, người nói, vùng thời gian, nút Save hoặc nhập metadata.
- Con trỏ tự vào editor sau khi ghi âm bắt đầu thành công.

### REQ-02 — Tự liên kết mốc (Must)
- Khi có nguồn âm thanh hợp lệ, các phần chữ mới gõ nhận anchor theo thời điểm nhập gần thời gian thực.
- Mốc cấp từ/cụm được nhóm sau khi kiểm thử, không dồn toàn bộ đoạn về mốc đầu.
- Tách thời điểm nhập thực với vị trí phát; không giả định chúng đồng nghĩa với lúc phát biểu.
- Mỗi vùng chữ hoặc có nguồn gốc thời gian xác định, hoặc ở trạng thái không liên kết.
- Khi gõ ở khoảng không thu được âm thanh, nội dung vẫn lưu, không trỏ sai vào file.

### REQ-03 — Soạn thảo và nghe lại không xung đột (Must)
- Editor **luôn sửa được**; nhấp thường đặt con trỏ hoặc chọn chữ.
- Nghe lại bằng **Alt + Click**, nút ▶ ngữ cảnh hoặc phím tắt tại con trỏ. Phím cụ thể phải thử tương thích Windows/Unikey/Edge/Chrome.
- Hover vào phần có liên kết cho biết mốc, phần không liên kết không hiện dấu phát.
- Tua, pause, tốc độ 0,5–2×, pre-roll có thể đặt 0/3/5/10/15/30 giây, vòng lặp A–B.
- Mặc định pre-roll live 5s, nhập file đang chạy 5s, nhập file đã pause 10s; có thể thay đổi và không sửa anchor gốc.
- Có thể chỉnh mốc liên kết thủ công khi cần, không là bước bắt buộc.
- Không tô sáng karaoke theo từng từ khi chưa có align lời nói.

### REQ-04 — Chỉnh sửa và gõ tiếng Việt (Must)
- Test Unikey/EVKey, Telex/VNI thật trên Windows.
- Thêm/sửa dấu trong từ đang gõ giữ mốc của từ; không nhân đôi chữ/làm sai dấu.
- Sửa chính tả đoạn cũ giữ mốc cũ; chèn ý mới khi đang ghi nhận nguồn mới theo quy tắc rõ.
- Copy/cut/move trong cùng tài liệu giữ liên kết; paste ngoài không bịa thời gian từng chữ.
- Paste từ cuộc họp khác không trỏ sai khi nguồn âm thanh không được đem theo.
- Undo/Redo và định dạng phải giữ dữ liệu liên kết khi phù hợp.
- Nếu ngữ cảnh sửa/nhập mới không xác định chắc chắn, ưu tiên bảo toàn mốc, hiển thị rõ hoặc có thể chỉnh sau.

### REQ-05 — Thu âm và nhập file (Must/Conditional)
- Micro: chọn nguồn, xin quyền, bắt đầu/tạm dừng/tiếp tục/dừng, đồng hồ, mức tín hiệu và cảnh báo mất nguồn.
- Ghi âm 2–3 giờ; lưu liên tục xuống đĩa cục bộ theo phần; kiểm tra trạng thái flush/checkpoint.
- File nhập: MP3/WAV/WebM/M4A khi giải mã được; thông báo rõ khi định dạng không được hỗ trợ.
- Với file nhập, phần chữ gõ nhận mốc theo **thanh phát**, kể cả khi pause để ghi; tua rồi gõ lấy mốc mới.
- **Có điều kiện:** âm thanh hệ thống/online hoặc trộn micro; chỉ hiển thị lựa chọn khi runtime hỗ trợ, không hứa thu mọi ứng dụng.

### REQ-06 — Dòng thời gian và bộ phát (Must)
- Một cuộc họp có thể lưu nhiều file/segment nhưng giao diện chỉ có một thanh thời gian logic.
- Phải chuyển qua ranh giới đoạn được, tua toàn cuộc họp và nghe A–B xuyên ranh giới.
- Giữ rõ sự khác nhau giữa pause có chủ đích và khoảng mất âm thanh do lỗi.
- Nhấp một vùng chữ vào gap/missing phải báo lỗi; tuyệt đối không phát nhầm đoạn kế bên.

### REQ-07 — Quản lý/lưu dữ liệu (Must)
- Tạo/mở/đổi tên/xóa có xác nhận; danh sách nhiều cuộc họp và tìm kiếm toàn văn.
- Tự lưu thay đổi editor, âm thanh có xác nhận lưu riêng.
- Chống ghi đồng thời cùng cuộc họp từ nhiều tab; tab sau đọc-only hoặc được thông báo.
- Cảnh báo khi micro không có tín hiệu, hết quota, ghi file lỗi hoặc browser ngắt thiết bị.
- Dữ liệu lưu cục bộ, hoạt động sau lần tải/thiết lập offline. Không bắt buộc tài khoản.

### REQ-08 — Sao lưu, phục hồi, xuất (Must)
- Sao lưu một/nhiều cuộc họp ra file độc lập ngoài browser; gói có manifest/schema/checksum/nội dung/audio.
- Streaming khi xuất/nhập file lớn; không nạp cả bản ghi 3 giờ vào RAM.
- Khôi phục vào vùng tạm, xác minh file/liên kết trước khi đổi dữ liệu đang dùng.
- Xuất DOCX/TXT/Markdown/CSV; có kiểu xuất văn bản sạch và kèm mốc.
- DOCX **không** cam kết có tương tác nghe lại; nội dung và định dạng cơ bản phải còn.

### REQ-09 — PWA và cập nhật (Must)
- Chrome/Edge Windows dùng qua HTTPS (GitHub Pages dự kiến); sau lần tải đầy đủ, chức năng chính chạy offline.
- Không reload/tự kích hoạt phiên bản làm gián đoạn lúc đang ghi.
- Asset cache theo phiên bản; HTML có chiến lược cập nhật + fallback; migration dữ liệu được kiểm thử.
- Screen Wake Lock được dùng khi có, nhưng có thể bị thu hồi; không hứa ngăn Windows ngủ.

## 2. Luồng ngoại lệ

| Tình huống | Hành vi mong đợi |
|---|---|
| Micro bị rút/hết quyền | Cảnh báo, đánh dấu khoảng mất âm thanh, vẫn cho gõ |
| Hết quota | Cảnh báo trước; khi ghi thất bại không báo đã lưu |
| Đóng tab giữa lúc ghi | Khôi phục phần audio/text đã xác nhận ghi; phần còn thiếu được báo rõ |
| Hai tab cùng mở | Chỉ một tab ghi; không overwrite |
| Dán đoạn từ ngoài | Không tạo fake per-word audio timestamps |
| Sửa mốc cũ | Giữ bản chất nguồn và chỉ đổi vị trí khi người dùng chủ động |
| Nhấp vào vùng không có âm thanh | Không play, giải thích liên kết thiếu |
| Cập nhật PWA khi đang thu | Hoãn kích hoạt/reload đến lúc an toàn |

## 3. Phân cấp ưu tiên

- **Must:** toàn bộ phần REQ-01 đến REQ-09, trừ tính năng đánh dấu rõ Conditional.
- **Should/Conditional:** thu online có kiểm thử theo nền tảng, manual labels/diarization thủ công, waveform và trích đoạn.
- **Out of scope:** AI chép lời, nhận diện người nói, tự tạo biên bản/thông báo kết luận, backend/cloud.

## 4. Định nghĩa nghiệm thu

Không gọi tính năng đã hoàn thành khi mới có nút hoặc demo UI. Kiểm thử theo [ACCEPTANCE_TESTS.md](ACCEPTANCE_TESTS.md), đặc biệt gõ Việt thực, ghi 3 giờ, phát xuyên file, mất điện/crash, khôi phục backup và cập nhật PWA. Các mục tiêu đo là **mục tiêu thử nghiệm**, không cam kết tuyệt đối trước khi có kết quả.

*Không chứa dữ liệu cuộc họp thật hoặc yêu cầu AI ở giai đoạn này.*
