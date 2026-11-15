# 00 · Independent contract harness — Mốc Họp V1.2

## Mục đích

Bộ kiểm thử **thuần Node.js**, không cần dịch vụ, API key, code/fixture worker khác, tài khoản hay audio thật. Hợp đồng lấy từ `docs/workstreams/2026-11-15/COMMON.md` tại baseline `6142f56`. Không thay thế ProseMirror, AudioWorklet/OPFS, playback engine, IndexedDB, ZIP hoặc PWA runtime. Mỗi PASS là **mock/fixture only**.

## Chạy từ checkout sạch

```bash
git clone --single-branch --branch gemini/20261115-00-command https://github.com/cavoixanh638/Bien-ban-hop.git
cd Bien-ban-hop/poc/00-contract-tests
node --version                 # Node >= 20
npm test                       # built-in node:test; no npm install required
npm run test:json > run.json   # optional; run.json untracked
```

Bộ `contracts.mjs` cung cấp adapter reference (thay bằng worker adapter khi tích hợp) và tự sinh fixture `fixture()`, văn bản tổng hợp tiếng Việt, `pcm()`. Chạy test độc lập khỏi 9 nhánh.

## Ý nghĩa kết quả

17 test Node: văn bản/timeSpan/coalescing, nguồn paste, clock sample mapping, ranh giới nửa kín, status pending/missing/gap/unsupported, PCM queue vs flush, playback segment và pre-roll, lưu revision/lease, staging/checksum/missing, PWA update guard. Ba ca âm tính cố ý tạo mutant sai nguồn, saved giả và writer thứ hai rồi **đòi harness bắt lỗi**.

Chỉ kiểm logic reference. Không khẳng định đạt độ trễ thực, Unikey/EVKey thực, ghi 3 giờ, bitstream WAV, khôi phục crash/OPFS, seek hoặc nối tiếng không mất/đúp, checksum ZIP streaming lớn, sử dụng ngoài trình duyệt hoặc offline. Ma trận `TC_MATRIX.md` phân ranh rõ.

## Tích hợp đợt sau

Đọc `INTEGRATION_RUNBOOK.md` theo thứ tự. Bắt buộc giữ `recordingId` xuyên mọi lớp; kiểm PCM `sampleCount` là frame, ACK queue khác commit, `timeSpan` không có status động, `save` phải trả revision đã commit và lease có token; rollback restore khi lỗi. Khi một adapter thực thay mock: chạy lại các negative-control và thêm test browser/thiết bị có SHA, log và môi trường.

## Lưu ý an toàn

Không có dữ liệu cuộc họp thực. Không dựa trên dữ liệu từ nhánh khác. Không chạy với quyền ghi repo/không tự thay đổi `main`. Cấm diễn giải fixture PASS thành Gói 1.1–1.6 PASS.
