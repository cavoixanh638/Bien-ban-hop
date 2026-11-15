# Tracker Gemini · Mốc Họp V1.2

Writer duy nhất: Gemini 00. [Mục lục](README.md) · [Hợp đồng](COMMON.md) · [Checkpoint điều phối](CHECKPOINT.md)

Baseline `6142f56a6efdb27aa9445920c9321f7930c0d5fd`. Trạng thái dòng này là tình trạng bàn giao độc lập của luồng. Trạng thái gói sản phẩm do `docs/STATUS.md` quản lý. Đợt tích hợp: **chưa bắt đầu**. **Bảng dưới là snapshot MỚI NHẤT sau kiểm lại HEAD/chứng cứ tất cả 10 nhánh; các đoạn lịch sử bên dưới có thể chứa HEAD cũ (không dùng làm trạng thái hiện hành).** Cột `HEAD` là snapshot nhánh được quan sát khi kiểm tra, **không** suy ra tested SHA. Cột Tested SHA để — nếu chưa có bằng chứng chạy đúng checkout tại SHA. Thời điểm quan sát: 15/11/2026. Trạng thái test V8 00 dùng shim Node và SHA-256, không thay thế `npm test` từ clean remote checkout.

| Owner | Checkpoint | Trạng thái | HEAD | Tested SHA | Test | Bằng chứng / việc còn thiếu |
|---|---|---|---|---|---|---|
| Gemini 00-command | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/CHECKPOINT.md) | READY_FOR_REVIEW | 8bf2a251 | —; Node exact NOT_RUN | V8 mock 17/17; Node clean NOT_RUN | Có harness và handoff; chờ Node test đúng checkout, chưa tích hợp |
| Gemini 01-editor | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-01-editor/docs/workstreams/2026-11-15/checkpoints/01-editor.md) | IN_PROGRESS / GATE_1_1_HOLD | dfb0b1fe | 4e9283ee blob-equiv. | Node 75/75; E2E/Windows NOT_RUN | G01-ADD-01 pending journal đã sửa; thiếu Tiptap browser và Windows IME |
| Gemini 02-capture | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-02-capture/docs/workstreams/2026-11-15/checkpoints/02-capture.md) | PARTIAL / BROWSER_HOLD | 4ceb8049 | 41bff106 V8 source | V8 24/24 mới; Node 36/36 SHA cũ | G02-ADD-06/07 đã sửa; Node 44 khai báo mới NOT_RUN, 3h thực NOT_RUN |
| Gemini 03-opfs | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-03-opfs/docs/workstreams/2026-11-15/checkpoints/03-opfs.md) | READY_FOR_REVIEW | 3add589c | 58cdba99 blob-equiv. | Node 25/25; 3h synthetic | Browser OPFS/IDB, crash/quota và Windows NOT_RUN |
| Gemini 04-timeline | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-04-timeline/docs/workstreams/2026-11-15/checkpoints/04-timeline.md) | DONE_POC_ONLY | 6681cdb1 | f093cfcf tree-verified | Node 33/33; TS PASS | PoC fixture DONE, app/audio thực NOT_RUN |
| Gemini 05-player | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-05-player/docs/workstreams/2026-11-15/checkpoints/05-player.md) | STANDALONE_POC_VERIFIED_LINUX / HOLD | 153db7d1 | 17e1b6f3 blob-equiv. | Node 10/10; Chromium synthetic 10/10 | C1/C2 voice + sample loopback/Windows NOT_RUN |
| Gemini 06-notes | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-06-notes/docs/workstreams/2026-11-15/checkpoints/06-notes.md) | IN_PROGRESS / BROWSER_GATE | 62248128 | 4dcc4625 blob-equiv. | Node 22/22 | IndexedDB browser, crash/quota/multitab NOT_RUN |
| Gemini 07-backup | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-07-backup/docs/workstreams/2026-11-15/checkpoints/07-backup.md) | PARTIAL / LIBRARY_GATE | 032c6a8f | eea265dc blob-equiv. | Node 31/31; Python 14/14; interop 2/2 | fflate ZIP32 guard đã bổ sung; 3 npm packages/Windows/restore khác máy NOT_RUN; D13 OPEN |
| Gemini 08-export | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-08-export/docs/workstreams/2026-11-15/checkpoints/08-export.md) | READY_FOR_REVIEW | b6b21b5e | 82d93899 blob-equiv. | Node 55/55; LibreOffice PASS | Word/Excel Windows và browser HTTP NOT_RUN |
| Gemini 09-pwa | [Đọc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-09-pwa/docs/workstreams/2026-11-15/checkpoints/09-pwa.md) | READY_FOR_REVIEW / BROWSER_HOLD | d5383f0d | 2a0f68d8 blob-equiv. | Node 28/28; HTTP 9/9 | SW, two-tab, offline/IDB/OPFS browser NOT_RUN |

## Bàn giao mới nhất — kiểm tra 15/11/2026 (khoảng 22:00 giờ Việt Nam)

- Đối chiếu **10/10 refs HEAD + checkpoint**, baseline→HEAD cho **9/9 worker**: tất cả diff đều trong `poc/<owner>/` và checkpoint được giao, **0 file ghi đè ngoài phạm vi**. Không có PR nào; `main` vẫn `6142f56`, `docs/STATUS.md` còn PLANNING. **Bàn giao PoC ≠ DONE nghiệm thu V1.2**.
- **G01 mới:** G01-ADD-01 đã sửa bằng `PendingLinkJournal` sidecar out-of-band, Node **75/75 PASS** trên source tương đương Git blob; Tiptap npm/build/E2E, 4 cấu hình Windows UniKey/EVKey × Telex/VNI và P95 **NOT_RUN**, tiếp tục HOLD Gói 1.1.
- **G02 mới:** G02-ADD-06/07 đã sửa pending clock và permission prompt; V8 **24/24 PASS** trên mã `41bff106`; `npm test` Node toàn bộ **44 test khai báo trên SHA mới NOT_RUN** (36/36 Node là SHA cũ), browser/3h thiết bị thật **NOT_RUN**.
- **G07 mới:** bổ sung `ClassicZip32Budget` chặn fflate writer tràn giới hạn classic ZIP, Node **31/31**, Python **14/14**, interop **2/2** PASS theo checkpoint; `fflate/client-zip/zip.js` thật **chưa chạy**, dù ZIP64 native reference đã test tới >4GiB. D13 vẫn **OPEN**.
- **G03/04/05/06/08/09:** HEAD không thay từ review trước; giữ chính xác phạm vi PASS fixture và `NOT_RUN` thiết bị/browser. G04 DONE chỉ PoC fixture.
- **Kết quả:** **SOURCE_HANDOFF_READY / INTEGRATED_APP_NOT_STARTED / RELEASE_HOLD**. Bắt đầu đợt tích hợp chỉ trên nhánh mới sau khi có chỉ đạo; không merge `main`/deploy. Hướng dẫn pin SHA, thin adapters và Windows gates: [INTEGRATION_READINESS_20261115.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/poc/00-contract-tests/INTEGRATION_READINESS_20261115.md).
- **Cross-worker gate cho G00, không giao lỗi riêng cho worker:** G02 `queueInput` trả `sampleIndex`/recordingId/status; G01 `PendingLinkJournal.prepare` yêu cầu thêm meetingId/generation/intervalId/inputMonoMs/audioOffsetMs/coverage. Cần thin adapter cùng manifest G04, kiểm sample→media offset, storage durable G03/G06, chống gán nguồn sai/mốc của phiên khác. Chưa có bằng chứng cross-worker PASS.
- G00 riêng còn cần **17/17 Node test trên đúng clean checkout** (hiện chỉ V8 shim PASS). Container thử `git ls-remote` nhưng không phân giải được `github.com`; **NOT_RUN**, không bịa PASS.

## G10 — Tiến độ tích hợp ứng dụng (bằng chứng GitHub Actions 15/11/2026)

- **Đã thực hiện:** tạo nhánh mới [`integration/20261115-g10-v1.2`](https://github.com/cavoixanh638/Bien-ban-hop/tree/integration/20261115-g10-v1.2), ghim 9 cây nguồn PoC G01–G09 từ các nhánh sở hữu, và tạo [Draft PR #1](https://github.com/cavoixanh638/Bien-ban-hop/pull/1) về `main`. **Không merge/deploy**; main vẫn `6142f56a`. Code/Tested SHA tích hợp **`a4e680d265f49ec8a3781d6bdbab9ac16449c875`**.
- **Đã viết app chung `app/`**: Vite 6/Tiptap, ghi chú trung tâm, G01 TimeSpan+pending sidecar, G02 AudioWorklet qua G03 OPFS/IndexedDB, G06 note + pending journal CAS trong một transaction, G09 Web Locks writer, G05 playback lấy PCM từ G03 sau khi dừng ghi, G08 xuất DOCX/TXT/MD/CSV, G07 ZIP64 stream 1 recording/meeting, PWA scoped shell và an toàn SW activation. Có giao diện và `app/START_WINDOWS.cmd` cho người dùng tự thử; **chưa có restore .mochop vào cùng app**, chưa hỗ trợ đa recording trong backup.
- **Kết quả chính xác:** [GitHub Actions run #43733129441](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/43733129441) `success`, HEAD+tested SHA trùng `a4e680d2`, **Linux Ubuntu 24.04 + Windows runners PASS**. `app/tests/core.test.mjs` **14/14 PASS**; Vite/Tiptap build PASS; G01 **75/75**, G02 **44/44 Node đúng commit tích hợp**, G03 **25/25**, G05 **10/10**, G07 **31/31 Node + 14/14 Python + 2/2 interop**, G08 **55/55**. **Chromium Playwright 1.56 fake micro**: `dev 3/3 PASS` (1 PWA case intentionally SKIPPED), `production-preview 4/4 PASS` (bao gồm reload offline), **0 retries**.
- **Lỗi tích hợp đã sửa trong G10:** Tiptap external-import Vite resolution, Windows Python UTF-8 interop test, writer SaveQueue race, click timeSpan nhầm caret boundary, playback pre-roll 5s chạm vùng âm thanh chưa có dữ liệu. Bản cuối yêu cầu anchor **valid đúng recordingId**, nếu pre-roll bị chặn thì có thông báo và phát **chính mốc đã xác thực**, không nhảy tới file lân cận. Đã thêm negative unit.
- **Trạng thái sản phẩm:** `INTEGRATION_ALPHA_TESTED_WITH_SYNTHETIC_BROWSER / RELEASE_HOLD`. Bản dùng thử **chưa nghiệm thu Windows thực**: UniKey/EVKey Telex/VNI 120s/P95, micro thật/3h wall-clock/CPU-RAM, OPFS crash/quota/mất điện, audio sample-gapless/giọng 0.75×/0.9×, đầy đủ G04 meeting timeline, ZIP 3 library candidate D13, restore máy thứ hai, Word/Excel Windows, PWA migration & TC01–TC38 đầy đủ vẫn `NOT_RUN`. Không dùng dữ liệu họp quan trọng.
- **Bước tiếp theo có điều kiện:** user test trên Windows từ [app/README.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/integration/20261115-g10-v1.2/app/README.md), ghi evidence và sửa lỗi thật; không merge main trước phê duyệt và đủ cổng an toàn.

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

## G00 — Kiểm tra toàn bộ 10 nhánh sau khi worker bàn giao (15/11/2026)

**Nguồn kiểm:** GitHub HEAD/refs, checkpoint riêng, evidence file, diff baseline `6142f56` → từng nhánh và diff Code SHA → HEAD. Tại thời điểm kiểm tra: 10/10 nhánh có mã/tài liệu trong phạm vi mình sở hữu. 9/9 nhánh worker G01–G09 **không có diff ngoài** `poc/<owner>/` và checkpoint riêng. G00 có 11 tệp entrypoint/COMMON/README gốc của công tác điều phối tạo ở nhánh 00 trước khi nhận vai trò; các commit G00 sau tiếp quản chỉ sửa tracker/checkpoint và `poc/00-contract-tests`.

| Luồng | HEAD quan sát | Code/test snapshot có bằng chứng | Kết luận bàn giao độc lập |
|---|---|---|---|
| G00 | `18e1d8c2` (trước commit audit) | V8 fixture 17/17; native Node đúng byte GitHub chưa chạy | `READY_FOR_REVIEW`, chưa DONE |
| G01 | `71595a60` | Node fixture **41/41** log; Chromium native input ASCII baseline 56 events | **HOLD gate 1.1**: source/test mới hơn checkpoint Code SHA cũ, thiếu SHA test xác định; Tiptap deps/build/E2E/Windows UniKey/EVKey NOT_RUN |
| G02 | `c4845450` | Code/Tested source `0083a670`, Node **36/36**, 3h metadata-only | Race/cleanup/clock/buffer đã sửa theo TRACKER; browser/3h wall-clock/TC21 NOT_RUN |
| G03 | `3add589c` | Code/Tested `58cdba99`, Node **25/25**, synthetic 3h 48k, ffprobe PASS | PoC sẵn sàng review, browser OPFS/quota/crash thực NOT_RUN |
| G04 | `6681cdb1` | Code/Tested `f093cfcf`, fixture **33/33** và tsc PASS | **DONE PoC độc lập**; tích hợp/live NOT_RUN |
| G05 | `153db7d1` | Code/Tested `17e1b6f3`, Node **10/10**, Chromium synthetic **10/10** | Lỗi `meetingMs` vs `audioOffsetMs` đã sửa; audio loopback/giọng thật/Windows NOT_RUN |
| G06 | `62248128` | Code/Tested `4dcc4625`, Node **22/22** | PoC logic sẵn; real IndexedDB browser/quota/crash NOT_RUN |
| G07 | `22e8f5d1` | Code/Tested `d9ed3ca5`, JS **23/23**, Python **13/13**, interop **2/2**, ZIP reference 512MiB/2GiB PASS | **Chưa DONE**: npm candidate `fflate/client-zip/zip.js` không tải được, browser/restore máy khác NOT_RUN |
| G08 | `b6b21b5e` | Code/Tested `82d93899`, Node **55/55**, 8 files, DOCX LibreOffice PASS | Sẵn sàng review; Word/Excel Windows/HTTP browser NOT_RUN |
| G09 | `d5383f0d` | Code/Tested `2a0f68d8`, Node mock **28/28**, HTTP smoke **9/9** | G09-ADD-01..04 sửa ở fixture; browser SW/IDB/OPFS/2 tab NOT_RUN |

**Đã đối chiếu Code SHA → HEAD**: G02/03/04/05/06/07/08/09 chỉ đổi evidence/log/README/checkpoint sau code snapshot; **G01** đã sửa mã nhiều tệp sau Code SHA `6db17bdb` nhưng checkpoint vẫn ghi `6db17bdb`. File `evidence/node22-41-tests.tap` có 41 PASS; cần chủ G01 cập nhật **Code SHA/Tested SHA mới**, xác minh lại source bằng Git blob; không dùng SHA cũ để chứng nhận code mới.

### Kết luận điều phối và cổng tiếp theo

1. **Không thể kết luận “10/10 DONE”**: có 10/10 PoC source bàn giao, nhưng checkpoint công khai chỉ G04 gọi `DONE` ở mức fixture. G01/G02/G06/G07 còn ghi `IN_PROGRESS/PARTIAL`; G03/G08/G09 `READY_FOR_REVIEW`; G05 `POC_VERIFIED_LINUX/HOLD`; G00 `READY_FOR_REVIEW`. 9 worker chưa tích hợp trên cùng mã. `main/docs/STATUS.md` hiện ghi `PLANNING/CHƯA CÓ ỨNG DỤNG ĐƯỢC NGHIỆM THU`.
2. **BLOCKER 1: G01 / Windows typing**: cài npm có mạng, build Tiptap thật, Playwright trên origin; Windows Chrome+Edge, 4 cấu hình UniKey/EVKey × Telex/VNI, gõ 120s/đổi dấu/paste/Undo/Redo, latency/marks; lỗi chữ hoặc sai nguồn thì **HOLD**. Không thay bài này bằng 41 fixture tests.
3. **BLOCKER 2: G07 / lựa chọn ZIP**: npm có mạng, chạy ba candidate thật `fflate/client-zip/zip.js` (client-zip xuất, zip.js nhập), benchmark 0,5–2GiB, ZIP64/interoperability, RAM/backpressure và restore browser/máy khác; D13 vẫn OPEN.
4. **Gates thực địa sau PoC**: G02 3h thu thật cùng nguồn (PCM vs MediaRecorder); G03 OPFS journal/quota/crash; G05 loopback sample-level và giọng chậm; G06 real IndexedDB; G08 Word/Excel; G09 real SW/offline/migration/Web Locks; G04 nối clock/sample thực khi tích hợp.
5. **G00 chưa tự DONE**: harness `poc/00-contract-tests` có 17/17 V8 mock nhưng bản đúng GitHub bằng `node --test` từ clean checkout vẫn `NOT_RUN`; cần chốt SHA và log trên máy có GitHub/npm.
6. Sau G01 qua gate 1.1, tổ chức **đợt tích hợp được giao riêng** bằng cách pin code SHA 9 nhánh, dùng adapter theo `COMMON.md`, test âm tính source sai/saved giả/dual writer, chạy TC01–TC38 trên bản tích hợp với Windows/thiết bị thật. **Không merge/main/deploy khi chưa có lệnh tích hợp và chứng cứ nghiệm thu.**

**Không phát hiện thêm FAIL runtime mới trong lần rà review này**. Đây là rà từ code/checkpoint/evidence và đối chiếu diff; tôi **không thể chạy lại toàn bộ bộ test trong container qua git clone** do DNS không phân giải `github.com`. Bài có browser/Windows không chạy vẫn là `NOT_RUN`, không được diễn dịch thành PASS.

## G02-capture — rà soát bổ sung sau vòng PASS 36/36 (15/11/2026)

**HEAD kiểm lại:** `c4845450d2ef6cc3d24fe22a9a445c588229b942`. `Code/Tested SHA` theo checkpoint G02: `0083a670e5537952899afb247949bc71442b46b8`, 36/36 Node PASS bằng byte-identical Git blobs. ADD-01..05 **đã xử lý** theo checkpoint, **không yêu cầu làm lại**. G02 vẫn `PARTIAL / NEEDS_BROWSER_AND_WINDOWS_EVIDENCE; NOT DONE` ở entrypoint; 3h real/browser/TC21 `NOT_RUN`.

### G02-ADD-06 — High: đang thu nhưng mốc gõ ngay sau điểm clock cuối bị trả `unlinked`

- **Source:** `poc/02-capture/src/clock-mapper.mjs` (`CaptureClockMapper.resolveInput`). Trong `active` recorded interval, `last = interval.mappingPoints.at(-1)?.inputMonoMs`; điều kiện `inputMonoMs >= last` bỏ qua ngay cả thời điểm bằng điểm clock đã xác nhận, và mọi thời điểm sau điểm cuối nhưng trước `progress` tiếp theo.
- **Reproducer trên đúng GitHub blob** `7a167940b6b2c95361f77170ae7a2fbaeda57276`, thực thi JavaScript V8 không cần micro: `receive(started sample=0,t=0)`, `receive(progress sample=48000,t=1000)`; `resolveInput(1000)` và `resolveInput(1500)` đều trả `{status:'unlinked',reason:'outside calibrated recorded coverage'}`; sau `receive(progress sample=96000,t=2000)`, `resolveInput(1500)` trả `valid, sampleIndex=72000`. Đây là sai trạng thái tạm thời có thể làm mất liên kết ghi chú nếu Editor ghi `unlinked` vĩnh viễn ở thời điểm gõ.
- **Yêu cầu:** ở đoạn recorded đang hoạt động, cho phép ánh xạ **đúng** điểm clock cuối hợp lệ; đối với input sau điểm cuối nhưng chưa có điểm để nội suy, trả `pending` rõ ràng (không bịa audioOffsetMs) kèm dấu vết `inputMonoMs`/recording source để hàng đợi liên kết về sau. Khi có điểm mới, xét lại pending; khi pause/gap/stop, fail-closed đúng vùng và không tự chọn nearest segment. **Không nhúng trạng thái pending/valid vào `timeSpan` Mark**, giữ `typedAt` là thời điểm gõ đầu cụm.
- **Regression deterministic:** t=1000 exact, t=1500 pending → valid(sample=72000) sau progress; pause trước progress không hồi tố nối nhầm; stop ngay sau điểm cuối, sink-gap và unavailable không tự gán audio. Kiểm hợp đồng với G01/G04 ở **đợt tích hợp** qua thin adapter, không sửa COMMON/nhánh khác.
- **Phân loại bằng chứng:** logic outcome `unlinked` đã tái hiện trong V8 trên source byte GitHub, **browser live NOT_RUN**. Không gán `TC17 FAIL` runtime trước khi kiểm thật.

### G02-ADD-07 — Medium/High: Stop chờ vô hạn nếu permission prompt không settle

- **Source:** `poc/02-capture/src/controller.mjs`, `start()` chờ `getUserMedia()` và `stop()` với `prior==='starting'` `await this.startPromise` không có thời hạn/hủy trạng thái khi browser prompt không Grant/Deny. G02-ADD-01 đã test quyền cấp **trễ rồi hoàn tất**, chưa test promise **không bao giờ settle**.
- **Reproducer trên đúng GitHub blob** `e7b0370adb6e6fb5d3ce64cb56485f4299a8c955`: fake `navigator.mediaDevices.getUserMedia=()=>new Promise(()=>{})`, `start({engine:'media',source:'microphone'})` rồi `stop()`; sau nhiều microtask `startStatus=pending,stopStatus=pending,state=stopping`. Đây là kiểm đường async bằng V8 fake, **không phải UI Windows test**.
- **Yêu cầu:** cung cấp cách hủy/thoát UI có giới hạn khi permission bị bỏ mặc; đánh dấu cancellation generation, đảm bảo nếu quyền được cấp **sau khi hủy** thì mọi track phải dừng ngay, tuyệt đối không Start lần nữa. Không báo “đã giải phóng micro” nếu browser chưa trả permission; nếu chưa thể khẳng định release, thể hiện `permission_pending_cleanup`/cảnh báo. Cho phép reset hoặc retry chỉ khi không tạo session writer trùng và không có rò nguồn.
- **Regression deterministic:** permission không settle (Stop/UI không mắc kẹt vô hạn); grant muộn sau cancel dọn nguồn đúng 1 lần; deny muộn; double-click start/stop; không phát start event sau cancel. Thử browser thật khi có môi trường.

**Phạm vi sửa:** chỉ `poc/02-capture/src/clock-mapper.mjs`, `controller.mjs`, `index.html`, các bài test trong `poc/02-capture/tests/`, README/evidence, checkpoint G02. Owner G02 tự sửa và push, ghi Code/Tested SHA, 36 test gốc vẫn PASS, các bài mới PASS/FAIL/NOT_RUN thực chất. Không thay COMMON và không đánh dấu DONE vì chưa có Windows/3h thật. Các ADD này là **hai ca mới**, không tái mở ADD-01..05.

## Kiểm lại G01 và G07 sau vòng bàn giao tiếp theo — 15/11/2026

Đọc trực tiếp GitHub HEAD, checkpoint, entrypoint, source và bằng chứng; không lấy từ lời báo DONE. HEAD G01 **`a44e94bcac07b8e1c0cb49c1d31d9066e7dda313`**, mã được test **`78aa598d423bba2ebc3bba3562e6bcbea2c2f644`**; HEAD G07 **`d112aff779ae21ba21de072ffe12e66f2883da53`**, mã được test **`4b6ebd2b26dc35ab9a7e60455ff7bb1c85e776a6`**. Diff Code SHA→HEAD của cả hai chỉ là checkpoint/README/evidence/log, không thay logic mã. Diff baseline→HEAD chỉ nằm trong thư mục và checkpoint của từng chủ nhánh.

- **G01**: đã sửa ba lỗi độc lập về reset Undo/Redo, không đoán mốc tại ranh giới, clipboard HTML không lộ audio IDs; Node source-blob-equivalent **45/45 PASS**, syntax PASS. **Không có** build Vite/Tiptap E2E, Windows UniKey/EVKey Telex/VNI, 120s nhập thật, P95, số DOM/Mark thực — đều **NOT_RUN**. Trạng thái đúng: `IN_PROGRESS/GATE_1_1_HOLD`, chưa READY.
- **G07**: đã phát hiện và sửa manifest.json byte tamper mà central CRC cũ không đổi, cùng Windows unsafe paths/Unicode NFC; Node source-blob-equivalent **26/26 PASS**, Python **14/14**, interop **2/2**. Benchmark reference ZIP64 một audio entry **4GiB+1 byte PASS** trên đường code trước chỉnh tên NFC; 512MiB/2GiB thuộc source SHA vòng trước; **không** gán các benchmark này cho 3 npm packages. `fflate/client-zip/zip.js` chưa tải/chạy do `EAI_AGAIN`, browser OPFS/IDB, Windows, restore máy khác **NOT_RUN**. D13 `OPEN`, `PARTIAL/NOT_DONE`. **Không thấy lỗi độc lập mới đã tái hiện** trong lần rà này.

### G01-ADD-01 — Ưu tiên cao: giữ liên kết chữ khi đồng hồ audio chưa cung cấp offset tại thời điểm nhập

- **Bằng chứng source-level (mới, không phải Windows runtime FAIL):** `poc/01-editor/src/policy.mjs`, Git blob `6acc1f51da7aafab500b58b08de616f9e1877954`: `normalizeContext({source:'live_recording',recordingId:'rec-1',audioOffsetMs:null,coverage:'pending'})` trả `{recordingId:null,audioOffsetMs:null,source:'unlinked'}`; `makeAnchor` lưu mốc `unlinked`. Khi clock G02 có điểm tương lai, source/mốc monotonic cần để tái liên kết không còn trong Mark. Đây là **lỗ hổng giao diện kết nối** với G02-ADD-06, vì G02 có thể tạm trả `pending` cho đoạn đang thu giữa hai clock points; không phải lỗi fixture hiện có của G01.
- **Owner G01, file đề xuất:** `poc/01-editor/src/tracker.mjs`, `policy.mjs`, tests và README/evidence/checkpoint riêng G01. Tạo fixture/adapter độc lập nhận context `pending` có `recordingId`, `inputMonoMs`, `typedAt` và generation; giữ **out-of-band pending provenance** (có thể EditJournal fixture), không ghi sai `audioOffsetMs` vào Mark và không thêm trạng thái động vào `timeSpan`. Khi G02 xác minh coverage `valid`, cho phép finalize Mark cùng `anchorId`, `typedAt` gốc (hoặc chặn rõ nếu đã bị sửa/xóa/đổi meeting); khi pause/gap/missing/stop phải fail-closed, tuyệt đối không gán nguồn của segment kế tiếp.
- **Regression định lượng:** (a) gõ t=1500 với recording `rec-1`, clock cuối t=1000 → pending, sau clock t=2000/media sample=96000 → anchor same `anchorId`/typedAt, audioOffset≈1500ms; (b) dấu tiếng Việt nhiều thao tác, edit/Undo/Redo khi pending, copy/cross meeting, xóa trước khi finalize không gây link ma; (c) pause/gap/recordingId change không tự gán sai; (d) offline/reopen chưa có sample chính xác giữ text và pending metadata an toàn. G01 chỉ làm adapter/fixture tự chủ, G00 sẽ ráp với G02 khi được giao tích hợp.
- **Lưu ý hợp đồng:** COMMON.md và `timeSpan` đóng băng, không tự phát hành bản tích hợp và không đánh dấu TC01–11 PASS nếu chỉ test Node. Nếu chọn phương án giữ pending ở một hàng đợi/Journal do G06 sở hữu thay vì G01, G01 phải bàn giao interface, còn owner tích hợp G00 quyết định cuối, không ghi đè nhánh G06.

### G07 — Không mở ADD mới về code; hoàn tất cổng tồn đọng

1. Trên môi trường có npm/có mạng, cài đúng 3 gói đã pin và tạo lockfile integrity; chạy candidate scripts cho **512MiB và 2GiB** (xuất+nhập bằng zip.js nếu candidate không có unzip), đo peak RAM/backpressure/CRC/ZIP64/quota. Bắt lỗi runtime nếu có mới giao G07 sửa; không tự gọi reference ZIP64 thắng.
2. Chạy Chrome/Edge/Windows trên origin thực cho OPFS+IndexedDB rollback/crash/quota; thử di chuyển archive sang thiết bị thứ hai và khôi phục text/timeSpan/audio missing, không ghi đè cuộc họp cũ. Ghi `PASS/FAIL/NOT_RUN` đúng tested SHA, giữ D13 `OPEN` đến khi có kết quả so sánh.
3. Với G01/G07 đang chặn vì **môi trường**, không bắt các luồng khác làm lại fixture hay chờ code ngoài phạm vi. Trên nhánh tích hợp sau này phải kiểm lại mọi bảo đảm với data thật.

**Quyết định điều phối:** G01 có **một nhiệm vụ bổ sung có reproducer**; G07 **không có lỗi logic mới đã xác minh** ngoài các cổng npm/browser/Windows còn thiếu. Chưa thể gọi hai luồng là DONE theo entrypoint; không cập nhật main, không merge/deploy.
