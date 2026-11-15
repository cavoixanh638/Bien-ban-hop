# THIẾT KẾ PHÁT ĐA ĐOẠN — V1.2

**Trạng thái:** đặc tả mục tiêu, chưa chạy kiểm thử. Phạm vi tại [PLAN_V1_2.md](PLAN_V1_2.md).

## 1. Bài toán

Bản ghi 3 giờ lưu thành nhiều file 2–5 phút; người dùng bấm ghi chú tại 01:32:18 phải nghe đúng nguồn/đoạn mà không tự chọn file. Thanh thời gian toàn cuộc họp không thể là currentTime của một phần tử audio riêng lẻ.

## 2. Virtual Timeline

Phân biệt Wall Time (đồng hồ thực), Input Time (lúc gõ), Meeting Timeline (diễn biến gồm pause/gap), Media Timeline (audio thực phát). Manifest xác định recordingId, segments, offset, sample counts và intervals recorded/paused/gap/unavailable.

Giải quyết một mốc: xác minh recordingId → tìm recorded interval → segment tương ứng → local offset → kết luận valid/pending/missing/gap/unsupported. Không phát đoạn liền kề nếu audio thiếu.

## 3. Hợp đồng Player

- Một thanh thời gian cho cả cuộc họp; phát/tạm dừng/tua/tốc độ 0,5–2×/A–B.
- Tải trước hoặc lập lịch đoạn kế tiếp; không mất/đúp tiếng bất thường ở ranh giới.
- Không decode toàn bộ PCM ba giờ vào RAM; có giới hạn buffer và giải phóng tài nguyên.
- Pre-roll 5 giây khi ghi trực tiếp/đang phát file, 10 giây khi file pause, 0 giây cho mốc người dùng chỉnh (giá trị có thể đổi); không sửa mốc gốc.
- Nhấp thường để sửa chữ; Alt + nhấp, phím tắt tại con trỏ hoặc ▶ ngữ cảnh để play.

## 4. Phương án phát có thể chọn

| Định dạng | Ứng viên |
|---|---|
| PCM/WAV | Web Audio API + schedule AudioBuffer liên tục |
| PCM dài | AudioWorklet playback với hàng đợi/bộ đệm |
| WebM/Opus | Media Source Extensions nếu container/codec hỗ trợ |
| MP3/M4A nhập | Audio element/giải mã thích hợp + Virtual Timeline |

Hai thẻ audio thay src hoặc preload **không tự bảo đảm gapless**. Lựa chọn cần kết quả đo sau Gói 1.2.

## 5. Test nghiệm thu

- Phát 04:58→05:02 tại ranh giới segment 5 phút; đo khoảng ngắt/lặp.
- Seek 00:00, 01:30:00, 02:59:59 và xuyên nhiều file.
- A–B bắt đầu ở một file và kết thúc ở file tiếp.
- Pause/resume rồi seek vào gap: phải báo thiếu, không phát sai.
- Thiếu một file trong backup: vẫn giữ chữ/mốc, báo missing.
- Restore rồi phát/tua đúng như trước; không tăng RAM vô hạn.

Công nghệ cuối và giới hạn trình duyệt phải ghi trong kết quả nghiệm thu Gói 1.3–1.4.
