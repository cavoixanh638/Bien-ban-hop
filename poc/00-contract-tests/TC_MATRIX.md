# TC01–TC38 · Ma trận Gói 1.6 và trạng thái chứng cứ

**Cách đọc:** `MOCK_CASE` nghĩa là test logic của adapter giả lập có trường hợp liên quan, **không phải runtime PASS**. `NOT_RUN` là chưa có kết quả trên bản tích hợp. Mọi TC hiện **RUNTIME NOT_RUN**; không tự đánh dấu PASS gói. Các dòng ghi mã test local `harness.test.mjs`, không mặc định bao phủ đầy đủ mọi subcase trong ACCEPTANCE_TESTS.md.

| TC | Fixture/mock liên quan | Runtime / chứng cứ còn thiếu |
|---|---|---|
| TC01 | MOCK_CASE text/anchor tiếng Việt | Editor thật, thao tác Word-like |
| TC02 | MOCK_CASE cùng paragraph | Gõ thực 2 phút không Enter, nhiều anchor |
| TC03 | MOCK_ONLY tiếng Việt chuỗi Unicode | Unikey/EVKey Telex/VNI trên Windows |
| TC04 | MOCK_CASE thay chữ giữ anchor | Đổi dấu muộn/Backspace burst bộ gõ thật |
| TC05 | MOCK_CASE sửa nội dung giữ mark | Editor historical edit |
| TC06 | MOCK_CASE attrs khác không gộp | Transaction Insert giữa Mark |
| TC07 | MOCK_CASE transfer preserve provenance | Copy/cut/paste nội bộ editor |
| TC08 | MOCK_CASE mark preserved (không history engine) | Undo/Redo editor |
| TC09 | MOCK_CASE bold + timeSpan | Format Tiptap/ProseMirror |
| TC10 | MOCK_CASE paste ngoài unlinked | Word/web clipboard thật |
| TC11 | MOCK_CASE đồng nhất thuộc tính | 2 phút P95 <100ms, JSON, Mark/TextNode/DOM |
| TC12 | MOCK_CASE PCM sequence vs ACK | AudioWorklet/MediaRecorder, 3h wall-clock, CPU/RAM/drop |
| TC13 | MOCK_CASE pause và mapping | Mic/browser timeline thực |
| TC14 | MOCK_CASE synthetic gap | Rút mic/permission |
| TC15 | MOCK_CASE recovered-through count | Kill tab/OPFS recovery |
| TC16 | MOCK_CASE multi-segment và source | Media real playback/file reference |
| TC17 | MOCK_CASE sample clock interpolation | Tín hiệu kiểm sai số <=1s |
| TC18 | MOCK_CASE missing, unsupported | File hỏng thật/decoder |
| TC19 | MOCK_CASE storage failure text/PCM | Quota, file flush và cảnh báo thật |
| TC20 | — | Wake Lock revoked trên thiết bị thật |
| TC21 | — | Audio online trên tổ hợp OS/browser/app có audio track |
| TC22 | MOCK_CASE play target/pre-roll | Click/shortcut/timeline runtime |
| TC23 | MOCK_CASE bước qua segment (không audio) | Waveform/phép đo mất/lặp C1/C2 |
| TC24 | MOCK_CASE seek resolve 2 segment | Seek 0/90/170 phút qua real player |
| TC25 | MOCK_CASE route nhiều segment | A–B lặp xuyên file |
| TC26 | — | Sửa khi đang playback trên cùng UI |
| TC27 | MOCK_CASE imported source & offset | Import MP3/WAV/WebM/M4A khi decoder hỗ trợ |
| TC28 | MOCK_CASE paused anchor, pre-roll 0/3/5/10 | UI pause rồi gõ, giữ mốc |
| TC29 | MOCK_CASE revision/commit/failure | IndexedDB autosave + crash |
| TC30 | MOCK_CASE checksum/staging/restore | Archive .mochop ZIP và máy khác |
| TC31 | — | ZIP 0.5–2GB, ZIP64, 3 engine, RAM/backpressure |
| TC32 | MOCK_CASE lease token | Browser đa tab/Web Locks |
| TC33 | — | Chrome/Edge offline sau lần tải đầu |
| TC34 | MOCK_CASE update guard | Service Worker thực không reload khi thu |
| TC35 | MOCK_ONLY update guard (không migration) | Schema migration fixture cũ |
| TC36 | — | DOCX Unicode và định dạng kiểm MS Word |
| TC37 | MOCK_CASE paste cross-recording | Tiptap paste từ cuộc họp khác |
| TC38 | MOCK_CASE restore thiếu file | ZIP .mochop restore và audio Manifest real |

## Âm tính bắt buộc

1. `NEG wrong audio source`: mutant trả `rec-other` trong khi yêu cầu `rec-1`, assertion bắt lỗi.
2. `NEG false saved UI`: fake UI ghi “Đã lưu” nhưng `Storage.save` thất bại; kiểm revision thật và bắt mutant.
3. `NEG dual writer`: `Storage.acquire` lần thứ hai trả null; mutant giả có lease bị assertion bắt.

Mỗi lần thay adapter thật phải giữ ba bài trên, bổ sung mutation source/reference trên runtime và tự xác nhận fail-closed.

## Mẫu bằng chứng tích hợp

`TC/subcase | code SHA | tested SHA | OS/browser/device | adapter/fixture | expected | actual | metric/log | PASS/FAIL/NOT_RUN | owner`.

**Cổng phát hành:** tất cả TC Must đạt trên mã tích hợp, không Critical/High, test Windows/Chrome/Edge, ghi 3 giờ, playback 04:58→05:02 + 90/170 phút, quota/crash, restore trên máy khác, offline, PWA update/migration và ZIP lớn. Không chốt engine/ZIP nếu chưa có benchmark.
