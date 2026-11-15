# Checkpoint · 03-opfs

- Chủ sở hữu: worker 03-opfs (chat hiện hành)
- Nhánh: `gemini/20261115-03-opfs`
- Baseline: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- HEAD khi nhận: `cd3f2d5c1d02baa2b209302631f665536290d456`
- Trạng thái: IN_PROGRESS (đã đọc entrypoint/COMMON/AGENTS/PLAN/STATUS/AUDIO_DESIGN/ARCHITECTURE/ACCEPTANCE)
- Code SHA: chưa có · Tested SHA: —
- Kiểm thử: NOT_RUN · Môi trường/run: chưa bắt đầu
- Phạm vi ghi: `poc/03-opfs/` và file checkpoint này, không sửa module của worker khác.

Entrypoint: [03-opfs](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/03-opfs.md) · [COMMON](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md)

## Đã xác minh
- HEAD chỉ thêm checkpoint so với baseline; thư mục `poc/03-opfs/` chưa tồn tại, không có test PASS.
- Fixture nhận các khối `{recordingId,sequenceNo,firstSample,sampleCount,sampleRate,channels,format:'f32le',pcm:ArrayBuffer}`; flush + IndexedDB journal mới được công bố committed coverage.
- OPFS và IndexedDB không có transaction chung. Phải thử crash giữa flush và journal, không báo lưu giả.

## Kế hoạch thực thi ngay
1. Tự tạo worker, adapter OPFS/IndexedDB, fixture PCM và bài kiểm thử riêng, không phụ thuộc luồng khác.
2. Ghi WAV PCM float32 từng segment, flush/checkpoint; journal riêng, duyệt checksum/length/header khi recover. Bảo toàn gap/missing và phân biệt buffer recycle với commit ACK.
3. Chạy test deterministic và benchmark ba giờ tổng hợp có thống kê write/flush/peak RAM; ghi PASS/FAIL/NOT_RUN đúng môi trường.
4. Xem diff, commit lên đúng nhánh, cập nhật checkpoint với SHA/test log.

## Còn thiếu
Toàn bộ mã nguồn/test/benchmark của PoC; kiểm chứng Chromium/Windows thực chưa chạy. Không tự nâng thành PASS Gói 1.2.

WIP/chưa push: không · Chặn bên ngoài: chưa xác định
