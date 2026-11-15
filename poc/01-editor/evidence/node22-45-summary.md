# PoC 01-editor — Node fixture regression, 45 tests

- Môi trường: Linux 6.18.57 x86_64; Node `v22.16.0`; npm `10.9.2`.
- Source thực thi: byte-identical với Git blob của 4 tệp mã/test đã thay đổi tại `78aa598d423bba2ebc3bba3562e6bcbea2c2f644`; đây là **local source run**, không phải checkout Git từ remote.
- Lệnh: `cd poc/01-editor && npm run test:unit`.
- Kết quả: **45 PASS / 0 FAIL / exit 0**. Run cuối cùng 251.5901 ms; syntax check JS tất cả tệp src/tests/scripts **PASS**.
- Ca mới: caret linked/unlinked, caret foreign-invalid/linked, copy HTML không chứa audio metadata và vẫn giữ trusted internal Slice, Undo/Redo reset active/pending state + gõ tiếp phải lấy mốc mới.
- Tiptap/Playwright E2E: **NOT_RUN** (npm registry DNS bị chặn, offline `ENOTCACHED` với `@playwright/test`).
- UniKey/EVKey Windows và P95 editor thật: **NOT_RUN**.

```text
1..45
# tests 45
# suites 0
# pass 45
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 251.5901
```

Báo cáo chỉ về **Node fixture**. Chưa thể dùng để nghiệm thu TC01–TC11 thực địa.
