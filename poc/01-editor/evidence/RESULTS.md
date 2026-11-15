# Chứng cứ PoC 01-editor — 15/11/2026

**Bản triển khai độc lập chuẩn bị trên nhánh `gemini/20261115-01-editor`.** Commit và tested SHA phải được bổ sung ở checkpoint sau khi push.

## Môi trường thực tế trong phiên chuẩn bị

- Runtime sandbox: Linux; Node `v22.16.0`, npm `10.9.2`.
- Kết nối: DNS ngoài container không phân giải được (`registry.npmjs.org` và `raw.githubusercontent.com`: `curl (6) Could not resolve host`). Không cài được Tiptap/Playwright trong container này.
- Trình duyệt Chromium có executable trên container, **nhưng chưa thể chạy bundle Tiptap do chưa cài dependency**.
- **Windows / Chrome / Edge / UniKey / EVKey thật: NOT_RUN**, không có thiết bị được điều khiển trong phiên này. Không có trace Windows, không có số liệu P95 thật.

## Lệnh đã thực thi và kết quả

```sh
node --check src/policy.mjs
node --check src/tracker.mjs
node --check src/main.mjs
node --check tests/editor.spec.mjs
node --check scripts/check-trace.mjs
node --test tests/policy.test.mjs
```

- JS syntax: **PASS** với các tệp liệt kê.
- Node built-in tests: **23/23 PASS, 0 FAIL**, chạy dựa trên các hàm logic phụ thuộc 0 thư viện; log TAP có trong terminal phiên làm việc, không phải GitHub Actions.
- `npm install`, `npm run build`, Playwright browser test: **NOT_RUN** do npm registry không truy cập được.
- P95 gõ với trình duyệt và Unicode composition của máy Windows: **NOT_RUN**.
- Các phép đo Node chỉ kiểm **quy tắc thuần**; `TC02 synthetic` chỉ là 120 bước logic, **không phải** gõ trong 120 giây qua bộ gõ thật.

## Báo cáo TC01–TC11 theo evidence hiện có

| TC | Logic thuần | Browser editor thật | Windows + IME thật | Gate |
|---|---|---|---|---|
| 01 | PASS | NOT_RUN | NOT_RUN | NOT_RUN |
| 02 | PASS (120 bước synthetic) | NOT_RUN | NOT_RUN | NOT_RUN |
| 03 | không áp dụng | NOT_RUN | NOT_RUN | NOT_RUN |
| 04 | PASS | NOT_RUN | NOT_RUN | NOT_RUN |
| 05 | PASS | NOT_RUN | NOT_RUN | NOT_RUN |
| 06 | PASS | NOT_RUN | NOT_RUN | NOT_RUN |
| 07 | PASS (allow-list) | NOT_RUN | NOT_RUN | NOT_RUN |
| 08 | PASS (attrs equality) | NOT_RUN | NOT_RUN | NOT_RUN |
| 09 | PASS (JSON marks) | NOT_RUN | NOT_RUN | NOT_RUN |
| 10 | PASS (paste/unlinked policy) | NOT_RUN | NOT_RUN | NOT_RUN |
| 11 | PASS (count/P95 pure) | NOT_RUN | NOT_RUN | NOT_RUN |

**Đánh giá hiện tại: IN_PROGRESS, không đủ READY_FOR_REVIEW.** Cần máy Windows + thử 4 cấu hình IME, browser build, kiểm mark xuyên edit/undo/redo và đo P95/memory/JSON thật. Không phát hành hoặc tích hợp chỉ nhờ 23 test pure logic.
