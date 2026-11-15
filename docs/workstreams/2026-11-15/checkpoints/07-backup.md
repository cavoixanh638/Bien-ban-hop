# Checkpoint · 07-backup

- Chủ sở hữu: 07-backup · Sao lưu và khôi phục .mochop
- Nhánh: `gemini/20261115-07-backup`
- Baseline chung: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- HEAD lúc tiếp quản: `951baf62c04ac529d8a22e5c580707b6a8400ca5` (chỉ checkpoint, chưa có mã trong thư mục sở hữu)
- Trạng thái: **IN_PROGRESS**, code/tested SHA: chưa có
- Kiểm thử TC30/TC31/TC38: **NOT_RUN**; nguồn fixture tổng hợp dự kiến, không dữ liệu họp thật
- Môi trường khởi tạo: Linux container, Node.js v22.16.0, npm 10.9.2, Python 3.13.5; RAM 5.8 GiB, disk trống ~30 GiB. **Không phải Windows/Chrome/Edge người dùng.**

Entrypoint: [07-backup](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/07-backup.md) · [COMMON](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md).

## Đã làm
- Đã đọc entrypoint, COMMON, AGENTS, PLAN, STATUS, ARCHITECTURE, ACCEPTANCE_TESTS và baseline.
- Đã kiểm HEAD và cây nguồn của nhánh. Chỉ ghi `poc/07-backup/` và checkpoint này.
- Thử truy cập npm registry từ container bị timeout (chưa coi là bằng chứng về thư viện).

## Đang thực hiện
1. Dựng fixture + adapter độc lập; định nghĩa manifest, ZIP streaming, staging/commit, test dữ liệu hỏng.
2. Chạy test và benchmark trong môi trường hiện có; đối chiếu khả năng thư viện.
3. Xem diff, cập nhật log/SHA và chỉ sau đó đánh giá đủ điều kiện DONE.

## Còn thiếu
- Code, chứng cứ TC30/TC31/TC38, đo 0,5 và 2 GB, ZIP64 riêng, test môi trường khác.
- Xác minh thực tế trên Windows/Chrome/Edge và cổng tích hợp là trách nhiệm đợt tiếp theo.
- Chỉ có writer hiện tại trong luồng này; không suy đoán trạng thái các client khác.

WIP/chưa push: không · Chặn bên ngoài: npm registry chưa truy cập được từ container ban đầu.
