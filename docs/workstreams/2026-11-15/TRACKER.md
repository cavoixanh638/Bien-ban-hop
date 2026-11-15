# Tracker Gemini · Mốc Họp V1.2

Writer duy nhất: Gemini 00. [Mục lục](README.md) · [Hợp đồng](COMMON.md) · [Checkpoint điều phối](CHECKPOINT.md)

Baseline `6142f56a6efdb27aa9445920c9321f7930c0d5fd`. Trạng thái dòng này là tình trạng bàn giao độc lập của luồng. Trạng thái gói sản phẩm do `docs/STATUS.md` quản lý. Đợt tích hợp: **chưa bắt đầu**. Cột `HEAD` là snapshot nhánh được quan sát khi kiểm tra, **không** suy ra tested SHA. Cột Tested SHA để — nếu chưa có bằng chứng chạy đúng checkout tại SHA. Thời điểm quan sát: 15/11/2026. Trạng thái test V8 00 dùng shim Node và SHA-256, không thay thế `npm test` từ clean remote checkout.

| Owner | Checkpoint | Trạng thái | HEAD | Tested SHA | Test | Bằng chứng / việc còn thiếu |
|---|---|---|---|---|---|---|
| Gemini 00-command | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/CHECKPOINT.md) | READY_FOR_REVIEW | `89e88347` | — | V8 shim 17/17; clean Node NOT_RUN | Harness độc lập đã push; thiếu Node chạy từ checkout đúng SHA |
| Gemini 01-editor | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-01-editor/docs/workstreams/2026-11-15/checkpoints/01-editor.md) | IN_PROGRESS | `d8ca16fa` | — | Node policy 23/23 local | Tiptap build/Playwright/IME Windows NOT_RUN |
| Gemini 02-capture | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-02-capture/docs/workstreams/2026-11-15/checkpoints/02-capture.md) | PARTIAL / BROWSER_BLOCKED | `8a9780cf` | local source `6898ec9b`; clean SHA NOT_RUN | Node 11/11; 3h metadata only; browser NOT_RUN | Đã push 18 file PoC; G02-ADD-01..04 cần fix/test; ghi 3h thực và đối chứng engine chưa chạy |
| Gemini 03-opfs | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-03-opfs/docs/workstreams/2026-11-15/checkpoints/03-opfs.md) | IN_PROGRESS | `e23593ba` | — | Node reference 10/10 local | Simulation 3h @1kHz; exact GitHub SHA/OPFS browser NOT_RUN; seek ~1.5s |
| Gemini 04-timeline | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-04-timeline/docs/workstreams/2026-11-15/checkpoints/04-timeline.md) | READY_FOR_REVIEW | `7a20de0e` | — | Node TS fixture 16/16 local | PoC độc lập; clean checkout SHA và capture live NOT_RUN |
| Gemini 05-player | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-05-player/docs/workstreams/2026-11-15/checkpoints/05-player.md) | IN_PROGRESS | `b9ac38fa` | — | Node reference 9/9 local | BUG: resolve nhầm meetingMs vs audioOffsetMs; fixture thiếu media range/segmentRefs; browser C1/C2 NOT_RUN |
| Gemini 06-notes | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-06-notes/docs/workstreams/2026-11-15/checkpoints/06-notes.md) | IN_PROGRESS | `ed272d05` | — | V8 memory fixture 9/9 | IndexedDB browser + two-tab/quota/crash NOT_RUN |
| Gemini 07-backup | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-07-backup/docs/workstreams/2026-11-15/checkpoints/07-backup.md) | IN_PROGRESS | `80af80db` | — | Python ref 10/10 local | 512MiB/2GiB benchmark Python không thay được 3 ZIP JS; clean SHA/browser NOT_RUN |
| Gemini 08-export | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-08-export/docs/workstreams/2026-11-15/checkpoints/08-export.md) | IN_PROGRESS | `9b71d4d9` | — | Node ref 20/20 local | Mã GitHub đã sửa sau run; cần test exact SHA, Word/Chrome/Edge |
| Gemini 09-pwa | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-09-pwa/docs/workstreams/2026-11-15/checkpoints/09-pwa.md) | READY_FOR_REVIEW | `4cdde5a5` | local source at `46e82448` (not clean checkout) | Node mock 10/10; browser NOT_RUN | 22 PoC files đã push; cần kiểm race start/release, save/release, migration đa meeting và SW activation gate |

## Giao lại theo bằng chứng

Ghi owner, lỗi và diff/run liên quan, đường dẫn file được phép sửa, yêu cầu và điều kiện kiểm lại. Mọi dòng chờ dữ liệu worker trong tracker chỉ thể hiện trạng thái tiến độ. Bộ kiểm thử hợp đồng của 00 tự hoàn thành với fixture.

## Đợt tích hợp tiếp theo

Kiểm cổng Gói 1.1 và bằng chứng thực trên từng SHA. Chốt các adapter và lựa chọn kỹ thuật bằng kết quả thử. Sau khi được giao đợt tích hợp, ghi SHA tích hợp, TC01–TC38, lỗi Critical/High và chứng cứ đủ điều kiện bàn giao.

## Sự kiện và điểm kiểm chứng 15/11/2026

- **00**: baseline `6142f56`, nhánh riêng từ `6feb6d9`; tạo độc lập `contracts.mjs`, `harness.test.mjs`, `package.json`, `README.md`, `TC_MATRIX.md`, `INTEGRATION_RUNBOOK.md`. HEAD mã/hướng dẫn `b136a897`; bản GitHub đã parse được; test logic 17/17 chạy lại trên nội dung đã fetch bằng JavaScript V8 với shim, trong khi test Node 16/16 là nguồn tương đương chạy cục bộ nhưng **không phải cùng file/SHA**. Chính xác các file GitHub bằng Node/clean checkout: NOT_RUN do môi trường container không kết nối github.com.
- **04**: checkpoint mới nhất xác nhận standalone TypeScript fixture test 16/16 trên Linux Node 22, revision code `8410cc27`, chưa có clean SHA test hay test live.
- **01/02/03/05/06/07/08/09**: checkpoint hiện hành ghi IN_PROGRESS và chưa có bằng chứng runtime để ghi PASS; các HEAD quan sát được đã ghi cột trên. Worker có thể tiếp tục commit sau thời điểm quan sát; kiểm lại trước tích hợp.

## Giao việc cụ thể / không đổi COMMON

- **Owner 00**, `poc/00-contract-tests/`: chạy `npm test` từ **clean checkout** nhánh `gemini/20261115-00-command`; kỳ vọng 17/17, ghi đúng SHA, Node/OS, stdout/log. Nếu FAIL, sửa chỉ file trong thư mục 00 và chạy lại. Đây là cổng còn thiếu để DONE độc lập.
- **Owner 01-editor**, `poc/01-editor/`: cung cấp trace UniKey/EVKey Telex/VNI thật (không composition cũng có thể xảy ra) với cùng đoạn 2 phút và marks đầu/cuối. Expected: chữ/mốc không mất, test TC01–TC11; Windows/Chrome/Edge vẫn NOT_RUN khi chưa kiểm.
- **Owner 02-capture + 03-opfs**, chỉ tại `poc/02-capture/` và `poc/03-opfs/`: đối chiếu `sequenceNo/firstSample/sampleCount`, ACK transfer vs flush+journal, crash/quota và mất micro. Expected: không công bố committed nếu mới queued; chứng minh bằng log/WAV header/trạng thái manifest.
- **Owner 05-player**, `poc/05-player/`: đo C1/C2 qua biên 04:58→05:02 và 0,75×/0,9×, tránh khẳng định gapless chỉ vì bước source logic.
- **Owner 07-backup**, `poc/07-backup/`: kiểm streaming ZIP 0,5–2 GB, path traversal/checksum/staging, ZIP64 và restore thiếu audio, đo RAM/backpressure.
- **Owner 09-pwa**, `poc/09-pwa/`: kiểm lock stale writer, SW update không reload khi ghi và migration rollback.

### Đề xuất cần xét lúc tích hợp (không chỉnh hợp đồng đóng băng)

1. **Pre-roll qua vùng không phát được**: reference mock fallback về anchor khi `start` missing/pending; production phải xác định rõ UX khi pre-roll đi qua gap/pending/segment missing, không âm thầm nhảy qua nguồn sai. Giữ `audioOffsetMs` gốc.
2. **Writer token**: hợp đồng `acquire(meetingId)` chỉ hứa `release()`; reference mock dùng identity token để chống stale release/save sau lease được tái cấp. Đề nghị thẩm định với IndexedDB/Web Locks adapter thực.
3. **Media interval ở gap**: địa chỉ Mark luôn media offset, trong khi paused/gap có meeting time riêng và có thể không có media range; đặt hàm resolve theo `meetingMs` riêng, không đánh tráo các loại time. Kiểm thêm gap xen giữa hai recorded media liên tục.

## Rà soát HEAD trực tiếp sau bàn giao — 15/11/2026

Đã đối chiếu Git-tree ở đúng HEAD của cả 10 nhánh, checkpoint độc lập và các artifact thực sự có trên GitHub, không tính đường dẫn chỉ xuất hiện trong tài liệu là code có sẵn. Tại lúc rà soát:
- **Có file PoC trên GitHub:** 00, 01, 03, 04, 05, 06, 07, 08.
- **Chưa có thư mục PoC trên GitHub:** 02-capture, 09-pwa. Hai luồng này vẫn IN_PROGRESS, chưa có mã bàn giao để review.
- **04** READY_FOR_REVIEW fixture; **00** READY_FOR_REVIEW nhưng còn thiếu Node clean checkout. **01/03/05/06/07/08** có mã, có kiểm thử một phần trên tham chiếu/synthetic nhưng chưa đủ nghiệm thu. Không có gói thực địa PASS.

### 05-player — lỗi được tái hiện trên đúng nguồn GitHub (cần sửa, ưu tiên cao)

- Owner: **05-player**; file được phép sửa: `poc/05-player/player.js`, `poc/05-player/player.test.js`, `README.md` và checkpoint `05-player.md`. Tested source: blob Git `15ef45b5abf5712b90cdd81d04820d7f60c9f8f6`; HEAD khi kiểm `b9ac38fa9e99be9349df6403713ba274f39ef981`.
- **Reproducer:** `resolve(ID, 1805000)` hiện trả `{status:'gap', reason:'pause'}` trong khi `seg-006` có `mediaStartMs=1800000`, `completionState='complete'` và chứa mốc audio này. `resolve()` dùng `meetingStartMs` và `meetingEndMs` để kiểm một `audioOffsetMs`: trộn **Meeting Timeline** với **Media Timeline**. Ba recorded intervals trong fixture không có `mediaStartMs/mediaEndMs/segmentRefs` như COMMON yêu cầu.
- **Yêu cầu:** bổ sung interval media ranges và references đúng cho segment, biểu diễn pause/gap bằng meeting timeline riêng; resolve media offsets chỉ qua media ranges và segment refs có trạng thái. Khi thiếu coverage đúng nguồn, trả `gap/missing` có lý do; không tự chọn file gần nhất. Sửa test hiện tại đang dựa vào nhầm lẫn và thêm test media=1805000 valid khi có coverage, meeting pause=1805000 không phát, mapping sau resume, audio gap thật, source sai và qua biên.
- **Cách kiểm:** `cd poc/05-player && npm test` đúng tested SHA; fixture dùng `04-timeline.validateManifest` hoặc kiểm hợp đồng tương đương và chạy đối chiếu adapter; sau đó browser playback/underrun/0.75x/0.9x trên Windows. **Không** đánh dấu C1/C2 PASS trước waveform/giọng thực. Tình trạng hiện tại: **FAIL logic theo COMMON trên source hiện hành**, chưa chấm lỗi ở playback runtime.

### Điều kiện tiếp tục cho các chủ sở hữu khác

- **00-command:** chạy chính xác `npm test` 17/17 từ clean HEAD; lưu stdout, Node version và tested SHA trước khi DONE.
- **01-editor:** `poc/01-editor/` chạy `npm install; npm run build; npm run test:e2e` trên Windows Chrome/Edge; bốn tổ hợp UniKey/EVKey × Telex/VNI, 120 giây nhập không Enter, trace; không hạ cổng Gói 1.1.
- **02-capture:** bổ sung `poc/02-capture/` trên nhánh; tạo AudioWorklet/PCM vs MediaRecorder, 2048/4096 frame, ACK pool vs durable, Chrome headless synthetic, sau đó đo 3h wall-clock thật.
- **03-opfs:** từ exact Git SHA chạy `npm test && npm run bench`, đo 48 kHz thay vì chỉ 1 kHz, browser OPFS crash/quota thật; seek ~1.5s synthetic cần profiling và tối ưu phạm vi xác minh CRC.
- **04-timeline:** chạy `npm test` ở checkout sạch đúng SHA đã push, giữ kết quả 16/16 chỉ là fixture; tích hợp mapping đầu vào thực với 02/03 và nguồn audio qua 05 (sau khi 05 sửa).
- **06-notes:** `node --test notes.test.mjs` trên exact SHA; browser IndexedDB durable transaction, autosave commit ACK, multi-tab conflict, crash/reopen.
- **07-backup:** Python reference là oracle; vẫn cần `fflate/client-zip/zip.js` hoặc các JS adapters pinned và benchmark browser 0.5–2GiB, bounded RAM, ZIP64, thiếu file/checksum và restore máy khác.
- **08-export:** test lại exact Git source qua `node test.mjs && node generate.mjs`; mở DOCX trên MS Word, kiểm CSV/Markdown/TXT và trạng thái timestamp.
- **09-pwa:** bổ sung `poc/09-pwa/` và kiểm Web Locks/SW offline/update/migration; không reload khi ghi, `crossOriginIsolated=false`.

**Ưu tiên điều phối:** (1) 05 sửa lỗi timeline sai nguồn/false gap; (2) 02 và 09 phải có mã nguồn thực; (3) 01 qua cổng Windows IME; (4) 00/04/03/06/08/07 chốt lại exact SHA và chạy môi trường phù hợp; (5) sau đủ gate mới tích hợp, chưa merge/deploy.

- **09-pwa bổ sung trong lúc rà soát:** HEAD `ea60179c8cf1b4ad4802c597508772e45599ec3b` chỉ vừa cập nhật checkpoint; báo code và test Node 10/10 **LOCAL_ONLY**, `poc/09-pwa/` chưa có trên Git-tree. Vì thế chỉ ghi `IN_PROGRESS`, không ghi tested SHA hoặc bàn giao.

## G09-PWA — review mới sau commit code `46e82448` (15/11/2026)

- Đã kiểm nhánh `gemini/20261115-09-pwa` ở HEAD `4cdde5a51909e1db016bfe880097944a3c26ea06`, Git-tree có **22 tệp PoC**; checkpoint `READY_FOR_REVIEW`, Node mock 10/10 local, 7 kịch bản Playwright đã viết nhưng browser bị chính sách chặn localhost, **runtime NOT_RUN**. Không coi nội dung code trên nhánh là đã nghiệm thu Chrome/Edge.
- **Phạm vi giao G09**: chỉ `poc/09-pwa/` và `docs/workstreams/2026-11-15/checkpoints/09-pwa.md`; không sửa COMMON, không yêu cầu nhập worker 01–08.

### G09-ADD-01 — High: race Start → Release trong first OPFS ACK

- Nguồn: `poc/09-pwa/app.js` `startRecording` (dòng ~124–137) chờ `appendFixtureTick()` rồi **không kiểm lại lease** trước khi set `recording=true` và tạo interval; `releaseWriter` (~175–184) gọi `stopRecording()`, nhưng khi first ACK chưa xong, `recording=false`, `tickPromise=null` nên trả về và thả lock. ACK đến sau có thể bật ticker **khi không còn writer lease**. Đây là đường tranh chấp nhìn thấy từ mã, chưa chạy browser.
- Yêu cầu: biểu diễn trạng thái `starting/active/stopping` hoặc generation token; theo dõi first write đang chờ, chặn/đợi start khi release, kiểm lease/token sau ACK; không có append/ticker tiếp tục sau release. Fail-closed nếu Worker chậm/lỗi/abort.
- Test mới: trong `poc/09-pwa/tests/` dùng deferred first Worker ACK, nhấn Start→Release trước ACK, thả ACK sau khi release; **PASS khi không còn recording, ticker và writer nào chạy**, tab khác có thể acquire an toàn; ghi trạng thái saved/OPFS đúng, không ghi PASS nếu chưa chạy. Test thêm stop ngay trong Start và timeout.

### G09-ADD-02 — High: race autosave → Release làm mất dirty text

- Nguồn: `poc/09-pwa/app.js` `persistNote()` (~185–209) trả sớm khi `saving=true`; `releaseWriter()` (~175–183) `await persistNote()` nhưng **không đợi tác vụ save hiện có**, sau đó release và refresh. Nếu người dùng nhập ký tự mới khi save đang chờ, bản dirty mới có thể không được commit, dù status của revision cũ được báo Saved.
- Yêu cầu: theo dõi `pendingSave` Promise, đặt cờ releasing để khóa input mới, đợi tất cả commit/flush đang có, kiểm dirty lần cuối trước release; nếu lỗi phải giữ nguyên nội dung chưa lưu và cảnh báo, không tự xóa bằng refresh/read-only. CAS revision và callback stale phải không ghi saved giả.
- Test: trì hoãn IDB `transaction.complete`, nhập lần A rồi sửa lần B trước khi A hoàn tất, nhấn Release; **PASS khi B được commit + revision xác nhận trước release hoặc release bị chặn với B còn visible/dirty**, không bao giờ mất B mà UI báo Saved. Test quota/transaction abort và hai tab tiếp quản.

### G09-ADD-03 — Medium: migration không tự retry khi writer cuộc họp KHÁC nhả lock

- Nguồn: `poc/09-pwa/lease.js` `makeChannel` (dòng ~67–75) chỉ chuyển tiếp BroadcastChannel event khi `meetingId` khớp; `app.js` listener đầu file chỉ retry `migrate()` khi thấy `writer-released`. Tuy nhiên `MAINTENANCE_LOCK` là **global cùng origin**, writer của meeting B cũng chặn migration meeting A; sự kiện B không tới A → `migrationBlocked` giữ nguyên, nút Acquire bị disable.
- Yêu cầu: listener riêng cho sự kiện global maintenance/release hoặc retry an toàn có kiểm lại Web Locks, kèm nút Retry thủ công khi blocked; không để UX kẹt vô hạn.
- Test 2 meeting IDs A/B: app A=v2 bị migrate blocked khi B giữ writer, B release → A retry và vẫn giữ document/marks/revision, không sửa dữ liệu khi B chưa release.

### G09-ADD-04 — Safety hardening: yêu cầu activate SW phải không bypass maintenance gate

- Nguồn: `poc/09-pwa/sw.js` message handler (dòng ~21–26) chạy `skipWaiting()` cho bất kỳ message có `type='ACTIVATE_AFTER_EXCLUSIVE_GATE'`, không xác minh lock hoặc sender. Guard `withMaintenanceLock` hiện chỉ ở `app.js` (`activateWaiting`), nên các message khác có thể gọi trực tiếp, đặc biệt cần thận trọng trên shared GitHub Pages origin.
- Yêu cầu: xác định trust boundary và phòng ngừa direct message ngoài quy trình an toàn; thêm negative test gửi message khi meeting khác đang ghi để xác nhận không tự activate. Giữ `skipWaiting` opt-in, không tự reload. Nếu chưa thể xác nhận bảo vệ nội bộ SW trên trình duyệt, ghi hạn chế và HOLD phát hành production; không lấy mock PASS làm bảo đảm.
- Đối chiếu thêm SW network-first `index.html` với cached phiên bản JS cũ khi v2 đã phát hành; kiểm version-consistent shell hoặc giữ HTML và JS đồng nhất khi waiting worker còn sống.

**Phân loại:** ADD-01/02 là nguy cơ race suy ra trực tiếp từ await/lock (cần xác nhận bằng test có điều khiển); ADD-03 là rủi ro kẹt retry từ bộ lọc meetingId; ADD-04 là yêu cầu kiểm soát điều kiện kích hoạt. Chưa có kết quả chạy negative cases trên bản đã sửa → **NOT_RUN**, không tự gọi là runtime FAIL. Các test TC32–TC35 trên browser/Windows vẫn giữ NOT_RUN nếu chưa thử.

### Điều kiện xét lại G09

1. Fix ADD-01/02 và bổ sung deterministic tests; xử lý ADD-03 và hardening ADD-04 trong phạm vi PoC; run `npm test` trên đúng checkout, ghi SHA/stdout.
2. Chạy 7 Playwright scenarios và các negative mới trên Chrome/Edge có localhost được phép; lưu version/screenshot/trace, sửa FAIL.
3. Giữ việc Pages HTTPS/origin riêng và tích hợp capture/OPFS thực cho **đợt tích hợp được ủy quyền**; không tự deploy hay sửa nhánh khác.

## G02-capture — kiểm tra mã mới sau bàn giao (15/11/2026)

- Branch `gemini/20261115-02-capture` HEAD quan sát `8a9780cf01e3b7e0a014ddf76bdbf9db1f2ad7e8`, Code SHA `6898ec9b11c296427f11479c31514ecda13a08b4`. Git-tree có **18 tệp PoC** cùng checkpoint riêng, không sửa các luồng khác.
- Checkpoint chính G02 báo `PARTIAL/BROWSER_BLOCKED`, Node 11/11 PASS từ mã đã bàn giao, 3 giờ chỉ duyệt metadata 518.4 triệu frame (không ghi/đọc 3 giờ), browser Chromium `NOT_RUN` vì URLBlocklist. Không đánh `DONE` hoặc PASS Gói 1.2.
- **Bằng chứng reviewer mới:** thực thi chính source GitHub blob `2fe32254f7871c144ff0f8e3f3567f6323c9c461` (controller) và `9163ce0d1cd30cc18875d3132b43e406d5191683` (processor) trong V8 với thiết bị/ArrayBuffer fake. Đây là *controlled JS mock*, **không phải test micro/browser**, không tự áp status PASS/FAIL cho TC thực địa.

### G02-ADD-01 — High/Critical candidate: race Start / Stop khi quyền micro chưa được cấp

- **Source:** `poc/02-capture/src/controller.mjs`: `start()` chờ `getUserMedia()`/setup nhiều bước nhưng không kiểm lại `this.stopping`; `stop()` có thể hoàn tất khi chưa có context/media; `index.html` chỉ disable nút Start sau `await run.start()`, nên double-click cũng có thể khởi tạo hai session và mất handle session trước.
- **Reproducer V8 trên đúng mã:** `run.start({engine:'media',source:'microphone'})` với promise quyền mic hoãn; gọi `await run.stop()`; sau đó resolve quyền micro. Đã quan sát `mediaStartCount=1` **sau Stop**, `mediaStopCount=0`, `trackStopCount=0`, `contextCloseCount=0`, gọi Stop lần hai chỉ lấy lại `stopPromise` cũ. Nguy cơ micro tiếp tục chạy sau khi người dùng đã dừng.
- **Yêu cầu:** state machine `idle/starting/capturing/stopping/stopped/failed` hoặc generation/abort token; serialize start/stop/permission, dừng và release mọi stream phát sinh khi stop trước ready; disable Start ngay khi click, không ghi đè `run` khi đang khởi tạo; track-ended/start-error cũng đi qua cleanup duy nhất.
- **Regression:** deferred getUserMedia permission; Stop trước grant; double-click Start; revoke permission/setup fail; Stop khi chưa ready; khi kết thúc không còn `MediaStreamTrack` live, context/recorder/timer/worklet/worker tồn dư, không khởi động sau stop; lưu test output đúng SHA.

### G02-ADD-02 — High: lỗi Stop/timeout bỏ qua cleanup (đã tái hiện)

- **Source:** `poc/02-capture/src/controller.mjs` `stop()` chờ `media.stop()` rồi `this.final` (sink drain), sau đó mới `AudioContext.close()` và `getTracks().stop()`; hiện **không có finally** bao quanh chuỗi await.
- **Reproducer V8:** ép `media.stop()` reject: `stopError='forced MediaRecorder.stop failure'`; `contextClosed=false`; `trackStopped=false`. Tương tự Worker final reject/timeout có thể bỏ qua cleanup.
- **Yêu cầu:** `try/finally` dọn mic/screen tracks, oscillator, AudioContext, MessagePorts/worker handle, với trạng thái fail-closed và lỗi hiển thị; preserve diagnostic WAV export chỉ khi stop thành công, dùng `dispose()` có chủ đích sau export. Stop idempotent kể cả khi hỏng, không báo hoàn tất lưu giả.
- **Regression:** media.stop reject/timeout, worker crash/timeout, track ended giữa Stop, cleanup được gọi chính xác một lần và không còn track live; UI báo lỗi rõ.

### G02-ADD-03 — High integration gap: ánh xạ thời điểm nhập ↔ sample chưa đủ

- **Source:** `poc/02-capture/src/controller.mjs` `results().clockMapping` chỉ trả **một** điểm `{inputMonoMs:startMonoMs,sampleIndex:0}`; `inputMonoAtStart/contextTimeAtStart` được lấy trước setup bất đồng bộ và Worklet mới nhận lệnh Start sau đó. Worklet `paused/resumed` có `sampleIndex/contextTimeSec`, nhưng chưa tạo mapping points đã hiệu chuẩn.
- **Probe V8:** `results().clockMapping.length === 1`. Luồng G04 `inputToSample` yêu cầu **ít nhất hai** điểm mapping để nội suy, và sau Pause phải phân biệt input monotonic / meeting time với media frame cursor.
- **Yêu cầu:** Worklet START ACK và mốc sample thật, mapping sau pause/resume, định kỳ và cuối phiên (sampleIndex/frameCursor + monotonic input correlation); không suy mapping từ thời điểm nhận message trễ trên main, không tự nối qua gap/pause. Thử drift/jitter và event delay; hợp đồng COMMON giữ nguyên.
- **Regression:** tạo 2+ calibrated points có ý nghĩa, pause 10s không cộng 10s vào media, resume không gán nhầm mốc note sang sample trước/sau; sample drift ±100 ppm, delayed message, đoạn gap/unavailable, đối chiếu G04 adapter **bằng fixture riêng**, không import code của worker khác.

### G02-ADD-04 — Medium/High resilience: không giới hạn số frame trong cấu hình bộ đệm

- **Source:** `poc/02-capture/src/capture-processor.js` case `attach` kiểm `batchFrames` chỉ integer ≥128, **không có giới hạn trên**. Sau đó `poolSize × batchFrames × channels × 4` cấp phát trên audio thread. Browser UI chọn sẵn 2048/4096 nhưng public `CaptureComparison.start(config)` có thể nhận số rất lớn.
- **Probe V8:** `attach(batchFrames=100000000,poolSize=2,channels=1)` chấp nhận và yêu cầu cấp hai buffer **400,000,000 bytes mỗi cái** (FakeArrayBuffer, không cấp phát thật).
- **Yêu cầu:** whitelist `2048/4096` cho PoC hoặc kiểm hard byte ceiling tổng pool + queue; config lỗi trả `invalid-configuration` trước bất kỳ allocation nào; validate recordingId/finite config và không crash AudioWorklet.
- **Regression:** 0/127/-1/float/NaN/`1e8` frames, pool 2..64, channels 1..2; zero allocations for invalid configs.

### G02-ADD-05 — Benchmark completeness (đã biết, không gán lỗi mới)

- `MediaRecorderProbe` giữ tối đa 20 MB trong `parts`, nếu vượt thì `truncated=true` và `getBlob()` không xuất bản đầy đủ; bên PCM diagnostic chỉ giữ tối đa 8 giây WAV prefix. Đây là giới hạn được công bố minh bạch, **không thể dùng hai đầu ra hiện tại để chứng minh phát/seek toàn bộ phiên 3 giờ**. Với engine đối chứng nên có fixture test lưu theo luồng/rolling segments, chỉ giữ buffer có giới hạn, đo bytes/cadence và đọc/tua điểm đầu/giữa/cuối mà không kéo 3 giờ vào RAM.
- Chạy Chrome/Edge Windows thực 3h với nguồn xác định; audio track thực của TC21 có hỗ trợ thì test, không hỗ trợ phải đánh `UNSUPPORTED/NOT_RUN`, không bịa PASS. OPFS journal/crash của G03 không bị chuyển trách nhiệm sang G02.

**Điều kiện bàn giao G02 vòng tiếp:** owner sửa ADD-01..04 và bổ sung negative tests; chạy `npm test` + `npm run test:virtual3h` trên **đúng SHA đã push** và ghi log/checkpoint. Nếu browser/Windows còn bị chặn, ghi `NOT_RUN` và chuyển kịch bản thực địa, không tuyên bố DONE Gói 1.2. Không chỉnh COMMON hoặc branch worker khác.
