# G10 — Ứng dụng Biên bản họp V1.2 tích hợp thử nghiệm

**Tên chương trình:** **Biên bản họp**. Tên package npm chính thức: `bien-ban-hop`. **Tên hiển thị và tên tệp xuất:** **Biên bản họp**. Gói sao lưu mới có tên `bien-ban-hop-<meetingId>.bbhop` (ZIP64 v2). **Vẫn nhập được tệp `.mochop` cũ (v1/v2).** Giữ định dạng nội dung ZIP, `format: "mochop"` và IndexedDB/OPFS để không mất dữ liệu; API localhost có tên mới cùng đường dẫn tương thích bản cũ.

**Trạng thái:** `INTEGRATION_ALPHA`, **không** phải bản phát hành và **không** có bằng chứng nghiệm thu TC01–TC38. Được dựng trên nhánh `integration/20261115-g10-v1.2`, giữ nguyên `main` và chín nhánh PoC. Không sử dụng dữ liệu họp quan trọng cho đến khi qua cổng Windows và kiểm thử crash/quota/restore.

## Tên cũ trong code và cách cập nhật `package-lock.json`

- `mochop-g10-integration` đã đổi thành **`bien-ban-hop`** trong `app/package.json`; các package PoC cũng đã đổi tiền tố thành `bien-ban-hop-poc-...`.
- **`app/package-lock.json` đã được tạo trên GitHub Actions và commit vào cùng nhánh G00**, với cả `name` đầu tệp và `packages[""].name` đều là `bien-ban-hop`. Không cần chạy npm trên PC để đổi tên hay **Push origin**. Nếu GitHub Desktop đang liệt kê lock cũ dưới dạng file mới chưa theo dõi, hãy **chỉ** đưa file đó ra ngoài repository hoặc Discard Changes của chính file đó trước khi Pull, tránh lỗi ghi đè file cục bộ. Không ảnh hưởng dữ liệu ghi âm.
- **Không đổi** mã nhận diện gói ZIP v1/v2 `format: "mochop"`, tên DB IndexedDB cũ và khóa bảo trì PWA khi chưa có bước di chuyển dữ liệu được kiểm thử; thay bừa sẽ gây mất quyền truy cập dữ liệu cuộc họp cũ. API nội bộ đã chuyển sang tên `bien_ban_hop` và vẫn có alias để bản đang mở cũ không lỗi.
- Danh sách các tên phải giữ tương thích được ghi tại [docs/NAMING_COMPATIBILITY.md](../docs/NAMING_COMPATIBILITY.md).

## Khởi chạy trên Windows (GitHub Desktop)

1. Checkout nhánh `integration/20261115-g10-v1.2`.
2. Mở Terminal trong thư mục repo, chạy:

```powershell
cd app
node --version
npm ci
npm run test
npm run build
npm run dev
```

3. Mở **http://127.0.0.1:5173/** trên Chrome hoặc Edge. Cấp quyền **micro** chỉ khi bắt đầu ghi âm. Node.js >=20.
4. Nhấn **Bắt đầu ghi**, gõ ghi chú ngay vào trang giấy; không phải nhập mã mốc. Sau khi dừng, nhấp đoạn chữ có gắn mốc để nghe. `Alt+Enter` nghe mốc tại con trỏ; `Esc` dừng phát. Ghi chú tự lưu với revision, báo "Đã lưu" chỉ sau IDB transaction hoàn tất.
5. Có thể tạo/chuyển cuộc họp, đổi tên, sử dụng hai tab (chỉ một tab giữ writer lock), xuất DOCX/TXT/MD/CSV, **Sao lưu biên bản và ghi âm** và **Khôi phục biên bản từ tệp**. Khi nhập, chương trình kiểm tra checksum rồi tạo ID cuộc họp, ghi chú và phiên thu mới; không ghi đè cuộc họp đang có.

## G00 — Bỏ qua im lặng: đã sửa lỗi chọn Liên tục (21/11/2026)

**Lỗi ảnh người dùng:** trước đây bật **Bỏ qua im lặng** khi **Nghe tập trung = Liên tục** rồi nhấp chữ/phiên phát sẽ hiện `Không nghe lại được: Để bỏ qua im lặng, hãy chọn Nghe tập trung 15/30/60 giây`. Đây là lỗi phối hợp UI–bộ phát mà E2E cũ chưa bao phủ.

**Cách dùng sau sửa:** Tại thanh phát nằm dưới trang ghi chú, mục **Nghe tập trung** đã được chuyển sát ô **Tốc độ**. Khi đang chọn **Liên tục** mà đánh dấu **Bỏ qua im lặng**, chương trình **tự chọn 30 giây**, hiện thông báo màu xanh bên dưới và giữ checkbox. Bấm vào chữ có mốc, một phiên trên thanh tua hoặc nút Phát để nghe đoạn đó. Nếu muốn trở lại **Liên tục**, chọn lại dropdown; checkbox Bỏ qua im lặng sẽ tự tắt và thông báo ngay. Tính năng này **chưa tự bỏ qua khoảng im lặng xuyên cả bản ghi nhiều giờ**. Chọn focus 15/30/60 giây là phạm vi được hỗ trợ, không quét cả cuộc họp trong một lần.

**Kết hợp tùy chọn:** Giữ cao độ + Bỏ qua im lặng đều có thể được chọn ở tốc độ 1× (lúc này không cần biến đổi pitch). Ở 0,5–2× khác 1×, hai cơ chế không cùng chạy: **chế độ vừa chọn sẽ được giữ**, chế độ kia tự bỏ chọn kèm giải thích. **RNNoise** có thể kết hợp với từng chế độ; xử lý hoàn toàn cục bộ, không gửi PCM đi. Khi lặp A–B chọn sẵn, phạm vi 0,4–120 giây được quét tuần tự theo từng cửa sổ tối đa 60 giây và không đi qua khoảng thiếu nguồn.

**Cách cập nhật:** Chọn nhánh `integration/20261115-g10-v1.2` trong GitHub Desktop, **Fetch origin → Pull origin**, kết thúc phiên ghi đang thu, dừng ứng dụng cũ và mở lại `app/START_WINDOWS.cmd`. Mở `http://127.0.0.1:5173/`, nhấn **Ctrl+Shift+R** nếu vẫn thấy giao diện cũ. Nếu đã cài PWA, dùng **Cập nhật phiên bản** lúc không thu âm, không xóa toàn bộ dữ liệu website/IndexedDB/OPFS. **Không cần Push origin.** Hãy thử với cuộc họp giả lập, không dùng bản chưa nghiệm thu cho biên bản quan trọng.

**Bằng chứng:** mã ứng dụng `d730b40d763acc0453056d5f27d711a0c35c41a5` đã PASS [CI #44908183703](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44908183703): Windows/Linux Node 100/100; Chromium dev 38 PASS +1 SKIP; Chromium production/PWA 39/39 PASS. Phần cứng Windows thật, UniKey/EVKey, chất lượng giọng nhiều người, 3 giờ/mất điện và tập TC01–TC38 vẫn NOT_RUN; RELEASE HOLD. Xem bảng kiểm đủ 18 nhóm ở `docs/STATUS.md`.

## G00 — Sửa hiển thị sóng và nút thu trên giao diện (21/11/2026)

- **Sóng âm:** khi dừng ghi/phát và bấm **Hiện dạng sóng**, sóng RMS lấy mẫu xuất hiện bằng **các vạch xanh lam phía trên**, dải xanh lá/xám **ở dưới** cho biết có âm thanh đã lưu/hay khoảng thiếu. Thanh tua nay cao 50px, không còn ép waveform trong sọc 18px; cột tối thiểu 4px, mức cao tương đối theo biên độ RMS nhưng không phóng đại nhiễu nền. Nếu thông báo **Đã lấy mẫu ... vị trí** mà biểu đồ chỉ là dãy vạch thấp, bản ghi có tín hiệu rất nhỏ hoặc im lặng — hãy dùng **Thử micro** để kiểm tra âm thanh. Dạng sóng là **128 điểm lấy mẫu**, không phải toàn bộ âm thanh được quét.
- **Đang ghi:** **Tạm dừng màu vàng cam**, **Kết thúc màu đỏ**; khi dừng tạm, **Tiếp tục chuyển xanh lá** còn Kết thúc vẫn đỏ. Các nút to, đậm, hỗ trợ focus bàn phím; khi không thu hai nút disabled. Màu chỉ giúp nhận diện, không thay trạng thái ghi/lưu.
- **Cập nhật máy:** Sau khi commit được kiểm thử, tại GitHub Desktop chọn nhánh `integration/20261115-g10-v1.2` rồi **Fetch origin → Pull origin** nếu có. Chạy `app/START_WINDOWS.cmd`, tải lại `http://127.0.0.1:5173/` (khuyến nghị Ctrl+Shift+R nếu còn giao diện cũ). Không cần Push origin. Test với dữ liệu thử, không dùng cuộc họp quan trọng.
- **Đối chiếu:** mã tại `88be7d4531cb22d7918c771e8d5c815c8e5fa913`; bài unit/E2E mới đã viết, **Tested SHA = NOT_RUN** cho đến khi CI xác nhận. Thiết bị Windows/micro thật vẫn NOT_RUN, RELEASE HOLD. Bài test đã bổ sung kiểm vị trí vạch sóng, khác màu green/gray, và thao tác start→pause→resume→stop.

## G00 — Bản để tự kiểm tra phát lại nâng cao (21/11/2026)

**Checkpoint tự động:** Code SHA = Tested SHA `8cf09646b4800037caadd9cd5e391da94f90af32`. [GitHub Actions #44890639015](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44890639015) **SUCCESS**: Linux và Windows mỗi hệ **89/89 unit PASS**, build/PoC PASS; Chromium dev **34 PASS + 1 PWA-only SKIP**, Chromium production/PWA **35/35 PASS**, không FAIL. Các commit sau checkpoint chỉ cập nhật script Windows và tài liệu, chưa được xác minh trên PC thật.

**Chạy trên PC:** Trong GitHub Desktop checkout nhánh `integration/20261115-g10-v1.2` rồi Pull. Mở `app/START_WINDOWS.cmd` (cần Node.js và npm), sau đó vào **http://127.0.0.1:5173/** bằng Chrome/Edge. Script tự chạy `npm ci` theo lockfile nếu máy chưa có dependency mới RNNoise. **Không cần push origin**; không thay đổi các DB IndexedDB/OPFS hoặc ghi âm cũ.

**Thử bằng cuộc họp giả lập:** ghi 5–15 giây và gõ nội dung, bấm **Kết thúc**; bấm chữ có mốc để nghe, hoặc tua bằng timeline. Chọn **Nghe tập trung 15/30/60 giây** trước khi bật các xử lý có giới hạn. Chọn tốc độ 0,75× và **Giữ cao độ giọng (đoạn ngắn)** để thử bộ phát `HTMLMediaElement.preservesPitch`; khi tắt tùy chọn, C2 tiếp tục hoạt động như cũ (tốc độ khác 1× có thể làm đổi pitch). Bộ phát giữ cao độ dùng WAV xác minh với giới hạn 60 giây/32 MiB; không hỗ trợ **Liên tục** hoặc trình duyệt thiếu `preservesPitch`, sẽ báo rõ thay vì âm thầm đổi cách phát.

**Bỏ qua im lặng (đoạn ngắn)** là phân tích RMS năng lượng của PCM thực trong cửa sổ 15/30/60 giây, bỏ khoảng im lặng dài (tối thiểu 750ms, giữ mép 160ms). Không phải VAD nhận diện lời nói bằng AI; có thể xử lý không lý tưởng trong phòng ồn. Không dùng đồng thời với giữ cao độ ở tốc độ khác 1× trong bản alpha. **Lọc nhiễu RNNoise (thử nghiệm)** dùng mô hình WASM `@sapphi-red/web-noise-suppressor@0.4.1` và AudioWorklet 48kHz, chỉ trong đường nghe, **mặc định tắt**; WASM nạp cục bộ, không gửi audio lên dịch vụ ngoài. Chất lượng/CPU trên PC thật chưa đo. Sau lần truy cập tải thành công, PWA có thể lưu tài nguyên WASM cùng origin phục vụ dùng offline; bản localhost dev không đăng ký service worker.

**Lặp A–B / Xuất WAV:** cho phép đi qua *ranh giới các đoạn WAV* trong cùng phiên khi mẫu PCM **liền mạch đã được xác minh**; vẫn từ chối gap/thiếu mẫu, phiên ghi khác hoặc giới hạn đoạn dài >120 giây. **Dạng sóng** chỉ lấy mẫu giới hạn để xem nhanh, không phải peak-envelope toàn bộ bản ghi dài.

**An toàn dữ liệu:** các chế độ phát chỉ đọc OPFS đã lưu, không viết đè nguồn WAV, `timeSpan`, ghi chú hoặc gói backup. Bài fake-micro/browser PASS **không thay thế** kiểm thử Windows thật với UniKey/EVKey, micro, Word, ghi 3 giờ, quota/mất điện, gói nhiều GiB và khôi phục giữa hai máy; các ca này vẫn **NOT_RUN**. Bản thử vẫn **INTEGRATION_ALPHA / RELEASE HOLD**, không merge hoặc deploy.

## G00 — Xem dạng sóng PCM lấy mẫu (20/11/2026, chưa nghiệm thu)

- Sau khi dừng thu, bấm **Hiện dạng sóng** ở thanh tua. Ứng dụng đọc có giới hạn tối đa **128 vị trí × 1024 mẫu PCM** qua OPFS, tính RMS và vẽ các cột mức tín hiệu gần đúng. Bấm **Ẩn dạng sóng** để bỏ lớp biểu diễn. Không tự tải toàn bộ file dài khi mở cuộc họp.
- **Các vùng xanh/xám của thanh tua vẫn là nguồn sự thật** về vùng ghi âm có dữ liệu và vùng gap. Các cột biên độ chỉ là mẫu đại diện, không chứng minh toàn bộ vùng có tiếng hay im lặng. Không sửa WAV, timeSpan, ghi chú, đoạn audio nguồn hay manifest.
- Dừng phát trước khi hiển thị dạng sóng; tránh dùng cùng lúc với ghi âm, nhập hoặc khôi phục. Nếu worker không đọc được PCM, app báo không có dạng sóng, không được vẽ giá trị đoán. Kiểm thử Node/Chromium **PASS trên CI tại SHA c9f4860ab93a19022b5434f9ee156d1c0cd2cd3a** ([Actions #44578894987](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44578894987)); Windows micro thật, dữ liệu nhiều giờ và các cổng phát hành vẫn NOT_RUN.

## G00 — Đợt bổ sung tính năng 01–18 (18/11/2026)

- **Âm thanh:** Lặp A–B giới hạn **cùng vùng mẫu liền mạch đã xác minh** (không tự vượt gap hoặc khác phiên), tua ±10 giây, 0,5–2×. Lưu ý thời điểm 18/11 C2 còn đổi cao độ; tính năng giữ cao độ opt-in đã bổ sung ngày 21/11, xem checkpoint mới ở trên. Nhập WAV PCM/F32 mono/stereo theo chunk (≤2GB và ≤3 giờ), file nén MP3/M4A/WebM/OGG dùng decodeAudioData khi trình duyệt hỗ trợ (≤32MB, ≤30 phút); OPFS commit trước khi liên kết meeting. Khi phát file nhập và gõ, mốc lấy từ vị trí phát xác minh; không suy đoán khi pause/gap.
- **Ghi chú Word:** thụt dòng đầu (0–72pt), tăng/giảm cấp danh sách, ảnh PNG/JPEG tối đa 300KB/ảnh, liên kết chỉ http(s)/mailto, ngắt trang. Export DOCX bao gồm media/relationships và rowSpan cơ bản, cần kiểm Microsoft Word thật trước nghiệm thu.
- **Tính năng khác:** bookmark `important` lưu cùng văn bản, hiển thị danh sách các mốc hợp lệ; cảnh báo quota là ước tính, không thay đổi ghi âm; xuất WAV đoạn A–B ≤120s từ committed PCM; kiểm chứng riêng tệp sao lưu v2 bằng SHA-256/CRC từng file.
- **Các giới hạn còn HOLD:** giữ cao độ mới chỉ cho cửa sổ tập trung, dạng sóng xấp xỉ; RNNoise và bỏ qua im lặng đã có mã/test nhưng chưa đo chất lượng thiết bị thật; Word pagination phức tạp, nhập file nén dài, backup đa-GB Windows và TC01–TC38 vẫn chưa nghiệm thu.
- **Theo dõi:** [docs/G00_FEATURE_BACKLOG.md](../docs/G00_FEATURE_BACKLOG.md), [STATUS.md](../docs/STATUS.md), [ACCEPTANCE_TESTS.md](../docs/ACCEPTANCE_TESTS.md). Mỗi module cần **Code SHA, Tested SHA, PASS/FAIL/NOT_RUN** trước khi chuyển trạng thái.

## G00 — Kiểm chứng tự động file sao lưu sau khi ghi (18/11/2026)

- Bổ sung checkbox **Kiểm chứng file ngay sau khi sao lưu** (mặc định bật). Khi FileSystemFileHandle hỗ trợ `getFile()`, sau khi ghi/đóng ZIP sẽ đọc lại tệp vật lý để kiểm tra SHA-256/CRC **từng entry**, không dựa vào kết quả ghi bộ nhớ.
- Nếu kiểm chứng thất bại hoặc trình duyệt không hỗ trợ, trạng thái hiển thị rõ **ĐÃ GHI nhưng CHƯA được xác nhận an toàn**. Người dùng có thể chọn kiểm chứng thủ công; không xóa file hỏng hay dữ liệu gốc trong OPFS.
- Có nút Hủy nhập/kiểm chứng dùng AbortController khi đọc lại file lớn; không tuyên bố PASS nếu hủy. Kiểm thử Chromium dựng FileSystemFileHandle fixture, xuất ZIP rồi đọc lại và verify.
- Tệp lớn có thể kiểm tra lâu do đọc lại toàn bộ; có thể bỏ chọn để xuất rồi tự kiểm chứng thủ công. Không tự xóa hoặc thay file đang lưu.

## G00 — Danh sách Word có đánh số và thụt cấp native (18/11/2026)

- Xuất Word dùng cấu trúc numbering OOXML gốc cho danh sách gạch đầu dòng/đánh số, kể cả lồng nhau; các danh sách riêng có reference riêng để không nối số thứ tự không mong muốn.
- Giữ nguyên văn bản, `timeSpan` và các Mark trong nội dung gốc; không thêm tiền tố `1.` hay `•` thành chữ thật vào ghi chú.
- Bài kiểm thử giải tệp DOCX xác nhận `word/numbering.xml` chứa định nghĩa decimal/bullet và `word/document.xml` chứa `w:numPr`. Cần thử Microsoft Word thực tế với danh sách rất dài, nhiều cấp, bảng xen kẽ trước khi nghiệm thu.

## G00 — Lựa chọn lề A4 khi xuất Word / In PDF (18/11/2026)

- Ba cấu hình cố định: **Biên bản** (trái 3cm, còn lại 2cm), **Cân đối** (trái/phải 2,5cm, trên/dưới 2cm), **Lề đều 2cm**. DOCX lấy giá trị twip đúng từ cùng bảng cấu hình. Print native CSS `@page` dùng lề tương ứng. Lựa chọn chỉ ảnh hưởng bản xuất/in, **không sửa văn bản hay mốc ghi âm**, không thay thế sao lưu `.bbhop`.
- Kiểm thử unit cho các giá trị và E2E Chromium xác nhận đổi print rule không sửa nội dung. Đây chưa phải trình dàn trang Word có phân trang hoàn toàn giống Microsoft Word desktop.

## G00 — Điều hướng vào nội dung tìm kiếm toàn cuộc họp (18/11/2026)

- Trong sidebar, tìm tiếng Việt không dấu qua MiniSearch, nhấp cuộc họp phù hợp sẽ chọn và cuộn tới đoạn chứa từ khóa đầu tiên trong văn bản; nếu chỉ trùng tiêu đề thì mở cuộc họp và thông báo không có đoạn nội dung chính xác.
- Bộ tìm vị trí đọc-only ánh xạ ký tự UTF-16 ProseMirror, hỗ trợ dấu tiếng Việt và văn bản bị chia thành nhiều node bởi định dạng; không thay đổi `timeSpan`, không thêm văn bản, không tự bật phát âm thanh.
- Giới hạn hiện tại: điều hướng kết quả đầu tiên cho mỗi cuộc họp (chưa là UI danh sách tất cả match); bộ index hiện đọc tối đa 160.000 ký tự một cuộc họp. Đã có unit + Chromium E2E, nghiệm thu thực tế còn HOLD.

## G00 — Đối chiếu tỷ lệ giãn dòng với chuẩn Microsoft Word (18/11/2026)

- **DOCX:** Các mức 1,0 / 1,15 / 1,5 / 2,0 phải ghi theo OpenXML `w:spacing w:lineRule="auto"` với `w:line` lần lượt **240 / 276 / 360 / 480** (đơn vị 1/240 dòng). Mã đang sử dụng `Math.round(240*height)`, đúng công thức quy định. CI có kiểm thử thực tế bằng cách xuất DOCX, mở `word/document.xml`, xác nhận đủ bốn giá trị, cùng `before=after=0`; kiểm thử cả fallback 1,15 và ghi chú cũ có giãn dòng inline.
- **WebApp:** CSS `line-height:1/1.15/1.5/2` tăng theo đúng các hệ số với cỡ chữ của đoạn. Chromium E2E đo `getComputedStyle` từng mức và kiểm tra lưu/tải lại. **Không đảm bảo số pixel hoặc vị trí glyph giống Microsoft Word**: bộ dàn trang Word dùng font metrics và quy tắc riêng, CSS dùng line box; việc bằng hệ số không đồng nghĩa bản xem trước và Word pixel-perfect.
- **Khoảng cách đoạn:** sản phẩm chủ ý đặt `before=after=0` để Enter không tạo khoảng trắng không mong muốn, **khác** một số Normal style mặc định của Word (Microsoft hướng dẫn khoảng cách dòng và khoảng cách đoạn là hai tùy chọn độc lập). Kiểm thử dùng Microsoft Word cài trên máy Windows vật lý vẫn `NOT_RUN`.

## G00 — Khử khoảng cách thừa sau Enter khi chọn giãn dòng (18/11/2026)

- **Nguyên nhân:** các lần nhấn Enter tạo `<p>` mới; CSS cũ `.tiptap p{margin:0 0 .75em}` cộng thêm khoảng cách sau mỗi đoạn bất kể giãn dòng đang chọn. Chữ trông vẫn cách xa khi đặt 1,0.
- **Sửa:** xóa khoảng cách mặc định giữa hai paragraph bằng `.tiptap p{margin:0}`; chế độ 1,0 dùng đúng chiều cao dòng chữ, 1,15/1,5/2,0 tăng khoảng cách theo giá trị đã chọn, không tăng thêm 0,75em. **Nhấn Enter vẫn tạo đoạn mới**, không thay `timeSpan` hay định dạng lưu cũ.
- **Xuất DOCX:** đặt `before:0, after:0` cho các đoạn thường; trước đây `after:120 twip` tự chèn thêm 6pt vào mỗi đoạn. Heading tiêu đề tài liệu vẫn có khoảng cách riêng.
- **Kiểm thử thực tế:** nhập ba dòng bằng Enter; kiểm tra bằng vị trí bounding box và `getComputedStyle()` rằng 1,0 không có margin thêm và 1,5 tăng đáng kể; xác minh tải lại, print view. PWA shell cache đã tăng phiên bản để nhận CSS mới.

## G00 — Căn giữa công cụ và sửa cỡ chữ/giãn dòng (18/11/2026)

- Thanh công cụ và hàng Tìm/Thay được **căn giữa**; bỏ dòng hướng dẫn và chip quyền/lưu khỏi vùng nhìn. Trạng thái quyền/lưu vẫn ở vùng thông báo hỗ trợ đọc màn hình, lỗi lưu tiếp tục được báo trên màn hình.
- Cỡ chữ trong menu Word là **point (pt)**: 14 pt được render là 14pt trong CSS (khoảng 18,67 px tại 96 dpi), và xuất DOCX là **28 half-points**. Các ghi chú cũ dùng `px` vẫn giữ nguyên nội dung và được chuyển đổi đúng khi xuất DOCX.
- Giãn dòng **1,0 / 1,15 / 1,5 / 2,0** được lưu trên **cả đoạn văn/tiêu đề**, không còn chỉ đặt trên `span` chữ; không sửa `timeSpan`. Khoảng cách **giữa các đoạn** vẫn riêng với giãn dòng bên trong đoạn.
- PWA service worker đã tăng phiên bản cache để nhận giao diện mới. Thử nghiệm Chromium lưu → tải lại kiểm tra cỡ 14 pt, computed line-height và bố cục.

## G00 — Soạn thảo Word và tìm kiếm offline

- Thanh **Định dạng & bảng** dùng Tiptap 3.33.1: gạch chân/gạch ngang, font, cỡ, màu chữ/tô sáng, căn lề, giãn dòng theo vùng chữ, Heading 1–3, bảng 3×3, thêm/xóa dòng/cột và gộp/tách ô.
- **Ctrl+F/Ctrl+H** mở tìm/thay trong biên bản. Thay thế tự động bị chặn nếu vùng kết quả có `timeSpan` (không bịa nguồn âm thanh); phần khác được thay. Không can thiệp khi người dùng đang gõ tiếng Việt.
- **Tìm tất cả cuộc họp** ở cột trái sử dụng MiniSearch nội bộ, hỗ trợ chữ có dấu/không dấu, chỉ đọc ghi chú khi tìm và không thay đổi nguồn.
- Xuất **DOCX bằng thư viện docx** có font/cỡ/căn lề/bảng, trang A4 và thông tin mốc tùy chọn. **DOCX chỉ là bản văn bản**, không thay thế sao lưu audio `.bbhop`. Trong bảng, ô gộp theo chiều dọc cần kiểm chứng riêng trước khi tuyên bố đúng 100%.
- Thử nghiệm unit `fast-check` để phát hiện nguy cơ thay thế chữ có mốc; CI vẫn cần thử UniKey/EVKey thật trên Windows.

## G00 — Nghe tập trung và làm rõ giọng không phá bản ghi gốc

- Tùy chọn **Nghe tập trung 15/30/60 giây** giới hạn cửa sổ nghe sau mốc (có pre-roll), hoặc **Liên tục** như trước. Không suy diễn điểm bắt đầu/kết thúc của câu nói.
- **Làm rõ giọng** có Gốc (mặc định), Nhẹ và Rõ hơn. Bộ lọc Web Audio: high-pass, EQ tăng tần số lời nói, compressor, trộn dry/wet. Chỉ xử lý ở đầu ra nghe, **không đổi WAV/OPFS/timeSpan**, không phải AI khử ồn chuyên sâu.
- Chưa nghiệm thu giọng nói thật hoặc độ trễ nghe trên Windows. Không khẳng định lọc được lời nói chồng nhau và chưa dùng SoundTouchJS/RNNoise trong sản phẩm; đây là các PoC riêng.

## G00 — Chèn Word và in PDF A4

- Nút **Chèn nội dung từ Word (.docx)** sử dụng Mammoth + DOMPurify. Chỉ nhập sau khi dừng ghi; chặn tệp lớn, loại các thuộc tính `data-time-*`, script và ảnh; chèn nội dung không có liên kết âm thanh giả, không thay thế nội dung hiện có.
- Nút **In / Lưu PDF (A4)** dùng chức năng in sẵn trong Chrome/Edge, định dạng trang A4 riêng; giao diện soạn thảo không bị chia trang trong lúc đang gõ.
- Word nhập từ bên ngoài có thể khác một số chi tiết định dạng; không đảm bảo tương đương Word 100%. Bản sao lưu đầy đủ có âm thanh vẫn là `.bbhop`.

## Kiến trúc thực tế của bản này

- **G01:** `InputTracker`, `timeSpan`, `PendingLinkJournal`, Tiptap Editor thật; không nhúng status động vào Mark.
- **G02:** `capture-processor.js` AudioWorklet 4096 frame, 32 buffer, transferable `MessagePort`; `CaptureClockMapper` dùng AudioContext render timestamp, chưa hiệu chuẩn độ trễ phần cứng micro.
- **G03:** `worker.mjs` OPFS/IndexedDB journal; chunk ACK chỉ trả buffer, flush+journal ACK mới cấp `committedThroughSampleExclusive`. Mốc pending chỉ finalize khi frame nằm dưới watermark đã commit. Bộ nối `app/src/clock-bridge.mjs` kiểm meeting/recording/generation/interval cùng sample→ms.
- **G04/G05:** Timeline nguồn được xác thực qua `poc/05-player/timeline.js`; `AudioPlayer` lập lịch các cửa sổ PCM nhỏ lấy từ `G03.seek`, không tự phát segment gần nhất. Đây là **bộ phát alpha dạng C2**, **chưa chứng minh sample-gapless hoặc giữ cao độ giọng ở 0,75×/0,9×**; PoC G04 TypeScript sẽ phải nối thêm để có meeting timeline đầy đủ.
- **G06:** `NotesRepository` + adapter `MeetingStore` ghi note và pending sidecar trong **một** IDB transaction, CAS revision và lease kiểm trước+trong transaction. `SaveQueue` single-flight, không báo saved khi còn edit dirty.
- **G07/G10:** ZIP64 streaming xuất tệp `.bbhop` **v2**, vẫn đọc được tên tệp `.mochop` cũ, chứa toàn bộ phiên ghi âm cùng nhật ký G03, nội dung ProseMirror và lịch sử G06; khôi phục vào OPFS+IndexedDB bằng kiểm SHA256/CRC và G03 reconcile trước khi công bố. Nhập được `.mochop` **v1 đời cũ** một phiên ghi với dữ liệu mà file cũ thực sự có. So sánh thư viện ZIP D13 vẫn chưa chốt.
- **G08:** xuất bốn định dạng, chọn có/không mốc thời gian.
- **G09:** Web Locks độc quyền writer từng cuộc họp; Service Worker shell chỉ cache asset app, giữ activation dưới origin-wide maintenance lock, không cache audio/notes. Chạy PWA ở production HTTPS, localhost Vite dev không đăng ký SW.

## Bài kiểm thử thực tế

- `npm test`: hợp đồng G10, tự lưu WAV localhost và kiểm định dạng sao lưu v2 gồm nhiều phiên thu, remap mốc, checksum, rollback, không ghi đè; chạy CI Linux/Windows.
- `npm run build`: bundle Vite/Tiptap/worker. Có CI Linux/Windows.
- `npm run test:e2e`: Chromium localhost và preview production: thử micro giả lập, lưu OPFS, ghi hai lần trong cùng biên bản, xuất `.bbhop`, nhập trên browser context mới, bấm phát lại cả hai phiên, nhập lặp không ghi đè, từ chối file sai CRC/SHA và nhập file v1. **Fake micro không thay thế cuộc họp thật/IME thật**.
- CI tại `.github/workflows/g10-verify.yml` **không** deploy, chạy mã G10 và unit các PoC. Cần xem kết quả đúng SHA trước khi báo PASS.
- Sau browser smoke cần **Windows** UniKey/EVKey × Telex/VNI trong 120 giây, ghi **3 giờ thật**, Pause/Resume/mất micro/quota/kill browser, nghe 04:58→05:02 và 90/170 phút, kiểm ZIP 0,5–2 GB/máy thứ hai, Word/Excel thực, PWA offline/update/migration. Tất cả vẫn **NOT_RUN** khi chưa có log.

## Ranh giới dữ liệu và rủi ro

- Cần HTTPS hoặc localhost; `navigator.locks` thiếu ⇒ **read-only fail closed**, không dùng fallback mất an toàn.
- OPFS/IndexedDB nằm trong **origin**; localhost với port khác hoặc đổi sang website khác là kho khác. Không lưu dữ liệu họp thật trên origin dùng chung `*.github.io`.
- Sau lỗi quota/commit, UI giữ dirty content và từ chối chuyển cuộc họp; người dùng cần xuất văn bản để tự bảo toàn nếu không khôi phục được quota. Browser không thể bảo đảm không mất vài giây dữ liệu khi thiết bị bị mất nguồn đột ngột.
- G10 giữ 9 PoC nguồn tham chiếu dưới `poc/` để truy vết SHA; đây **không** phải merge chín nhánh Git, chỉ sao chép Git tree vào nhánh mới. Một chỉnh sửa portable UTF-8 ở `poc/07-backup/interop-check.py` được làm riêng trong nhánh G10 để CI Windows chạy được, nhánh gốc G07 không bị thay.
- Đã có khôi phục `.bbhop` v2 và `.mochop` v1/v2 ở mức alpha và đa phiên v2. Vẫn chưa nghiệm thu **nhập trên hai máy Windows vật lý**, stress file 0,5–2GiB và >4GiB, kill trình duyệt/quota, phát khi đang ghi, hiệu chuẩn micro hardware latency, G04 full meeting timeline và PWA migration.

## File ghi âm được lưu ở đâu?

- Âm thanh luôn được ghi trước vào OPFS. **Khi chạy bằng `app/START_WINDOWS.cmd` (Vite localhost), bấm Kết thúc sẽ tự động sao chép từng đoạn WAV hoàn chỉnh vào `app/Recording/<recordingId>/seg-<sample>.wav` trên ổ đĩa Windows**. Thư mục được tạo khi lưu và được `.gitignore` để không vô tình đưa âm thanh lên GitHub. Nếu ứng dụng chạy bằng bản PWA/website, trình duyệt không được ghi trực tiếp vào thư mục dự án; trong trường hợp đó bản ghi vẫn nằm ở OPFS. Ứng dụng lưu WAV bên trong **Origin Private File System (OPFS)** của Chrome/Edge cho đúng địa chỉ web hiện tại. Đường dẫn nội bộ ở dạng `<recordingId>/seg-<firstSample>.wav`; mỗi segment tối đa khoảng **5 phút** (cấu hình `segmentSeconds: 300`). Đây là các WAV Float32 PCM; trình duyệt quản lý vị trí tệp vật lý trong hồ sơ người dùng.
- **IndexedDB** riêng lưu manifest/journal của âm thanh (tên database `mochop-opfs-poc-v1`) và ghi chú/cuộc họp (database `mochop-g10-v1`). Nút **Kết thúc** đợi flush/journal; ACK nhận buffer sớm không được tính là đã lưu bền vững.
- Muốn có gói sao lưu **di chuyển được sang máy khác**, sau khi dừng ghi chọn **Sao lưu biên bản và ghi âm**. Tự lưu WAV trong `app/Recording` và sao lưu `.bbhop` là hai chức năng khác nhau. Tệp `.bbhop` chứa âm thanh và dữ liệu cuộc họp, **không phải tệp WAV đơn lẻ**. Bản alpha đã xuất/nhập được cuộc họp **có nhiều phiên ghi**; máy khác chỉ cần cùng bản app, chọn **Khôi phục biên bản từ tệp**. File v1 cũ vốn chỉ chứa một phiên và bản ghi chú mới nhất nên không thể khôi phục lịch sử mà v1 chưa từng lưu. Không dùng bản alpha như kho lưu trữ duy nhất của cuộc họp quan trọng.
- Dữ liệu phụ thuộc **trình duyệt + profile + origin**: `http://127.0.0.1:5173` khác `http://localhost:5173`, khác port và khác website được phát hành. Việc xóa dữ liệu trang web, dùng cửa sổ riêng tư hoặc chuyển sang máy mới có thể làm dữ liệu hiện không còn truy cập được. **Đừng xóa dữ liệu trình duyệt** trước khi xuất bản sao lưu cần thiết.
- Muốn kiểm tra cấu trúc lưu, mở DevTools → Application → Storage/IndexedDB/Origin Private File System (tên mục thay đổi theo phiên bản trình duyệt). Không nên tìm/di chuyển trực tiếp file bên trong thư mục hồ sơ Chrome của Windows, vì có thể làm hỏng dữ liệu.

- **Kiểm tra micro:** chọn thiết bị ở mục Micro đầu vào, bấm **Thử micro (15 giây)** và nói. Thanh tín hiệu di chuyển xác nhận có mẫu âm thanh; chỉ được nhận diện thiết bị nhưng không có tín hiệu không có nghĩa là giọng đã ghi được. Thử micro không lưu tệp và tự tắt sau 15 giây.
- **Nghe lại:** bộ phát ưu tiên giới hạn theo sample PCM đã commit, không báo lỗi khi phát đến hết tệp; nếu mốc thực sự nằm ngoài âm thanh đã ghi, ứng dụng từ chối liên kết nguồn không đúng. Có thể dùng nút **Lưu lại WAV vào Recording** nếu lần sao chép cục bộ thất bại, không cần ghi lại cuộc họp.

## Chuyển toàn bộ cuộc họp sang máy tính khác

1. Ở **máy A**, kết thúc mọi phiên ghi và chờ **Đã lưu**. Bấm **Sao lưu biên bản và ghi âm**, chọn thư mục lưu. Gói ZIP64 v2 ghi cả văn bản, các dấu `timeSpan`, lịch sử ghi chú và **mọi phiên WAV**, kèm manifest/CRC32/SHA256 và nhật ký mẫu G03. Xuất ghi chú không có audio cũng được.
2. Chép **chính file `.bbhop`** sang **máy B** (hoặc dùng tệp `.mochop` đã sao lưu từ bản cũ). Không cần chép `app/Recording` hay thư mục Chrome. Chạy **cùng bản G10** trên Chrome/Edge, chọn **Khôi phục biên bản từ tệp**.
3. Ứng dụng xác minh khai báo và checksum từng file theo luồng, tái lập file WAV vào OPFS và journal vào IndexedDB, kiểm đọc lại mẫu qua G03. **Chỉ khi thành công mới công bố biên bản mới**. Mã của cuộc họp, note và các bản ghi được cấp mới; các mốc chữ được đổi sang đúng recordingId mới. File nguồn/biên bản cũ không bị ghi đè.
4. Trong biên bản vừa nhập, bấm vào chữ của **mỗi** phiên để nghe lại; có thể gõ thêm và ghi âm mới. Nếu ZIP hỏng, thiếu WAV, giả mạo nguồn hoặc thiếu chỗ lưu, việc nhập thất bại và không hiện một cuộc họp khôi phục thiếu dữ liệu.
5. File **v1** do bản thử nghiệm G10 trước đây xuất cũng có thể nhập. Bản v1 chỉ chứa một phiên ghi và snapshot note mới nhất, nên các revision không tồn tại trong file v1 là không thể khôi phục. Với bản v2 mới, dùng tiếp chế độ v2 để có đủ lịch sử/đa phiên.

**Ranh giới nghiệm thu:** CI đã thử hai profile Chromium độc lập và các trường hợp âm thanh bị sửa; **không đồng nghĩa đã thử chuyển giữa hai máy tính vật lý, thiết bị ghi âm thật hay gói dữ liệu nhiều GiB**. Khi triển khai chính thức phải chạy thêm các bài này, và có bản sao lưu ngoài OPFS.
