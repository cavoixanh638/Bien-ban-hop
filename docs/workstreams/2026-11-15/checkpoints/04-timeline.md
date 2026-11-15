# Checkpoint · 04-timeline

- Chủ sở hữu: 04-timeline (một writer, GitHub connector)
- Nhánh: `gemini/20261115-04-timeline`
- Baseline: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- Trạng thái: IN_PROGRESS · khởi động PoC độc lập
- HEAD đã kiểm: `c59fb319d15f78fdf4dc964bc2ac69a639c499d6` (1 commit hơn baseline, chỉ thêm checkpoint; chưa có code)
- Code SHA: — · Tested SHA: —
- Kiểm thử: NOT_RUN · Môi trường/run: đang chuẩn bị Node/TypeScript + synthetic fixtures

Entrypoint: [Timeline và ánh xạ mốc](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/04-timeline.md) · [Hợp đồng](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md)

## Đã làm

- Đọc entrypoint, COMMON và tài liệu thiết kế/tiêu chí; rà diff `baseline...nhánh`, chưa có mã PoC hiện hữu.
- Chốt ranh giới ghi: chỉ `poc/04-timeline/` và checkpoint này; không phụ thuộc output luồng khác.
- Thiết kế fixture tự sinh; mapping input monotonic → sample/media; meeting → media; resolver segment trạng thái rõ ràng.

## Còn thiếu

- Mã thư viện, fixture, test biên nguồn/segment/pause/gap/missing/pending, phép đo tín hiệu tổng hợp.
- Test thiết bị live thuộc lượt tích hợp, không được gán PASS từ fixture.

## Tiếp theo

1. Tạo package TypeScript chạy độc lập, fixture tự sinh và kiểm tra drift/sample mapping.
2. Chạy test và ghi Expected/Actual theo SHA; kiểm tra diff chỉ thuộc scope.
3. Commit kết quả/checkpoint trên nhánh riêng; bàn giao hạn chế tích hợp.

WIP/chưa push: — · Chặn bên ngoài: chưa có thiết bị capture live trong PoC.
