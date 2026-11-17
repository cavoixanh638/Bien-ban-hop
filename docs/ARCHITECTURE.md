# KIẾN TRÚC KỸ THUẬT — BIÊN BẢN HỌP V1.2

**Trạng thái:** kiến trúc mục tiêu; chưa có module được nghiệm thu. Nguồn phạm vi: [PLAN_V1_2.md](PLAN_V1_2.md).
> **Căn cứ nghiên cứu và so sánh công nghệ:** [TECHNICAL_OPTIONS.md](TECHNICAL_OPTIONS.md). Tài liệu nghiên cứu là đề xuất; file này quy định kiến trúc mục tiêu. **Nguồn chính thức về thiết kế module và mô hình dữ liệu.** Tài liệu này hợp nhất `ARCHITECTURE.md` và `DATA_MODEL.md` trước khi tinh gọn. Đây là **kiến trúc mục tiêu**, không phải mô tả một phần mềm đã triển khai. Phạm vi xem [PLAN_V1_2.md](PLAN_V1_2.md), quy tắc mốc xem [TIMELINE_RULES.md](TIMELINE_RULES.md), âm thanh xem [AUDIO_DESIGN.md](AUDIO_DESIGN.md).

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
- **PoC ưu tiên AudioWorklet → Storage Worker:** Main Thread tạo `MessageChannel`, chuyển một port tới WorkletProcessor bằng `AudioWorkletNode.port` và port còn lại tới Dedicated Worker. Cặp `AudioWorkletProcessor.port` / `AudioWorkletNode.port` mặc định không thể “gán lại”; nó chỉ dùng truyền port lúc khởi tạo/điều khiển.
- Worklet gom render quantum (thường 128 frame, không hardcode) thành khối thử 2.048/4.096 frame; chuyển `Transferable ArrayBuffer` có sequence number, firstSample, sampleCount; quản lý buffer pool và giới hạn queue/backpressure. Không xử lý OPFS hay đợi I/O trong luồng xử lý audio.
- SharedArrayBuffer **không phải yêu cầu V1.2**; chỉ đánh giá sau khi có số liệu bottleneck thực và môi trường cross-origin isolated.
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
- **Chưa chốt engine production**: PoC C1 HTMLAudioElement đôi đọc trước (`preservesPitch`) so với C2 Web Audio PCM buffer nhỏ được lập lịch. Đo sai lệch boundary, không mất/lặp lời nói, seek, peak RAM và giọng nghe chậm 0,75×/0,9×. Không crossfade vô điều kiện hoặc trộn hai engine chỉ để che lỗi.
- Đọc manifest qua Timeline; chọn engine phù hợp PCM/WAV/WebM/MP3/M4A.
- Phải prebuffer hoặc schedule qua boundary, không giả định việc đổi src là không gap.
- Trình phát hiển thị một Virtual Timeline cho cả cuộc họp, theo dõi khoảng thiếu audio.

### Meeting/Search
- Tạo/đổi tên/mở/xóa cuộc họp, danh sách, tìm toàn văn trong NoteDocument và điều hướng đến vùng kết quả.
- Tôn trọng exclusive writer lock; tab thứ hai chỉ đọc hoặc thông báo.

### Backup/Export
- Xuất gói .mochop streaming ZIP với manifest/version/checksum, âm thanh và tài liệu; xác minh trước khi restore.
- So sánh `fflate`, `client-zip`, `zip.js` bằng PoC export/import lớn: backpressure và peak RAM có giới hạn, ZIP64, đọc entry theo Central Directory hoặc unzip theo luồng, kiểm checksum. Không chốt thư viện chỉ vì nhãn “streaming”.
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
- **Origin riêng** giúp cô lập IndexedDB/OPFS nhưng không tự cung cấp COOP/COEP. Chia sẻ `SharedArrayBuffer` giữa ngữ cảnh đòi `crossOriginIsolated` và header phù hợp; GitHub Pages chuẩn không cho cấu hình trực tiếp HTTP response header tùy ý. **Ưu tiên MessageChannel + Transferable ArrayBuffer** không cần COOP/COEP; `FileSystemSyncAccessHandle` trong Dedicated Worker cũng không phụ thuộc SAB. Nếu phải dùng SAB thì đánh giá lại hosting có thể thiết lập header, không dùng Service Worker workaround như mặc định.
- Khi schema thay đổi: kiểm tra phiên bản, backup/an toàn hoặc shadow-copy, migrate, validate rồi mới đưa vào sử dụng. Regression với dữ liệu bản cũ.

## 7. Điểm còn mở và điều kiện chốt

1. Quy tắc grouping timeSpan/Unikey: qua PoC Windows thực.
2. AudioWorklet/PCM vs MediaRecorder: benchmark/khôi phục/seek/CPU/RAM/quota trên Chrome/Edge, kiểm tra `MessageChannel + Transferable ArrayBuffer`, buffer pool và backpressure; báo cáo trong [AUDIO_DESIGN.md](AUDIO_DESIGN.md).
3. Player công nghệ cụ thể: đối chứng HTMLAudioElement preservesPitch và Web Audio PCM có lập lịch; chốt dựa chất lượng nghe chậm, sai lệch biên và RAM, thiết kế tại [AUDIO_DESIGN.md](AUDIO_DESIGN.md).
4. Âm thanh online: theo quyền getDisplayMedia, Windows/browser/app, không coi mọi nguồn là thu được.
5. ZIP/khôi phục: đánh giá fflate, client-zip và zip.js bằng gói lớn, checksum, ZIP64, bounded RAM và dữ liệu độc hại; chốt thư viện sau PoC.

**Không xây thêm microservices, server, cloud, multiuser hoặc AI ở V1.2.**

## 8. Mô hình dữ liệu và quy tắc lưu trữ (hợp nhất)

Các đối tượng dưới đây cụ thể hóa hợp đồng của Editor/Audio Manifest/Timeline ở các phần trên. **NoteDocument là nguồn sự thật cho chữ và Mark; Audio Manifest + file là nguồn sự thật cho audio đã lưu được.** Trạng thái link valid/pending/missing/gap/unsupported/unlinked được suy ra; không nằm trong Mark và không gây transaction editor khi Worker flush.

### D1. Hai nguồn sự thật tách biệt

1. **NoteDocument**: nội dung, định dạng và timeSpan Mark của người dùng.
2. **Audio Manifest + file âm thanh**: các nguồn ghi, đoạn phát được, khoảng thiếu và trạng thái lưu.

Không có transaction nguyên tử chung giữa IndexedDB và OPFS. Trạng thái có thể phát phải được **suy ra** khi đọc Manifest, không update hàng loạt Mark vào editor khi Worker flush.

Không tạo bảng from/to độc lập làm nguồn sự thật về vị trí chữ. Chỉ mục search hoặc hiển thị có thể dẫn xuất và rebuild.

### D2. Danh sách đối tượng

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

### D3. Meeting

Trường đề xuất: meetingId, title, createdAt, updatedAt, startedAt?, endedAt?, noteDocumentId, recordingIds[], storageRevision, schemaVersion.

Bản ghi chỉ có ghi chú mà chưa có âm thanh vẫn là cuộc họp hợp lệ. Xóa cuộc họp phải xác nhận và bảo đảm không xóa file được cuộc họp khác tham chiếu.

### D4. NoteDocument và timeSpan

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

**MarkSpec định hướng, phải kiểm chứng qua Gói 1.1:**

```ts
{ inclusive: false, excludes: "timeSpan", spanning: true }
```

- `excludes: "timeSpan"`: khai báo tường minh không có hai Mark timeSpan khác nhau trên một ký tự, vẫn có thể kết hợp bold/italic/strike. ProseMirror mặc định cũng loại trừ Mark cùng loại.
- `spanning: true` (mặc định) điều khiển wrapper DOM/HTML qua node kề nhau, **không phải cơ chế tự gộp các TextNode trong model**.
- `inclusive: false` giúp quản lý biên nhưng chưa thay transaction plugin/IME logic.
- Một cụm coalesced phải dùng chung **toàn bộ attrs** `anchorId/recordingId/audioOffsetMs/typedAt/source/schemaVersion`. `typedAt` là thời điểm bắt đầu cụm; EditJournal mới là nơi lưu thay đổi từng thao tác. Không tạo typedAt riêng cho từng ký tự rồi trông chờ các Mark đó được tự hợp nhất.

**Không đưa anchorStatus vào Mark.** Các trạng thái pending/valid/missing/gap/unsupported lấy từ manifest hiện tại. Khi Mark trỏ vào audio chưa flush có thể tạm là pending; nếu file mất là missing, nhưng Mark không bị sửa theo mỗi flush.

Với chữ chưa liên kết: có thể không có timeSpan (được hiểu là unlinked), hoặc dùng Mark có source=unlinked và audio fields=null nếu cần giữ typedAt/lý do. Chọn cách chuẩn hóa sau PoC; **không được tự tạo audioOffsetMs giả**. Dữ liệu dán từ ngoài có thể lưu provenance là paste mà không bịa mỗi ký tự ứng với thời điểm nói.

Các thông tin nhập/sửa lịch sử có thể nằm trong EditJournal để phục hồi, nhưng timeSpan Mark vẫn là nguồn gốc liên kết hiện tại.

### D5. RecordingSession

Trường đề xuất:

- recordingId, meetingId, kind (micro / online / imported), state (recording / paused / closed / interrupted).
- wallStartedAt, wallEndedAt?, captureClockOrigin?, actualSampleRate?, channels, codec, container, audioDeviceInfo? (không lưu định danh thiết bị nhạy cảm khi không cần).
- sampleCountAccepted, sampleCountCommitted, manifestRevision, storagePathPrefix.
- mappingPoints[] biểu diễn mối quan hệ giữa đồng hồ nhập và sample/media timeline đã kiểm chứng.

RecordingSession của file nhập có duration/media metadata và không cần capture sample count. Không coi đồng hồ trong tab là thời lượng thực phát khi có pause/gap.

### D6. AudioSegment

Trường đề xuất:

- segmentId, recordingId, logicalOrder, filePath trong OPFS.
- mediaStartMs, mediaDurationMs; sampleStart/sampleCount hoặc cơ chế thời gian tương đương.
- codec, container, sampleRate, channels, byteLength.
- completionState (writing / checkpointed / finalized / recovery_needed / corrupt).
- checkpointOffsetBytes, committedSampleCount, checksum? (sau khi hoàn tất), createdAt.
- Nếu file còn dở, ghi đúng trạng thái; không khẳng định có thể tua/phát khi chưa kiểm tra.

Checkpoint **không** là bảo đảm dữ liệu toàn vẹn tuyệt đối; phải đối chiếu kích thước file, header, metadata và nội dung hợp lệ sau lỗi.

### D7. TimelineInterval

Cần lưu khoảng theo thứ tự:

- recorded: có audio thực tế và ánh xạ sang segment.
- paused: người dùng chủ động tạm dừng, không cộng vào thời lượng media thực phát.
- gap: thiếu audio vì micro/worker/browser gặp sự cố; giữ rõ vị trí trên thời gian cuộc họp.
- unavailable: audio đã biết từng tồn tại nhưng không thể tìm/giải mã lúc đọc.

Mỗi interval gồm recordingId, meetingStartMs/meetingEndMs, mediaStartMs?/mediaEndMs?, segmentRefs[], reason?, status. Quy tắc không chồng khoảng và không tạo khoảng âm thanh phát được giả.

### D8. Mô hình thời gian

- Wall Time: ngày giờ thực (có thể thay đổi do chỉnh đồng hồ).
- Input Monotonic Time: đồng hồ đơn điệu khi người dùng gõ; dùng để liên kết trong phiên đang mở.
- Meeting Timeline: vị trí lịch sử cuộc họp có cả pause/gap.
- Media Timeline: vị trí audio thực tế có thể nghe; không cộng thời gian pause chủ động.

Các mốc chỉnh sửa/đồng hồ cần hiệu chỉnh theo điểm mapping trong phiên. Không lưu một offset màn hình làm chứng cứ duy nhất.

Với file nhập, audioOffsetMs lấy từ playback position. Với live, lấy từ ánh xạ giữa input monotonic clock và điểm mẫu/segment thực.

### D9. Trạng thái dẫn xuất, không thuộc Mark

resolveLink(timeSpan, manifest) trả về kết quả kiểu:

- valid: segment/offset phát được.
- pending: chưa xác nhận dữ liệu audio tương ứng đã ghi thành công.
- missing: nguồn hoặc file bị thiếu.
- gap: thời điểm nằm trong khoảng không có audio.
- unsupported: codec/nguồn hiện không đọc được.
- unlinked: không có đường dẫn audio.

Giao diện chỉ vẽ nút phát khi link valid. Lỗi giải thích nguyên nhân, không lấy đoạn gần nhất làm âm thanh thay thế mặc định.

### D10. Tự lưu và khôi phục

- IndexedDB transaction ghi snapshot và/hoặc journal có revision.
- Worker OPFS ghi dữ liệu, xác nhận flush/checkpoint, rồi mới update Manifest “committed coverage”.
- Khi browser crash: kiểm tra trạng thái manifest vs file thực, lấy phần audio còn hợp lệ; văn bản không bị loại bỏ do audio lỗi.
- Hai tab: exclusive writer lock; không có thao tác save đồng thời cho cùng meeting.
- Đo kiểm trạng thái trước khi hiện chữ “Đã lưu”.

### D11. Gói sao lưu .mochop

ZIP theo luồng với manifest chứa:

- formatVersion/schemaVersion, exportedAt, meetingIds, NoteDocument JSON, RecordingSessions, AudioSegments, intervals, file list (path, size, checksum), appVersion.
- Không lưu đường dẫn OPFS tuyệt đối làm đường dẫn dự phòng duy nhất; mapping tương đối.
- Gói nhập kiểm schema, checksum, mapping, các tham chiếu thiếu, restore vào vùng tạm, xác nhận rồi mới áp dụng.
- Dữ liệu nhiều file/phiên được khôi phục cả id và liên kết; collision được xử lý có chủ đích.

### D12. Migration và ràng buộc

- Tài liệu cũ không bị rewrite hoặc xóa trước khi chuyển đổi hoàn tất.
- Không giảm schemaVersion chỉ để đọc file mới.
- Phải có fixture test dữ liệu cũ, Mark bị tách/gộp, audio mất, hai recording cùng cuộc họp, sao lưu file lớn.
- Không commit file chứa dữ liệu cuộc họp thực tế vào repo.

Xem [TIMELINE_RULES.md](TIMELINE_RULES.md) và [AUDIO_DESIGN.md](AUDIO_DESIGN.md) cho quy tắc xử lý.

## 9. Ranh giới cập nhật tài liệu

- Đổi **dữ liệu, schema, module/interface, chính sách lưu/migration**: sửa file này và test có liên quan.
- Đổi **cách nhập, chỉnh Mark, xử lý tiếng Việt, pre-roll**: sửa [TIMELINE_RULES.md](TIMELINE_RULES.md).
- Đổi **engine audio, checkpoint, multi-segment player**: sửa [AUDIO_DESIGN.md](AUDIO_DESIGN.md).
- Chốt/đảo một quyết định hoặc xác minh runtime: cập nhật [STATUS.md](STATUS.md) với bằng chứng và commit.
- Không tự nâng kiến trúc đề xuất thành “đã chạy” nếu chưa có PoC/test.
