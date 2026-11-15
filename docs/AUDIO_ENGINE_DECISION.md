# LỰA CHỌN BỘ GHI ÂM — V1.2

**Trạng thái: CHƯA QUYẾT ĐỊNH / CHƯA CHẠY BENCHMARK.** Đây là kế hoạch thử nghiệm, không phải kết quả.

## 1. Mục tiêu

Thu âm 2–3 giờ trên Windows Chrome/Edge; các phần đã lưu phát, tua và khôi phục được; đánh giá CPU/RAM/dung lượng và sai lệch mốc. Không cam kết không mất dữ liệu khi máy tắt đột ngột.

## 2. Phương án A (ưu tiên PoC): AudioWorklet + PCM

AudioWorklet thu mẫu ở sample rate thực, đếm mẫu và chuyển block qua Dedicated Worker. Worker ghi OPFS bằng FileSystemSyncAccessHandle, checkpoint/flush định kỳ. Lưu các đoạn logic 2–5 phút nhưng không đợi đến hết đoạn mới lưu. Có thể lưu PCM thô và metadata trong quá trình thu, hoàn thiện WAV sau.

Ưu điểm: kiểm soát mẫu và ánh xạ thời gian, thuận lợi phục hồi theo checkpoint. Rủi ro: mất mẫu do hàng đợi quá tải, CPU/RAM, PCM lớn, quota. Mono PCM 16-bit xấp xỉ 115 MB/giờ (16 kHz), 173 MB/giờ (24 kHz), 346 MB/giờ (48 kHz). Không mặc định micro hỗ trợ lấy mẫu trực tiếp ở 16/24 kHz.

Cập nhật WAV header/flush định kỳ **không** bảo đảm file 100% hợp lệ khi mất điện. Phải kiểm tra kích thước thực, số mẫu và metadata, có đường khôi phục.

## 3. Phương án B (đối chứng tối thiểu): MediaRecorder

Dùng MIME được trình duyệt hỗ trợ, thường WebM/Opus. Blob timeslice không mặc nhiên phát độc lập hoặc có chỉ mục seek. Nếu dừng/khởi động lại recorder theo file, đo mất/đúp mẫu tại ranh giới; nếu remux, đo chi phí CPU/RAM và khả năng sửa file sau crash.

Không phát triển đồng thời hai engine production.

## 4. Bộ test chung

| Tình huống | Dữ liệu cần đo |
|---|---|
| Ghi liên tục 3 giờ | file đọc được, thời lượng, CPU/RAM/quota |
| Pause/resume | sai lệch thời gian, không phát nhầm |
| Tắt tab/browser | phần flush còn đọc được, vùng mất |
| Micro bị ngắt | cảnh báo và khoảng gap |
| Tua đầu/giữa/cuối | sai lệch so với tín hiệu thực |
| Qua ranh giới đoạn | mất/đúp tiếng và độ trễ |
| Quota/OPFS lỗi | trạng thái lưu và khả năng khôi phục |
| Backup/restore | dữ liệu và timeline sau khôi phục |

## 5. Micro và âm thanh online

Micro là phạm vi bắt buộc. Âm thanh hệ thống và phối micro qua getDisplayMedia/AudioContext chỉ làm khi Windows/trình duyệt cấp audio track; kiểm tra Zoom/Teams/Meet, tai nghe, độ lệch hai nguồn, tiếng lặp và mất quyền. Không hứa thu được mọi ứng dụng. Screen Wake Lock có thể bị thu hồi, không bảo đảm Windows không Sleep.

## 6. Cổng quyết định Gói 1.2

Phải có mã commit, cấu hình máy/OS/browser, file thử tổng hợp, phép đo, kết quả PASS/FAIL, dung lượng, CPU/RAM, sai lệch mốc, khả năng khôi phục và giới hạn. Sau khi thử mới cập nhật lựa chọn chính thức. Nếu hai phương án đều chưa đạt thì không coi Gói 1.2 PASS.

Không chấp nhận các tuyên bố tuyệt đối: WAV luôn an toàn, WebM chunk luôn độc lập, AudioWorklet không bao giờ mất mẫu, hoặc hai bộ phát luôn liền mạch.
