# G00 — Bảng theo dõi 18 tính năng bổ sung (18/11/2026)

**Quản lý:** G00 · **Nhánh:** `integration/20261115-g10-v1.2` · **PR:** [Draft #1](https://github.com/cavoixanh638/Bien-ban-hop/pull/1) · **Mức nghiệm thu:** INTEGRATION_ALPHA / RELEASE HOLD.

Đây là trạng thái **tích hợp sản phẩm**, không phải trạng thái riêng của các PoC. “Có mã” không đồng nghĩa “PASS nghiệm thu”; đối chiếu kết quả CI bằng đúng Code SHA/Tested SHA tại [STATUS.md](STATUS.md). Các chức năng liên quan dữ liệu ghi âm không được tự suy đoán thời gian: `timeSpan` là mốc lúc gõ, không phải timestamp lời nói.

| # | Hạng mục | Trạng thái tích hợp tại G00 | Phạm vi đã có / phần còn thiếu |
|---|---|---|---|
| 01 | Word cơ bản | **Có chức năng cơ bản** | Font pt, đậm/nghiêng/gạch, màu chữ; lưu và xuất DOCX |
| 02 | Căn lề, giãn dòng, thụt dòng, nhiều cấp, Heading | **Một phần** | Đã thêm thụt dòng đầu (0–72pt), sink/lift danh sách, Heading; DOCX xuất numbering gốc Word cho danh sách số/chấm và nhánh lồng nhau; vẫn cần kiểm tra danh sách dài/đa cấp trên Word desktop |
| 03 | Tìm/thay | **Có chức năng cơ bản** | Ctrl+F/H, chặn thay tự động văn bản gắn `timeSpan` hợp lệ |
| 04 | Bảng/ô gộp | **Một phần** | Thao tác TableKit, DOCX `colspan`/`rowspan`; ô hợp nhất và bảng dài qua trang chưa nghiệm thu Word desktop |
| 05 | DOCX định dạng/A4/lề | **Một phần** | DOCX A4, font/cỡ/giãn dòng, ảnh/link/ngắt trang; có 3 mức lề Word/PDF, chưa đủ pagination Word desktop |
| 06 | Nghe tập trung/phím tắt | **Có chế độ Liên tục xử lý theo luồng; đang kiểm CI mới** | Nghe 15/30/60s hoặc Liên tục; Alt+Enter tại mốc; bộ lọc không quyết định thời lượng. Khi Liên tục, tự chuyển phiên kế tiếp chỉ nếu không có gap; máy thật NOT_RUN |
| 07 | Lặp A–B, tua, tốc độ | **Có mã, kiểm thử mới đang chạy** | A–B có thể qua WAV liền mẫu trong một recordingId, từ chối gap/phiên khác; tua ±10s, tốc độ 0,5–2×; đổi tốc độ trong lúc phát giữ mốc nguồn. Giật khi nối clip trên Windows thật NOT_RUN |
| 08 | Nhập âm thanh sẵn | **Một phần** | WAV PCM/float mono, stereo → mono theo chunk ≤2GB/3h; MP3/M4A/WebM/OGG nếu `decodeAudioData` hỗ trợ ≤32MB/30 phút. Lưu OPFS commit, liên kết khi đang phát; chưa streaming giải mã file nén dài, pause-to-type chưa nghiệm thu |
| 09 | Giữ cao độ giọng khi nghe chậm | **Mặc định bật, có Liên tục; chờ CI cuối/máy thật** | HTMLMediaElement `preservesPitch` đọc PCM OPFS theo WAV đã xác minh **≤6s/≤8 MiB/đoạn**, tối đa hai đoạn đang phát + chuẩn bị, không nạp cả cuộc họp; hoạt động với 0,5–2× kể cả Liên tục và kết hợp RNNoise/skip; chưa benchmark nối clip và giọng thật |
| 10 | EQ làm rõ giọng | **Có chức năng cơ bản** | Gốc/Nhẹ/Rõ hơn chỉ trên luồng nghe, không sửa WAV; không phải AI denoise |
| 11 | Ảnh/link/ngắt trang/PDF | **Một phần** | Ảnh PNG/JPEG ≤300KB/ảnh, link http(s)/mailto, ngắt trang, native Print PDF A4; ảnh lớn/cắt trang/định dạng Word nâng cao chưa nghiệm thu |
| 12 | Tìm toàn cuộc họp | **Có chức năng cơ bản, đang bổ sung điều hướng** | MiniSearch offline, có dấu/không dấu; nhấp cuộc họp phù hợp chuyển đến từ khóa đầu tiên trong nội dung bằng selection (không sửa `timeSpan`); giới hạn tìm kiếm tại đoạn tối đa 160k ký tự của bộ index, chưa liệt kê toàn bộ kết quả |
| 13 | Đánh dấu đoạn quan trọng | **Một phần** | Mark `important` lưu trong note JSON, danh sách lọc `timeSpan` hợp lệ, bấm nghe; cần thử tương tác dài với IME |
| 14 | Cảnh báo quota/kiểm chứng sao lưu | **Một phần** | `navigator.storage.estimate()` chỉ ước tính + tự cảnh báo, chọn file v2 để verify SHA256/CRC từng entry; đã có chế độ tự kiểm chứng SHA256/CRC ngay sau SaveFilePicker (mặc định bật) hoặc kiểm thủ công; chưa xác minh v1 và trường hợp file đa GB trên Windows thật |
| 15 | Xuất clip WAV A–B | **Đã có clip qua ranh giới WAV liền mẫu, CI PASS; Windows thật NOT_RUN** | Xuất Float32 WAV từ PCM đúng sample qua các đoạn adjacent đã xác minh; không qua gap/khác phiên, giới hạn 0,4–120s; chưa kiểm file dài/thiết bị thực |
| 16 | Waveform | **Có mã, Chromium CI PASS; máy thật NOT_RUN** | 128×1024 mẫu PCM xấp xỉ, vùng sóng lam ở trên dải coverage xanh/xám, cột ≥4px, chuẩn hóa RMS trung thực; test unit+Chromium dev/prod tại SHA d730b40 PASS; **chưa phải full-resolution waveform** |
| 17 | RNNoise WASM | **Đã kết hợp trong luồng nghe; chờ CI cuối/máy thật** | `@sapphi-red/web-noise-suppressor@0.4.1`, AudioWorklet 48k cục bộ, OFF mặc định; có thể bật chung giữ cao độ và bỏ qua im lặng, áp dụng đổi khi đang phát; không sửa WAV/OPFS/mốc; CPU/RAM/giọng thật NOT_RUN |
| 18 | Bỏ qua im lặng | **Quét tiến dần cả Liên tục; chờ CI cuối/máy thật** | ProgressiveSilenceIndex đọc trước **8s PCM durable**, bỏ qua im lặng dài theo RMS, giải phóng index đã qua, hỗ trợ focus và Liên tục nhiều giờ, kết hợp pitch/RNNoise; không vượt gap và không sửa `timeSpan`. Đây là RMS, **không phải speech VAD ML** |

## Checkpoint G00 — Đọc âm thanh theo luồng trong chế độ Liên tục (22/11/2026)

- **Kiến trúc mới thay giới hạn cũ #09/#18:** giữ cao độ mặc định khi tốc độ ≠1 bằng trình duyệt, đọc WAV theo từng chunk ≤6s/≤8 MiB thay vì dựng 60s một lần. Skip silence đọc PCM bền vững theo cửa sổ nhìn trước 8s, không quét cả file nhiều giờ trước khi phát. Cả RNNoise, giữ cao độ, skip có thể cùng bật; đổi tùy chọn khi đang nghe vẫn lấy mốc nguồn.
- **Phiên ghép:** nghe Liên tục được phép sang phiên sau khi đầu/cuối đều là sample đã xác minh, không có gap/trailing unavailable; helper `nextContiguousSession()` từ chối mọi khoảng thiếu và không dựng thời gian nghỉ tường. A–B vẫn không vượt phiên.
- **Mã mới:** `streaming-playback.mjs`, `audio.mjs`, `meeting-timeline.mjs`, `timeline-ui.mjs`, `main.mjs`, `playback-options.mjs`, unit/E2E đọc WAV 16s, các chunk nối, phiên liên tục, hủy/Stop, kết hợp RNNoise và đổi cài đặt đang phát.
- **Chưa nghiệm thu máy thật:** ghép bằng MediaElement từng WAV nhỏ chưa bảo đảm *gapless* tuyệt đối/chất lượng giọng khi nối, cần benchmark CPU/RAM và Windows 3h. Không thay PCM/OPFS, archive, ID nguồn, `timeSpan`. **Tested SHA:** đối chiếu CI mới nhất trong `STATUS.md`; **thiết bị Windows, micro/UniKey/EVKey, Word desktop vẫn NOT_RUN**. PR Draft, không merge/deploy.
- Các checkpoint trước ngày 22/11 là lịch sử của bản cũ, không còn phản ánh giới hạn hiện hành.

## Checkpoint G00 — Khắc phục lỗi Bỏ qua im lặng và rà toàn bộ tính năng (21/11/2026)

- Lỗi ảnh người dùng: checkbox skip-silence + focus `Liên tục` gây lỗi runtime; UI đã tự đổi focus sang 30 giây khi bật skip, khi chọn lại Liên tục sẽ tắt skip rõ ràng. Đồng bộ giữ cao độ/rate/skip, tránh chọn xung đột; chuyển `Nghe tập trung` lên cạnh tốc độ. Không giả vờ hỗ trợ xử lý im lặng cho toàn bản thu nhiều giờ.
- Sửa giới hạn lặp A–B khi skip: clip 0,4–120s, phân tích PCM tách cửa sổ ≤60s, giữ nguyên recordingId/timeSpan. Bổ sung unit cho 0,4s, 90s, cancellation/gap, UI options, và Chromium E2E tái hiện nguyên lỗi, RNNoise kết hợp, kiểm màu nút, waveform.
- **Code SHA = Tested SHA `d730b40d763acc0453056d5f27d711a0c35c41a5`**; [Actions #44908183703](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44908183703) **SUCCESS**: Node 100/100 mỗi hệ Linux/Windows, Chromium dev 38 PASS + 1 PWA-only SKIP, production 39/39 PASS, 0 FAIL. Cache PWA và tài liệu sau SHA này là các commit hậu kiểm, xem PR #1 để kiểm tra HEAD.
- **Đã đối chiếu đủ 18 nhóm** (bảng bằng chứng/mức chưa nghiệm thu trong `docs/STATUS.md`). Phần đầy đủ trên Windows thật, micro/UniKey/EVKey, 3h, Word desktop, gói nhiều GB, CPU/RAM và chất lượng khử nhiễu vẫn NOT_RUN. Giữ **RELEASE HOLD**, PR Draft, không merge/deploy.

## Checkpoint G00 — Waveform và nút ghi âm dễ nhìn (21/11/2026)

- Phát hiện từ ảnh giao diện thật: nút Hiện dạng sóng báo đọc 128/128 vị trí nhưng cột nằm trong nền xanh chỉ cao 18px nên hầu như không quan sát được; hai nút Tạm dừng / Kết thúc trắng giống nhau.
- Mã sửa: `waveformDisplayHeights` scale RMS trung thực, làn sóng xanh lam ở **trên**, coverage xanh/xám ở **dưới** và vẫn là nguồn sự thật; màu trạng thái ghi **vàng cam/tạm dừng**, **đỏ/kết thúc**, **xanh lá/tiếp tục**, không sửa capture state/mốc nguồn.
- Bài unit + E2E kiểm màu/chiều cao/vị trí; **Code SHA `88be7d4531cb22d7918c771e8d5c815c8e5fa913`; Tested SHA NOT_RUN** đến khi CI SUCCESS. Windows micro/Chrome/Edge thật NOT_RUN; PR Draft, RELEASE HOLD.

## Checkpoint G00 — Âm thanh nâng cao để người dùng tự kiểm tra (21/11/2026)

- **Code SHA = Tested SHA:** `8cf09646b4800037caadd9cd5e391da94f90af32`; [CI #44890639015](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44890639015) **SUCCESS**: G10 Node 89/89 PASS mỗi hệ Windows/Linux, Vite build và PoC PASS, Chromium dev 34 PASS + 1 PWA SKIP, production/PWA 35/35 PASS, 0 FAIL. Bài E2E giữ cao độ, RNNoise, bỏ im lặng đều PASS ở dev và production.
- Đã có: phát qua ranh giới WAV khi **mẫu liền mạch**, A–B/clip WAV xuyên ranh giới ấy; giữ cao độ `preservesPitch` cho nghe tập trung ≤60s/32 MiB; RNNoise WASM nạp động 48k, tắt mặc định; bỏ im lặng theo RMS ở cửa sổ ≤60s, tắt mặc định. Đều chỉ đọc và xử lý khi **nghe**, không sửa OPFS/WAV/manifest/`timeSpan`/notes.
- **Không đánh đồng phạm vi:** Bỏ im lặng RMS không phải speech-VAD ML; bộ phát giữ cao độ không phải streaming qua nhiều giờ; RNNoise chưa benchmark CPU/RAM/chất lượng giọng nhiều người. Waveform vẫn là lấy mẫu, chưa full waveform. Không bao giờ tự vượt gap hay phát nhầm phiên.
- **Sau Tested SHA** chỉ có các commit hướng dẫn/checkpoint và script `app/START_WINDOWS.cmd` cài dependency đúng lockfile nếu thiếu, các ca phần cứng này chưa chạy.
- **RELEASE HOLD / NOT_RUN:** Windows vật lý Chrome/Edge, micro, UniKey/EVKey, 3h, quota/crash/mất điện, giọng người thật, Word desktop, gói 0,5–2 GB/ZIP64 lớn, chuyển hai máy và full TC01–TC38. PR #1 vẫn Draft, không merge/deploy.

## Checkpoint G00 — Dạng sóng PCM lấy mẫu theo yêu cầu (20/11/2026)

- Mã đã được kiểm chứng CI ở SHA c9f4860 trên nhánh tích hợp: `app/src/waveform-envelope.mjs`, `timeline-ui.mjs`, giao diện/CSS, unit và Chromium E2E. Giao diện chỉ bật **theo yêu cầu người dùng**, không đọc toàn bộ WAV mỗi lần mở cuộc họp.
- Mẫu lấy tối đa 128 bins × 1024 mẫu; từ OPFS đã xác minh; không suy diễn biên độ vùng gap; dùng RMS làm độ cao cột và giữ dải coverage độc lập. Có AbortController, đóng worker sau khi lấy xong hoặc hủy, không sửa WAV/manifest/note/timeSpan.
- **Code SHA = Tested SHA:** `c9f4860ab93a19022b5434f9ee156d1c0cd2cd3a`; [CI #44578894987](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44578894987) SUCCESS: G10 Windows/Linux 80/80 unit, Chromium dev 31 PASS + 1 SKIP, Chromium production 32 PASS; **Windows/device: NOT_RUN**. Không xem đây là waveform đầy đủ hoặc coi #16 đã nghiệm thu.
- Các mục #09/#17/#18 vẫn chưa tích hợp; RELEASE HOLD giữ nguyên.

## Checkpoint G00 — Sao lưu được kiểm chứng hậu ghi (18/11/2026)

**Code SHA = Tested SHA:** `fad90119530817404d2e57e7bb73b197dde65021`; [CI #44317666582](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44317666582) **SUCCESS**: Windows/Linux unit 76/76, Chromium dev 30 PASS + 1 SKIP PWA, production 31/31 PASS. Đã thử tự verify file ZIP sau SaveFilePicker, khôi phục hai phiên trên browser profile mới, từ chối WAV sửa checksum. Nếu kiểm chứng không hỗ trợ/thất bại phải hiển thị CHƯA AN TOÀN, không báo DONE. #09/#16/#17/#18 vẫn chưa tích hợp và Windows/thiết bị thật NOT_RUN.

## Checkpoint G00 gần nhất (18/11/2026)

**Code SHA = Tested SHA:** `8478a1c45f37bca537cdcdf367578fa44809a20c`; [CI #44314800214](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44314800214) **SUCCESS**: Windows/Linux G10 unit 76/76 PASS, Chromium dev 29 PASS + 1 intentional SKIP, production/PWA 30 PASS. Đã có: tìm toàn cuộc họp nhảy tới chữ đầu tiên, 3 preset lề DOCX/PDF, Word native numbering, các hồi quy ngắt trang/ảnh/link. Chưa tích hợp: #09/#16/#17/#18. Không merge/publish.

## Phương án triển khai và thứ tự an toàn

1. **P0 G00 đợt 1**: `e0063e68` + sửa test `df6939bf`: A–B có kiểm tra gap, tua, tốc độ, thụt đầu dòng, nested list. CI kiểm điểm xong mới đóng.
2. **P0 G00 đợt 2**: `fb1aed7e`: nhập file có sẵn, streaming OPFS với giới hạn/rollback, gõ có mốc `imported_playback` khi nguồn hợp lệ. Phải tái kiểm tra E2E nhập WAV → nghe → gõ → lưu/tải lại.
3. **P1 G00 đợt 3**: `a5cb80e2`: bookmark trong ProseMirror và cảnh báo quota; sửa regression khôi phục v1/v2.
4. **P1 G00 đợt 4**: `ff57f907`: clip WAV A–B và verify ZIP v2 SHA256/CRC toàn bộ, chỉ đọc.
5. **P0/P1 G00 đợt 5**: `1e2e7c9a`: link/ảnh/ngắt trang, DOCX rowSpan; test liên quan. Kết quả mã chính xác xem `STATUS.md`.

**Nguyên tắc:** Không reset/xóa IndexedDB hay OPFS, không đổi `format:"mochop"` của ZIP legacy, không gán audioOffsetMs đoán từ thời gian tường, không tự phát qua gap, không coi `CI SUCCESS` là TC01–TC38 PASS. Khi thiếu bằng chứng nên ghi `NOT_RUN` / `HOLD`.

## Những việc chưa nghiệm thu dù có giao diện hoặc PoC

- **P0 chất lượng audio:** A–B xuyên nhiều WAV segment/phiên trong cùng meeting, kiểm sample-level drop/duplicate; phát 0,75×/0,9× giữ cao độ; nhập file nén dài qua bộ giải mã streaming; pause nghe file rồi gõ ghi đúng vị trí pause; backend file MP3 decoder support matrix.
- **P1 DOCX:** list numbering gốc, table rowSpan trong Microsoft Word Windows thật, ảnh và page break đúng bố cục nhiều trang; lề in xuất tuỳ chỉnh.
- **P2:** waveform PCM lấy mẫu, RNNoise WASM và bỏ im lặng RMS đã tích hợp opt-in và PASS CI; vẫn phải benchmark CPU/RAM, cảm nhận giọng người, waveform đủ độ phân giải, VAD lời nói thực và ánh xạ nguồn trên Windows thật.
- **Release gate:** TC01–TC38 đầy đủ; Win + Chrome/Edge + UniKey/EVKey/micro thật, 3h, quota/crash, PWA upgrade đang ghi, sao lưu v1/v2/v2 GB, chuyển máy thực; `NOT_RUN` nếu chưa có bằng chứng.

## Mẫu checkpoint bắt buộc

`Code SHA | Tested SHA | CI URL | Unit pass/fail | Browser dev pass/fail/skip | Browser prod pass/fail/skip | TC subcase | Windows/device NOT_RUN | Dữ liệu/backup unchanged | G00 integration hold`.
