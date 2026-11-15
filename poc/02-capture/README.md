# Mốc Họp · PoC 02-capture

Phạm vi thuộc nhánh `gemini/20261115-02-capture`, chỉ mã trong thư mục này và checkpoint 02. Đối chứng **AudioWorklet/PCM** với **MediaRecorder/WebM/Opus**; có **spool OPFS chẩn đoán cho MediaRecorder nhưng KHÔNG có journal/durability của G03**, không phải bản ghi âm sản xuất. Mọi số liệu là bằng chứng riêng của đúng môi trường chạy, không tự kế thừa cho ứng dụng tích hợp.

## Chạy từ checkout sạch

Yêu cầu Node.js >=22, Chrome/Chromium hoặc Edge hỗ trợ AudioWorklet, MediaRecorder, Dedicated Worker và origin an toàn (`localhost`/HTTPS). Không cần cài npm dependency. Từ thư mục `poc/02-capture/`:

```bash
npm test                    # contract + worklet quantum + real Worker/MessagePort integration
npm run test:virtual3h      # traversal METADATA 3 giờ, KHÔNG phải ghi 3 giờ thực
npm run serve               # http://127.0.0.1:8765/ - mở trong Chrome/Edge
npm run test:browser        # CDP test ngắn (bị chặn bởi chính sách trình duyệt hiện tại)
npm run test:browser -- --quick         # smoke 3 ca
npm run test:browser -- --three-hours   # ghi THẬT 10.800 giây, CHỈ chạy ở host đã chuẩn bị
```

**Cảnh báo môi trường đo hiện tại (15/11/2026):** Chromium 144.0.7559.96 trong Linux container bị tổ chức áp dụng `URLBlocklist: ["*"]`, trả trang `chrome-error://chromewebdata/` khi truy cập localhost. Vì vậy test trình duyệt, CPU/RAM đo riêng mỗi engine, verify WebM/WebAudio thực và tình huống đổi tab **NOT_RUN** ở môi trường này. Không vô hiệu hóa/bỏ qua chính sách trình duyệt để báo PASS. File `evidence/browser-results.json` ghi nguyên nhân. Muốn hoàn tất điều kiện cuối phải chạy trên Windows Chrome/Edge được phép chạy localhost/HTTPS, ghi liên tục 3 giờ thời gian thực và phát/tua đầu/giữa/cuối.

## Demo và thiết kế truyền dữ liệu

Trong demo có ba nguồn: WebAudio tổng hợp 437 Hz **kèm marker 1.200 Hz/120 ms mỗi phút** (dùng tham chiếu đầu/giữa/cuối), micro với quyền `getUserMedia`, nguồn audio chia sẻ màn hình với quyền `getDisplayMedia` (chỉ khi thực sự cấp audio track). Chọn `both` để đưa **cùng đầu ra source node** vào AudioWorklet và MediaStreamDestination -> MediaRecorder; hai bộ thu dùng cùng `AudioContext`, cùng thiết bị và điều kiện trong phiên. Chọn `pcm` / `media` riêng để đo chi phí CPU từng bộ thu (các phép đo cần ghi cả mức idle/baseline). Micro/online không hứa có track khi trình duyệt/OS không cấp; nếu track dừng thì báo `unavailable`, không tự coi silence là lời họp.

Main Thread chỉ điều phối, tạo `MessageChannel`, chuyển `port1` cho Worklet qua `AudioWorkletNode.port.postMessage({type:'attach',port:port1},[port1])`, chuyển `port2` cho Dedicated Worker qua `worker.postMessage(...,[port2])`. Data/ACK đi **trực tiếp qua MessageChannel riêng**, không truyền từng quantum qua main. AudioWorklet xử lý quantum theo `inputs[0][0].length`, gom batch 2.048/4.096 frames, dùng pool hữu hạn 2–64 `ArrayBuffer` (transfer), tổng pool tối đa **2 MiB**. Worklet kiểm `recordingId`, batch whitelist, pool/channels và giới hạn byte **trước cấp phát**; cấu hình lỗi trả `invalid-configuration`. Mỗi khối có:

```js
{
  type: 'chunk', chunk: {
    recordingId: '...', sequenceNo: 0, firstSample: 0, sampleCount: 2048,
    sampleRate: 48000, channels: 1, format: 'f32le', pcm: ArrayBuffer
  }
}
```

`sampleCount` là **số frame** (mỗi frame có một sample/kênh); f32le little-endian, PCM xen kênh. Producer `firstSample` tính cả frame bị drop, loại trừ thời gian pause. `sequenceNo` tăng theo chunk đã phát, không cần tăng theo quantum rơi; xác định chỗ thiếu từ `firstSample + sampleCount` giữa khối trước và khối sau. Bên nhận kiểm `recordingId`, `format`, `sampleRate`, `channels`, `sequenceNo`, `firstSample`, `sampleCount`, `byteLength = sampleCount * channels * 4`; không tự lấp khoảng thiếu rồi báo recorded. Thông tin mẫu trong `CoverageLedger` có `gaps/overlaps/sequenceAnomalies`, including `tailMissingFrames` khi dừng chưa có chunk kế tiếp. Nếu packet lỗi phải đánh lỗi, không báo ACK ghi thành công.

Sự kiện Worklet `started`, `paused`, `resumed`, `gap{start,end,count,reason}`, `unavailable{reason}`, `stopped` có `sampleIndex` và **thời gian render Worklet** `contextTimeSec`. Controller **chờ START ACK từ Worklet**, tạo các điểm hiệu chuẩn trong `results().clockMapping` và `clockIntervals`: `AudioContext.getOutputTimestamp()` cung cấp cặp `{contextTime, performanceTime}` ở cùng performance clock; tuyệt đối không dùng `performance.now()` khi nhận message làm timestamp của chunk cũ. Đồng hồ đầu vào micro có thể có latency chưa đo, **không coi mốc output timestamp là hiệu chuẩn input latency thật**. `CaptureClockMapper.resolveInput` không nội suy qua pause/gap/unavailable, còn `sink-queue-full` là lỗi thiếu coverage riêng. Các phép nội suy chỉ là ứng viên mapping, **không là xác nhận bytes đã lưu**. Pause không tăng `frameCursor`; âm thanh không có `input` tạo gap, track dừng là unavailable. Quá tải tạo `pool-exhausted` hoặc `sink-queue-full`; không bao giờ chờ I/O trong `process()`.

**ACK khác nhau:** worker gửi `{type:'recycle',pcm}` qua port để trả ownership và được dùng lại; đây chỉ là ACK buffer. PoC cố ý trả `committedThroughSampleExclusive: null`, `durability:'NOT_IMPLEMENTED_CAPTURE_SINK_ONLY'`: adapter 03-OPFS sau khi đã `flush/journal` mới được tạo ACK durable, không suy từ `recycle` hoặc worker nhận. Đầu nối luồng 03 có thể tiếp nhận `chunk`/`source-event`/`source-ended` ở `port.onmessage`, viết file theo thứ tự/ledger và trả buffer như trên. OPFS, quota, crash restore, manifest giao dịch không thuộc nhánh capture.

Worker dùng `maxQueue` (bao gồm chunk đang xử lý), `delayMs`, `cpuBurnMs` để đo backpressure; cap số event chẩn đoán và cap `maxPrefixSeconds` để không giữ cả file 3 giờ trong RAM. WAV `Tải WAV mẫu đầu` là **tiền tố liên tục ngắn** sau xử lý, không là file đầy đủ hoặc bằng chứng durability. MediaRecorder giữ tối đa 20 MB prefix trong RAM; `stream-spool.mjs` thêm **spool OPFS chẩn đoán** với hàng đợi tối đa 8 MB/32 blobs, một file WebM liên tục cho toàn phiên nếu browser hỗ trợ. Bất kỳ reject/quota/write-failure đều đánh dấu `INCOMPLETE/FAILED`, không gọi file là đầy đủ; không dùng timeslice độc lập như một container có thể seek. Spool chỉ là phép đo capture, **không có flush+journal/manifest/crash recovery**, `durable:false` luôn giữ nguyên. Khi `dispose()` sạch file thử được xóa; nếu crash có thể tồn file thử dưới thư mục OPFS `moc-hop-capture-poc-02`, cần kiểm quota và dọn thủ công sau khi sao lưu dữ liệu cần thiết. `getCompleteBlob()` cho phép HTMLAudioElement đọc/tua toàn container trên đĩa mà không decode toàn bộ file 3 giờ vào RAM; `decodeAudioData()` chỉ thử trên file <=16 MB. MediaRecorder đo cadence, codec, bytes, spool backlog và trạng thái, **chưa có kết quả browser thực**.

## Kiểm thử / bằng chứng

- `tests/unit.test.mjs`: hợp đồng, gap/missing/duplicate, WAV, quantum thực, 2.048/4.096, pause/resume, pool cạn/unavailable; G02-ADD-04 rejected invalid config với zero allocations và giới hạn 2 MiB; timestamp của gap không bị Stop trễ đẩy sai.
- `tests/lifecycle.test.mjs`, `tests/pcm-lifecycle.test.mjs`: G02-ADD-01/02: deferred micro permission, double Start, Stop trước cấp quyền hoặc trong resume, Stop/error/timeout, worker crash và Worklet START ACK; kiểm cleanup idempotent và không báo saved giả.
- `tests/clock-mapper.test.mjs`: G02-ADD-03: hai hoặc nhiều mốc đã hiệu chuẩn, pause 10 giây không tăng media cursor, ±100 ppm và message delayed, gap/unavailable/sink-queue.
- `tests/spool.test.mjs`: G02-ADD-05: OPFS-like adapter streaming độc lập, bounded queue, dữ liệu đầy đủ khi retained prefix bị cắt, quota/failure không nhận nhầm file đầy đủ.
- `tests/transport.test.mjs`: real `worker_threads.MessageChannel` + transferable buffer (đúng detach/return ownership), 2.048/4.096, Worker chậm/hàng đợi đầy và đường sự kiện, **không thay thế AudioWorklet thật trên Chrome**.
- `tests/virtual-3h.mjs`: duyệt đủ **518.400.000 frame** tại 48 kHz = 10.800 giây (3 giờ) ở mức *metadata*; lưu số khối, hash logic/giá trị mẫu đại diện đầu, mốc 90 phút, cuối và injection mất/trùng, **không tạo/ghi/đọc 2 GB PCM**. Không được xem là TC12 thực nghiệm ba giờ.
- `tests/browser-runner.mjs`: so sánh 2.048/4.096; hỗ trợ `--three-hours` **10.800s wall-clock** với hai engine cùng nguồn, mốc phút 90 và đọc/seek WebM đầu/giữa/cuối. CDP chuyển sang background polling và lấy RSS mỗi 5 giây cho bài dài; chưa chạy được tại môi trường hiện tại. Test ngắn: PCM-only, MediaRecorder-only, both; Worker chậm/CPU stress, fake getUserMedia; đo CPU time / sum RSS của cây tiến trình Chromium, byte WebM, số frame PCM, cadence, WAV/WebM decode + seek. *Phải chạy được trên trình duyệt/host được phép; máy hiện tại bị chính sách chặn.* `sum RSS` chỉ là giới hạn trên tương đối do chia sẻ trang nhớ, không phải peak heap thực của từng engine.
- `evidence/virtual-3h.json`: kết quả Node metadata, không có audio cuộc họp.
- `evidence/browser-results.json`: blocker policy/hoặc kết quả, không chứa PCM/WebM nội dung họp.

### Bảng đối chứng cần điền bằng **số đo thật**

| Chỉ tiêu | AudioWorklet + PCM | MediaRecorder + WebM/Opus |
|---|---|---|
| Bộ đếm sample/frame | Có `firstSample`, `sampleCount`, sequence | Không có số frame trực tiếp theo timeslice; kiểm giải mã |
| Codec/size | `f32le`, mono 48 kHz ~0,69 GB/giờ thô (lý thuyết), chưa nén | `audio/webm;codecs=opus` nếu supported; chưa có số liệu size thực |
| Pool/queue/drop | Pool giới hạn, đo `pool-exhausted`, `sink-queue-full`, gap | `dataavailable` không cam kết tự chứa/seek; cần decode & đo |
| Độ trễ, cadence, CPU/RAM, seek | **NOT_RUN** trên browser bị block | **NOT_RUN** trên browser bị block |
| Test 3 giờ wall-clock | **NOT_RUN** | **NOT_RUN** |
| Khả năng đọc đầu/giữa/cuối | WAV prefix/unit PASS, khối middle @90m được chuẩn bị; PCM toàn phiên **NOT_RUN** | OPFS spool diagnostic đã code, full WebM decode/seek browser **NOT_RUN** |
| Lưu bền vững, crash recovery | Ngoài phạm vi; phối hợp 03 | Ngoài phạm vi; cần thiết kế container/remux riêng |

**Khuyến nghị tạm thời (chưa chốt production):** giữ AudioWorklet/PCM là ứng viên ưu tiên vì có số frame/chuỗi gap xác minh được trong unit/worker, đồng thời **giữ MediaRecorder đối chứng** tới khi có cùng phép đo browser thật, ghi 3 giờ và kiểm decode/seek/recovery. Chưa đủ chứng cứ chọn engine sản xuất hoặc báo Gói 1.2 DONE.

### Checklist kiểm Windows thật (sau khi bỏ chặn môi trường)

1. Windows 10/11, phiên bản Chrome và Edge, CPU/RAM/micro, sample rate thực, quyền audio ghi vào log; thử PCM 2048/4096 và MediaRecorder trên cùng nguồn, rồi chạy tách engine để đo CPU riêng.
2. Ghi liên tục tối thiểu 3 giờ wall-clock; kiểm dữ liệu thật phát/seek ở 0 phút, 90 phút, 179 phút; xác nhận chuẩn WAV/Opus, số sample/drop, drift, size và hash các cửa sổ đầu/giữa/cuối; so với tín hiệu/chỉ dấu tham chiếu.
3. Đổi tab (visibility), stress CPU của Worker, giảm queue/pool, pause/resume nhiều lần, rút vật lý microphone, cấm/thu hồi quyền, kiểm không điền đoạn unavailable bằng silence không rõ nguồn.
4. Khi tích hợp 03, thử kill tab/browser, quota, journal/flush/checkpoint, reconcile và đọc lại file; chỉ đánh PASS vùng đã xác nhận durability.
5. TC21: từng cấu hình Windows/browser/Zoom/Teams/Meet/thiết bị tai nghe cần log có/không có audio track thật từ getDisplayMedia, chất lượng/echo/trộn và mất quyền. Nếu không có track thì đánh NOT_RUN/UNSUPPORTED, không gắn PASS.

## Cổng G00 bổ sung — vòng sửa G02-ADD-01..05

- **ADD-01:** một trạng thái `idle → starting → capturing → stopping → stopped/failed`, `stopPromise` idempotent. Trường hợp người dùng Stop trước khi cấp quyền: prompt trình duyệt có thể vẫn hiện; nếu quyền được cấp sau Stop, stream đến muộn bị dừng và không tạo recorder. UI vô hiệu hóa Start **ngay khi click**, Stop vẫn dùng để hủy pending Start; không ghi đè session đang hoạt động.
- **ADD-02:** trong cả Stop lỗi `MediaRecorder.stop`, Worker fail/timeout, mọi stream track, oscillator, context và Worker được giải phóng bằng đường `cleanup()` duy nhất. Worker được giữ lại sau Stop thành công **chỉ** để export WAV prefix chẩn đoán, rồi `dispose()` terminate. Không suy `recycle` là committed ACK.
- **ADD-03:** mốc `started` là ACK từ render thread; `getOutputTimestamp()` map từ `contextTimeSec` của event sang performance timeline, có pause/unavailable/gap intervals và phân biệt sink gaps. Khoảng không đủ dữ liệu/thiếu timestamp trả `pending/unlinked`, không dựng mốc giả. Độ trễ input micro và clock uncertainty vẫn cần phép đo thực.
- **ADD-04:** Worklet whitelist 2048/4096, pool 2..64, channels 1..2, pool tổng <=2 MiB, recordingId có kiểm tra. Cấu hình sai không cấp phát; đường thất bại cấp phát trả `pool-allocation-failed`.
- **ADD-05:** MediaRecorder spool một container liên tục trên đĩa qua adapter có giới hạn backlog và hỗ trợ HTMLAudioElement seek ở toàn file. Chưa có kết quả seek/CPU/RAM/browser cho phiên thật; không chuyển ranh giới công việc OPFS durability từ G03 sang G02.

**Chỉ định khi chạy benchmark 3 giờ:** giữ máy không sleep/đủ nguồn điện, ít nhất 4 GB dung lượng trống với PCM diagnostic khác nếu lắp G03, ghi run ID/chrome version, CPU/RSS, tình trạng track và quota. Ở PoC G02, PCM chỉ xuất WAV prefix 8s và first/middle/last block summaries; **không được khẳng định PCM full 3h có thể seek**. Nếu MediaRecorder tạo WebM không hỗ trợ seek chính xác, ghi FAIL/unsupported, không chấp nhận chunk timeslice như file độc lập. Chạy kiểm riêng micro thật, chuyển tab, revoke quyền, pause/resume, Worker stress và queue-full, không trộn các case đó vào kết quả 3h ổn định.
