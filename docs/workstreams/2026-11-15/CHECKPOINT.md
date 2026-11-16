# Checkpoint · 00-command

- Chủ sở hữu: ChatGPT tiếp quản vai trò Tổng chỉ huy và bộ kiểm thử hợp đồng (writer duy nhất nhánh 00 trong lượt này).
- Nhánh: `gemini/20261115-00-command`
- Baseline: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- Trạng thái: **READY_FOR_REVIEW — đã push bộ harness độc lập và hướng dẫn tích hợp; chưa DONE do thiếu clean-checkout Node run**
- Code revision: [`bd08496a`](https://github.com/cavoixanh638/Bien-ban-hop/commit/bd08496a57ba80706eb0b2e5ac9730600c019591) (test + adapters); runbook revision [`b136a897`](https://github.com/cavoixanh638/Bien-ban-hop/commit/b136a897109dacd211ff6118e190481092634d34)
- Bằng chứng kiểm thử: **17/17 V8 mock PASS** trên nội dung nguyên file lấy lại trực tiếp từ GitHub (blob `7bca1887b80448e5ec916417fa69385468467b3d` và `08500d8626dd155fbd3fdb415103a047ef45682a`), dùng shim tương đương `node:assert`, `node:crypto` hash và Buffer. **Không được gọi đây là Node runtime PASS.**
- Kiểm thử Node cục bộ bằng code mô phỏng tương đương (khác file code trên GitHub): `16 PASS / 0 FAIL`, Node 22.16.0, Linux, `npm test`, không dùng code/fixture worker. Bản **đúng GitHub SHA từ clean checkout: NOT_RUN** vì container không kết nối được github.com.
- Môi trường: Node 22.16.0 Linux cho test mô phỏng cục bộ; V8 isolated cho kiểm tra lại mã GitHub. Windows/Chrome/Edge thực địa: NOT_RUN.

Entrypoint: [00-command.md](00-command.md) · [COMMON.md](COMMON.md) · [TRACKER.md](TRACKER.md).

## Đã tạo và push

1. [Reference contracts + synthetic fixture](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/poc/00-contract-tests/contracts.mjs): ProseMirror JSON và `timeSpan`, dữ liệu tiếng Việt, clock sample, multi-segment manifest, link resolver, PCM sink, revision/lease, staging restore, SW activation mock.
2. [17 test cases](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/poc/00-contract-tests/harness.test.mjs): thời gian/segment/nguồn, pause/gap/missing/pending, autosave fail, dual writer, backup checksum và ba negative controls có bắt lỗi cố ý.
3. [package.json](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/poc/00-contract-tests/package.json), [README / cách chạy](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/poc/00-contract-tests/README.md).
4. [Ma trận TC01–TC38](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/poc/00-contract-tests/TC_MATRIX.md) phân biệt mock và runtime NOT_RUN.
5. [Gated integration runbook](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/poc/00-contract-tests/INTEGRATION_RUNBOOK.md): cổng 1.1, thứ tự chín adapter và bằng chứng Windows/3 giờ/playback/crash/quota/restore/PWA.
6. [TRACKER.md](TRACKER.md): đã đọc checkpoint + HEAD của chín worker, cập nhật 04 READY_FOR_REVIEW local 16/16, tám luồng còn lại IN_PROGRESS, không gán PASS từ báo cáo mô phỏng. Giao việc cụ thể và ghi 3 đề xuất hợp đồng cho đợt tích hợp, không sửa COMMON.

## Cách chạy chính xác từ checkout sạch

```bash
git clone --single-branch --branch gemini/20261115-00-command https://github.com/cavoixanh638/Bien-ban-hop.git
cd Bien-ban-hop/poc/00-contract-tests
npm test
npm run test:json > run.json
```

Kỳ vọng: 17 test, 0 FAIL. Chỉ khi chạy và xác nhận trên file từ commit đúng, cập nhật `Tested SHA` và log thành PASS. Không hứa đã làm bước này.

## Ranh giới và việc chưa làm

- **Chưa tích hợp mã worker, chưa thay đổi main/STATUS, chưa merge/deploy/DNS.** Đợt này là fixture test chuẩn bị Gói 1.6, không phải bản ứng dụng hoàn chỉnh.
- Toàn bộ TC01–TC38 trên runtime tích hợp: **NOT_RUN**. Cổng 1.1 cần UniKey/EVKey Telex/VNI Windows thực; cần ghi 3 giờ, player C1/C2 thực, OPFS/crash/quota, restore .mochop lớn/máy khác, SW/migration, DOCX Word.
- **Chặn DONE độc lập:** chưa chạy đúng file vừa push từ fresh checkout bằng Node. Không có block kỹ thuật từ worker cho fixture. Không kế thừa V8/mock PASS thành production PASS.

WIP/chưa push: không (mọi artifact được push qua GitHub connector). **Checkpoint này cần commit làm HEAD**, kiểm lại git tree sau ghi; mã source không thêm bất cứ file nào ngoài phạm vi 00.

## Rà soát các worker (tiếp nối 15/11/2026)

- Đã duyệt Git-tree/HEAD của 10 nhánh, không ghi đè mã worker. Mục `TRACKER.md` được nâng cấp tại commit [`31acdb99`](https://github.com/cavoixanh638/Bien-ban-hop/commit/31acdb999ab4d7e9cb5be2a1e26731de50072ad5).
- **05-player** có lỗi logic tái hiện từ blob Git `15ef45b5abf5712b90cdd81d04820d7f60c9f8f6`: `resolve(ID,1805000)` trả `gap/pause`, song `seg-006` hợp lệ. Nguyên nhân: dùng `meetingStartMs` để kiểm `audioOffsetMs`; recorded intervals thiếu `mediaStartMs/mediaEndMs/segmentRefs`. Đã giao chính xác file, kết quả và bước hồi quy cho owner 05 trong TRACKER. Không tự sửa nhánh worker.
- **04-timeline** READY_FOR_REVIEW ở phạm vi fixture (16/16 local), chưa có clean checkout/livedata. **01/03/05/06/07/08** đã push PoC, còn các cổng runtime hoặc exact SHA. **02** chưa có code trên nhánh khi quan sát.
- **09-pwa** cập nhật checkpoint trong lúc rà soát: mock Node 10/10, mã PoC vẫn **LOCAL_ONLY**, Git-tree HEAD `ea60179c` chưa có `poc/09-pwa/`. Chưa đánh dấu bàn giao.
- Không chốt production C1/C2, không PASS Gói 1.1–1.6 và không merge/deploy. Lượt sau kiểm lại HEAD trước nhận bằng chứng mới, đặc biệt 09 đang push.

## 09-pwa cập nhật từ bàn giao mới

- Đã kiểm nhánh `gemini/20261115-09-pwa` HEAD `4cdde5a51909e1db016bfe880097944a3c26ea06`, commit mã `46e82448d03c710eef8f1feeb74fb073d9b13737`: **đã push đủ 22 file PoC**, `READY_FOR_REVIEW`. Node 10/10 mock local, 7 Playwright scenarios **NOT_RUN** do Chromium URLBlocklist; Pages/Windows cũng **NOT_RUN**.
- Code review phát hiện 4 vấn đề phải xem lại: **G09-ADD-01** start/release race trước ACK OPFS; **G09-ADD-02** release khi autosave pending làm mất dirty text; **G09-ADD-03** migration bị kẹt bởi lock từ cuộc họp khác do BroadcastChannel chỉ lọc meetingId; **G09-ADD-04** SW nhận activate message mà không tự xác minh gate. Các phát hiện được ghi cùng file, reproducer, yêu cầu test vào [TRACKER.md](TRACKER.md), commit `3eeab917`.
- Review mã là phân tích luồng logic, chưa có test runtime mới trên các race; các nhánh worker chỉ được owner tự sửa. Không đổi COMMON, không nhập/bật Pages, không coi code đã push là nghiệm thu Gói 1.5.

## G02-capture — review mã PoC mới (15/11/2026)

- Đã xác minh nhánh `gemini/20261115-02-capture` HEAD `8a9780cf01e3b7e0a014ddf76bdbf9db1f2ad7e8`, mã `6898ec9b11c296427f11479c31514ecda13a08b4`, đủ 18 tệp PoC; checkpoint G02 là **PARTIAL/BROWSER_BLOCKED**, Node 11/11 PASS, 3h metadata-only, Chrome Windows/3h wall-clock/TC21 **NOT_RUN**.
- Reviewer chạy lại đúng source của controller (`blob 2fe32254f7871c144ff0f8e3f3567f6323c9c461`) bằng JS V8 với fake MediaRecorder/MediaStream. **Stop trước khi permission resolve:** sau Stop, `MediaRecorder.start` vẫn được gọi 1 lần, `MediaRecorder.stop` 0 lần, `track.stop` 0, `AudioContext.close` 0; Stop lặp chỉ trả promise cũ. **MediaRecorder.stop reject:** context và track không được đóng. Đây là code-path failures trên mock, không phải browser test.
- Probe `results().clockMapping` chỉ có **một điểm**, không đủ để G04 nội suy; Worklet `attach` cho phép `batchFrames=100000000`, yêu cầu 2 × 400 MB FakeArrayBuffer — chưa cấp phát thật. Đều là khoảng trống cần sửa ở logic.
- Đã ghi **G02-ADD-01..04** kèm file, reproducer, expected tests và **G02-ADD-05** liên quan benchmark 3h vốn đã được ghi thiếu ở checkpoint, vào [TRACKER.md](TRACKER.md) revision `e4b137f7`.
- Không sửa trực tiếp nhánh G02, không đổi COMMON, không chuyển unit/mock PASS thành nghiệm thu Gói 1.2. Lượt sau xem SHA mới rồi review regression; Windows/live vẫn NOT_RUN trừ khi có log thật.

## Tổng rà soát 10/10 nhánh sau bàn giao 15/11/2026

- Đã fetch HEAD/checkpoint tất cả 10 nhánh, đối chiếu GitHub compare baseline→HEAD cho cả 10, và Code SHA→HEAD với G01–G09. Kết quả: **9/9 worker chỉ thay đúng thư mục PoC + checkpoint riêng**, không ghi đè nhau, không đổi COMMON. Snapshot SHA và trạng thái chi tiết ở [TRACKER.md](TRACKER.md), review commit [`ebbf9cab`](https://github.com/cavoixanh638/Bien-ban-hop/commit/ebbf9cabad666a01b9a8a037945ae913b7f0f3fc).
- Mã PoC **đã có trên cả 9 nhánh worker**, không còn tình trạng G02/G09 thiếu mã như snapshot cũ. Các lỗi G02-ADD-01..04, G05 sai miền thời gian và G09-ADD-01..04 được chủ nhánh báo sửa, có test hồi quy fixture và source trên GitHub; reviewer đối chiếu điểm chính trong mã cập nhật (`G02/controller.mjs` đã có stop cleanup `finally`; `G05/timeline.js` tách `resolveMedia` và `meetingToMedia`; `G09/sw.js` xin exclusive maintenance Web Lock khi activate). **Chưa chấp nhận browser PASS nếu chỉ là fixture.**
- Tóm tắt: G01 Node 41/41 nhưng Tiptap/Windows IME chưa chạy; G02 Node 36/36, 3 giờ metadata-only; G03 Node 25/25 và 3h synthetic; G04 DONE **PoC fixture** 33/33 + TS typecheck; G05 Node/Chromium synthetic 10/10+10/10; G06 22/22 fake IDB; G07 JS 23/23, Python 13/13, interop 2/2, 2GiB ZIP reference, **ba npm ZIP candidates NOT_RUN**; G08 55/55 và DOCX LibreOffice; G09 Node mock 28/28, HTTP 9/9, browser TC32–35 NOT_RUN.
- Code/Tested SHA của G01 trong checkpoint cũ **chưa phản ánh** sửa source 41-test; đã giao cập nhật lại SHA cho G01 ở tracker. G07 chưa đủ điều kiện `DONE` theo entrypoint vì thiếu so sánh 3 npm packages thật.
- **Kết luận tổng chỉ huy:** 10/10 luồng đều có mã bàn giao, nhưng **không phải 10/10 DONE**, chưa ghép app và chưa nghiệm thu TC01–TC38. `main/docs/STATUS.md` vẫn PLANNING, không có ứng dụng đã nghiệm thu. G00 tự có V8 mock 17/17 nhưng `npm test` từ checkout GitHub sạch còn `NOT_RUN`. Giữ `READY_FOR_REVIEW`; Windows/Chrome/Edge/địa chỉ HTTPS/3h thu thật/thiết bị audio và restore máy khác còn cần kiểm.
- Không có thay đổi mã, merge, deploy hay sửa worker. Lượt kiểm này chỉ cập nhật `TRACKER.md` và checkpoint G00.

## G02-capture — review sau 36/36 PASS (15/11/2026)

- G02 HEAD `c4845450d2ef6cc3d24fe22a9a445c588229b942`, code source `0083a670e5537952899afb247949bc71442b46b8`. Checkpoint xác nhận G02-ADD-01..05 đã xử lý (Node 36/36), đã push đầy đủ; không yêu cầu làm lại.
- Chạy review JavaScript đúng blob GitHub qua V8 fake: (a) `CaptureClockMapper.resolveInput(1500)` trả `unlinked` khi cuộc thu vẫn active và điểm gần nhất t=1000, chuyển `valid/sampleIndex=72000` khi progress t=2000; t=1000 đúng điểm cuối cũng trả `unlinked`; (b) `stop()` khi `getUserMedia()` không settle khiến cả Start/Stop vẫn pending, state `stopping` sau nhiều microtask.
- Giao **G02-ADD-06** live clock phải có `pending` và không làm mất mốc chữ; **G02-ADD-07** cách hủy/timeout prompt micro không settle và dọn quyền cấp muộn; reproducer và tiêu chí regression cụ thể trong [TRACKER.md](TRACKER.md), commit `f64a7835`.
- Không tự sửa code G02, không đổi COMMON. Kết quả V8 là source-level mock, không thay Chrome/Edge Windows, micro thật, 3 giờ real-time và test tích hợp `NOT_RUN`.

## Rà G01 + G07 sau báo hoàn thành — 15/11/2026

- **G01 HEAD `a44e94bc`** / Code+Tested source `78aa598d`: 45/45 Node test PASS trên Git blob equivalent, 3 sửa lỗi Undo/Redo, ranh giới mốc và clipboard HTML đã push. Tiptap E2E, Windows UniKey/EVKey, 120s gõ/IME/P95 vẫn NOT_RUN; checkpoint G01 ghi `IN_PROGRESS/GATE_1_1_HOLD`.
- **G07 HEAD `d112aff7`** / Code+Tested source `4b6ebd2b`: 26/26 Node JS + 14/14 Python + 2/2 interop PASS. Đã vá manifest CRC tamper và path Windows; ZIP64 single entry >4GiB PASS ở Node reference (một phần trước thay đổi NFC), còn benchmark 0,5/2GiB cũ ở SHA khác. 3 npm library candidates `fflate/client-zip/zip.js`, browser OPFS/quota và restore máy thứ hai NOT_RUN; `D13 OPEN`, checkpoint G07 `PARTIAL/NOT_DONE`. Diff Code SHA→HEAD hai nhánh chỉ docs/log; phạm vi baseline đúng worker.
- **Reproducer mới `G01-ADD-01`:** trực tiếp chạy `normalizeContext` và `makeAnchor` từ Git blob `6acc1f51`. Khi `live_recording/rec-1` có clock pending, `audioOffsetMs=null`, G01 chuyển sang `unlinked`; như vậy không có queue/Journal thì sau G02-ADD-06 trả offset mới không thể khôi phục mốc. Đã giao G01 adapter pending-provenance và negative regression với typedAt/anchorId bảo toàn, không bịa offset, không thêm status vào Mark; mã hiện là logic interface gap, chưa khẳng định browser/IME FAIL.
- G07 **không giao thêm ADD về lỗi code**: chỉ giữ cổng thư viện npm thật, browser và cross-device đã tồn tại. Cập nhật đầy đủ tại [TRACKER.md](TRACKER.md) revision `93d4eac4`.
- Không sửa code worker, COMMON, STATUS/main; không merge/deploy. Toàn bộ Windows/browser nếu chưa chạy vẫn NOT_RUN. Trạng thái G00: `READY_FOR_REVIEW`, harness Node clone sạch chưa chạy.

## Đối chiếu cuối ngày sau các worker báo hoàn thành (15/11/2026)

- **Tất cả 10 nhánh có code/evidence/checkpoint**; 9/9 worker diff baseline chỉ trong `poc/<worker>/` và checkpoint riêng. Không có PR/nhánh tích hợp, `main` vẫn `6142f56` và `docs/STATUS.md` PLANNING.
- G01 HEAD `dfb0b1fe`, Code `4e9283ee`, **75/75 unit PASS**, G01-ADD-01 pending sidecar sửa trong PoC; Windows IME/Tiptap browser cổng 1.1 **NOT_RUN/HOLD**.
- G02 HEAD `4ceb8049`, Code `41bff106`, **24/24 V8 controlled PASS mới**, nhưng 36/36 Node là SHA cũ. **Node npm test đầy đủ mã mới NOT_RUN**, cùng 3h thực/mic/Chrome-Edge. ADD-06/07 đã sửa ở PoC.
- G07 HEAD `032c6a8f`, Code `eea265dc`, **31/31 Node JS**, **14/14 Python**, **2/2 interop** PASS trên nguồn tương đương Git blob. Guard fflate ZIP32 đã có; 3 package npm `fflate/client-zip/@zip.js/zip.js` thật và browser/restore máy thứ hai **NOT_RUN**, D13 OPEN.
- G03/04/05/06/08/09 giữ nguồn/evidence như bảng; G04 **DONE chỉ PoC fixture**. Không phát hiện thêm lỗi code có reproducible evidence cần mở ADD mới cho worker trong lượt này.
- Đã tạo [INTEGRATION_READINESS_20261115.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/poc/00-contract-tests/INTEGRATION_READINESS_20261115.md), pin HEAD/code snapshots, contract adapters, test thật/âm tính và GO/NO-GO. [TRACKER.md](TRACKER.md) cập nhật trạng thái 10/10, không thay COMMON hoặc tệp nhánh khác.
- **Cổng chặn quan trọng:** G01 pending journal phải nối G02 sample mapping qua G04 media resolver và G03/G06 durable storage bằng thin adapter riêng; G01 không nhận thẳng kết quả `sampleIndex` của G02 làm `audioOffsetMs` mà chưa quy đổi/xác thực, tránh mất mốc hoặc sai cuộc họp. G07 production ZIP/engine capture và C1/C2 còn OPEN cho tới số đo browser/Windows.
- Đã thử từ container: `git ls-remote https://github.com/cavoixanh638/Bien-ban-hop.git` trả lỗi DNS `Could not resolve host: github.com`; vì vậy G00 **chưa chạy Node 17/17 trên clean checkout**, tiếp tục `NOT_RUN`. V8 mock 17/17 là test khác, không tự nâng trạng thái.
- **G00 status:** `READY_FOR_REVIEW` fixture harness; **SOURCE_HANDOFF_READY / INTEGRATED_APP_NOT_STARTED / RELEASE_HOLD**. Không merge main, tạo branch integration, deploy hay ghi PASS TC01–TC38 khi chưa có bản chạy chung và bằng chứng. Lần sau kiểm lại HEAD nguồn trước tích hợp.

## G10 — đã thực hiện tích hợp alpha và kiểm thử (15/11/2026)

- **Nhánh thực hiện:** `integration/20261115-g10-v1.2`, Code/Tested SHA **`a4e680d265f49ec8a3781d6bdbab9ac16449c875`**, branch HEAD xác minh trùng tested SHA; [Draft PR #1](https://github.com/cavoixanh638/Bien-ban-hop/pull/1) mở, **chưa merge** vào `main`. Main SHA `6142f56a` không đổi.
- **Mã chạy chung:** `app/` Vite/Tiptap, lưu ghi chú+pending journal IDB, G01↔G02 sample bridge, G02 AudioWorklet→G03 OPFS Worker, G05 playback multi-segment alpha, G08 xuất văn bản, G07 ZIP streaming export giới hạn 1 recording, G09 single-writer Web Locks/PWA shell. Có `app/START_WINDOWS.cmd` và README. Giữ nguyên 9 nhánh worker; một sửa UTF-8 Python ở bản sao G07 chỉ nằm trên nhánh G10.
- **Thử nghiệm exact-commit:** [GitHub Actions #43733129441](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/43733129441) **completed/success** với Linux Ubuntu 24.04 và Windows runners. Unit G10 **14/14**, Node G01 **75/75**, G02 **44/44 mã mới** (đã gỡ `NOT_RUN` Node trên SHA tích hợp, khác độc lập G02), G03 **25/25**, G05 **10/10**, G07 **31/31 JS +14/14 Python+2/2 interop**, G08 **55/55**. App `npm run build` PASS cả Linux+Windows.
- **Browser Chromium Playwright 1.56 HEADLESS fake mic:** chạy Vite dev **3/3 PASS + 1 PWA test SKIP đúng mục đích**; chạy Vite production-preview **4/4 PASS**, gồm ghi PCM giả lập, OPFS durable ACK, note TimeSpan, click nghe, reload nghe lại, hai tab lock, PWA offline reload. Mã cuối chạy **0 retry**. Không coi đây là test micro Windows thật.
- **Lỗi G10 đã sửa:** Vite module resolution, Windows Python cp1252 UTF-8, cạnh tranh SaveQueue, click mốc dựa sai caret, lỗi pre-roll khi âm thanh ở đầu phiên chưa phủ từ 0. Nếu pre-roll bị chặn, chỉ fallback sang **đúng mốc gốc đã validate** và báo UX, không gán nguồn/file khác.
- **Ranh giới:** `INTEGRATION_ALPHA_TESTED / RELEASE_HOLD`, không phát hành/merge; TC01–38 integrated nghiệm thu Windows thật **NOT_RUN**, ghi 3h wall-clock thật, Unikey/EVKey Telex/VNI, âm sắc C1/C2/loopback sample-level, quota/crash/sleep/power loss, backup nhiều recording, **restore .mochop vào cùng app chưa có**, 3 npm ZIP packages D13, MS Word/Excel Windows, G04 full meeting timeline và browser PWA migration end-to-end còn HOLD.
- **G00 riêng:** 17/17 V8 shim fixture đã có; **G00 exact Node clean checkout** vẫn NOT_RUN trên G00 branch, không nhầm với 14/14 G10 Node chạy từ Actions. Khi có điều kiện bổ sung chính xác SHA/logger rồi mới đánh G00 DONE.

Đã cập nhật [TRACKER.md](TRACKER.md) revision `69129672ab2c6bd8ab50faad98e038cd370a0646` với PR, test SHA và bản giao G10. Không chỉnh COMMON, không nhập `main` và không deploy.

## 16/11/2026 — G10-R portable meeting restore completed at alpha integration level

- Pre-work G10 commit: `378f7da9`, after original production source `46d12dc7`. Added G10 `app/src/portable-{model,archive,storage,legacy}.mjs`, dedicated ZIP64 v2 format, compatible v1 import, native Node + Chromium cross-profile E2E, UI buttons import/export, transfer status.
- **Code SHA = Tested SHA:** `a38175ed1fa1bb90efa83a2e9773a6d94401a27a`. [CI #43815476675](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/43815476675): **success** Linux+Windows, G10 Node **28/28 PASS**, G01 75/75, G02 44/44, G03 25/25, G05 10/10, G07 31/31, G08 55/55; Chromium dev 9 PASS/1 intentional skip, production **10 PASS**, 0 retries. Last G10 HEAD also contains subsequent docs-only checkpoint `92f552e94`.
- ZIP64 v2 includes all recordings/WAV, exact G03 audio journals + sample checksums, all note revisions (G06), current note rich text/timeSpan, original pending provenance archived fail-closed. Imported note/playback markers remapped to random fresh meeting/note/recording IDs and published after G03 reconcile and IDB atomic commit. ZIP corrupted/path unsafe/oversized => no partial visible meeting.
- Verified actual Chrome BrowserContext migration: two recording sessions, independent browser storage, click playback of both, reload, reimport no overwrite, one-byte WAV tamper refused. Legacy format v1 one recording passes import/playback; v1 invalid WAV header refused. Lost history absent from original v1 is unrecoverable, documented.
- **G00 status for this feature:** `FEATURE_COMPLETE_SYNTHETIC_CI`. Still `RELEASE_HOLD`: real 2 Windows physical machines, 3h microphone, 0.5–2GiB/ZIP64 >4GiB browser quota, forced kill/restore, native Windows IME, G04 full timeline and TC01–38 `NOT_RUN`; no deploy, no main merge.
- [G10 README](https://github.com/cavoixanh638/Bien-ban-hop/blob/integration/20261115-g10-v1.2/app/README.md), [G10 workboard](https://github.com/cavoixanh638/Bien-ban-hop/blob/integration/20261115-g10-v1.2/app/RESTORE_WORKBOARD.md), [Draft PR #1](https://github.com/cavoixanh638/Bien-ban-hop/pull/1). `COMMON.md` and G01–09 worker branches not modified.

- **Regression sau bàn giao G10-R:** Core/Tested SHA `a38175ed1fa1bb90efa83a2e9773a6d94401a27a`, [Actions #43815476675](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/43815476675) PASS cả Linux/Windows; archivedPendingState được lưu qua import lặp, nhưng không tự quyết định gắn mốc lên WAV khi thiếu clock nguồn. G10 HEAD có doc-only `8046ed43`, giữ Code SHA như trên.

## 16/11/2026 — G10 thêm thanh tua toàn bộ âm thanh, khắc phục OPFS lock

- **Code/Tested SHA:** `1b2aaa9869ab3ec5196f1024fb2500d51060e005`. [CI #43902784531](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/43902784531) **completed/success**, Linux/Windows native Node + Vite build PASS, G10 31/31, Chromium Vite dev 9/9 PASS + 1 intentional skip, production/PWA 10/10 PASS, 0 retry. Chưa merge `main`, Draft PR #1 vẫn mở.
- **Đã làm:** thanh ngang ở chân vùng giấy ghi chú với vị trí phát thực, tổng thời gian các phiên, nút phát/dừng, chọn phiên; seek ghi âm theo G03 sample ranges, vùng mất mẫu được nhận diện hiện xám và seek không được tự nhảy nguồn. Các phiên dừng/ghi tiếp có clock riêng; tổng thanh chỉ nối thời lượng ghi, **không cộng thời gian nghỉ giữa phiên**. Bấm chữ vẫn có thể nghe và hiển thị trên thanh.
- **Lỗi regression tìm qua test & khắc phục:** tạo nhiều OPFS `SyncAccessHandle` xung đột khi vừa mở timeline vừa phát hoặc sao lưu. Thêm async settlement của timeline reader và `player.closeReader()` trước backup/đổi cuộc họp; `run.recordingFinalization` giữ khóa UI và nhãn `Đang hoàn tất lưu` cho đến khi G03/notes/timeline/WAV mirror xong. Test cross-profile 2 phiên, backup sau tua, seek, EOF đã PASS.
- **Hạn chế cần nghiệm thu:** nút tua chỉ hoạt động **sau khi kết thúc/chốt** (không phát lúc đang ghi); gap trailing chưa được G03 ghi vào journal thì có thể không vẽ được; chưa đo seek thực máy Windows với họp nhiều giờ, missing-sample khi CPU quá tải, C1/C2 gapless/voice playback. Các bài Windows microphone thật/3h/TC01–38 vẫn **NOT_RUN**. `RELEASE_HOLD`.
