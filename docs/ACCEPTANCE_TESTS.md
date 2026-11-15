# BỘ NGHIỆM THU V1.2 — TC01–TC38

**Trạng thái:** Bộ tiêu chí dự kiến, **chưa chạy test**, không có kết quả PASS được kế thừa. Nguồn phạm vi: [PLAN_V1_2.md](PLAN_V1_2.md).

## Nguyên tắc

- Kiểm thử tự động (unit/integration/e2e) **và** thao tác bộ gõ thật trên Windows Chrome/Edge.
- Mỗi test ghi commit SHA, môi trường/phiên bản, thiết bị, fixture, bước chạy, Expected/Actual, PASS/FAIL, ảnh/log/file mẫu và lỗi.
- Dữ liệu kiểm thử dùng nội dung tổng hợp hoặc được phép sử dụng; không commit bản ghi âm họp thực.
- Không coi UI có nút là bằng chứng tính năng hoàn thành.
- Các mục tiêu đo **không phải bảo đảm tuyệt đối** trước khi chạy; nếu chưa đạt cần báo cáo và quyết định, không tự hạ chuẩn.

## Danh sách

| Mã | Tình huống | Điều kiện đạt |
|---|---|---|
| TC01 | Gõ văn bản | Gõ như Word, tự có mốc, không bấm Lưu |
| TC02 | Gõ dài không Enter | Trong đoạn 2 phút có nhiều mốc khác nhau |
| TC03 | Unikey/EVKey | Telex/VNI thực, không mất chữ/mốc |
| TC04 | Thêm dấu | Giữ mốc ban đầu của từ |
| TC05 | Sửa chữ cũ | Không tự đổi nguồn âm thanh |
| TC06 | Chèn giữa Mark | Theo quy tắc mới/cũ rõ ràng |
| TC07 | Cắt/dán/di chuyển | Giữ link còn hợp lệ |
| TC08 | Undo/Redo | Khôi phục cả chữ và mốc |
| TC09 | Định dạng | Không phá link |
| TC10 | Dán ngoài | Không bịa per-word timestamp |
| TC11 | Tài liệu dài | Không giật nghiêm trọng; đo P95 nhập |
| TC12 | Ghi 3 giờ | Phát và tua toàn bộ phần hợp lệ |
| TC13 | Pause/resume | Timeline không bị cộng nhầm pause |
| TC14 | Mất micro | Có cảnh báo và gap rõ ràng |
| TC15 | Đóng tab đột ngột | Khôi phục phần đã lưu |
| TC16 | Nhiều đoạn audio | Mốc không trỏ sai file |
| TC17 | Sai lệch mốc | Mục tiêu <=1 giây tín hiệu thử |
| TC18 | File audio hỏng | Missing/gap, không phát nhầm |
| TC19 | Hết quota | Cảnh báo, không báo lưu giả |
| TC20 | Wake Lock thu hồi | Hiển thị đúng, không hứa ngăn Sleep |
| TC21 | Audio online | Chỉ PASS môi trường được kiểm chứng |
| TC22 | Phát từ con trỏ | Đúng link và pre-roll |
| TC23 | Phát xuyên boundary | Không mất/lặp âm bất thường |
| TC24 | Seek đầu/giữa/cuối | Virtual Timeline tìm đúng đoạn |
| TC25 | A-B xuyên file | Phát lặp đúng khoảng |
| TC26 | Vừa sửa vừa nghe | Không cần đổi chế độ |
| TC27 | Nhập file có sẵn | Mốc theo vị trí phát |
| TC28 | Pause file rồi ghi | Giữ mốc tại pause |
| TC29 | Auto-save | Không đòi Save; xác nhận lưu thực |
| TC30 | Backup/restore | Giữ chữ, marks, audio, checksum |
| TC31 | Backup file lớn | Streaming, không nạp hết RAM |
| TC32 | Hai tab | Chỉ một writer, không ghi đè |
| TC33 | Offline | Sau tải ban đầu vẫn ghi/soạn |
| TC34 | PWA update | Không reload phiên ghi |
| TC35 | Schema migration | Mở dữ liệu cũ không mất |
| TC36 | DOCX | Giữ tiếng Việt và định dạng cơ bản |
| TC37 | Paste cuộc họp khác | Không trỏ nhầm recording |
| TC38 | Restore thiếu audio | Báo missing, vẫn giữ text |

## Bộ test trọng tâm theo gói

### 1.1 — Editor + bộ gõ Việt
TC01–TC11: hai phút gõ không xuống dòng, cùng một đoạn có mốc khác nhau; Unikey/EVKey Telex/VNI trên **Windows thật**, chuỗi Backspace+Insert, từ “trường”, “tiếng”, đổi dấu muộn, gõ nhanh/chậm, máy tải nặng, Undo/Redo, paste từ Word/web/cuộc họp khác. Tracing phải cho thấy mốc giữ đúng dù composition events không có.

### 1.2 — Audio capture + OPFS
TC12–TC21: ghi 3 giờ, pause nhiều lần, browser/tab kill, micro rút, thiếu quota, file/chunk dở, WAV/PCM header, CPU/RAM/độ dài, checksum và ghi nhận mất mẫu. Audio online chỉ nghiệm thu cho cấu hình OS/browser/ứng dụng **có audio track thực tế**.

### 1.3 — Timeline
TC13–TC18 và TC22/24/27/28: ánh xạ input clock ↔ sample/media, segment, pause, gap, nguồn nhập, lưu mốc gốc độc lập với pre-roll. Không phát nhầm gần gap hoặc nguồn khác.

### 1.4 — Player + UX
TC22–TC28: vừa nghe vừa sửa, Alt + nhấp/phím tại con trỏ/▶ ngữ cảnh, nhấp thường đặt con trỏ, loop A–B, tốc độ, phát 04:58→05:02 xuyên file. Đo gap/lặp, không chỉ xem thanh progress.

### 1.5 — Storage/PWA
TC29–TC38: auto-save được xác nhận, restore .mochop, dữ liệu lớn streaming, writer lock, offline, không cập nhật ép lúc ghi, migration schema trên fixture cũ, xuất DOCX Unicode.

### 1.6 — Tổng hợp và thực địa
Kiểm thử tổng thể Gói 1.1–1.5 trên Windows/Chrome/Edge; một số phiên họp thử dài; sao lưu ra máy khác và mở lại. Chưa có evidence thì **không được** ghi PASS.

## Ngưỡng đo tham khảo

| Chỉ số | Mục tiêu thử nghiệm |
|---|---|
| Độ lệch mốc | <= 1 giây so với tín hiệu thử thực, không phải so khớp lời nói |
| Độ trễ nhập liệu | P95 < 100 ms trên cấu hình thử được ghi rõ |
| Văn bản chưa được xác nhận lưu có thể mất | Mục tiêu khoảng <= 2 giây khi giả lập sự cố |
| Audio chưa được xác nhận flush có thể mất | Mục tiêu khoảng <= 10 giây trong ca thử chuẩn |
| Ghi dài | >= 3 giờ |
| Ranh giới file | Không mất/đúp âm bất thường và sai mốc trong bộ thử |
| Backup/restore | Manifest/checksum, nội dung/mốc/audio khớp |

**Lưu ý:** Tiêu chí âm thanh online là phạm vi có điều kiện. Nếu môi trường không hỗ trợ, phải công bố giới hạn và đưa vào known limitations, không báo PASS giả hoặc coi toàn V1.2 thất bại nếu lõi micro đã đạt.

## Mẫu phiếu nghiệm thu

- Ngày/commit SHA:
- Gói/TC:
- Máy, OS, browser, mic/audio source:
- Fixture/audio signal và cách đo:
- Bước chạy:
- Expected:
- Actual:
- PASS / FAIL / BLOCKED / NOT_RUN:
- Bằng chứng (link log/screenshot/fixture):
- Lỗi và ảnh hưởng:
- Người xác nhận:
- Quyết định (PASS gói / HOLD / cần sửa):

## Quy định phát hành

Critical: mất chữ/audio đã báo lưu, phát nhầm nguồn, backup không thể khôi phục phần hợp lệ. High: gõ Việt hỏng, mốc lệch, ghi/phát cốt lõi hỏng. **Không phát hành khi có Critical/High**. Mỗi gói cần checkpoint và hồ sơ bằng chứng riêng.
