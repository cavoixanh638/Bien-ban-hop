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
| 06 | Nghe tập trung/phím tắt | **Có chức năng cơ bản** | Nghe 15/30/60s hoặc liên tục; Alt+Enter tại mốc |
| 07 | Lặp A–B, tua, tốc độ | **Một phần** | Lặp A–B **chỉ cùng vùng mẫu liền mạch đã xác minh**; tua ±10s; tốc độ chọn 0,5–2×; chưa nối A–B qua segment/gap/multi-session; tốc độ khác 1× đổi cao độ |
| 08 | Nhập âm thanh sẵn | **Một phần** | WAV PCM/float mono, stereo → mono theo chunk ≤2GB/3h; MP3/M4A/WebM/OGG nếu `decodeAudioData` hỗ trợ ≤32MB/30 phút. Lưu OPFS commit, liên kết khi đang phát; chưa streaming giải mã file nén dài, pause-to-type chưa nghiệm thu |
| 09 | Giữ cao độ giọng khi nghe chậm | **Chưa tích hợp** | C2 playbackRate thay pitch; PoC C1 có `preservesPitch` nhưng chưa tích hợp, cần đo và thử nghe giọng thật |
| 10 | EQ làm rõ giọng | **Có chức năng cơ bản** | Gốc/Nhẹ/Rõ hơn chỉ trên luồng nghe, không sửa WAV; không phải AI denoise |
| 11 | Ảnh/link/ngắt trang/PDF | **Một phần** | Ảnh PNG/JPEG ≤300KB/ảnh, link http(s)/mailto, ngắt trang, native Print PDF A4; ảnh lớn/cắt trang/định dạng Word nâng cao chưa nghiệm thu |
| 12 | Tìm toàn cuộc họp | **Có chức năng cơ bản, đang bổ sung điều hướng** | MiniSearch offline, có dấu/không dấu; nhấp cuộc họp phù hợp chuyển đến từ khóa đầu tiên trong nội dung bằng selection (không sửa `timeSpan`); giới hạn tìm kiếm tại đoạn tối đa 160k ký tự của bộ index, chưa liệt kê toàn bộ kết quả |
| 13 | Đánh dấu đoạn quan trọng | **Một phần** | Mark `important` lưu trong note JSON, danh sách lọc `timeSpan` hợp lệ, bấm nghe; cần thử tương tác dài với IME |
| 14 | Cảnh báo quota/kiểm chứng sao lưu | **Một phần** | `navigator.storage.estimate()` chỉ ước tính + tự cảnh báo, chọn file v2 để verify SHA256/CRC từng entry; đã có chế độ tự kiểm chứng SHA256/CRC ngay sau SaveFilePicker (mặc định bật) hoặc kiểm thủ công; chưa xác minh v1 và trường hợp file đa GB trên Windows thật |
| 15 | Xuất clip WAV A–B | **Một phần** | Xuất từ một vùng PCM thật liên tục, có validation từ chối gap; chưa xuất xuyên segment/gap, chưa nghiệm thu dài/máy thật |
| 16 | Waveform | **Có mã thử nghiệm, CHƯA có CI đúng SHA** | Bấm **Hiện dạng sóng** để đọc tối đa 128 vị trí × 1024 PCM, vẽ RMS xấp xỉ lên thanh tua; chỉ lấy mẫu trong vùng đã ghi thật, giữ dải recorded/gap nguyên trạng. Chưa quét đầy đủ peak/dữ liệu nhiều giờ; chờ unit/Chromium CI và máy thật, không báo PASS |
| 17 | RNNoise WASM | **Chưa tích hợp** | Cần PoC CPU/latency/âm người, tuyệt đối không lọc lại WAV gốc |
| 18 | Tự bỏ qua im lặng | **Chưa tích hợp** | Cần VAD và bộ ánh xạ thời gian nguồn→phát không phá `timeSpan`; giữ OFF mặc định |

## Checkpoint G00 — Dạng sóng PCM lấy mẫu theo yêu cầu (20/11/2026)

- Mã đang chờ kiểm chứng CI trên nhánh tích hợp: `app/src/waveform-envelope.mjs`, `timeline-ui.mjs`, giao diện/CSS, unit và Chromium E2E. Giao diện chỉ bật **theo yêu cầu người dùng**, không đọc toàn bộ WAV mỗi lần mở cuộc họp.
- Mẫu lấy tối đa 128 bins × 1024 mẫu; từ OPFS đã xác minh; không suy diễn biên độ vùng gap; dùng RMS làm độ cao cột và giữ dải coverage độc lập. Có AbortController, đóng worker sau khi lấy xong hoặc hủy, không sửa WAV/manifest/note/timeSpan.
- **Code SHA:** xem HEAD nhánh tại thời điểm nhận việc; **Tested SHA: NOT_RUN**, **CI: chưa xác nhận**, **Windows/device: NOT_RUN**. Không xem đây là waveform đầy đủ hoặc coi #16 đã nghiệm thu.
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
- **P2:** waveform PCM bounded, RNNoise WebAssembly benchmark, skip silence/VAD giữ mapping và không ảnh hưởng mốc.
- **Release gate:** TC01–TC38 đầy đủ; Win + Chrome/Edge + UniKey/EVKey/micro thật, 3h, quota/crash, PWA upgrade đang ghi, sao lưu v1/v2/v2 GB, chuyển máy thực; `NOT_RUN` nếu chưa có bằng chứng.

## Mẫu checkpoint bắt buộc

`Code SHA | Tested SHA | CI URL | Unit pass/fail | Browser dev pass/fail/skip | Browser prod pass/fail/skip | TC subcase | Windows/device NOT_RUN | Dữ liệu/backup unchanged | G00 integration hold`.
