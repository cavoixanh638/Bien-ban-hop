# G10 — Ứng dụng Mốc Họp V1.2 tích hợp thử nghiệm

**Trạng thái:** `INTEGRATION_ALPHA`, **không** phải bản phát hành và **không** có bằng chứng nghiệm thu TC01–TC38. Được dựng trên nhánh `integration/20261115-g10-v1.2`, giữ nguyên `main` và chín nhánh PoC. Không sử dụng dữ liệu họp quan trọng cho đến khi qua cổng Windows và kiểm thử crash/quota/restore.

## Khởi chạy trên Windows (GitHub Desktop)

1. Checkout nhánh `integration/20261115-g10-v1.2`.
2. Mở Terminal trong thư mục repo, chạy:

```powershell
cd app
node --version
npm install
npm run test
npm run build
npm run dev
```

3. Mở **http://127.0.0.1:5173/** trên Chrome hoặc Edge. Cấp quyền **micro** chỉ khi bắt đầu ghi âm. Node.js >=20.
4. Nhấn **Bắt đầu ghi**, gõ ghi chú ngay vào trang giấy; không phải nhập mã mốc. Sau khi dừng, nhấp vùng chữ có gạch xanh để nghe. `Alt+Enter` nghe mốc tại con trỏ; `Esc` dừng phát. Ghi chú tự lưu với revision, báo "Đã lưu" chỉ sau IDB transaction hoàn tất.
5. Có thể tạo/chuyển cuộc họp, đổi tên, sử dụng hai tab (chỉ một tab giữ writer lock), xuất DOCX/TXT/MD/CSV, thử sao lưu `.mochop` qua File System Access API sau khi dừng ghi. **Chưa có chức năng khôi phục backup vào cùng kho ứng dụng**.

## Kiến trúc thực tế của bản này

- **G01:** `InputTracker`, `timeSpan`, `PendingLinkJournal`, Tiptap Editor thật; không nhúng status động vào Mark.
- **G02:** `capture-processor.js` AudioWorklet 4096 frame, 32 buffer, transferable `MessagePort`; `CaptureClockMapper` dùng AudioContext render timestamp, chưa hiệu chuẩn độ trễ phần cứng micro.
- **G03:** `worker.mjs` OPFS/IndexedDB journal; chunk ACK chỉ trả buffer, flush+journal ACK mới cấp `committedThroughSampleExclusive`. Mốc pending chỉ finalize khi frame nằm dưới watermark đã commit. Bộ nối `app/src/clock-bridge.mjs` kiểm meeting/recording/generation/interval cùng sample→ms.
- **G04/G05:** Timeline nguồn được xác thực qua `poc/05-player/timeline.js`; `AudioPlayer` lập lịch các cửa sổ PCM nhỏ lấy từ `G03.seek`, không tự phát segment gần nhất. Đây là **bộ phát alpha dạng C2**, **chưa chứng minh sample-gapless hoặc giữ cao độ giọng ở 0,75×/0,9×**; PoC G04 TypeScript sẽ phải nối thêm để có meeting timeline đầy đủ.
- **G06:** `NotesRepository` + adapter `MeetingStore` ghi note và pending sidecar trong **một** IDB transaction, CAS revision và lease kiểm trước+trong transaction. `SaveQueue` single-flight, không báo saved khi còn edit dirty.
- **G07:** `exportMochop` ZIP64 streaming sau flush; duy nhất **1 recording/meeting** trong bản alpha, dùng Native File System Access; không gom file nhiều GB vào RAM. **Chưa có restore** và chưa chốt ZIP thư viện D13.
- **G08:** xuất bốn định dạng, chọn có/không mốc thời gian.
- **G09:** Web Locks độc quyền writer từng cuộc họp; Service Worker shell chỉ cache asset app, giữ activation dưới origin-wide maintenance lock, không cache audio/notes. Chạy PWA ở production HTTPS, localhost Vite dev không đăng ký SW.

## Bài kiểm thử thực tế

- `node --test app/tests/core.test.mjs`: hợp đồng 11 ca cho atomic note+pending, revision/lease, failed save, source/generation mismatch, pending sample sau durable ACK, meeting vs media. Có CI Linux/Windows.
- `npm run build`: bundle Vite/Tiptap/worker. Có CI Linux/Windows.
- `npm run test:e2e`: Playwright Chromium localhost với fake microphone: khởi động, ghi/chỉnh sửa/lưu/reload, hai tab khóa writer, capture PCM→OPFS→note→playback ngắn. **Fake micro không thay thế cuộc họp thật/IME thật**.
- CI tại `.github/workflows/g10-verify.yml` **không** deploy, chạy mã G10 và unit các PoC. Cần xem kết quả đúng SHA trước khi báo PASS.
- Sau browser smoke cần **Windows** UniKey/EVKey × Telex/VNI trong 120 giây, ghi **3 giờ thật**, Pause/Resume/mất micro/quota/kill browser, nghe 04:58→05:02 và 90/170 phút, kiểm ZIP 0,5–2 GB/máy thứ hai, Word/Excel thực, PWA offline/update/migration. Tất cả vẫn **NOT_RUN** khi chưa có log.

## Ranh giới dữ liệu và rủi ro

- Cần HTTPS hoặc localhost; `navigator.locks` thiếu ⇒ **read-only fail closed**, không dùng fallback mất an toàn.
- OPFS/IndexedDB nằm trong **origin**; localhost với port khác hoặc đổi sang website khác là kho khác. Không lưu dữ liệu họp thật trên origin dùng chung `*.github.io`.
- Sau lỗi quota/commit, UI giữ dirty content và từ chối chuyển cuộc họp; người dùng cần xuất văn bản để tự bảo toàn nếu không khôi phục được quota. Browser không thể bảo đảm không mất vài giây dữ liệu khi thiết bị bị mất nguồn đột ngột.
- G10 giữ 9 PoC nguồn tham chiếu dưới `poc/` để truy vết SHA; đây **không** phải merge chín nhánh Git, chỉ sao chép Git tree vào nhánh mới. Một chỉnh sửa portable UTF-8 ở `poc/07-backup/interop-check.py` được làm riêng trong nhánh G10 để CI Windows chạy được, nhánh gốc G07 không bị thay.
- Khôi phục `.mochop` về Notes/OPFS chung và backup nhiều recording, phát khi đang ghi, hiệu chuẩn micro hardware latency, kết nối G04 full meeting timeline, migrate IDB bản production, và UX/QA Windows là **việc chưa xong**, không diễn giải từ mẫu thử.

## File ghi âm được lưu ở đâu?

- Âm thanh luôn được ghi trước vào OPFS. **Khi chạy bằng `app/START_WINDOWS.cmd` (Vite localhost), bấm Kết thúc sẽ tự động sao chép từng đoạn WAV hoàn chỉnh vào `app/Recording/<recordingId>/seg-<sample>.wav` trên ổ đĩa Windows**. Thư mục được tạo khi lưu và được `.gitignore` để không vô tình đưa âm thanh lên GitHub. Nếu ứng dụng chạy bằng bản PWA/website, trình duyệt không được ghi trực tiếp vào thư mục dự án; trong trường hợp đó bản ghi vẫn nằm ở OPFS. Ứng dụng lưu WAV bên trong **Origin Private File System (OPFS)** của Chrome/Edge cho đúng địa chỉ web hiện tại. Đường dẫn nội bộ ở dạng `<recordingId>/seg-<firstSample>.wav`; mỗi segment tối đa khoảng **5 phút** (cấu hình `segmentSeconds: 300`). Đây là các WAV Float32 PCM; trình duyệt quản lý vị trí tệp vật lý trong hồ sơ người dùng.
- **IndexedDB** riêng lưu manifest/journal của âm thanh (tên database `mochop-opfs-poc-v1`) và ghi chú/cuộc họp (database `mochop-g10-v1`). Nút **Kết thúc** đợi flush/journal; ACK nhận buffer sớm không được tính là đã lưu bền vững.
- Muốn có gói sao lưu **di chuyển được sang máy khác**, sau khi dừng ghi chọn **Sao lưu .mochop (ZIP streaming)**. Tự lưu WAV trong `app/Recording` và sao lưu `.mochop` là hai chức năng khác nhau. Tệp `.mochop` chứa âm thanh và dữ liệu cuộc họp, **không phải tệp WAV đơn lẻ**. Bản alpha hiện chỉ cho sao lưu khi cuộc họp có **đúng một bản ghi âm** và **chưa hỗ trợ khôi phục `.mochop` vào ứng dụng**. Không dùng bản alpha như kho lưu trữ duy nhất của cuộc họp quan trọng.
- Dữ liệu phụ thuộc **trình duyệt + profile + origin**: `http://127.0.0.1:5173` khác `http://localhost:5173`, khác port và khác website được phát hành. Việc xóa dữ liệu trang web, dùng cửa sổ riêng tư hoặc chuyển sang máy mới có thể làm dữ liệu hiện không còn truy cập được. **Đừng xóa dữ liệu trình duyệt** trước khi xuất bản sao lưu cần thiết.
- Muốn kiểm tra cấu trúc lưu, mở DevTools → Application → Storage/IndexedDB/Origin Private File System (tên mục thay đổi theo phiên bản trình duyệt). Không nên tìm/di chuyển trực tiếp file bên trong thư mục hồ sơ Chrome của Windows, vì có thể làm hỏng dữ liệu.

- **Kiểm tra micro:** chọn thiết bị ở mục Micro đầu vào, bấm **Thử micro (15 giây)** và nói. Thanh tín hiệu di chuyển xác nhận có mẫu âm thanh; chỉ được nhận diện thiết bị nhưng không có tín hiệu không có nghĩa là giọng đã ghi được. Thử micro không lưu tệp và tự tắt sau 15 giây.
- **Nghe lại:** bộ phát ưu tiên giới hạn theo sample PCM đã commit, không báo lỗi khi phát đến hết tệp; nếu mốc thực sự nằm ngoài âm thanh đã ghi, ứng dụng từ chối liên kết nguồn không đúng. Có thể dùng nút **Lưu lại WAV vào Recording** nếu lần sao chép cục bộ thất bại, không cần ghi lại cuộc họp.
