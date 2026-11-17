# G10 — Ứng dụng Biên bản họp V1.2 tích hợp thử nghiệm

**Tên hiển thị và tên file xuất:** Biên bản họp / `bien-ban-hop-<meetingId>`. Đuôi sao lưu `.mochop`, format ID `mochop` và kho IndexedDB/OPFS nội bộ được giữ nguyên để tương thích dữ liệu đã tạo; đây không phải tên hiển thị sản phẩm.

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
4. Nhấn **Bắt đầu ghi**, gõ ghi chú ngay vào trang giấy; không phải nhập mã mốc. Sau khi dừng, nhấp đoạn chữ có gắn mốc để nghe. `Alt+Enter` nghe mốc tại con trỏ; `Esc` dừng phát. Ghi chú tự lưu với revision, báo "Đã lưu" chỉ sau IDB transaction hoàn tất.
5. Có thể tạo/chuyển cuộc họp, đổi tên, sử dụng hai tab (chỉ một tab giữ writer lock), xuất DOCX/TXT/MD/CSV, **Xuất toàn bộ cuộc họp (.mochop)** và **Nhập cuộc họp từ máy khác (.mochop)**. Khi nhập, chương trình kiểm tra checksum rồi tạo ID cuộc họp, ghi chú và phiên thu mới; không ghi đè cuộc họp đang có.

## Kiến trúc thực tế của bản này

- **G01:** `InputTracker`, `timeSpan`, `PendingLinkJournal`, Tiptap Editor thật; không nhúng status động vào Mark.
- **G02:** `capture-processor.js` AudioWorklet 4096 frame, 32 buffer, transferable `MessagePort`; `CaptureClockMapper` dùng AudioContext render timestamp, chưa hiệu chuẩn độ trễ phần cứng micro.
- **G03:** `worker.mjs` OPFS/IndexedDB journal; chunk ACK chỉ trả buffer, flush+journal ACK mới cấp `committedThroughSampleExclusive`. Mốc pending chỉ finalize khi frame nằm dưới watermark đã commit. Bộ nối `app/src/clock-bridge.mjs` kiểm meeting/recording/generation/interval cùng sample→ms.
- **G04/G05:** Timeline nguồn được xác thực qua `poc/05-player/timeline.js`; `AudioPlayer` lập lịch các cửa sổ PCM nhỏ lấy từ `G03.seek`, không tự phát segment gần nhất. Đây là **bộ phát alpha dạng C2**, **chưa chứng minh sample-gapless hoặc giữ cao độ giọng ở 0,75×/0,9×**; PoC G04 TypeScript sẽ phải nối thêm để có meeting timeline đầy đủ.
- **G06:** `NotesRepository` + adapter `MeetingStore` ghi note và pending sidecar trong **một** IDB transaction, CAS revision và lease kiểm trước+trong transaction. `SaveQueue` single-flight, không báo saved khi còn edit dirty.
- **G07/G10:** ZIP64 streaming định dạng `.mochop` **v2**, chứa toàn bộ phiên ghi âm cùng nhật ký G03, nội dung ProseMirror và lịch sử G06; khôi phục vào OPFS+IndexedDB bằng kiểm SHA256/CRC và G03 reconcile trước khi công bố. Nhập được `.mochop` **v1 đời cũ** một phiên ghi với dữ liệu mà file cũ thực sự có. So sánh thư viện ZIP D13 vẫn chưa chốt.
- **G08:** xuất bốn định dạng, chọn có/không mốc thời gian.
- **G09:** Web Locks độc quyền writer từng cuộc họp; Service Worker shell chỉ cache asset app, giữ activation dưới origin-wide maintenance lock, không cache audio/notes. Chạy PWA ở production HTTPS, localhost Vite dev không đăng ký SW.

## Bài kiểm thử thực tế

- `npm test`: hợp đồng G10, tự lưu WAV localhost và kiểm `.mochop` v2 gồm nhiều phiên thu, remap mốc, checksum, rollback, không ghi đè; chạy CI Linux/Windows.
- `npm run build`: bundle Vite/Tiptap/worker. Có CI Linux/Windows.
- `npm run test:e2e`: Chromium localhost và preview production: thử micro giả lập, lưu OPFS, ghi hai lần trong cùng biên bản, xuất `.mochop`, nhập trên browser context mới, bấm phát lại cả hai phiên, nhập lặp không ghi đè, từ chối file sai CRC/SHA và nhập file v1. **Fake micro không thay thế cuộc họp thật/IME thật**.
- CI tại `.github/workflows/g10-verify.yml` **không** deploy, chạy mã G10 và unit các PoC. Cần xem kết quả đúng SHA trước khi báo PASS.
- Sau browser smoke cần **Windows** UniKey/EVKey × Telex/VNI trong 120 giây, ghi **3 giờ thật**, Pause/Resume/mất micro/quota/kill browser, nghe 04:58→05:02 và 90/170 phút, kiểm ZIP 0,5–2 GB/máy thứ hai, Word/Excel thực, PWA offline/update/migration. Tất cả vẫn **NOT_RUN** khi chưa có log.

## Ranh giới dữ liệu và rủi ro

- Cần HTTPS hoặc localhost; `navigator.locks` thiếu ⇒ **read-only fail closed**, không dùng fallback mất an toàn.
- OPFS/IndexedDB nằm trong **origin**; localhost với port khác hoặc đổi sang website khác là kho khác. Không lưu dữ liệu họp thật trên origin dùng chung `*.github.io`.
- Sau lỗi quota/commit, UI giữ dirty content và từ chối chuyển cuộc họp; người dùng cần xuất văn bản để tự bảo toàn nếu không khôi phục được quota. Browser không thể bảo đảm không mất vài giây dữ liệu khi thiết bị bị mất nguồn đột ngột.
- G10 giữ 9 PoC nguồn tham chiếu dưới `poc/` để truy vết SHA; đây **không** phải merge chín nhánh Git, chỉ sao chép Git tree vào nhánh mới. Một chỉnh sửa portable UTF-8 ở `poc/07-backup/interop-check.py` được làm riêng trong nhánh G10 để CI Windows chạy được, nhánh gốc G07 không bị thay.
- Đã có khôi phục `.mochop` v1/v2 ở mức alpha và đa phiên v2. Vẫn chưa nghiệm thu **nhập trên hai máy Windows vật lý**, stress file 0,5–2GiB và >4GiB, kill trình duyệt/quota, phát khi đang ghi, hiệu chuẩn micro hardware latency, G04 full meeting timeline và PWA migration.

## File ghi âm được lưu ở đâu?

- Âm thanh luôn được ghi trước vào OPFS. **Khi chạy bằng `app/START_WINDOWS.cmd` (Vite localhost), bấm Kết thúc sẽ tự động sao chép từng đoạn WAV hoàn chỉnh vào `app/Recording/<recordingId>/seg-<sample>.wav` trên ổ đĩa Windows**. Thư mục được tạo khi lưu và được `.gitignore` để không vô tình đưa âm thanh lên GitHub. Nếu ứng dụng chạy bằng bản PWA/website, trình duyệt không được ghi trực tiếp vào thư mục dự án; trong trường hợp đó bản ghi vẫn nằm ở OPFS. Ứng dụng lưu WAV bên trong **Origin Private File System (OPFS)** của Chrome/Edge cho đúng địa chỉ web hiện tại. Đường dẫn nội bộ ở dạng `<recordingId>/seg-<firstSample>.wav`; mỗi segment tối đa khoảng **5 phút** (cấu hình `segmentSeconds: 300`). Đây là các WAV Float32 PCM; trình duyệt quản lý vị trí tệp vật lý trong hồ sơ người dùng.
- **IndexedDB** riêng lưu manifest/journal của âm thanh (tên database `mochop-opfs-poc-v1`) và ghi chú/cuộc họp (database `mochop-g10-v1`). Nút **Kết thúc** đợi flush/journal; ACK nhận buffer sớm không được tính là đã lưu bền vững.
- Muốn có gói sao lưu **di chuyển được sang máy khác**, sau khi dừng ghi chọn **Xuất toàn bộ cuộc họp (.mochop)**. Tự lưu WAV trong `app/Recording` và sao lưu `.mochop` là hai chức năng khác nhau. Tệp `.mochop` chứa âm thanh và dữ liệu cuộc họp, **không phải tệp WAV đơn lẻ**. Bản alpha đã xuất/nhập được cuộc họp **có nhiều phiên ghi**; máy khác chỉ cần cùng bản app, chọn **Nhập cuộc họp từ máy khác (.mochop)**. File v1 cũ vốn chỉ chứa một phiên và bản ghi chú mới nhất nên không thể khôi phục lịch sử mà v1 chưa từng lưu. Không dùng bản alpha như kho lưu trữ duy nhất của cuộc họp quan trọng.
- Dữ liệu phụ thuộc **trình duyệt + profile + origin**: `http://127.0.0.1:5173` khác `http://localhost:5173`, khác port và khác website được phát hành. Việc xóa dữ liệu trang web, dùng cửa sổ riêng tư hoặc chuyển sang máy mới có thể làm dữ liệu hiện không còn truy cập được. **Đừng xóa dữ liệu trình duyệt** trước khi xuất bản sao lưu cần thiết.
- Muốn kiểm tra cấu trúc lưu, mở DevTools → Application → Storage/IndexedDB/Origin Private File System (tên mục thay đổi theo phiên bản trình duyệt). Không nên tìm/di chuyển trực tiếp file bên trong thư mục hồ sơ Chrome của Windows, vì có thể làm hỏng dữ liệu.

- **Kiểm tra micro:** chọn thiết bị ở mục Micro đầu vào, bấm **Thử micro (15 giây)** và nói. Thanh tín hiệu di chuyển xác nhận có mẫu âm thanh; chỉ được nhận diện thiết bị nhưng không có tín hiệu không có nghĩa là giọng đã ghi được. Thử micro không lưu tệp và tự tắt sau 15 giây.
- **Nghe lại:** bộ phát ưu tiên giới hạn theo sample PCM đã commit, không báo lỗi khi phát đến hết tệp; nếu mốc thực sự nằm ngoài âm thanh đã ghi, ứng dụng từ chối liên kết nguồn không đúng. Có thể dùng nút **Lưu lại WAV vào Recording** nếu lần sao chép cục bộ thất bại, không cần ghi lại cuộc họp.

## Chuyển toàn bộ cuộc họp sang máy tính khác

1. Ở **máy A**, kết thúc mọi phiên ghi và chờ **Đã lưu**. Bấm **Xuất toàn bộ cuộc họp (.mochop)**, chọn thư mục lưu. Gói ZIP64 v2 ghi cả văn bản, các dấu `timeSpan`, lịch sử ghi chú và **mọi phiên WAV**, kèm manifest/CRC32/SHA256 và nhật ký mẫu G03. Xuất ghi chú không có audio cũng được.
2. Chép **chính file `.mochop`** sang **máy B**. Không cần chép `app/Recording` hay thư mục Chrome. Chạy **cùng bản G10** trên Chrome/Edge, chọn **Nhập cuộc họp từ máy khác (.mochop)**.
3. Ứng dụng xác minh khai báo và checksum từng file theo luồng, tái lập file WAV vào OPFS và journal vào IndexedDB, kiểm đọc lại mẫu qua G03. **Chỉ khi thành công mới công bố biên bản mới**. Mã của cuộc họp, note và các bản ghi được cấp mới; các mốc chữ được đổi sang đúng recordingId mới. File nguồn/biên bản cũ không bị ghi đè.
4. Trong biên bản vừa nhập, bấm vào chữ của **mỗi** phiên để nghe lại; có thể gõ thêm và ghi âm mới. Nếu ZIP hỏng, thiếu WAV, giả mạo nguồn hoặc thiếu chỗ lưu, việc nhập thất bại và không hiện một cuộc họp khôi phục thiếu dữ liệu.
5. File **v1** do bản thử nghiệm G10 trước đây xuất cũng có thể nhập. Bản v1 chỉ chứa một phiên ghi và snapshot note mới nhất, nên các revision không tồn tại trong file v1 là không thể khôi phục. Với bản v2 mới, dùng tiếp chế độ v2 để có đủ lịch sử/đa phiên.

**Ranh giới nghiệm thu:** CI đã thử hai profile Chromium độc lập và các trường hợp âm thanh bị sửa; **không đồng nghĩa đã thử chuyển giữa hai máy tính vật lý, thiết bị ghi âm thật hay gói dữ liệu nhiều GiB**. Khi triển khai chính thức phải chạy thêm các bài này, và có bản sao lưu ngoài OPFS.
