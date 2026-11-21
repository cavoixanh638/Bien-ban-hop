# BỘ NGHIỆM THU V1.2 — TC01–TC38

**Trạng thái:** Bộ tiêu chí dự kiến, **chưa chạy test**, không có kết quả PASS được kế thừa. Nguồn phạm vi: [PLAN_V1_2.md](PLAN_V1_2.md); **trạng thái thực tế và dẫn chứng chỉ ghi tại [STATUS.md](STATUS.md)**. Tài liệu kiểm thử này không tự thể hiện một ca đã PASS chỉ vì tiêu chí đã được viết.

## G00 — Nghiệm thu bổ sung cho xử lý liên tục theo luồng (22/11/2026)

Bản sau 22/11 **không còn giới hạn giữ cao độ và RMS skip ở 15/30/60 giây** như checkpoint cũ bên dưới. Kiểm tra riêng theo các mức bằng chứng:

| Subcase | Cổng | Điều kiện và bằng chứng cần có |
|---|---|---|
| Liên tục nhiều giờ/giới hạn bộ nhớ | TC16/TC23/TC24 | Bật skip + pitch ở 1,5–2× khi `focus-duration=0`; chỉ đọc cửa sổ PCM 8s và WAV media ≤6s/≤8 MiB, không phân tích toàn 3h trước khi bắt đầu. Unit kiểm nguồn giả 3h; browser phải phát qua ≥2 chunk, theo dõi RSS/CPU máy thật **NOT_RUN** |
| Ba bộ lọc đồng thời | TC22/TC23/TC25 | RNNoise + giữ cao độ + bỏ qua im lặng cùng bật trong Liên tục, phát chính xác file có tiếng/silence, không thay `timeSpan` hoặc mẫu WAV; test browser dev/prod; cảm nhận giọng nói và thông số latencies Windows **NOT_RUN** |
| Thay tùy chọn khi đang nghe | TC22/TC23 | Đổi liên tiếp tốc độ, pitch, skip, RNNoise; lệnh cuối cùng phải thắng, start lại đúng source offset (không quay về 0/đoạn đã bỏ). Dừng khi đang prefetch không tự phát lại; kiểm Chromium và test thật |
| Session-to-session | TC16/TC24/TC25 | Khi Liên tục, hết một session đúng mẫu cuối và session kế bắt đầu từ sample 0 thì được sang; nếu trailing/leading gap, source khác, hay loop A–B thì không tự nhảy. Unit và E2E hai phiên với micro giả, phải giữ note nguyên bản |
| Giao diện/cập nhật offline | TC32/TC34 | Checkbox giữ pitch bật mặc định; chọn Liên tục không tắt skip, các lựa chọn độc lập; UI hiển thị trạng thái; PWA cache version mới và dữ liệu OPFS/IDB cũ giữ nguyên khi cập nhật an toàn |
| Độ liên tục âm thanh thực | TC23/TC25/TC35 | Nghe file dài, giọng thật ở tốc độ 0,5/1,5/2× và RNNoise trên loa/micro Windows, phát hiện seam/drop/click ở mỗi chunk, đo jitter, CPU/RAM, mẫu/gap và nguồn thời gian. **NOT_RUN**, không được tuyên bố gapless/perceptual PASS chỉ từ giả lập |

Chỉ đánh dấu **CI PASS** khi Windows/Linux Node, Chromium dev + production/PWA đều SUCCESS ở **đúng Code SHA**. Bài giả 3 giờ không phải chạy thật 3 giờ; test micro giả không thay bằng chứng UniKey/EVKey, hiệu quả lọc nhiễu, nghe giọng thật hoặc độ bền trên thiết bị thật. Giữ RELEASE HOLD.

## G00 — Subcase hồi quy phát lại khi bật nhiều lựa chọn (21/11/2026)

**Tái hiện lỗi thực tế đã sửa:** chế độ `Nghe tập trung = Liên tục` (`focus-duration = 0`), bật `Giữ cao độ` ở tốc độ 1× và `Bỏ qua im lặng` rồi bấm vào phiên/đoạn chữ. Trước sửa, bộ phân tích RMS ném lỗi phải chọn 15/30/60 giây. Sau sửa, dropdown phải **hiện 30 giây** ngay lúc bật skip, status văn bản giải thích, có thể nghe PCM; không được sửa source/notes, không được xuất hiện toast lỗi. Chuyển ngược về Liên tục phải bỏ chọn skip; ở tốc độ 0,75×, bật pitch rồi skip (hoặc thứ tự ngược) phải giữ lựa chọn mới nhất và thông báo rõ.

**Các ca thêm:** A–B 0,4 giây (không bỏ nhầm im lặng ngắn hơn ngưỡng 750ms), A–B 90 giây chia cửa sổ quét ≤60 giây, sai PCM/gap/cancel phải từ chối; PCM vẫn đọc từ đúng `recordingId`. Chromium E2E kiểm đường nghe pitch + RNNoise, skip + RNNoise, màu nút thu theo state và waveform tách lớp. CI [#44908183703](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44908183703) đúng SHA `d730b40d763acc0453056d5f27d711a0c35c41a5` **PASS** (Node 100/100 mỗi OS, Chromium dev 38 PASS + 1 SKIP, production/PWA 39/39 PASS). **Không** tuyên bố tính năng bỏ qua im lặng Liên tục hàng giờ: chỉ hỗ trợ focus 15/30/60 hoặc A–B tường minh 0,4–120 giây. Windows micro thật/IME/Word/3h/backup lớn vẫn **NOT_RUN**.

Đã rà soát tình trạng kiểm thử của 18 nhóm tính năng trong `STATUS.md`; một số nhóm chỉ có bằng chứng E2E/Unit đường cơ bản, các tiêu chí nghiệm thu đầy đủ TC01–TC38 chưa được thực thi trên thiết bị thật. Giữ **INTEGRATION_ALPHA / RELEASE HOLD**.

## G00 — Subcase kiểm thử 18 tính năng bổ sung (18/11/2026)

**Giữ nguyên mã TC01–TC38.** Các subcase sau gắn với mã TC gốc, không tự tạo trạng thái PASS. Các bài unit/e2e chỉ có chứng cứ khi GitHub Actions kết thúc SUCCESS tại đúng Code SHA. Mọi trường hợp cần thiết bị thật vẫn `NOT_RUN` cho tới khi có số liệu và log.

| Subcase | TC hiện hành | Phương pháp và điều kiện đạt |
|---|---|---|
| A–B liên tục / gap / phiên | TC23/TC25 | Cặp A,B cùng vùng sample durable được phép; A/B băng qua gap, khác phiên, quá 120s bị chặn. Phải thử loop nhiều vòng, Stop/Seek/switch không tự resume từ task cũ; đo gap/drop/duplicate khi qua segment. |
| Tua ±10s/tốc độ | TC22–TC26 | Tua tuyệt đối trên timeline, từ chối vùng missing; thử 0,5–2×. C2 mặc định `playbackRate` còn đổi pitch; opt-in giữ cao độ đoạn ngắn đã PASS CI, nhưng cảm nhận giọng thật vẫn NOT_RUN. |
| Thụt đầu dòng/nested list | TC01/TC09/TC36 | `firstLineIndentPt` 0–72, lưu/reopen, export DOCX twip đúng; sink/lift nested list; không làm thay `timeSpan`. |
| Nhập WAV/MP3 | TC27/TC28/TC30 | WAV PCM mono/stereo 8–192k, chunk ≤32k frames, rollback OPFS nếu lỗi trước IDB ref; MP3/M4A/WebM/OGG chỉ nếu decode thành công và nằm trong giới hạn; nhập file lớn phải chặn rõ, không crash. |
| Gõ khi phát file nhập | TC02/TC22/TC27/TC28 | `imported_playback` chỉ khi player đang phát, sampleRange xác minh, đúng meeting; pause/seek/gap hoặc đổi meeting không gán audioOffsetMs giả. |
| Bookmark trong ghi chú | TC02/TC09/TC26 | Chỉ bôi đen chữ có một mốc hợp lệ mới đánh dấu; lưu `important` trong ProseMirror, tập hợp theo recordingId/anchorId, click nghe; không phá Undo, paste, nguồn gốc. |
| Quota cảnh báo | TC19/TC29 | `navigator.storage.estimate()` chỉ hiển thị ước tính, báo WARNING ở ngưỡng; thiếu API báo UNKNOWN, không báo lưu giả. |
| Verify ZIP toàn bộ | TC30/TC31/TC38 | Chọn tệp sao lưu v2, đọc stream SHA256/CRC từng entry; thiếu/hỏng entry trả FAIL, không thay đổi bản gốc, không giả kết quả v1. |
| Xuất riêng WAV A–B | TC23/TC25/TC30 | Chỉ cho phép vùng contiguous đã commit; header WAV PCM f32 chuẩn, dung lượng chính xác, không vượt gap/phiên, không sửa OPFS. |
| DOCX ảnh/link/ngắt trang | TC09/TC36 | PNG/JPEG ≤300KB, link allowlist http(s)/mailto, pageBreak; mở file DOCX trong Word/LibreOffice có ảnh/quan hệ link/pagebreak hợp lệ. Bài Microsoft Word Windows thật `NOT_RUN`. |
| Table colspan/rowspan | TC09/TC36 | Tiptap gộp/tách ô, XML DOCX có gridSpan/vMerge đúng; bảng dài và Word Windows thật `NOT_RUN`. |
| G00 waveform quan sát được | TC16/TC24 | Sau khi mẫu PCM được đọc, cột sóng **xanh lam** hiện ở làn **trên** dải recorded/gap, tách màu và có độ cao ≥4px; khung tua ≥48px. Không vẽ cột giả ở gap; RMS=0 chỉ hiển thị baseline thấp, cực nhỏ không được thổi thành sóng to. Kiểm DOM geometry, CSS màu, đủ 128 vị trí lấy mẫu và giữ mốc chữ; test Chromium dev/prod đúng SHA. |
| G00 màu và trạng thái nút thu | TC01/TC12/TC13 | Chưa thu: Pause/Stop disabled; đang thu: Start disabled, Pause **vàng cam**, Stop **đỏ**, cỡ nút ≥44px, chữ rõ; tạm dừng: Resume **xanh lá**, Stop vẫn đỏ; sau Kết thúc cả hai disabled, bản ghi vẫn lưu. Thử keyboard/focus/giả lập và Windows micro thật; không coi CSS có nút là nghiệm thu cơ chế thu dài. |
| Waveform lấy mẫu PCM (G00) | TC16/TC23/TC24 | Sau Stop, người dùng tự bấm Hiện dạng sóng; tối đa 128 bins × 1024 samples, chỉ đọc sampleRanges đã commit, vẽ RMS; vùng gap không được tô biên độ. Kiểm đóng reader trước khi đổi cuộc họp/phát hoặc thu; đọc lỗi phải bỏ waveform, tuyệt đối không sửa WAV/manifest/timeSpan/note. Test đúng SHA trên Chromium dev và production; Windows 3h thật NOT_RUN. |\n| Giữ cao độ opt-in | TC22/TC23/TC25 | Cửa sổ nghe 15/30/60s, ≤32 MiB, tốc độ 0,5–2×: `preservesPitch` thật trên WAV xác minh; trình duyệt không hỗ trợ hoặc chế độ Liên tục phải báo lỗi, không ngầm đổi pitch. Chromium dev/production PASS ở SHA `8cf0964`; chất lượng giọng thật/CPU-RAM Windows **NOT_RUN**. |
| Lọc nhiễu RNNoise WASM | TC16/TC22/TC23 | Mô hình local WASM `@sapphi-red/web-noise-suppressor@0.4.1`, AudioWorklet 48kHz, chỉ xử lý luồng phát; tắt mặc định; không sửa bản ghi/mốc. Unit/build + Chromium dev/production PASS ở SHA `8cf0964`. Benchmark CPU/RAM/âm người nói chồng, browser thiếu AudioWorklet **NOT_RUN**. |
| Bỏ qua im lặng RMS | TC16/TC23/TC25/TC27 | PCM durable ≤60s, phát bỏ đoạn yên tĩnh có xác minh theo ngưỡng RMS, giữ mép; tuyệt đối không đổi recordingId/audioOffsetMs, không xuyên gap, không giả speech-VAD. Chromium dev/production PASS SHA `8cf0964`; nghe với nhiễu nền/giọng thật NOT_RUN. |
| A–B / clip WAV qua segment liền mẫu | TC16/TC23/TC25/TC30 | Có thể phát/lặp/xuất clip xuyên segment khác file nhưng **cùng recordingId, các sampleRanges kề nhau**, chính xác số mẫu; âm thanh gap/phiên khác hoặc file hỏng bị chặn. Unit PASS; chưa đo drop/duplicate sample trên máy thật, NOT_RUN. |
| Legacy restore sau tích hợp | TC30/TC35/TC38 | Sau mọi thay đổi player/editor kiểm restore v1/v2 và chuyển vào meeting mới (internal transition cho phép dù đang transfer), không overwrite meeting hiện có. |

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
| TC11 | Tài liệu dài | Đo P95 nhập, độ phân mảnh Mark/TextNode/DOM, JSON và coalescing thuộc tính đồng nhất |
| TC12 | Ghi 3 giờ | Phát/tua toàn bộ phần hợp lệ; đo worklet chunk/queue/backpressure, sample drop |
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
| TC23 | Phát xuyên boundary | So sánh C1/C2; không mất/lặp lời nói; không dùng crossfade để che lỗi đo |
| TC24 | Seek đầu/giữa/cuối | Virtual Timeline tìm đúng đoạn |
| TC25 | A-B xuyên file | Phát lặp đúng khoảng |
| TC26 | Vừa sửa vừa nghe | Không cần đổi chế độ |
| TC27 | Nhập file có sẵn | Mốc theo vị trí phát |
| TC28 | Pause file rồi ghi | Giữ mốc tại Pause, pre-roll mặc định thử 5 giây, chỉnh 0/3/5/10 mà không đổi mốc |
| TC29 | Auto-save | Không đòi Save; xác nhận lưu thực |
| TC30 | Backup/restore | Giữ chữ, marks, audio, checksum |
| TC31 | Backup file lớn | So sánh fflate/client-zip/zip.js, backpressure, ZIP64, restore, RAM có giới hạn |
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


## Bộ kiểm thử chuyên sâu sau phản biện kỹ thuật 15/11/2026

**Giữ nguyên mã TC01–TC38** để không phá bảng quản lý hiện có. Các tình huống bên dưới là subcase bắt buộc của TC tương ứng, **không phải PASS**. Ghi môi trường Windows/Chrome/Edge, commit SHA, log, fixture và cách đo.

| TC liên quan | Subcase bổ sung | Điều kiện đạt / dữ liệu cần lưu |
|---|---|---|
| **TC03, TC04, TC06, TC08, TC11** | MarkSpec `inclusive:false`, `excludes:"timeSpan"`, `spanning:true` và Mark coalescing | Một ký tự không mang hai timeSpan, vẫn có bold/italic; cụm gộp phải có **tất cả attrs giống nhau**, `typedAt` là lúc đầu cụm. Kiểm số TextNode/Mark/DOM span/JSON/P95 trên đoạn dài và sau Undo/Redo. Không nhầm spanning DOM với gộp model |
| **TC12, TC14, TC15, TC17, TC19** | AudioWorklet quantum/batching/port riêng | Đo số render quantum thực (không hardcode 128), thử batch 2.048/4.096 frame, buffer pool `Transferable ArrayBuffer`, message/s, sequenceNo/firstSample/sampleCount, Worker chậm, queue đầy và phần committed sau crash; missing/gap được báo, không báo saved giả |
| **TC16, TC22–TC26** | PoC C1 HTMLAudioElement đọc trước, `preservesPitch` so với C2 Web Audio buffer nhỏ | Phát 04:58→05:02, seek phút 90/170, A–B qua biên, đo gap/drop/duplicate, độ rõ cao độ ở 0,75× và 0,9×, peak RAM. Không khẳng định hai thẻ audio gapless hoặc crossfade vô hại |
| **TC27, TC28** | Playback đang Pause rồi gõ và đổi độ lùi | Mốc chữ giữ chính xác tại playback head khi Pause; thử pre-roll 0/3/5/10 giây (giá trị đề xuất ban đầu **5 giây**); thay pre-roll không sửa Mark gốc |
| **TC30, TC31, TC38** | .mochop export/import 0,5 GB và 2 GB; 3 ứng viên ZIP | So sánh fflate/client-zip/zip.js; bounded RAM/backpressure, ZIP64, Central Directory/random-access hoặc streaming unzip, checksum; kiểm path traversal, ZIP bomb, file thiếu và rollback vùng tạm; không đặt ngưỡng RAM <10 MB hay tốc độ cố định khi chưa đo |
| **TC32–TC35** | PWA trên origin GitHub Pages không có COOP/COEP; cập nhật/khôi phục | Thu bằng MessageChannel + Transferable **không cần SharedArrayBuffer**; đo hoạt động khi `crossOriginIsolated === false`. Không ép reload đang thu; kiểm Web Locks, scope, origin riêng và migration |

**Biểu mẫu bằng chứng cho subcase:** `TC/subcase | commit | Chrome/Edge version | Windows/device | fixture | expected | actual | measured latency/CPU/RAM/drop count | log link | PASS/FAIL/NOT_RUN`.

Không dùng `AudioBufferSourceNode.playbackRate` làm bằng chứng nghe chậm giữ cao độ khi chưa có xử lý pitch. Không khẳng định `fflate.Unzip` tự nạp cả gói vào RAM, nhưng phải đo queue/backpressure ở pipeline thực.

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

> Khi bắt đầu triển khai, giữ mã TC01–TC38 ổn định. Mỗi kết quả kiểm thử dẫn commit SHA, môi trường, fixture và báo cáo bằng chứng ở STATUS.md hoặc đường dẫn tới CI/PR. Không tạo bản sao khác của bảng TC.
