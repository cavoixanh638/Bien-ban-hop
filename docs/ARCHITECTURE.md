# KIẾN TRÚC KỸ THUẬT — MỐC HỌP V1.2

**Trạng thái:** kiến trúc mục tiêu; chưa có module được nghiệm thu. Nguồn phạm vi: [PLAN_V1_2.md](PLAN_V1_2.md).

## 1. Quyết định công nghệ và giới hạn

- **Frontend:** React, TypeScript, Vite; editor Tiptap/ProseMirror.
- **Dữ liệu:** IndexedDB (tài liệu, cuộc họp, audio manifest, journal), OPFS (âm thanh) trong cùng origin.
- **Âm thanh:** thử nghiệm AudioWorklet/PCM trước; MediaRecorder đối chứng. Chốt sản xuất sau kết quả Gói 1.2.
- **Playback:** Virtual Timeline + Multi-Segment Player, không gắn chặt với engine capture.
- **Worker:** Dedicated Worker ghi OPFS qua FileSystemSyncAccessHandle ở runtime hỗ trợ; không dùng API này trên Main Thread.
- **Đa tab:** Web Locks cho exclusive writer, BroadcastChannel truyền thông báo trạng thái.
- **Offline:** PWA Service Worker; GitHub Pages HTTPS với base path và scope đúng.
- **Không backend, không AI** ở V1.2.

## 2. Sơ đồ luồng dữ liệu

1. Người dùng nhập → Editor/InputTracker xác định thao tác và thời điểm.
2. InputTracker gọi Timeline.getAnchorAtInput(timestamp, currentPlaybackContext).
3. Editor thêm/giữ timeSpan Mark **trên cây NoteDocument**; Storage ghi snapshot/transaction log.
4. Capture nhận âm thanh → Worker/OPFS ghi dữ liệu và checkpoint → Manifest ghi trạng thái coverage.
5. Playback nhận recordingId/audioOffsetMs từ Mark → Timeline.resolve → xác định segment/offset/gap → Player phát.
6. Trang soạn thảo hiển thị trạng thái âm thanh suy ra từ Manifest, **không** chỉnh hàng loạt Mark theo flush.

Không dùng một bảng from/to độc lập làm nguồn sự thật; nếu có chỉ mục tìm kiếm văn bản/mốc, đó là dữ liệu dẫn xuất và phải rebuild được.

## 3. Các module và hợp đồng

### EditorModule
- Quyền sở hữu: tài liệu, selection/cursor, transaction, timeSpan Mark, Undo/Redo, formatting.
- Input: các events/chuyển đổi tài liệu, thông tin CurrentAudioContext qua Timeline interface.
- Output: NoteDocument snapshot, thay đổi có timestamp và lựa chọn anchor để Playback.
- Cấm: phụ thuộc trực tiếp MediaRecorder/AudioWorklet hoặc OPFS.
- Trạng thái âm thanh chỉ hiển thị bằng Decorations/derived state, không đổi Mark liên tục.

### InputTrackingModule
- Theo dõi transaction, beforeinput/input/composition nếu có, thay đổi văn bản trước/sau, selection và chuỗi xóa/chèn.
- Phân biệt gõ mới, sửa từ cũ, đổi dấu Telex/VNI, paste, cut/move, lịch sử.
- Không dùng 30–50 ms hay composition làm bằng chứng duy nhất; không chặn bàn phím Việt bằng filterTransaction.
- Bảo vệ nguyên tắc khi không chắc: giữ nguồn cũ/đánh dấu không thể xác định, không bịa mốc.

### AudioCapture
- Giao diện điển hình: start(config), pause(), resume(), stop(), onStatus(), onChunk(), onError().
- Cung cấp mã phiên, thời điểm bắt đầu, sample rate thực, sample count hoặc điểm thời gian tương đương; không kết luận file phát được từ riêng Blob timeslice.
- Ghi âm micro mặc định; audio hệ thống/online chỉ khi có quyền và audio track.

### AudioStorage/Manifest
- Worker ghi OPFS và cung cấp xác nhận durability/checkpoint.
- Manifest liệt kê recording, segments, intervals/gaps, codec, mapping, completeness, checksum, file paths.
- Không tạo giao dịch nguyên tử giả giữa IndexedDB và OPFS: dùng journal + reconcile sau crash.
- Quản lý quota, unavailable, corrupt, pending, saved và báo trạng thái.

### TimelineModule
Các hàm khái niệm (tên chính thức chốt khi code):
- captureInputAnchor(context, monotonicTime) → {recordingId, audioOffsetMs, source, typedAt} hoặc null.
- resolveAudioPosition(recordingId, offsetMs) → segment/offset và trạng thái valid/gap/missing.
- meetingToMedia / mediaToMeeting → ánh xạ khi pause/gap và nhiều recording.
- getDefaultPreRoll(source) → offset play **không làm biến đổi mốc gốc**.

### PlaybackModule
- Các lệnh: loadMeeting, playAt(recordingId,offsetMs,preRollMs), pause, seekMeeting, setSpeed, loopRange, stop.
- Đọc manifest qua Timeline; chọn engine phù hợp PCM/WAV/WebM/MP3/M4A.
- Phải prebuffer hoặc schedule qua boundary, không giả định việc đổi src là không gap.
- Trình phát hiển thị một Virtual Timeline cho cả cuộc họp, theo dõi khoảng thiếu audio.

### Meeting/Search
- Tạo/đổi tên/mở/xóa cuộc họp, danh sách, tìm toàn văn trong NoteDocument và điều hướng đến vùng kết quả.
- Tôn trọng exclusive writer lock; tab thứ hai chỉ đọc hoặc thông báo.

### Backup/Export
- Xuất gói .mochop streaming ZIP với manifest/version/checksum, âm thanh và tài liệu; xác minh trước khi restore.
- DOCX/TXT/Markdown/CSV giữ nội dung và thông tin mốc theo chế độ xuất.
- Không mô tả DOCX thông thường có hành vi bấm chữ phát ngay.

## 4. Các bất biến kỹ thuật

- Mark timeSpan bảo toàn các liên kết còn hợp lệ. **Không** chứa anchorStatus pending/valid/missing vì chúng thay đổi khi Worker flush.
- Audio Manifest là nguồn sự thật về audio đã ghi được; NoteDocument là nguồn sự thật về chữ và liên kết được gõ.
- Vị trí media dựa trên đoạn/số mẫu/metadata đã kiểm tra, không chỉ trên đồng hồ text giao diện.
- Mọi gap/pause được lưu rõ; seek không được tự phát nhầm một nguồn khác.
- “Saved” phải có xác nhận từng kho riêng. Sau crash phải reconcile Mark và manifest.
- Trong lúc ghi, không service worker reload; dữ liệu cập nhật schema phải có migration test.
- Exclusive writer duy trì trong phiên chỉnh sửa/ghi; không deadlock im lặng.
- OPFS chỉ thuộc origin và có thể bị xóa/quota; cần sao lưu file độc lập.

## 5. Thiết kế lưu trữ và khôi phục

Storage không thể có transaction atomic giữa OPFS và IndexedDB. Đề xuất:
1. Mở phiên ghi/journal với mã phiên.
2. Ghi các khối audio có offset/số mẫu xác định; flush/checkpoint.
3. Cập nhật manifest về vùng đã xác nhận lưu.
4. Lưu NoteDocument và journal ở transaction IndexedDB ngắn.
5. Sau crash: scan manifest/file, xác nhận kích thước/checksum/coverage, phục hồi segment chưa đóng nếu có thể, gắn trạng thái derived cho liên kết.
6. Không tự xóa hoặc nối qua gap. Giữ phần text ngay cả khi audio bị lỗi.

## 6. PWA/cache/migration

- Asset JS/CSS có hash: cache theo phiên bản; HTML main: kiểm tra phiên bản có fallback offline.
- Không skipWaiting/reload ép khi đang thu; activation/migration tại trạng thái an toàn.
- GitHub Pages dùng base path đúng và Service Worker scope phù hợp; không giả định origin root.
- Khi schema thay đổi: kiểm tra phiên bản, backup/an toàn hoặc shadow-copy, migrate, validate rồi mới đưa vào sử dụng. Regression với dữ liệu bản cũ.

## 7. Điểm còn mở và điều kiện chốt

1. Quy tắc grouping timeSpan/Unikey: qua PoC Windows thực.
2. AudioWorklet/PCM vs MediaRecorder: benchmark/khôi phục/seek/CPU/RAM/quota trên Chrome/Edge, báo cáo trong [AUDIO_ENGINE_DECISION.md](AUDIO_ENGINE_DECISION.md).
3. Player công nghệ cụ thể: tùy codec và độ mượt qua ranh giới, thiết kế tại [PLAYBACK_DESIGN.md](PLAYBACK_DESIGN.md).
4. Âm thanh online: theo quyền getDisplayMedia, Windows/browser/app, không coi mọi nguồn là thu được.

**Không xây thêm microservices, server, cloud, multiuser hoặc AI ở V1.2.**
