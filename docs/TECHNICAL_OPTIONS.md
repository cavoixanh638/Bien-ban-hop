# ĐÁNH GIÁ VÀ LỰA CHỌN PHƯƠNG ÁN KỸ THUẬT — BIÊN BẢN HỌP V1.2

**Ngày nghiên cứu:** 15/11/2026  
**Phạm vi:** Giai đoạn 1 — WebApp ghi chú tự liên kết âm thanh, Windows Chrome/Edge.  
**Trạng thái:** **TECHNICAL REVIEW / CHƯA CÓ BENCHMARK**. Đây là tài liệu so sánh **3–4 phương án cho mỗi quyết định trọng yếu**, không phải kết quả thử nghiệm hay quyết định chốt công nghệ sản xuất.  
**Quản trị:** [PLAN_V1_2.md](PLAN_V1_2.md) là nguồn chính thức về yêu cầu và phạm vi; [ARCHITECTURE.md](ARCHITECTURE.md) về module/dữ liệu; [TIMELINE_RULES.md](TIMELINE_RULES.md) về hành vi mốc/IME; [AUDIO_DESIGN.md](AUDIO_DESIGN.md) về hợp đồng thu/phát; [STATUS.md](STATUS.md) về trạng thái thực tế, bằng chứng và quyết định đã được xác minh.

> **Quy tắc quan trọng:** “Đề xuất chọn” không có nghĩa “đã lập trình”, “đã kiểm chứng trên Windows” hay “đã PASS”. Các lựa chọn liên quan đến gõ tiếng Việt, audio dài, seek và recovery chỉ chính thức khi đạt thử nghiệm. Tài liệu này không mở rộng Giai đoạn 1 sang AI.

## 1. Bài toán cần giải quyết và thứ tự ưu tiên

Biên bản họp là **trình soạn thảo ghi chú có liên kết âm thanh tự động**, không phải phần mềm ghi âm có thêm ô nhập. Người dùng chỉ tập trung gõ như Word; một đoạn không Enter vẫn có nhiều mốc. Nghe lại từ chữ/con trỏ không cản trở sửa. Ghi âm nhiều giờ phải có thể khôi phục phần đã lưu, phát xuyên nhiều file như một nguồn, hoạt động offline và sao lưu ra ngoài trình duyệt.

**Thứ tự ưu tiên khi hai phương án xung đột:**
1. Không làm mất/sai **chữ hoặc mốc** và không phát nhầm nguồn audio.
2. Thu âm/lưu/khôi phục đáng tin cậy; trạng thái “đã lưu” trung thực.
3. Thao tác ít, nhập tiếng Việt tự nhiên, nghe lại và sửa thuận tiện.
4. Chạy offline Windows Chrome/Edge, không tài khoản/backend bắt buộc.
5. Dễ bảo trì, ít phụ thuộc; hiệu năng và dung lượng chấp nhận được.
6. Cho phép thay công nghệ thu/phát khi có bằng chứng tốt hơn.

**Khung đánh giá chung (trọng số định hướng, chưa chấm điểm định lượng):** tính đúng và an toàn dữ liệu 30%; UX ghi chú/nghe lại 25%; phù hợp Windows/offline 15%; đơn giản/bảo trì 15%; hiệu năng/dung lượng 10%; khả năng mở rộng 5%. Một giải pháp không đạt các điều kiện bắt buộc về đúng mốc, phục hồi hoặc gõ Việt sẽ bị loại dù tổng điểm có vẻ cao.

**Mức quyết định dùng trong tài liệu:**
- **DESIGN_PREFERRED:** ưu tiên thiết kế theo phân tích; chưa có test.
- **POC_REQUIRED:** phải có thử nghiệm trước khi chốt cho production.
- **CONDITIONAL:** chỉ bật/triển khai khi môi trường hỗ trợ hoặc có nhu cầu.
- **DEFERRED:** không làm trong V1.2 nếu không xuất hiện điều kiện buộc phải đổi.

## 2. Nền tảng chạy ứng dụng — so sánh 4 phương án

| Phương án | Lợi thế | Hạn chế/rủi ro | Nhận xét |
|---|---|---|---|
| **A. WebApp/PWA Chrome/Edge** | Không cần cài phần mềm, offline sau lần tải, dễ phát hành thử và cập nhật | Vòng đời tab, quyền micro, quota/cấp quyền browser, không ghi khi tab đóng | **DESIGN_PREFERRED** |
| B. Electron | Điều khiển file/tiến trình Windows thuận tiện hơn, có thể duy trì background bằng native process | Đóng gói, cập nhật, nhiều tài nguyên và bề mặt bảo trì | Dự phòng khi PWA không đạt |
| C. Tauri 2 | Gói desktop gọn và có API native, WebView2 Windows | Thêm Rust/plugin/native, môi trường build, quyền hệ thống | Dự phòng xa |
| D. Local server + trình duyệt | Backend file/DB cục bộ dễ kiểm soát | Phải cài và chạy server/port, tăng điểm lỗi, không còn trải nghiệm mở web đơn giản | Không ưu tiên |

**Đề xuất chọn:** A. Vì người dùng cần **một ứng dụng ghi chú Windows đơn giản**, không đăng nhập, không backend, dùng ngay trên Chrome/Edge. Quyết định này vẫn phụ thuộc nghiệm thu bản ghi 3 giờ, crash/recovery và offline.

**Ngưỡng xem xét lại:** Nếu PWA không thể đạt độ bền dữ liệu cần thiết dù đã thử OPFS/backup, mới đánh giá Electron/Tauri bằng PoC cụ thể, không đổi nền tảng chỉ do lo ngại lý thuyết.

Nguồn tham khảo: [PWA — web.dev](https://web.dev/learn/pwa/), [Electron](https://www.electronjs.org/docs/latest/), [Tauri 2](https://v2.tauri.app/).

## 3. Origin và nơi phát hành — so sánh 4 phương án

| Phương án | Thuận lợi | Rủi ro | Đề xuất |
|---|---|---|---|
| A. GitHub Pages dưới đường dẫn repo trong origin chung | Dễ triển khai nhất | Nhiều WebApp cùng host có **cùng origin**; đường dẫn không phải ranh giới an ninh cho IndexedDB/OPFS | Chỉ dùng demo không nhạy cảm |
| **B. GitHub Pages + tên miền/subdomain riêng** | Vẫn deploy tĩnh đơn giản, vùng lưu trữ tách theo origin riêng | Cần cấu hình DNS/HTTPS; di chuyển origin phải có kế hoạch backup/restore | **DESIGN_PREFERRED trước dữ liệu thật** |
| C. Static hosting khác với subdomain riêng | Tách origin và quản lý deploy | Thêm dịch vụ/tài khoản/quy trình | Thay thế tốt |
| D. Desktop/local origin riêng | Dữ liệu gắn ứng dụng cục bộ, không phụ thuộc Pages | Phải làm bản desktop hoặc local server | Chưa cần |

**Căn cứ lựa chọn B:** OPFS, IndexedDB và quyền browser được phân theo **origin (scheme + host + port)**, không phân theo thư mục dự án. Một site tại tên miền phụ riêng giúp tránh dùng chung origin với các WebApp Pages không liên quan. Nó **không thay thế** sao lưu, mã hóa thiết bị hoặc quản lý quyền truy cập máy.

**Ràng buộc SharedArrayBuffer:** Subdomain riêng chỉ cô lập IndexedDB/OPFS, **không tự bật cross-origin isolation**. SharedArrayBuffer truyền giữa ngữ cảnh cần chính sách COOP/COEP và `crossOriginIsolated`; GitHub Pages chuẩn không có cơ chế cấu hình HTTP response header tùy ý. Vì V1.2 chỉ cần transfer ArrayBuffer/MessageChannel và OPFS Worker, **không buộc SharedArrayBuffer hay đổi hosting vì tính năng này**. Nếu sau PoC cần SAB, mới đánh giá hosting cho phép đặt header (ví dụ Cloudflare Pages), kiểm tra phụ thuộc iframe/cross-origin và bảo mật.

**Điều kiện bắt buộc:** Không commit hoặc deploy ghi âm, bản sao lưu và dữ liệu cuộc họp lên Pages. Website Pages phải được xem là trang phát hành mã frontend, không phải nơi lưu dữ liệu người dùng. GitHub Pages của repository riêng tư **không mặc nhiên biến website thành riêng tư**. Nếu đổi origin sau khi có dữ liệu, phải có quy trình xuất và khôi phục; dữ liệu IndexedDB/OPFS không tự chuyển giữa origin.

Nguồn: [MDN — Origin](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy), [MDN — OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system), [GitHub Pages custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages), [About GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages).

## 4. Framework giao diện — so sánh 4 phương án

| Phương án | Ưu thế | Hạn chế | Kết quả |
|---|---|---|---|
| **A. React + TypeScript + Vite** | Hệ sinh thái lớn; tích hợp Tiptap, dễ kiểm thử, chia module | Dễ render dư nếu đẩy toàn bộ editor state vào React | **DESIGN_PREFERRED** |
| B. Vue 3 + TypeScript + Vite | Reactivity gọn, cũng có Tiptap integration | Không có ưu thế quyết định so với A trong trường hợp này | Thay thế tương đương |
| C. Svelte + TypeScript | Ít boilerplate, tối ưu UI nhỏ | Ít mẫu triển khai nghiệp vụ editor/audio dài hạn hơn | Không ưu tiên |
| D. TypeScript thuần | Ít framework | Tự quản lý nhiều trạng thái và lifecycle phức tạp | Không chọn |

**Căn cứ:** Phần khó của ứng dụng là thuật toán editor/audio, không phải đa dạng UI. React giúp tách các thành phần rõ, đồng thời không bắt buộc phải xây state management phức tạp.

**Ràng buộc thiết kế:** ProseMirror giữ quyền sở hữu text/selection/transactions. **Không** setState toàn bộ NoteDocument mỗi phím gõ; trạng thái recorder/playback/storage phải được tối ưu riêng. Chỉ render UI theo những thay đổi có ý nghĩa.

Nguồn: [Tiptap React](https://tiptap.dev/docs/editor/getting-started/install/react), [Vite](https://vite.dev/).

## 5. Editor — so sánh 4 phương án

| Phương án | Lợi thế cho Biên bản họp | Bất lợi | Kết luận |
|---|---|---|---|
| **A. Tiptap / ProseMirror** | Inline Mark có thuộc tính, schema, transaction/history, phù hợp từng vùng chữ gắn thời gian | Phải tự làm logic Mark khi thay/sửa/cut/paste/IME | **POC_REQUIRED, ưu tiên A** |
| B. Lexical | Custom TextNode/NodeState và React integration mạnh | Cần xây quy tắc clone/split/merge vùng chữ có metadata | Phương án thay thế số 1 |
| C. Slate | Model operations/transforms linh hoạt | Nhiều quy tắc editor phải kiểm soát hơn | Không ưu tiên |
| D. CodeMirror 6 | State transactions và decorations tốt, hiệu năng cao | Tối ưu mã/văn bản thuần, kém tự nhiên hơn khi soạn rich text như Word | Chỉ dùng nếu đổi sang plain text |

**Vì sao ưu tiên A:** Biên bản họp cần nội dung văn bản mang metadata thời gian **ngay bên trong câu**, độc lập với vị trí đoạn/DOM. ProseMirror Custom Mark phù hợp trực tiếp hơn việc tạo mô hình block note hoặc bảng offset độc lập.

**Nhưng:** Mark của ProseMirror **không tự bảo toàn 100%** khi mọi loại chỉnh sửa/IME. Tiptap phải vượt qua PoC nhập Việt thật và các transaction với Mark. Nếu số lỗi/chi phí sửa lớn, đối chứng bằng Lexical trước khi viết toàn bộ UI.

Nguồn: [ProseMirror schema và Mark](https://prosemirror.net/docs/ref/#model.MarkSpec), [Tiptap custom Mark](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/mark), [Lexical concepts](https://lexical.dev/docs/concepts/nodes), [Slate operations](https://docs.slatejs.org/concepts/05-operations), [CodeMirror reference](https://codemirror.net/docs/ref/).

## 6. Mô hình liên kết chữ–thời gian — so sánh 4 phương án

| Phương án | Lợi thế | Hạn chế | Kết luận |
|---|---|---|---|
| A. Chỉ mốc đầu đoạn/Enter | Ít dữ liệu, dễ lập trình | **Sai yêu cầu:** đoạn dài không có các mốc bên trong | Loại |
| B. Bảng from/to theo ký tự bên ngoài editor | Dễ truy xuất độc lập | Rất phức tạp khi insert/delete/move/Undo, dễ lệch | Không chọn làm nguồn chính |
| **C. Inline timeSpan Mark** | Text và thông tin liên kết di chuyển cùng tài liệu | Cần rõ quy tắc biên, stored marks, paste, IME | **POC_REQUIRED, ưu tiên C** |
| D. Event log từng phím rồi tái dựng mapping | Giữ toàn bộ lịch sử ban đầu | Phức tạp và tốn công tái dựng từ chữ sau khi chỉnh sửa | Chỉ làm journal hỗ trợ |

**Đề xuất:** timeSpan Mark lưu anchorId, recordingId, audioOffsetMs, typedAt, source, schemaVersion. Cấu hình thử MarkSpec: `inclusive: false`, `excludes: "timeSpan"` (làm rõ không chồng hai mốc cùng loại) và `spanning: true` (mặc định; quyết định bọc DOM, **không** tự gộp model TextNode). **Khi gộp một cụm, toàn bộ thuộc tính Mark — kể cả anchorId và typedAt — phải giống nhau; typedAt là lúc bắt đầu cụm, không phải đồng hồ riêng cho từng ký tự.** Một anchorId định danh mốc, không bắt buộc duy nhất cho mỗi mảnh text sau split. **Không lưu pending/valid/missing trong Mark** vì status thay đổi khi worker flush; tính trạng thái từ Audio Manifest và chỉ vẽ dấu hiệu qua decorations.

**Độ phân giải:** ưu tiên mốc theo từ/cụm ngắn, thử nhóm thao tác ở mức khoảng 0,5–2 giây tùy tốc độ gõ. Không đổi typedAt/audioOffsetMs cho từng ký tự nhưng vẫn kỳ vọng ProseMirror gộp Mark; kiểm thử độ phân mảnh/JSON/DOM khi gõ dài. Không chốt 1–2 giây khi chưa đo. Gộp để giảm JSON không được làm giảm khả năng tìm nghe lại.

**Quy tắc clipboard:** copy/cut/move trong cuộc họp giữ liên kết; paste từ ngoài không bịa thời điểm nói; paste sang Word không đưa metadata nội bộ nếu không cần; paste sang cuộc họp khác không tự trỏ tới nguồn audio sai.

Nguồn: [ProseMirror MarkSpec inclusive](https://prosemirror.net/docs/ref/#model.MarkSpec.inclusive), [Quy tắc riêng của dự án](TIMELINE_RULES.md).

## 7. Nhập tiếng Việt Unikey/EVKey — so sánh 4 phương án

| Phương án | Lợi thế | Điểm yếu | Kết luận |
|---|---|---|---|
| A. Chỉ composition events | Phù hợp IME chuẩn | Unikey/EVKey có thể thay chữ bằng chuỗi xóa/chèn, không bảo đảm composition | Không đủ |
| B. Chỉ keydown/Backspace | Đơn giản | Không thấy đầy đủ kết quả DOM/transaction, dễ bỏ sót | Không chọn |
| **C. Transaction diff + vùng từ đang gõ + dấu hiệu sự kiện** | Xử lý cả việc xóa/chèn nhanh và composition khi có | Phải viết state machine và regression tests | **POC_REQUIRED, ưu tiên C** |
| D. Ô nhập đệm/textarea tự xây rồi đổ vào editor | Kiểm soát nhập trước khi gắn Mark | Khó đồng bộ selection, rich text, cursor và accessibility | Dự phòng khi C không đạt |

**Cách làm C:** Theo dõi selection/vùng từ, text trước/sau transaction, beforeinput/input, composition (nếu có), cửa sổ thời gian sự kiện và thứ tự thay thế; nhận diện các lần đổi dấu trong từ vừa nhập để giữ anchor khởi đầu. Ngưỡng 30–50 ms chỉ là **tín hiệu hỗ trợ**, không phải luật tuyệt đối; không dùng filterTransaction từ chối các thao tác mà bộ gõ cần.

**Test bắt buộc:** Windows thật, Unikey/EVKey Telex/VNI, đổi dấu muộn (ví dụ “trường”, “tiếng”), gõ nhanh/chậm, gõ giữa Mark, định dạng, paste, Undo/Redo, tải CPU. Playwright nhập Unicode **không thay thế** test bộ gõ thật.

Nguồn: [MDN input events](https://developer.mozilla.org/en-US/docs/Web/API/InputEvent), [ProseMirror transactions](https://prosemirror.net/docs/ref/#state.Transaction), [TIMELINE_RULES.md](TIMELINE_RULES.md).

## 8. Bộ ghi âm — so sánh 4 phương án

| Phương án | Điểm mạnh | Hạn chế/rủi ro | Kết luận |
|---|---|---|---|
| A. MediaRecorder + WebM/Opus | Đơn giản, file nén nhỏ | Blob timeslice không mặc nhiên độc lập/seek được; remux/recovery phức tạp | **PoC đối chứng** |
| **B. AudioWorklet + PCM + Worker** | Kiểm soát khối mẫu, checkpoint, đường khôi phục | PCM lớn, cần backpressure, sample count và xử lý mất mẫu | **POC_REQUIRED, ưu tiên B** |
| C. AudioWorklet + WebCodecs AudioEncoder Opus | Kiểm soát đầu vào + nén tại chỗ | Encoder/container và timestamp/worker phức tạp hơn | Giai đoạn tối ưu sau |
| D. WASAPI/native desktop | Kiểm soát thiết bị, file và nền Windows | Đổi nền tảng; triển khai, cài đặt, bảo trì phức tạp | DEFERRED |

**Vì sao ưu tiên B:** Ghi chú nhiều giờ gắn mốc cần biết phần âm thanh nào **đã thu và lưu thực tế**. AudioWorklet có khả năng nắm số mẫu/khối tốt hơn cơ chế timeslice mang tính sự kiện của MediaRecorder. Nó cũng giúp tổ chức đoạn thô/checkpoint và phục hồi khi browser gặp sự cố.

**Không được khẳng định:** “AudioWorklet không mất mẫu”, “MediaRecorder chắc chắn mất vài trăm ms”, hay “WAV cập nhật header sau flush luôn hợp lệ 100%”. Có thể mất khối do tải, trục trặc thiết bị, crash giữa các thao tác ghi; flush **không** biến nhiều lần ghi thành giao dịch nguyên tử.

**Đường truyền ưu tiên PoC:** AudioWorklet gom các render quantum (thường 128 frame nhưng không hardcode), thử khối 2.048/4.096 frame trước khi gửi. Main Thread chỉ **chuyển giao MessageChannel hai đầu** khi khởi tạo: một port cấp cho WorkletProcessor qua `AudioWorkletNode.port`, port kia cấp cho Storage Worker; sau đó chuyển buffer bằng Transferable ArrayBuffer, pool hữu hạn, sequence/sample counters và xử lý queue chậm. **Không gán lại `AudioWorkletProcessor.port` mặc định** hoặc gọi postMessage từng 128 mẫu. Chưa cần SharedArrayBuffer/COOP-COEP. Chi tiết hợp đồng tại [AUDIO_DESIGN.md](AUDIO_DESIGN.md).

**Bộ thử lựa chọn:** cùng micro và phiên Windows Chrome/Edge, ghi 3 giờ, CPU/RAM/dung lượng, sample-drop/gap, pause/resume, kill tab, mất micro, hết quota, seek và recovery. Nếu A đáp ứng yêu cầu với đơn giản hơn B, có thể chọn A. Không làm hai engine production.

Nguồn: [MDN AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet), [MediaRecorder dataavailable](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/dataavailable_event), [WebCodecs AudioEncoder](https://developer.mozilla.org/en-US/docs/Web/API/AudioEncoder), [FileSystemSyncAccessHandle](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemSyncAccessHandle).

## 9. Định dạng audio và chính sách lưu lâu dài — so sánh 4 phương án

| Phương án | Chất lượng / dung lượng | Đặc tính | Kết luận |
|---|---|---|---|
| **A. PCM thô + metadata/checkpoint** | Không nén; lớn | Thuận lợi ghi nối tiếp và phục hồi theo số mẫu | **Ưu tiên lúc đang ghi** |
| B. WAV PCM theo đoạn | Không nén; lớn | File độc lập, dễ chia sẻ/seek | Ưu tiên khi hoàn tất từng đoạn |
| C. Ogg/Opus | Nén tốt cho tiếng nói | Cần bộ mã hóa + container và test timeline | Cân nhắc lưu lâu dài |
| D. WebM/Opus | Nén tốt, Chromium thuận lợi | Cần đảm bảo metadata, segment và seek | Đối chứng/định dạng nhập |

**Đề xuất hai tầng:** (1) lúc đang thu, lưu PCM và nhật ký theo khối/segment có thể phục hồi; (2) sau khi hoàn tất và **xác minh đúng số mẫu, thời lượng, giải mã**, mới có thể đóng gói WAV hoặc mã hóa Opus để giảm dung lượng. Không tự xóa PCM trước khi bản nén và mapping được nghiệm thu.

**Dung lượng tính toán (mono 16-bit chưa nén, 3 giờ):**
- 16 kHz ≈ 345,6 MB; 24 kHz ≈ 518,4 MB; 48 kHz ≈ 1.036,8 MB.
- Opus 48 kbps: ~64,8 MB trong 3 giờ trước container overhead.

Các số này là **lý thuyết**, không phải benchmark máy người dùng. Không giả định micro thu trực tiếp ở 16/24 kHz; cần đo sample rate thực và resampling nếu cần.

**Cổng:** xác minh đọc/seek/backup trên các segment đã hoàn tất, codec và dung lượng; nếu chưa có bộ nén đủ tin cậy thì giữ PCM/WAV, công bố quota và chính sách sao lưu.

## 10. Lưu trữ dữ liệu — so sánh 4 phương án

| Phương án | Ưu điểm | Hạn chế | Kết luận |
|---|---|---|---|
| A. Chỉ IndexedDB | Một hệ thống transaction cho cấu trúc | Không thuận tiện bằng OPFS khi append và phục hồi file audio lớn | Không ưu tiên |
| **B. IndexedDB + OPFS** | Dữ liệu cấu trúc và file audio dùng đúng công cụ; không server | Không có transaction atomic chung; cần journal/reconcile | **DESIGN_PREFERRED** |
| C. SQLite WASM + OPFS | SQL/truy vấn tốt, một core dữ liệu rõ | VFS/WASM, khóa, di trú, độ phức tạp chưa có lợi rõ | Không cần V1.2 |
| D. File trực tiếp trong thư mục Windows | Dễ thấy file và sao lưu | Quyền File System Access, chọn thư mục, browser differences | Bản xuất/sao lưu tùy chọn |

**Chọn B** vì cuộc họp có metadata/tài liệu nhỏ nhưng audio lớn. IndexedDB phù hợp transaction JSON/index; OPFS phù hợp file âm thanh và Worker. Phải có journal/manifest, committed coverage, kiểm tra sau crash; khi Mark còn mà file mất thì trạng thái link missing, **không** phát nhầm file cạnh bên.

**Bảo vệ:** theo dõi quota qua StorageManager.estimate(), yêu cầu persist nếu hỗ trợ, cảnh báo trước khi đầy; xóa dữ liệu website có thể xóa OPFS, nên bắt buộc hỗ trợ backup ra bên ngoài.

Nguồn: [MDN IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), [MDN OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system), [Storage quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

## 11. Bộ phát đa đoạn — so sánh 4 phương án

| Phương án | Ưu điểm | Rủi ro | Kết luận |
|---|---|---|---|
| **A. Hai HTMLAudioElement đọc trước, preservesPitch** | Giữ cao độ khi nghe chậm theo engine trình duyệt; không cần tự triển khai time-stretch; lấy File/Blob URL từ OPFS | Bắt đầu phần tử thứ hai có thể khựng, lặp hoặc thiếu mẫu; chưa bảo đảm sample-accurate | **PoC C1 ưu tiên về UX, không mặc định đạt** |
| **B. Web Audio API, lập lịch buffer PCM nhỏ** | Kiểm soát chính xác điểm biên và đồng hồ audio; không cần decode toàn bộ bản ghi | Thay tốc độ bằng playbackRate có thể đổi cao độ; phải giới hạn bộ đệm và lập lịch | **PoC C2 bắt buộc đối chứng** |
| C. AudioWorklet playback streaming | Có thể kiểm soát luồng mẫu và bộ nhớ cho PCM dài | Cần tự quản lý ring buffer, time-stretch và seek nếu yêu cầu | Dự phòng khi A/B không đạt |
| D. Media Source Extensions (MSE) | Thích hợp chuỗi segment có container/codec tương thích | Điều kiện codec/segment/mapping và cách phát thay tốc độ cần test | Ứng viên nếu lựa chọn âm thanh nén |

**Thay đổi thứ tự nghiên cứu:** Không mặc định B là engine phát chính. PoC C1 thử HTMLAudioElement đôi với `preservesPitch = true`, đọc trước segment kế tiếp và điều phối Virtual Timeline. PoC C2 thử AudioBufferSourceNode lập lịch các buffer PCM ngắn; đo cùng điều kiện với C1. Chỉ chốt production khi **đồng thời** đạt độ toàn vẹn âm thanh qua biên, seek chính xác, nghe chậm rõ và RAM có giới hạn.

**Cẩn trọng:** Hai thẻ `<audio>` không mặc nhiên gapless. Không crossfade 10–20 ms một cách vô điều kiện giữa hai segment vốn không chồng lấn mẫu, vì có thể hòa trộn hoặc làm mất thông tin lời nói. Không trộn HTMLAudioElement và AudioBufferSourceNode chỉ trong ±200 ms biên ở bản đầu: hai engine có clock/latency khác nhau, cần PoC riêng nếu thực sự cần.

**Bộ nhớ:** `decodeAudioData` cả một WAV mono Float32 5 phút/48 kHz cần ~57,6 MB (thập phân) chỉ cho sample Float32; không dùng cách này cho toàn bộ phiên ba giờ. Đọc trước theo cửa sổ/segment và giải phóng tài nguyên, đo peak RAM thực tế.

**Nghe chậm:** HTMLMediaElement.playbackRate thường được sửa cao độ theo `preservesPitch` (mặc định true), còn AudioBufferSourceNode.playbackRate resample và có thể làm giọng thấp đi. Phải đánh giá thực tế tại 0,75× và 0,9×; không triển khai WSOLA/Phase Vocoder tự viết ở V1.2 nếu chưa chứng minh bắt buộc.

**Test:** Phát 04:58→05:02 xuyên segment, seek 01:30:00/02:59:59, A–B xuyên file, file missing, nghe chậm, đo drop/duplicate sample/độ trễ, RAM đỉnh và chất lượng tiếng. Không tuyên bố “không có gap” khi chưa đo.

Nguồn: [MDN preservesPitch](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preservesPitch), [AudioBufferSourceNode playbackRate](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/playbackRate), [Media Source Extensions](https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API), [AUDIO_DESIGN.md](AUDIO_DESIGN.md).

## 12. Đồng hồ và ánh xạ mốc gõ ↔ âm thanh — so sánh 4 phương án

| Phương án | Ưu điểm | Vấn đề | Kết luận |
|---|---|---|---|
| A. Chỉ dùng Date.now() | Dễ lấy ngày giờ nhập | Đồng hồ hệ điều hành có thể bị đổi; không phản ánh pause và mẫu audio thực | Loại |
| B. Chỉ dùng performance.now() | Đồng hồ đơn điệu, phù hợp xác định thứ tự và độ trễ nhập | Chưa có ánh xạ tới sample thực, không biết gap/lost audio | Chưa đủ |
| C. Chỉ dùng AudioContext.currentTime | Gần engine âm thanh, hữu ích cho lịch phát | Không tự cho biết mẫu nào đã được ghi bền vững; trạng thái pause/suspend cần xử lý | Chưa đủ |
| **D. Đồng hồ đơn điệu + điểm đồng bộ mẫu/segment** | Biết lúc nhập và biết audio nào đã thu/lưu; có thể biểu diễn gap/pause | Phải thiết kế mapping points và đo drift | **POC_REQUIRED, ưu tiên D** |

**Đề xuất D:** Ghi dấu thời gian đơn điệu gần lúc nhận thao tác nhập; Capture Module tạo các điểm hiệu chuẩn liên kết đồng hồ đơn điệu với **vị trí mẫu/khối âm thanh thực tế**; Audio Manifest xác nhận vùng đã lưu thành công. Timeline tính vị trí media từ các điểm đồng bộ, có khoảng recorded/paused/gap rõ ràng. Wall time chỉ dùng cho ngày giờ cuộc họp và lịch sử.

**Tại sao cần cho Biên bản họp:** Người dùng gõ sau khi nghe, tạm dừng rồi gõ tiếp hoặc có thể bị mất micro giữa cuộc họp. Một đồng hồ hệ thống đơn thuần không đủ bảo đảm nhấp chữ sẽ về **đúng file và đúng khoảng âm thanh**. Phải phân biệt vị trí mốc gốc với điểm bắt đầu phát có pre-roll.

**Kiểm thử:** ghi tín hiệu beep/tick theo mốc tham chiếu, gõ ở đầu/giữa/cuối bản ghi 3 giờ, pause/resume, mô phỏng chỉnh giờ Windows và mất mẫu. Mục tiêu sai lệch trong test chuẩn ≤1 giây, không đồng nhất với độ chính xác xác định thời điểm phát biểu.

Nguồn: [Performance.now](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now), [AudioContext.currentTime](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/currentTime), [TIMELINE_RULES.md](TIMELINE_RULES.md), [ARCHITECTURE.md](ARCHITECTURE.md).

## 13. Sao lưu và khôi phục — so sánh 4 phương án

| Phương án | Lợi thế | Rủi ro | Kết luận |
|---|---|---|---|
| A. fflate streaming ZIP/Unzip | Một thư viện có cả tạo và giải ZIP theo luồng | API push cần backpressure; phải đo buffer/ZIP64 và restore thật | **Ứng viên PoC D** |
| B. client-zip streaming + thư viện đọc ZIP | Hợp với export STORE lớn, ReadableStream và ZIP64 | Không có unzip đi kèm; thêm phụ thuộc và pipeline nhập | **Ứng viên PoC D (export)** |
| C. zip.js ZipWriter/ZipReader | Một thư viện cho đọc/ghi, có ZIP64, hỗ trợ truy cập entry theo Central Directory với nguồn thích hợp | API/worker/cache và mức RAM thực phải thử nghiệm | **Ứng viên PoC D (export + import)** |
| D. JSZip thông thường | Dễ sử dụng, có hệ sinh thái rộng | Luồng generateAsync thông dụng có thể giữ kết quả lớn trong RAM | Chỉ baseline đối chứng; không ưu tiên file lớn |

**Chưa chốt thư viện.** So sánh A/B/C trên cùng file .mochop chứa hàng trăm segment audio, với file 0,5–2 GB; D là baseline. Ưu tiên một giải pháp vừa xuất vừa nhập thực, có **mức RAM tăng được khống chế**, giữ checksum/mapping và ít mã tự viết nhất. Không suy luận “fflate.Unzip luôn nạp toàn bộ file” vì thư viện có cơ chế streaming; **nhưng streaming không tự bảo đảm backpressure**.

**Export:** Đọc mỗi file audio từ OPFS theo chunk và nối sang writer của gói ZIP qua WritableStream/đích lưu. Tốc độ đọc/ZIP phải bị giới hạn bởi tốc độ ghi (backpressure), không push đồng loạt rồi để pending writes đầy RAM. Với audio nén dùng STORE khi phù hợp; theo dõi ZIP64 khi gói lớn.

**Import:** File được người dùng chọn cho phép `slice(start, end)` để đọc phần cần thiết; một ZIP reader thích hợp có thể tra Central Directory/ZIP64 và truy cập từng entry, thay vì đọc cả gói vào RAM. Nếu dùng streaming unzip thì phải giới hạn hàng đợi và giải nén từng entry xuống vùng OPFS tạm. Cả hai đường đều phải kiểm tra path traversal/ZIP slip, size bom nén, checksum, schema, trùng id và dữ liệu chưa hoàn chỉnh trước khi nhập chính thức.

**Không cam kết dưới 10 MB RAM cho gói 2 GB hoặc tốc độ 1–2 giây** trước phép đo: bộ nhớ giải nén/checksum/write phụ thuộc chunk, thư viện và trình duyệt. Tiêu chí đúng là **RAM được giới hạn và không tăng gần tuyến tính theo dung lượng gói**.

Nguồn: [fflate](https://github.com/101arrowz/fflate), [client-zip](https://github.com/Touffy/client-zip), [zip.js](https://gildas-lormeau.github.io/zip.js/), [JSZip](https://stuk.github.io/jszip/).

## 14. Xuất Word/DOCX — so sánh 4 phương án

| Phương án | Ưu điểm | Hạn chế | Đề xuất |
|---|---|---|---|
| **A. docx (JavaScript)** | Sinh DOCX thực, hỗ trợ đoạn/heading/list/style, xuất trên browser | Cần mapper từ ProseMirror JSON sang DOCX | **DESIGN_PREFERRED** |
| B. HTML → DOCX | Nhanh khi nội dung đơn giản | Tương thích/định dạng có thể không ổn định | Đối chứng |
| C. Xuất HTML mở bằng Word | Ít mã | Không phải DOCX chuẩn trong mọi trường hợp | Không chọn |
| D. Backend/Pandoc/LibreOffice | Mạnh với chuyển đổi phức tạp | Phải có môi trường ngoài trình duyệt | DEFERRED |

**Chọn A** vì V1.2 chỉ cần chữ, tiêu đề, bold/italic, danh sách và tùy chọn hiện mốc. DOCX là bản văn bản sử dụng bên ngoài, **không** được tuyên bố giữ tương tác bấm chữ phát audio. Backup đầy đủ nằm trong .mochop.

Nguồn: [docx.js](https://docx.js.org/).

## 15. Thu âm cuộc họp online — so sánh 4 phương án

| Phương án | Đặc tính | Giới hạn | Quyết định |
|---|---|---|---|
| **A. getUserMedia micro** | Họp trực tiếp, đơn giản | Tai nghe có thể khiến micro không thu được tiếng phía bên kia | Must |
| B. getDisplayMedia audio + AudioContext trộn micro | Thu âm thanh tab/cửa sổ/màn hình khi được cấp track | Cần chọn nguồn, audio track không phải lúc nào có, có thể trùng âm | **CONDITIONAL** |
| C. Windows WASAPI Loopback native | Thu audio hệ thống mạnh hơn | Phải chuyển nền tảng desktop/native | DEFERRED |
| **D. Nhập file họp có sẵn** | Chắc chắn có nội dung âm thanh nếu file hợp lệ | Phụ thuộc người dùng có bản ghi | **Must (bổ sung A)** |

**Lựa chọn:** micro trực tiếp + nhập file là nền tảng bắt buộc. Thu online bằng getDisplayMedia là tùy chọn khi browser/OS cấp audio; không để việc không có track ngăn chức năng ghi chú micro. Nếu bổ sung, test Zoom/Teams/Meet, tai nghe, quyền, dừng nguồn, độ lệch và lặp âm.

Nguồn: [getDisplayMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia), [getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

## 16. Điều phối đa tab — so sánh 4 phương án

| Phương án | Ưu điểm | Nhược điểm | Đề xuất |
|---|---|---|---|
| A. Cờ trong localStorage | Dễ code | Dễ kẹt cờ/sai trạng thái nếu crash; race | Không chọn |
| B. Khóa tự viết trong IndexedDB | Có thể lưu lease, timeout | Tự xử lý race, crash, stale lease | Chỉ fallback |
| **C. Web Locks + BroadcastChannel** | Khóa độc quyền theo tên meeting và thông báo tab khác | Không thay thế xác nhận lưu, cần quy tắc takeover/UI | **DESIGN_PREFERRED** |
| D. Cho nhiều tab tự ghi | Không phải lập trình khóa | Có thể ghi đè NoteDocument/manifest | Loại |

**Chọn C:** chỉ một tab writer theo cuộc họp. Tab thứ hai hiển thị chế độ read-only hoặc lựa chọn mở khác; không chờ lock không giới hạn. Sau crash phải reconcile journal/manifest trước khi cho tab khác tiếp tục.

Nguồn: [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API), [BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel).

## 17. Offline/PWA và cập nhật — so sánh 4 phương án

| Phương án | Điểm mạnh | Rủi ro | Kết luận |
|---|---|---|---|
| A. Không Service Worker, chỉ trang tĩnh | Đơn giản | Không bảo đảm mở khi offline | Loại |
| B. Workbox generateSW tự động | Ít mã, cache dễ | Không kiểm soát đủ chi tiết nếu cập nhật/app lifecycle phức tạp | Ứng viên |
| **C. Workbox injectManifest hoặc Service Worker kiểm soát chủ động** | Đặt quy tắc update và recovery theo vòng đời phiên ghi | Cần viết và test update/caching | **DESIGN_PREFERRED có điều kiện** |
| D. Offline bundling bằng ứng dụng desktop | Không phụ thuộc SW | Phải chuyển nền tảng | DEFERRED |

**Chọn chiến lược C khi triển khai PWA:** asset JS/CSS hash theo version; HTML cần cơ chế revalidate khi online, fallback offline; không tự skipWaiting/reload khi đang thu âm. Nếu quy tắc generateSW đơn giản **được chứng minh** vẫn không gián đoạn thu thì B có thể tốt hơn. Phải kiểm tra base path GitHub Pages, SW scope và migration schema.

Nguồn: [Service Worker lifecycle](https://web.dev/learn/pwa/update), [Workbox](https://developer.chrome.com/docs/workbox/), [Vite PWA](https://vite-pwa-org.netlify.app/).

## 18. Kiểm thử — so sánh 4 phương án

| Phương án | Điểm mạnh | Hạn chế | Kết luận |
|---|---|---|---|
| **A. Vitest + Playwright + Windows thực** | Unit/logic, browser E2E và kiểm thử IME thật | Cần test fixtures và môi trường Windows | **DESIGN_PREFERRED** |
| B. Jest + Cypress | Hệ sinh thái mạnh | Không có lợi thế rõ hơn với Vite/ứng dụng này | Thay thế |
| C. Chỉ Playwright | Một framework | Các thuật toán thuần khó chạy regression nhanh | Không tối ưu |
| D. Chỉ thử thủ công | Bắt đầu nhanh | Không bảo vệ khỏi lỗi chỉnh Mark/gap/backup sau sửa code | Loại |

**Chọn A** và bổ sung test theo thuộc tính cho editor transaction (chuỗi insert/delete/paste/Undo ngẫu nhiên). Bài thử tự động gõ tiếng Việt không thay thế test **Unikey/EVKey thật**. Kiểm thử audio dựa tín hiệu chuẩn/đếm mẫu, không chỉ đồng hồ UI.

**Gắn với TC01–TC38:** [ACCEPTANCE_TESTS.md](ACCEPTANCE_TESTS.md). Mọi PASS phải có commit, môi trường, file thử tổng hợp, log và phép đo; trước test kết quả mặc định NOT_RUN.

Nguồn: [Vitest](https://vitest.dev/), [Playwright](https://playwright.dev/).

## 19. Bảng khuyến nghị tổng hợp

| Hạng mục | Phương án ưu tiên | Trạng thái trước triển khai | Điều kiện để chốt |
|---|---|---|---|
| Nền tảng | PWA Chrome/Edge | DESIGN_PREFERRED | 3 giờ, offline, recover thực |
| Origin | Subdomain riêng (GitHub Pages hoặc hosting tĩnh) | DESIGN_PREFERRED | Cấu hình HTTPS/origin tách biệt trước dữ liệu thật |
| Frontend | React + TypeScript + Vite | DESIGN_PREFERRED | Test build/performance |
| Editor | Tiptap/ProseMirror | **POC_REQUIRED** | Unikey/EVKey và Mark edit/Undo đạt |
| Mark | timeSpan trực tiếp trong NoteDocument | **POC_REQUIRED** | Không sai mốc qua split/paste/move |
| Nhập liệu | Transaction diff + vùng từ | **POC_REQUIRED** | Trace Windows thật |
| Capture | AudioWorklet + PCM/Worker | **POC_REQUIRED** | Đối chứng MediaRecorder 3 giờ/crash |
| Định dạng khi ghi | PCM thô + metadata/checkpoint | **POC_REQUIRED** | Đo mất mẫu và phục hồi |
| Lưu dài hạn | WAV trước; Opus khi đã xác minh | CONDITIONAL | Mapping, codec/seek/quality/quota |
| Storage | IndexedDB + OPFS | DESIGN_PREFERRED | Crash reconciliation/quota/restore |
| Clock mapping | Đồng hồ đơn điệu + điểm đồng bộ khối/mẫu | **POC_REQUIRED** | Sai lệch mốc/độ trôi/gap/pause thực |
| Playback | PoC C1 HTMLAudioElement preservesPitch vs C2 Web Audio buffer PCM | **POC_REQUIRED** | Seek, biên, không mất/lặp nội dung, giọng tự nhiên ở 0,75×/0,9× |
| Backup | So sánh fflate, client-zip và zip.js | **POC_REQUIRED** | Backpressure, ZIP64, random-access/stream restore, checksum, bounded RAM |
| DOCX | docx.js | DESIGN_PREFERRED | Xuất chuẩn tiếng Việt/list/format |
| Online audio | getDisplayMedia khi có track | CONDITIONAL | Windows/browser/app compatibility |
| Multi-tab | Web Locks + BroadcastChannel | DESIGN_PREFERRED | Crash/lock/reopen test |
| PWA update | SW có kiểm soát phiên ghi | DESIGN_PREFERRED | Update không ngắt thu, migration |
| Tests | Vitest + Playwright + Windows thật | DESIGN_PREFERRED | CI + trace/test bằng chứng |

**Quan trọng:** Bảng này là **khuyến nghị thiết kế**; không được đổi trạng thái Gói 1.1–1.6 thành PASS. Nếu một bài đo phủ định lựa chọn, phải cập nhật bảng này, tài liệu thiết kế liên quan và [STATUS.md](STATUS.md) kèm số liệu.

## 20. Bốn gói PoC tối thiểu để chốt kiến trúc

### PoC A — Editor/IME/Mark (ưu tiên làm đầu tiên)

- So sánh Tiptap và (nếu cần) Lexical với các chuỗi gõ/sửa.
- Gõ 2 phút không Enter vẫn sinh nhiều mốc; Unikey/EVKey Telex/VNI thật; đổi dấu muộn, cut/paste, Undo/Redo, marks đậm/nghiêng.
- Kiểm tra sai/mất link, độ trễ nhập P95 <100ms trên máy được ghi cấu hình, kích thước JSON, clipboard nguồn ngoài.
- **Pass gate:** không còn lỗi nghiêm trọng mất chữ/sai link trong các kịch bản cốt lõi; có trace và commit.

### PoC B — Thu/lưu/khôi phục 3 giờ

- Đối chiếu AudioWorklet PCM với MediaRecorder trên cùng nguồn tín hiệu/máy.
- Đo sample count, missing/gap, CPU/RAM/quota, file âm thanh và thời điểm đã flush; mô phỏng đóng tab, micro ngắt, hết dung lượng, pause/resume.
- **Pass gate:** bản ghi đầu-giữa-cuối phát/tua được, phần đã commit còn đọc được, gap rõ; mục tiêu lệch mốc ≤1 giây trong thử chuẩn.

### PoC C — Player và chất lượng nghe lại

- Phát qua boundary (ví dụ 04:58→05:02), seek phút 90/170, A–B xuyên file, file missing, tốc độ 0,75×/0,9×.
- So sánh C1 (hai HTMLAudioElement đọc trước, preservesPitch) với C2 (Web Audio scheduled PCM nhỏ); không dùng crossfade hoặc engine lai để che lỗi chưa đo.
- **Pass gate:** không mất/lặp âm bất thường; nghe chậm đủ rõ; không load cả bản ghi vào RAM.

### PoC D — Backup, restore, PWA và an toàn origin

- Gói nhiều file lớn, đo 3 thư viện fflate/client-zip/zip.js với backpressure và ZIP64, checksum, random-access hoặc streaming restore sang môi trường khác, đo peak RAM và quota.
- Thử Web Locks hai tab, SW update khi đang thu và migration; kiểm tra origin riêng.
- **Pass gate:** khôi phục liên kết và audio đúng; update không cắt phiên ghi; không báo saved sai.

Kết quả của mỗi PoC phải có **môi trường, commit, log, phép đo và kết luận PASS/FAIL/HOLD**. Chỉ [STATUS.md](STATUS.md) quản lý trạng thái thực tế; không tạo thêm một hệ thống điều phối riêng.

## 21. Ranh giới quyết định và việc không làm

- **Không phát triển sớm** AI chép lời/người nói/tóm tắt/soạn biên bản, backend/cloud/login.
- **Không chuyển ngay** sang Electron/Tauri/SQLite chỉ vì đó là lựa chọn mạnh hơn trong bài toán khác.
- **Không ưu tiên chỉ số lý thuyết** thay bài thử. Số liệu dung lượng PCM là phép tính; chất lượng ghi, phục hồi, latency, tiếng chậm và thời điểm tua vẫn chưa đo.
- **Không ép tất cả thành một file audio lớn** hoặc ngược lại giả định nhiều Blob timeslice đều phát được.
- **Không nâng cao tính tiện dùng bằng cách làm sai mốc**: người dùng muốn gõ như Word trước, nghe lại với pre-roll sau.
- **Không làm nổ số lượng tài liệu**: file này chỉ lưu **so sánh, căn cứ và khuyến nghị**; kiến trúc/how-to ở ARCHITECTURE/AUDIO_DESIGN/TIMELINE_RULES, tiến độ/bằng chứng ở STATUS.

**Ghi chú triển khai:** truyền `MessageChannel + Transferable ArrayBuffer` là đường ưu tiên không yêu cầu SharedArrayBuffer/crossOriginIsolated; phải đo buffer backpressure. `playback_paused` có độ lùi đề xuất **5 giây**, thử các mức 0/3/5/10 giây với người dùng; mốc gốc không đổi.

**Kết luận:** Hướng thiết kế ưu tiên là **PWA origin riêng + React/TypeScript + Tiptap/timeSpan + IndexedDB/OPFS + AudioWorklet/PCM thử nghiệm + Virtual Multi-Segment Player + backup streaming**. Trong đó, **editor/IME, capture audio và player là ba quyết định tuyệt đối không được chốt production nếu chưa có PoC**.

---

*Ghi chú về nguồn: các liên kết trong từng mục dẫn tới tài liệu chính thức hoặc repository của công nghệ để đối chiếu cơ chế. Đây là nghiên cứu tài liệu và lập luận kiến trúc; không có thử nghiệm nào trên máy Windows của người dùng trong lượt cập nhật này.*
