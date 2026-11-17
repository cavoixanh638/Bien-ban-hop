# THIẾT KẾ THU ÂM VÀ PHÁT LẠI — BIÊN BẢN HỌP V1.2

**Trạng thái:** Đặc tả thử nghiệm, **chưa lựa chọn engine production**, chưa có kết quả benchmark. Tài liệu này hợp nhất kế hoạch lựa chọn bộ ghi âm và thiết kế Virtual Multi-Segment Player; thông tin PASS/FAIL thực tế thuộc [STATUS.md](STATUS.md).

**Phạm vi tài liệu:** audio capture, lưu bền vững/checkpoint/khôi phục, nguồn micro và âm thanh máy tính, Virtual Timeline, phát/tua qua các file. So sánh bốn công nghệ và căn cứ lựa chọn tại [TECHNICAL_OPTIONS.md](TECHNICAL_OPTIONS.md); quyết định production vẫn phải dựa benchmark Gói 1.2. Quy tắc liên kết chữ với mốc thuộc [TIMELINE_RULES.md](TIMELINE_RULES.md); schema/manifest thuộc [ARCHITECTURE.md](ARCHITECTURE.md).

## I. Thu, lưu và lựa chọn bộ ghi âm

### 1. Mục tiêu

Thu âm 2–3 giờ trên Windows Chrome/Edge; các phần đã lưu phát, tua và khôi phục được; đánh giá CPU/RAM/dung lượng và sai lệch mốc. Không cam kết không mất dữ liệu khi máy tắt đột ngột.

### 2. Phương án A (ưu tiên PoC): AudioWorklet + PCM

AudioWorklet thu mẫu ở sample rate thực, đếm mẫu và chuyển block qua Dedicated Worker. Worker ghi OPFS bằng FileSystemSyncAccessHandle, checkpoint/flush định kỳ. Lưu các đoạn logic 2–5 phút nhưng không đợi đến hết đoạn mới lưu. Có thể lưu PCM thô và metadata trong quá trình thu, hoàn thiện WAV sau.

Ưu điểm: kiểm soát mẫu và ánh xạ thời gian, thuận lợi phục hồi theo checkpoint. Rủi ro: mất mẫu do hàng đợi quá tải, CPU/RAM, PCM lớn, quota. Mono PCM 16-bit xấp xỉ 115 MB/giờ (16 kHz), 173 MB/giờ (24 kHz), 346 MB/giờ (48 kHz). Không mặc định micro hỗ trợ lấy mẫu trực tiếp ở 16/24 kHz.

Cập nhật WAV header/flush định kỳ **không** bảo đảm file 100% hợp lệ khi mất điện. Phải kiểm tra kích thước thực, số mẫu và metadata, có đường khôi phục.

**Thiết kế kênh dữ liệu ưu tiên (phải PoC):** `process()` thường nhận các render quantum 128 frame (khoảng 375 lần/giây tại 48 kHz), nhưng phải dùng `inputs[n][c].length`/kích thước thực chứ không hardcode. Worklet gom vào khối khoảng 2.048 hoặc 4.096 frame (43/85 ms tại 48 kHz) rồi chuyển **Transferable ArrayBuffer**. Main Thread chỉ thiết lập một `MessageChannel` riêng khi khởi tạo: chuyển một port qua `AudioWorkletNode.port.postMessage(..., [port])` để Processor nhận port, chuyển port còn lại tới Dedicated Worker. Không thể gán lại cặp `AudioWorkletProcessor.port` vốn là kênh mặc định giữa Node và Processor. Sau khởi tạo, dữ liệu chạy trên port riêng, không xử lý từng khối qua callback Main Thread.

**Chống nghẽn/mất dữ liệu:** dùng pool buffer hữu hạn, chuyển quyền sở hữu và trả buffer để tái dùng; đánh số `sequenceNo`, `firstSample`, `sampleCount`, `recordingId`, `format` để nhận diện mất/trùng/gap; đo độ sâu hàng đợi và tốc độ Worker flush. Worklet không được cấp phát vô hạn hay chờ blocking file I/O trong luồng audio. Khi queue đầy phải báo lỗi/drop/gap đúng, không coi khối chưa ghi là đã lưu. Thử thay đổi kích thước khối, chuyển tab, CPU load, micro dừng và sự cố Worker.

**SharedArrayBuffer là phương án dự phòng, không phải yêu cầu V1.2:** truyền SAB giữa ngữ cảnh đòi cross-origin isolation/COOP-COEP phù hợp. `FileSystemSyncAccessHandle` trong Dedicated Worker không phụ thuộc SAB hay các header đó. Không áp dụng workaround Service Worker chỉ để giả lập header khi chưa có bài đo cho thấy transferable không đáp ứng.

### 3. Phương án B (đối chứng tối thiểu): MediaRecorder

Dùng MIME được trình duyệt hỗ trợ, thường WebM/Opus. Blob timeslice không mặc nhiên phát độc lập hoặc có chỉ mục seek. Nếu dừng/khởi động lại recorder theo file, đo mất/đúp mẫu tại ranh giới; nếu remux, đo chi phí CPU/RAM và khả năng sửa file sau crash.

Không phát triển đồng thời hai engine production.

### 4. Bộ test chung

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

### 5. Micro và âm thanh online

Micro là phạm vi bắt buộc. Âm thanh hệ thống và phối micro qua getDisplayMedia/AudioContext chỉ làm khi Windows/trình duyệt cấp audio track; kiểm tra Zoom/Teams/Meet, tai nghe, độ lệch hai nguồn, tiếng lặp và mất quyền. Không hứa thu được mọi ứng dụng. Screen Wake Lock có thể bị thu hồi, không bảo đảm Windows không Sleep.

### 6. Cổng quyết định Gói 1.2

Phải có mã commit, cấu hình máy/OS/browser, file thử tổng hợp, phép đo, kết quả PASS/FAIL, dung lượng, CPU/RAM, sai lệch mốc, khả năng khôi phục và giới hạn. Sau khi thử mới cập nhật lựa chọn chính thức. Nếu hai phương án đều chưa đạt thì không coi Gói 1.2 PASS.

Không chấp nhận các tuyên bố tuyệt đối: WAV luôn an toàn, WebM chunk luôn độc lập, AudioWorklet không bao giờ mất mẫu, hoặc hai bộ phát luôn liền mạch.

## II. Virtual Timeline và phát âm thanh đa đoạn

### 1. Bài toán

Bản ghi 3 giờ lưu thành nhiều file 2–5 phút; người dùng bấm ghi chú tại 01:32:18 phải nghe đúng nguồn/đoạn mà không tự chọn file. Thanh thời gian toàn cuộc họp không thể là currentTime của một phần tử audio riêng lẻ.

### 2. Virtual Timeline

Phân biệt Wall Time (đồng hồ thực), Input Time (lúc gõ), Meeting Timeline (diễn biến gồm pause/gap), Media Timeline (audio thực phát). Manifest xác định recordingId, segments, offset, sample counts và intervals recorded/paused/gap/unavailable.

Giải quyết một mốc: xác minh recordingId → tìm recorded interval → segment tương ứng → local offset → kết luận valid/pending/missing/gap/unsupported. Không phát đoạn liền kề nếu audio thiếu.

### 3. Hợp đồng Player

- Một thanh thời gian cho cả cuộc họp; phát/tạm dừng/tua/tốc độ 0,5–2×/A–B.
- Tải trước hoặc lập lịch đoạn kế tiếp; không mất/đúp tiếng bất thường ở ranh giới.
- Không decode toàn bộ PCM ba giờ vào RAM; có giới hạn buffer và giải phóng tài nguyên.
- Pre-roll **đề xuất ban đầu**: 5 giây khi ghi trực tiếp, 5 giây khi đang phát file, **5 giây khi file đang Pause**, 0 giây khi mốc đã chỉnh thủ công. Giá trị cấu hình 0–30 giây; phải thử 0/3/5/10 giây với người dùng. Không sửa mốc gốc.
- Nhấp thường để sửa chữ; Alt + nhấp, phím tắt tại con trỏ hoặc ▶ ngữ cảnh để play.

### 4. Phương án phát có thể chọn

| Phương án | Khi nào dùng | Điểm phải kiểm chứng |
|---|---|---|
| **C1 — Hai HTMLAudioElement, đọc trước WAV segment** | Ưu tiên thử trước vì có `preservesPitch = true`, hữu ích khi nghe chậm | Phát qua biên không mất/lặp, clock giữa hai phần tử, quản lý Blob URL từ OPFS và peak RAM |
| **C2 — Web Audio API, buffer PCM nhỏ được lập lịch** | Đối chứng với C1, có ưu điểm về điều khiển điểm bắt đầu | Khi giảm playbackRate, cao độ có thể đổi; tránh giải mã cả segment/bản ghi lớn |
| C3 — AudioWorklet playback theo luồng | Dự phòng nếu C1/C2 không đạt đồng thời độ liền mạch và chất lượng nghe | Ring buffer, mất mẫu, thời gian seek và chi phí bảo trì |
| C4 — MSE với chuỗi media segment hợp lệ | Khi production chọn codec/container nén tương thích | MSE codec/segment support, metadata seek và tốc độ phát |

**Lưu ý:** Không mặc định hai thẻ audio tự phát không gap; `MediaElementAudioSourceNode` và prebuffer cũng không tự tạo clock nối sample-accurate. Không crossfade 10–20 ms vô điều kiện giữa các segment **không có vùng audio chồng lấn** vì có thể làm mất/hòa trộn tiếng nói. Không mặc định dùng kiến trúc lai HTMLAudioElement + AudioBufferSourceNode quanh ±200 ms ranh giới, vì sẽ phát sinh đồng bộ hai engine.

**Tối ưu RAM:** `getFile()`/Blob URL có thể dùng để cấp nguồn cho audio element; phải `URL.revokeObjectURL()` khi không sử dụng. `decodeAudioData()` cả một segment WAV mono 5 phút/48 kHz thành Float32 đã cần khoảng 57,6 MB thập phân, chưa kể buffer phụ; chỉ đọc các cửa sổ có giới hạn.

**Nghe chậm là chức năng cốt lõi:** kiểm thử 0,75× và 0,9×. HTMLMediaElement mặc định giữ cao độ qua `preservesPitch`; AudioBufferSourceNode.playbackRate không có pitch-preserving time-stretch. Không vội tự viết WSOLA/Phase Vocoder ở V1.2; chốt engine sau khi nghe giọng nói thực tế.

Xem [TECHNICAL_OPTIONS.md](TECHNICAL_OPTIONS.md) mục 11 cho so sánh và điều kiện PoC.

### 5. Test nghiệm thu

- Phát 04:58→05:02 tại ranh giới segment 5 phút; đo khoảng ngắt/lặp.
- Seek 00:00, 01:30:00, 02:59:59 và xuyên nhiều file.
- A–B bắt đầu ở một file và kết thúc ở file tiếp.
- Pause/resume rồi seek vào gap: phải báo thiếu, không phát sai.
- Thiếu một file trong backup: vẫn giữ chữ/mốc, báo missing.
- Restore rồi phát/tua đúng như trước; không tăng RAM vô hạn.
- So sánh C1 và C2: độ trễ/gap ở biên, mất/trùng tiếng, seek, peak RAM, giọng ở 0,75×/0,9×. Không dùng crossfade để che lỗi trong bài đo gốc.
- Kiểm thử Worklet: 128-frame quanta theo dữ liệu thực, block 2.048/4.096, pool buffer/sequence/queue backpressure, CPU stress, Worker ghi chậm, không có `SharedArrayBuffer` và không có COOP/COEP.

Công nghệ cuối và giới hạn trình duyệt phải ghi trong kết quả nghiệm thu Gói 1.3–1.4.

## III. Các quy tắc bổ sung khi triển khai

- **Không phát nhầm khi thiếu audio**: Mark có thể còn trong NoteDocument nhưng nguồn đã mất hoặc đoạn chưa được xác nhận flush. Bộ phát chỉ mở audio khi Manifest xác minh vùng nguồn hợp lệ, không tự chuyển sang đoạn gần nhất.
- **Không giữ toàn bộ bản ghi trong RAM**: worker đọc/ghi và player quản lý các bộ đệm có giới hạn. Đo memory khi thu/phát ba giờ, nhiều ranh giới.
- **Checkpoint không là transaction nguyên tử**: việc ghi PCM, header WAV, journal và manifest phải được hòa giải khi khôi phục. Chỉ nhận dữ liệu đã lưu hợp lệ; không công bố “luôn an toàn 100%”.
- **Điểm quyết định**: sau Gói 1.2 ghi đo đạc, kết quả và engine đã chốt vào [STATUS.md](STATUS.md). Nếu thay đổi thiết kế audio đã được chấp nhận thì sửa tài liệu này và test liên quan, không tạo một tệp quyết định trùng lặp.
- **Độ dài các file**: 2–5 phút là đề xuất tổ chức logic; flush/checkpoint cần thực hiện thường xuyên *trong mỗi file*. Mọi giá trị phải kiểm chứng sau PoC.
- **Online audio là điều kiện**: getDisplayMedia có thể không trả audio track; không khẳng định có thể thu tất cả Zoom, Teams hoặc Meet. Cảnh báo khi nguồn thu ngắt.
- **Screen Wake Lock không bảo đảm Windows không Sleep**. Hướng dẫn người dùng chuẩn bị nguồn điện và cấu hình ngủ máy cho họp dài.
