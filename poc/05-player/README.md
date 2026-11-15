# 05-player — độc lập PoC C1/C2, Mốc Họp V1.2

**Không phải ứng dụng đã nghiệm thu.** Luồng này chỉ thử độc lập playback trên fixture tổng hợp theo `COMMON.md`. Không chờ G04 hoặc nhánh khác. Quyết định production còn HOLD do chưa nghe giọng thật/Windows Chrome+Edge.

## Chạy

```bash
cd poc/05-player
node --version
npm test
python3 -m http.server 8765
```

Mở `http://127.0.0.1:8765/index.html` bằng Chrome/Edge. Có thể thay cách mở demo khi origin bị quản trị chặn. Không có `npm install` vì dùng Node built-in, mọi audio là tổng hợp ngay trong source. Tùy chọn kiểm browser trên Linux với Playwright Python có sẵn và Chromium:

```bash
python3 browser_smoke.py
python3 browser_benchmark.py
```

Nếu máy không có thư viện test: `python3 -m pip install playwright numpy psutil` và cài Chromium qua trình quản lý gói hoặc `python3 -m playwright install chromium` (script mặc định `executable_path=/usr/bin/chromium`; chỉnh nếu đường dẫn khác). Các runner dựng `about:blank` + `data:` ES modules từ source checkout, không mở localhost; đây là workaround **cho môi trường test**, demo vẫn hoạt động bằng HTTP bình thường.

## Fixture, timeline và hợp đồng

- Media: 3 giờ/10.800.000 ms, 36 WAV PCM16 16k mono × 5 phút; 36 segment descriptor có `segmentRefs`, `sampleStart`, `sampleCount`, `mediaStartMs/mediaDurationMs`. WAV tổng hợp chỉ cấp phát *clip phát* hiện tại/tiếp theo ở C1; C2 sinh cửa sổ 160ms, không giải mã cả 3 giờ.
- Meeting: +10s Pause tại 30 phút; +15s gap micro tại giờ thứ nhất; sau đó một media gap nội bộ có media range `[7.420.000,7.422.000)` và meeting gap tương ứng. Mark dùng `audioOffsetMs` theo **media**; `meetingToMedia()` và `mediaToMeeting()` là API riêng. Media 1.805.000ms là **valid** (`seg-006`); meeting 1.805.000ms là **paused**. Resume meeting 1.815.000ms → media 1.805.000ms.
- Đoạn `seg-020` (100–105 phút media) missing, không fallback sang đoạn khác; trạng thái `pending` độc lập. `resolveMedia()` trả `valid` cùng `clipStartMs/clipEndMs`, hoặc `gap/pending/missing/unsupported/unlinked` và lý do. `validateManifest()` kiểm tham chiếu, khoảng recorded, sample count và mốc rời rạc.
- `choosePreRoll()` chọn lùi 0/3/5/10/15/30s nhưng **block** nếu vùng phát đi qua missing/gap; giữ nguyên `audioOffsetMs`/Mark gốc. Không tự nhảy tới đoạn khả dụng gần nhất.

## C1 vs C2

| | C1: HTMLAudioElement đôi | C2: AudioBufferSourceNode |
|---|---|---|
| Nối segment | Preload URL clip kế tiếp; `ended` trigger, **không sample-accurate** | Lập lịch 160ms PCM trên cùng `AudioContext.currentTime`, 750ms lookahead |
| Gap nội bộ trong file | Cắt WAV synthetic tại `clipEndMs` để không phát qua gap | Không lên lịch bất kỳ frame nào sau `clipEndMs` |
| Nghe chậm | `preservesPitch=true`; cần nghe giọng thực | `playbackRate` làm giảm cả tốc độ và pitch |
| RAM | 2 ObjectURLs/PCM16 WAV tối đa ≈ 19,2 MB nguồn nếu mỗi clip 5 phút; URL revoke khi không gắn thẻ | Bộ đệm nguồn 160ms, thực tế headless maxPending 7 (~72 KiB PCM float ở 16k), thêm overhead trình duyệt |
| A–B | Trim clip đúng B; bắt đầu lại ở A qua `ended` | Scheduler không phát quá B; restart từ A, không cam kết loop gapless |
| Khôi phục | Đọc theo resolver và Blob source; production cần OPFS byte stream adapter | PoC tổng hợp PCM từ sample index; production cần partial PCM/WAV read |

Dữ liệu ở `evidence/browser-smoke.json` và `evidence/synthetic-benchmark.json` là **đo trên Linux headless Chromium 144**, không phải máy Windows thật. Script có thể chạy lại với source và log mới, không ghi đè evidence commit khi chưa kiểm khác biệt.

## Kết quả đo và giới hạn

- Node fixture + scheduler: **10/10 PASS**; 04:58→05:02, phút 90/170, meeting vs media, pause, missing, source sai, gap nội bộ, preroll và PCM continuity.
- Chromium headless smoke: **10/10 PASS** sau khi sửa test harness chuyển trạng thái; C1 seek 90 ≈457ms, phút 170 ≈455ms trong một run (phụ thuộc CPU, audio synth tạo WAV); C1 có sự kiện boundary 300.000ms; C2 lập lịch qua biên và stop tại media 7.420.000ms, không underrun trong run này. C1 ScriptProcessor tap dùng khối 16ms: `maxMidstreamSilenceMs=0` trong run **không tương đương chứng minh không mất/đúp mẫu**.
- Đo tần số bằng FFT trên tín hiệu tổng hợp (các run 2,25s): **C1 220Hz tại 0,75× và 0,9×**; **C2 165Hz tại 0,75×, 198Hz tại 0,9×**. Đúng cơ chế cao độ của browser, **chưa thể kết luận nghe giọng nói tự nhiên**.
- Bộ nhớ đo bằng snapshot RSS của nhóm Chromium process CDP (không phải peak RAM cả hệ thống): trong 4 run ≈230–236 MB; baseline thay đổi theo browser/pages. Đếm nguồn C1 2 Blob URL, C2 maxPending 6, nhưng **peak RSS dài 3h NOT_RUN**.
- **NOT_RUN:** Windows Chrome/Edge với tai nghe, UniKey/EVKey Telex/VNI, so khớp nguồn PCM qua loopback ngoài, sample-level drop/duplicate, stress 3 giờ, tình huống CPU bị khóa/tab background, tích hợp editor/manifest OPFS thật. Giọng người tại 0,75×/0,9× NOT_RUN; không dùng sóng tổng hợp thay thử nghe.

## Adapter bàn giao

Dùng `resolveMedia(fixture,recordingId,audioOffsetMs)` hoặc `meetingToMedia(fixture,recordingId,meetingMs)` **theo đúng loại clock**; `clipStartMs/clipEndMs` buộc decoder/player giới hạn nguồn. C1 có thể tương thích giọng thật tốt hơn nhưng chưa đủ bằng chứng chọn; C2 ưu thế buffer/scheduling nhưng pitch đổi. **Khuyến nghị tạm thời: giữ C1 làm ứng viên ưu tiên thử nghe Windows; C2 làm đối chứng, không chốt production.**

Checkpoint: `docs/workstreams/2026-11-15/checkpoints/05-player.md` trên nhánh.
