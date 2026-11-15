# MÔ HÌNH DỮ LIỆU — MỐC HỌP V1.2

**Trạng thái:** schema đề xuất, cần chốt hợp đồng thực tế sau PoC. Tài liệu tổng thể: [PLAN_V1_2.md](PLAN_V1_2.md).

## 1. Hai nguồn sự thật tách biệt

1. **NoteDocument**: nội dung, định dạng và timeSpan Mark của người dùng.
2. **Audio Manifest + file âm thanh**: các nguồn ghi, đoạn phát được, khoảng thiếu và trạng thái lưu.

Không có transaction nguyên tử chung giữa IndexedDB và OPFS. Trạng thái có thể phát phải được **suy ra** khi đọc Manifest, không update hàng loạt Mark vào editor khi Worker flush.

Không tạo bảng from/to độc lập làm nguồn sự thật về vị trí chữ. Chỉ mục search hoặc hiển thị có thể dẫn xuất và rebuild.

## 2. Danh sách đối tượng

| Đối tượng | Chức năng | Nơi lưu |
|---|---|---|
| Meeting | id, tên, timestamps, trạng thái/phiên bản | IndexedDB |
| NoteDocument | Tiptap/ProseMirror JSON, marks, revision | IndexedDB |
| timeSpan Mark | Liên kết đoạn chữ tới recording/time, thuộc tài liệu | NoteDocument |
| RecordingSession | Một lần thu trực tiếp hoặc một nguồn file nhập | IndexedDB |
| AudioSegment | Đoạn file + vị trí, codec, số mẫu, tính hợp lệ | Manifest/IndexedDB + OPFS |
| TimelineInterval | Khoảng recorded, paused, gap, unavailable | Manifest/IndexedDB |
| EditJournal | Chỉ để khôi phục, trace; không là bảng vị trí chữ song song | IndexedDB |
| BackupManifest | Schema version, danh mục file, checksum, mapping | Gói .mochop |

Các id định danh bất biến (UUID hoặc tương đương), không dựa tên file/tên cuộc họp. Mọi dữ liệu phải có version để migration.

## 3. Meeting

Trường đề xuất: meetingId, title, createdAt, updatedAt, startedAt?, endedAt?, noteDocumentId, recordingIds[], storageRevision, schemaVersion.

Bản ghi chỉ có ghi chú mà chưa có âm thanh vẫn là cuộc họp hợp lệ. Xóa cuộc họp phải xác nhận và bảo đảm không xóa file được cuộc họp khác tham chiếu.

## 4. NoteDocument và timeSpan

Định dạng gốc: JSON của ProseMirror. Trong những text node cần truy audio, thêm Custom Mark **timeSpan**.

Thuộc tính Mark:

| Thuộc tính | Kiểu/ý nghĩa |
|---|---|
| anchorId | string; định danh **mốc**, không mặc định duy nhất cho một vùng chữ |
| recordingId | string hoặc null; nguồn ghi âm |
| audioOffsetMs | số nguyên ≥0 hoặc null; vị trí media **gốc** |
| typedAt | timestamp UTC của thao tác nhập thực |
| source | live_recording / imported_playback / playback_paused / historical_edit / paste / unlinked |
| schemaVersion | số phiên bản của Mark |

Một đoạn bị tách làm hai có thể cùng tham chiếu anchorId. Mark của hai vùng liền kề chỉ được gộp khi thuộc tính và quy tắc thời gian thực sự tương thích; **không** gộp chỉ vì vị trí kề nhau.

**Không đưa anchorStatus vào Mark.** Các trạng thái pending/valid/missing/gap/unsupported lấy từ manifest hiện tại. Khi Mark trỏ vào audio chưa flush có thể tạm là pending; nếu file mất là missing, nhưng Mark không bị sửa theo mỗi flush.

Với chữ chưa liên kết: có thể không có timeSpan (được hiểu là unlinked), hoặc dùng Mark có source=unlinked và audio fields=null nếu cần giữ typedAt/lý do. Chọn cách chuẩn hóa sau PoC; **không được tự tạo audioOffsetMs giả**. Dữ liệu dán từ ngoài có thể lưu provenance là paste mà không bịa mỗi ký tự ứng với thời điểm nói.

Các thông tin nhập/sửa lịch sử có thể nằm trong EditJournal để phục hồi, nhưng timeSpan Mark vẫn là nguồn gốc liên kết hiện tại.

## 5. RecordingSession

Trường đề xuất:

- recordingId, meetingId, kind (micro / online / imported), state (recording / paused / closed / interrupted).
- wallStartedAt, wallEndedAt?, captureClockOrigin?, actualSampleRate?, channels, codec, container, audioDeviceInfo? (không lưu định danh thiết bị nhạy cảm khi không cần).
- sampleCountAccepted, sampleCountCommitted, manifestRevision, storagePathPrefix.
- mappingPoints[] biểu diễn mối quan hệ giữa đồng hồ nhập và sample/media timeline đã kiểm chứng.

RecordingSession của file nhập có duration/media metadata và không cần capture sample count. Không coi đồng hồ trong tab là thời lượng thực phát khi có pause/gap.

## 6. AudioSegment

Trường đề xuất:

- segmentId, recordingId, logicalOrder, filePath trong OPFS.
- mediaStartMs, mediaDurationMs; sampleStart/sampleCount hoặc cơ chế thời gian tương đương.
- codec, container, sampleRate, channels, byteLength.
- completionState (writing / checkpointed / finalized / recovery_needed / corrupt).
- checkpointOffsetBytes, committedSampleCount, checksum? (sau khi hoàn tất), createdAt.
- Nếu file còn dở, ghi đúng trạng thái; không khẳng định có thể tua/phát khi chưa kiểm tra.

Checkpoint **không** là bảo đảm dữ liệu toàn vẹn tuyệt đối; phải đối chiếu kích thước file, header, metadata và nội dung hợp lệ sau lỗi.

## 7. TimelineInterval

Cần lưu khoảng theo thứ tự:

- recorded: có audio thực tế và ánh xạ sang segment.
- paused: người dùng chủ động tạm dừng, không cộng vào thời lượng media thực phát.
- gap: thiếu audio vì micro/worker/browser gặp sự cố; giữ rõ vị trí trên thời gian cuộc họp.
- unavailable: audio đã biết từng tồn tại nhưng không thể tìm/giải mã lúc đọc.

Mỗi interval gồm recordingId, meetingStartMs/meetingEndMs, mediaStartMs?/mediaEndMs?, segmentRefs[], reason?, status. Quy tắc không chồng khoảng và không tạo khoảng âm thanh phát được giả.

## 8. Mô hình thời gian

- Wall Time: ngày giờ thực (có thể thay đổi do chỉnh đồng hồ).
- Input Monotonic Time: đồng hồ đơn điệu khi người dùng gõ; dùng để liên kết trong phiên đang mở.
- Meeting Timeline: vị trí lịch sử cuộc họp có cả pause/gap.
- Media Timeline: vị trí audio thực tế có thể nghe; không cộng thời gian pause chủ động.

Các mốc chỉnh sửa/đồng hồ cần hiệu chỉnh theo điểm mapping trong phiên. Không lưu một offset màn hình làm chứng cứ duy nhất.

Với file nhập, audioOffsetMs lấy từ playback position. Với live, lấy từ ánh xạ giữa input monotonic clock và điểm mẫu/segment thực.

## 9. Trạng thái dẫn xuất, không thuộc Mark

resolveLink(timeSpan, manifest) trả về kết quả kiểu:

- valid: segment/offset phát được.
- pending: chưa xác nhận dữ liệu audio tương ứng đã ghi thành công.
- missing: nguồn hoặc file bị thiếu.
- gap: thời điểm nằm trong khoảng không có audio.
- unsupported: codec/nguồn hiện không đọc được.
- unlinked: không có đường dẫn audio.

Giao diện chỉ vẽ nút phát khi link valid. Lỗi giải thích nguyên nhân, không lấy đoạn gần nhất làm âm thanh thay thế mặc định.

## 10. Tự lưu và khôi phục

- IndexedDB transaction ghi snapshot và/hoặc journal có revision.
- Worker OPFS ghi dữ liệu, xác nhận flush/checkpoint, rồi mới update Manifest “committed coverage”.
- Khi browser crash: kiểm tra trạng thái manifest vs file thực, lấy phần audio còn hợp lệ; văn bản không bị loại bỏ do audio lỗi.
- Hai tab: exclusive writer lock; không có thao tác save đồng thời cho cùng meeting.
- Đo kiểm trạng thái trước khi hiện chữ “Đã lưu”.

## 11. Gói sao lưu .mochop

ZIP theo luồng với manifest chứa:

- formatVersion/schemaVersion, exportedAt, meetingIds, NoteDocument JSON, RecordingSessions, AudioSegments, intervals, file list (path, size, checksum), appVersion.
- Không lưu đường dẫn OPFS tuyệt đối làm đường dẫn dự phòng duy nhất; mapping tương đối.
- Gói nhập kiểm schema, checksum, mapping, các tham chiếu thiếu, restore vào vùng tạm, xác nhận rồi mới áp dụng.
- Dữ liệu nhiều file/phiên được khôi phục cả id và liên kết; collision được xử lý có chủ đích.

## 12. Migration và ràng buộc

- Tài liệu cũ không bị rewrite hoặc xóa trước khi chuyển đổi hoàn tất.
- Không giảm schemaVersion chỉ để đọc file mới.
- Phải có fixture test dữ liệu cũ, Mark bị tách/gộp, audio mất, hai recording cùng cuộc họp, sao lưu file lớn.
- Không commit file chứa dữ liệu cuộc họp thực tế vào repo.

Xem [TIMELINE_RULES.md](TIMELINE_RULES.md) và [PLAYBACK_DESIGN.md](PLAYBACK_DESIGN.md) cho quy tắc xử lý.
