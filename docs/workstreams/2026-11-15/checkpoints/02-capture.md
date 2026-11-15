# Checkpoint · 02-capture

- Chủ sở hữu: 02-capture (tiếp nhận luồng thu âm độc lập)
- Nhánh: `gemini/20261115-02-capture`
- Baseline: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- Trạng thái: IN_PROGRESS
- Code SHA: chưa có (HEAD ban đầu `271adbd4a326b1cc7afd1b593eb621819b1820ad`) · Tested SHA: —
- Kiểm thử: NOT_RUN · Môi trường: Linux x86_64, Node 22.16.0, Chromium 144.0.7559.96 (headless; không phải Windows Chrome/Edge thật)

Entrypoint: [Thu âm và vận chuyển dữ liệu](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/02-capture.md) · [Hợp đồng](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md)

## Đã xác minh

- 15/11/2026: branch HEAD `271adbd4` ahead baseline 1 commit; chỉ có checkpoint, chưa có `poc/02-capture/`. Phạm vi writer cố định cho luồng này.
- Đã đọc entrypoint, COMMON và các tài liệu thiết kế/TC12–TC21.
- Môi trường có Chromium headless và ffmpeg/ffprobe; không có Windows thật, thiết bị micro thật hoặc giao diện tương tác để rút mic.

## Đang làm

1. Xây fixture PCM tự sinh, engine AudioWorklet/MessageChannel/Worker với pool hữu hạn, pause/gap và kiểm bộ đếm.
2. Tạo MediaRecorder đối chứng với cùng nguồn, demo/browser harness và phép đo.
3. Chạy unit + Chrome headless; ghi rõ khác nhau giữa bài 3 giờ theo số mẫu tổng hợp và 3 giờ thời gian thực.
4. Commit chỉ trong thư mục sở hữu, cập nhật tested SHA và bằng chứng.

## Còn thiếu tại mốc này

- Mọi kiểm thử còn NOT_RUN (không ghi PASS trước khi chạy).
- TC21 audio online với audio track thật và ghi 3 giờ wall-clock trên Windows còn NOT_RUN.
- OPFS durability/crash thuộc luồng 03; không gộp giả vào kết quả capture.

WIP/chưa push: none · Chặn bên ngoài: Windows Chrome/Edge + micro/screen audio thật.
