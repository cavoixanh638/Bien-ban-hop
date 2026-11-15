# V1.2 · Runbook tích hợp Gói 1.6 (đợt sau)

## 0. Không hợp nhất trước khi đủ điều kiện

Đợt này chỉ xác minh fixture trên nhánh `gemini/20261115-00-command`, không merge `main`, deploy hay xác nhận Gói 1.1–1.6. Baseline chung `6142f56`; mọi worker chỉ có phần PoC và evidence riêng. `COMMON.md` đóng băng; thay đổi schema phát hiện trong PoC chỉ đề xuất tại TRACKER, **không áp vào nhánh worker giữa đợt**.

## 1. Cổng 1.1 bắt buộc trước tích hợp bản ứng dụng

**01-editor** giao: commit SHA, standalone Tiptap/ProseMirror demo, trace transaction, timeSpan JSON, test TC01–TC11, đo P95/Mark/TextNode/DOM/JSON và cách lấy trace UniKey/EVKey. Thử trên Windows Chrome/Edge, UniKey và EVKey Telex/VNI, câu “trường”, “tiếng”, đổi dấu muộn, Backspace+Insert không composition, typing 2 phút không Enter, paste ngoài/chuyển cuộc họp, Undo/Redo. Nếu mất chữ hoặc sai audio source → **HOLD tích hợp**. Chỉ khi cổng này có bằng chứng thật mới ráp bản ứng dụng.

## 2. Thứ tự dây nối adapter và điều kiện đầu vào

| Thứ tự | Gói/owner | Artifact tối thiểu | Cổng kiểm |
|---|---|---|---|
| A | 01-editor | Tiptap document JSON, timeSpan Mark, trace typedAt/recordingId/audioOffsetMs | TC01–TC11, Windows IME, test giữ mark |
| B | 02-capture | PCM `sequenceNo/firstSample/sampleCount`, input mono mapping, queue/ACK và benchmark AudioWorklet vs MediaRecorder | TC12/13/14/17, 2048/4096 frame, sample drop, CPU/RAM |
| C | 03-opfs | sink/flush+journal+manifest, validated audio file and OPFS recovery | TC12/15/18/19, crash/quota/WAV header, committed sample |
| D | 04-timeline | resolver `(recordingId,audioOffsetMs)` và meeting↔media mapping, status | TC13–18, 22/24/27/28, boundaries/missing |
| E | 05-player | C1/C2 player, cursor/Alt-click, 0.75×/0.9×, pre-roll | TC22–28, 04:58→05:02, 90/170 phút |
| F | 06-notes | IndexedDB read/save with revision, Meeting/NoteDocument, search | TC29/32/35, actual commit acknowledgement |
| G | 07-backup | streaming `.mochop` exporter/importer, staging rollback, checksums | TC30/31/38, machine transfer, 0.5–2GB and ZIP64 |
| H | 08-export | DOCX/TXT/Markdown/CSV adapters | TC36, Unicode on Word and formatted output |
| I | 09-pwa | SW scope/update gate, Web Locks, migration, offline fixture | TC32–35, no reload while recording |

Mỗi adapter được nối bằng một thin adapter tại đợt tích hợp, **không sửa vào PoC worker** chỉ để ép tương thích. Contract đầu vào là `COMMON.md` và `poc/00-contract-tests/contracts.mjs` chỉ làm reference mock. Tên production API được chốt sau khi xem 9 implementation cụ thể.

## 3. Kiểm chứng chéo, fail-closed

- Mốc chữ: truyền `anchorId`, `recordingId`, `audioOffsetMs`, `typedAt`, `source`; không đưa `anchorStatus` vào Mark. Kiểm sửa/format/move/Undo không đổi recording gốc; paste từ họp khác không phát nhầm.
- Capture→storage: `sampleCount` là số frame không phải byte/sample cộng tất cả kênh; block sequence/gap/quota được hiển thị rõ. ACK accepted/transfer/buffer recycled **khác** ACK committed sau journal; fake saved là lỗi nghiêm trọng.
- Timeline→player: khoảng nửa kín, clock không dùng wall time một mình; resolve đúng `recordingId`; pending/missing/gap/unsupported/unlinked không auto nearest segment. Seek/pre-roll không ghi đè mốc nguyên bản.
- Storage/backup: `save(document, expectedRevision)` commit thành công mới báo lưu. Lease writer độc quyền có token và stale-release phải vô hiệu. Restore staging + verify checksum/schema/path trước publish, rollback khi lỗi; thiếu audio vẫn giữ văn bản và marks, ghi missing.
- PWA: không ép activate/reload trong lúc ghi; migration phải atomic/rollback và giữ data source cũ. Kiểm thử khi `crossOriginIsolated=false`, không bắt buộc SharedArrayBuffer.

## 4. Bằng chứng / thứ tự nghiệm thu tích hợp

1. Pin **HEAD + SHA test** của từng PoC và xác minh branch/commit; chỉ lấy code từ owner được giao. Xem diff và bảng `TC_MATRIX.md`; chưa có bằng chứng → `NOT_RUN`.
2. Chạy `npm test` trong `poc/00-contract-tests/` từ clone sạch; thay reference adapters lần lượt A→I trên nhánh tích hợp sau khi đạt cổng 1.1. Giữ negative-control cố ý sai nguồn/saved giả/dual writer.
3. Chạy browser tests có version/screenshot/log/PCM signal đã biết; đưa vào ma trận trên tested SHA tích hợp. Windows Chrome/Edge UniKey/EVKey bắt buộc; đo capture 3 giờ wall-clock, crash/quota và playback gap/duplicate thực, 0.75×/0.9× nghe giọng, backup ZIP lớn/restore máy khác, PWA offline/update/migration.
4. Chọn engine thu và C1/C2 bằng số liệu `drop/latency/CPU/RAM/seek/gap/duplicate/pitch` trước/sau và dấu vết test. Chọn ZIP trong `fflate/client-zip/zip.js` bằng peak RAM/backpressure/ZIP64/restore, không dựa benchmark giả lập.
5. Kiểm cổng TC01–TC38 với mỗi subcase, code/test SHA, OS/browser/device, expected/actual, log và người xác nhận. Không còn Critical/High; nếu FAIL thì giao đúng owner/file/check/re-run, không xóa bằng chứng. Chỉ lúc người dùng giao **đợt tích hợp/phát hành** mới cập nhật `docs/STATUS.md`, merge và deploy theo quyền được cấp.

## 5. Gates không thể xác nhận từ fixture

- **Windows:** IME Telex/VNI của UniKey/EVKey, Chrome/Edge cùng bàn phím thật; phím tắt/Alt-click và P95 nhập.
- **Media:** micro và audio track online nếu có, record 3 giờ thật, rút micro/quota/crash và WAV/PCM header, kiểm mẫu/clock drift; playback C1/C2 qua biên bằng tín hiệu, 0.75×/0.9×.
- **Persistence:** OPFS + IndexedDB transaction/collision, service worker, hai tab, offline, SW activation, schema migration, ZIP dung lượng lớn/máy khác.
- **Xuất:** DOCX mở thực trong MS Word với chữ Việt, bold/italic/list và nguồn; TXT/MD/CSV so định dạng.

Mọi fixture PASS ở nhánh 00 chỉ là bằng chứng mock và không thay đổi trạng thái `docs/STATUS.md`.
