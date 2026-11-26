# G10-R — Restore/transfer workboard (2026-11-16)

Starting source HEAD: `46d12dc76e8d7033c1aab5087463b865c1f5d0b0` (GitHub branch `integration/20261115-g10-v1.2`). **Checkpoint commit before implementation**, not proof of a working restore.

## Scope

1. One portable `.mochop` archive includes meeting, complete ProseMirror note/timeSpan marks, pending provenance if safe, **all** recording IDs and WAV segments, manifest and integrity checks. Fail closed for missing/corrupt/unsafe paths; versioned metadata; no silent omissions.
2. Import into an empty browser/other Windows computer with a new meeting ID and remapped recording references; restore OPFS and IndexedDB with rollback/cleanup on failure. Do not overwrite an existing meeting. Must restore a second recording session and click-to-play from both.
3. Browser UI: Export all recordings; Import with clear progress/status, no recording in progress; tests of single/multiple sessions, integrity, rollback, re-import collision, and production build/Chromium on separate browser contexts.

## Gates and evidence

For each revision record HEAD/Tested SHA, native Node, Linux/Windows build, HTTP Chromium E2E, and separately NOT_RUN Windows physical microphone/long-duration/cross-hardware transfer. No merge/deploy without acceptance. Preserve source `poc/07-backup` and G03/G06 contracts, adding dedicated G10 adapters if format changes are needed.

## Kết quả thực hiện — 2026-11-16

**Chức năng G10-R đã triển khai, mức `FEATURE_COMPLETE_SYNTHETIC_CI`, không phải nghiệm thu sản phẩm.**

- **Code SHA = Tested SHA:** `a38175ed1fa1bb90efa83a2e9773a6d94401a27a`.
- **CI:** [GitHub Actions #43815476675](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/43815476675) `completed/success`. Windows + Ubuntu runners: `npm test` **28/28 PASS**, Vite build PASS, G01 75/75, G02 44/44, G03 25/25, G05 10/10, G07 31/31 + Python/interop và G08 55/55 theo log. Chromium dev **9/9 PASS + 1 PWA-only SKIP**, production **10/10 PASS**, **0 retries**.
- **v2:** nhập vào Chrome BrowserContext độc lập, **2 bản ghi**, note tiếng Việt, các timeSpan marks đã remap sang bản ghi mới, playback cả hai, nhập file hai lần không ghi đè, ZIP WAV bị sửa byte từ chối; Node kiểm SHA/CRC, rollback, note-only, lịch sử và pending provenance bảo thủ.
- **v1:** nhập file đời cũ một phiên ghi vào app mới, tái tạo journal G03/CRC từng chunk, phát được anchor cũ sau nhập và mở lại trang; ZIP hợp lệ nhưng WAV sai header không được công bố.
- **Nhánh:** `integration/20261115-g10-v1.2`, [Draft PR #1](https://github.com/cavoixanh638/Bien-ban-hop/pull/1). **Không merge main**, không deploy.
- **NOT_RUN:** chuyển file trên **hai máy Windows vật lý**, 0,5–2GiB và ZIP64 >4GiB bằng browser, cuộc họp 3h thật, crash/quota/mất điện giữa restore, Windows mic/IME và toàn bộ TC01–TC38. Đây là cổng nghiệm thu kế tiếp, không phải PASS.
- **Giới hạn thật của v1:** file v1 chỉ chứa một snapshot note và một recording; lịch sử chỉnh sửa/đa phiên không được đóng gói v1 thì không thể phục hồi. `pending` cũ được giữ làm chứng cứ trong v2 nhưng không tự kích hoạt lại trên máy B nếu thiếu clock gốc.

- **Bổ sung bảo toàn thông tin sau test v2/v1:** bản sao lịch sử lưu `archivedPendingState` (clock provenance từ máy A) bên ngoài `timeSpan` và `pendingState` đang hoạt động. Trên máy B không được tự xác nhận mốc khi thiếu điểm clock; dấu vết cũ vẫn tồn tại khi tiếp tục xuất/nhập lần nữa. Regression `G10 v2: unverified pending input...` đã mở rộng và đạt trên Code/Tested SHA ở trên.
