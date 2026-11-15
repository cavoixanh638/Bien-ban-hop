# Checkpoint · 01-editor (PoC A / Gói 1.1)

- Chủ sở hữu: ChatGPT tiếp quản luồng Editor được giao cho 01-editor
- Nhánh duy nhất: `gemini/20261115-01-editor`
- Baseline: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- HEAD sau bàn giao: `6db17bdb68b791c04eeb7a4a72d980da02aaaee9` (trước commit checkpoint này)
- Code SHA: `6db17bdb68b791c04eeb7a4a72d980da02aaaee9`
- Evidence SHA: `6db17bdb68b791c04eeb7a4a72d980da02aaaee9`
- Tested source: `6db17bdb68b791c04eeb7a4a72d980da02aaaee9` **CHỈ CHO PURE POLICY TEST**; chạy trên bản sao độc lập của đúng các tệp source/test đã push, không phải checkout GitHub sạch
- Trạng thái: **IN_PROGRESS (KHÔNG READY_FOR_REVIEW)** — bắt buộc có Windows + UniKey/EVKey thực và browser verification
- Node policy test: **PASS 24/24** (Linux sandbox Node `v22.16.0`, npm `10.9.2`); syntax check 5 tệp **PASS**
- Tiptap build, Playwright browser, Windows Chrome/Edge UniKey/EVKey Telex/VNI: **NOT_RUN**
- Mốc P95 nhập trên Windows (<100ms), TextNode/Mark/DOM trên browser và 2 phút gõ thật: **NOT_RUN**

Entrypoint: [01-editor.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/01-editor.md) · [COMMON.md](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md).

## Đã triển khai và push

1. [Demo độc lập + README](../../../../poc/01-editor/README.md) tại `poc/01-editor/`: Tiptap/ProseMirror, toolbar, editor tự gắn `timeSpan` trên nhiều cụm cùng một đoạn, mốc tại con trỏ, fake audio context/coverage, xuất NoteDocument và trace lược nội dung.
2. [InputTracker](../../../../poc/01-editor/src/tracker.mjs) và [pure policy](../../../../poc/01-editor/src/policy.mjs): MarkSpec `inclusive:false`, `excludes:'timeSpan'`, `spanning:true`; kiểm tất cả attrs, phân loại StepMap/selection/word, beforeinput/input/composition, heuristic Backspace+Insert, format, clipboard provenance + allow-list recordingId, Undo/Redo do ProseMirror history quản lý.
3. [Bộ kiểm thử Node](../../../../poc/01-editor/tests/policy.test.mjs) (24 test) và [browser Playwright](../../../../poc/01-editor/tests/editor.spec.mjs) (đã viết, NOT_RUN), [fixture](../../../../poc/01-editor/fixtures/synthetic-note.json), [trace validator](../../../../poc/01-editor/scripts/check-trace.mjs).
4. [Bảng TC01–TC11 + trạng thái](../../../../poc/01-editor/evidence/RESULTS.md) và [TAP log](../../../../poc/01-editor/evidence/policy-node22.tap.md). Kết quả fixture chỉ minh chứng phép thử policy; **không coi là TC của editor đạt**.
5. Rà soát an toàn trace: lược mọi phím in được thành `[printable]`, giữ phím điều khiển để quan sát Backspace/Insert, bổ sung 1 test privacy; **24/24 PASS** và cập nhật TAP log. Đã kiểm GitHub diff commit code trước push: 14 tệp mới đều trong `poc/01-editor/`; commit evidence tiếp theo chỉ đổi/đặt hai tệp trong cùng phạm vi.

## Lệnh đã chạy

```sh
node --check src/policy.mjs
node --check src/tracker.mjs
node --check src/main.mjs
node --check tests/editor.spec.mjs
node --check scripts/check-trace.mjs
node --test tests/policy.test.mjs
```

- Kết quả Node policy (bản sao isolated của đúng source/test): **24 PASS, 0 FAIL, exit 0**. Log: `poc/01-editor/evidence/policy-node22.tap.md`.
- `npm install` bị chặn vì sandbox không resolve `registry.npmjs.org`; không thử `npm run build`/Playwright khi thiếu dependency. Không ghi PASS cho phần chưa chạy.
- Máy dùng thật trong đợt này là Linux container; không có UniKey/EVKey/Windows. Không có dấu hiệu test IME đã chạy, không dựng trace giả mạo.

## Bảng gate

| TC | Unit policy | Browser runtime | Windows IME | Trạng thái TC tổng thể |
|---|---|---|---|---|
| TC01 | PASS | NOT_RUN | NOT_RUN | NOT_RUN |
| TC02 | PASS synthetic (không phải gõ 120s) | NOT_RUN | NOT_RUN | NOT_RUN |
| TC03 | PASS (trace redaction policy; không phải IME) | NOT_RUN | NOT_RUN | NOT_RUN |
| TC04–TC11 | PASS subcase policy | NOT_RUN | NOT_RUN | NOT_RUN |

## Còn thiếu / giới hạn có chủ đích

- **Bắt buộc Windows thực:** 4 tổ hợp UniKey/EVKey × Telex/VNI, trace `Backspace+Insert` không composition, đổi dấu muộn, gõ nhanh/chậm, máy tải nặng, định dạng và 120 giây không Enter.
- **Browser + QA:** cài dependency, khóa lockfile, build Vite/Chrome-Edge, chạy Playwright, kiểm sát mark theo từng thao tác, Undo/Redo, clipboard từ Word/web/cross-meeting, số TextNode/DOM/JSON, độ trễ P95 <100ms trên cấu hình công bố; sửa kết quả FAIL trước review.
- **Giới hạn heuristic:** burst có thể nhận sai một thao tác xóa rồi gõ thật thành sửa dấu; clipboard thiếu MIME custom rơi về unlinked để an toàn; khi con trỏ ở ranh giới hai mốc trả `ambiguous`, không đoán nguồn; `compositionend` deferred cần test browser/IME thật.
- Demo không thu audio, không autosave bền vững, không có player; các phần này thuộc workstream khác/đợt tích hợp. Không đưa trạng thái Gói 1.1 về PASS và không sửa tracker/STATUS chung vì chỉ được ghi checkpoint nhánh của mình.

## Tiếp tục từ HEAD

```sh
git fetch origin
git switch gemini/20261115-01-editor
cd poc/01-editor
npm install
npm run test:unit
npx playwright install chromium
npm run test:e2e
npm run build
npm run dev
```

Sau thử Windows: lưu trace đã lược chữ + NoteDocument/screenshot/cấu hình máy; đối chiếu bảng TC, sửa lỗi nếu phát hiện và cập nhật checkpoint theo tested SHA mới. Chỉ đổi `READY_FOR_REVIEW` khi **toàn bộ bằng chứng bắt buộc** Gói 1.1 có thể kiểm độc lập.

WIP/chưa push: **không** · Chặn bên ngoài: **cài npm/browser tại máy có mạng; chạy IME Windows thật**.
