# PoC 03 — OPFS audio durability

Độc lập, không import module từ các worker khác. PCM f32le theo COMMON, lưu thành WAV IEEE float32 (44-byte header) theo segment mặc định 300 giây.

## Chạy

- `npm test`: 10 bài thử Node deterministic dùng filesystem/journal mô phỏng.
- `npm run bench`: ghi bộ dữ liệu **tổng hợp tương đương 3 giờ**, Node filesystem fsync, journal mô phỏng; tự xóa dữ liệu sinh trong thư mục tạm.
- `python -m http.server 8765` từ thư mục này, sau đó mở `http://localhost:8765/browser-test.html` trong Chrome/Edge để thử **OPFS + IndexedDB thật** bằng Dedicated Worker. Yêu cầu secure context (localhost hoặc HTTPS), origin không dùng cho dữ liệu thật.
- Tự dùng `worker.mjs`: `init` (recordingId, sampleRate, channels, segmentSeconds, hoặc reopen:true), `append` (chunk theo COMMON, transfer pcm), `flush`, `seek`, `reconcile`, `manifest`, `metrics`, `close`. Request/response có id, ok, result/error. Không được gọi hai thao tác ghi đồng thời trên cùng Worker. Khóa multi-tab thuộc luồng 09, chưa được triển khai tại đây.

## Bất biến durability

1. `append` ghi chunk xuống file và trả `bufferReleased` **không phải xác nhận durable**.
2. `flush` cập nhật WAV header, gọi `FileSystemSyncAccessHandle.flush()` cho từng file, sau đó commit snapshot journal trong một transaction IndexedDB; chỉ lúc đó trả `committedThroughSampleExclusive`.
3. Mỗi chunk committed giữ sequence, sample start/count, byte offset/length, CRC32. Đọc lại so từng lát với file. Nếu OPFS mới có bytes nhưng journal chưa commit thì phần dư bị truncate về checkpoint; không tự quảng cáo là dữ liệu đã lưu. Nếu journal có nhưng file bị thiếu/truncated/corrupt: báo unavailable/missing, không tự nối qua gap.
4. Journal ban đầu được tạo khi `init`, không tạo Meeting/NoteDocument hay dữ liệu ZIP.
5. WAV float32 là PoC; 48 kHz mono chiếm ~691 MB/giờ. Không coi WAV header hoặc checkpoint là chứng cứ chống mất điện tuyệt đối. CRC32 phát hiện lỗi vô ý, không có vai trò xác thực mật mã.

## File layout

- OPFS: `<recordingId>/seg-<firstSample>.wav`, mỗi WAV có 44-byte header, PCM interleaved f32le.
- IndexedDB: database `mochop-opfs-poc-v1`, object store `audioManifest`, key recordingId; value gồm schemaVersion, segments, chunks có CRC32, intervals/gaps, nextSequenceNo, accepted/committed sample exclusive, revision.
- `reconcile()` trả `committedRanges` với sampleStart/sampleEndExclusive và byteStart/byteEndExclusive, `unavailable` với reason, `gaps`, `uncommittedBytes`, `truncatedBytes`, `repairedHeaders`, `orphanFiles`.

## Phạm vi chứng cứ

Các bài Node đã được chạy trên bản PoC cùng thuật toán; commit lên GitHub cần thử lại từ clean checkout. Benchmark 3 giờ chạy ở 1 kHz để giữ fixture nhỏ, **không** chứng minh hiệu năng 48 kHz Windows, việc giữ tài nguyên khi tab đóng hoặc flush/persistence dưới mất điện. Browser smoke có sẵn nhưng chưa có bằng chứng PASS từ Chrome/Edge thật. Cần đo OPFS browser, quota thật và peak memory trình duyệt trước khi chốt Gói 1.2.

## Hạn chế chưa đóng

- Giữ một Writer duy nhất; không có Web Locks trong module này.
- Mọi thao tác `readSample` đang re-verify toàn bộ journal (seek chậm ~1,5 giây trên fixture 3 giờ); production phải cache verified index, invalidation đúng và kiểm cửa sổ tại điểm phát.
- Journal snapshot nguyên manifest mỗi lần flush; cần thử tải ghi kéo dài ở 48 kHz, tối ưu incremental journal nếu cần.
- Orphan file được báo cáo nhưng không tự nhập lại dữ liệu chưa có commit, tránh tuyên bố sai về độ bền.
- Thời gian chưa xác nhận mục tiêu ~10 giây phụ thuộc chính sách gọi flush, hàng đợi, quota và tốc độ I/O; adapter không tự lập lịch flush. 
