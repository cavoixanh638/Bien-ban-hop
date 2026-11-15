# Checkpoint · 00-command

- Chủ sở hữu: ChatGPT tiếp quản vai trò Tổng chỉ huy và bộ kiểm thử hợp đồng (writer duy nhất nhánh 00 trong lượt này).
- Nhánh: `gemini/20261115-00-command`
- Baseline: `6142f56a6efdb27aa9445920c9321f7930c0d5fd`
- Trạng thái: **READY_FOR_REVIEW — đã push bộ harness độc lập và hướng dẫn tích hợp; chưa DONE do thiếu clean-checkout Node run**
- Code revision: [`bd08496a`](https://github.com/cavoixanh638/Bien-ban-hop/commit/bd08496a57ba80706eb0b2e5ac9730600c019591) (test + adapters); runbook revision [`b136a897`](https://github.com/cavoixanh638/Bien-ban-hop/commit/b136a897109dacd211ff6118e190481092634d34)
- Bằng chứng kiểm thử: **17/17 V8 mock PASS** trên nội dung nguyên file lấy lại trực tiếp từ GitHub (blob `7bca1887b80448e5ec916417fa69385468467b3d` và `08500d8626dd155fbd3fdb415103a047ef45682a`), dùng shim tương đương `node:assert`, `node:crypto` hash và Buffer. **Không được gọi đây là Node runtime PASS.**
- Kiểm thử Node cục bộ bằng code mô phỏng tương đương (khác file code trên GitHub): `16 PASS / 0 FAIL`, Node 22.16.0, Linux, `npm test`, không dùng code/fixture worker. Bản **đúng GitHub SHA từ clean checkout: NOT_RUN** vì container không kết nối được github.com.
- Môi trường: Node 22.16.0 Linux cho test mô phỏng cục bộ; V8 isolated cho kiểm tra lại mã GitHub. Windows/Chrome/Edge thực địa: NOT_RUN.

Entrypoint: [00-command.md](00-command.md) · [COMMON.md](COMMON.md) · [TRACKER.md](TRACKER.md).

## Đã tạo và push

1. [Reference contracts + synthetic fixture](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/poc/00-contract-tests/contracts.mjs): ProseMirror JSON và `timeSpan`, dữ liệu tiếng Việt, clock sample, multi-segment manifest, link resolver, PCM sink, revision/lease, staging restore, SW activation mock.
2. [17 test cases](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/poc/00-contract-tests/harness.test.mjs): thời gian/segment/nguồn, pause/gap/missing/pending, autosave fail, dual writer, backup checksum và ba negative controls có bắt lỗi cố ý.
3. [package.json](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/poc/00-contract-tests/package.json), [README / cách chạy](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/poc/00-contract-tests/README.md).
4. [Ma trận TC01–TC38](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/poc/00-contract-tests/TC_MATRIX.md) phân biệt mock và runtime NOT_RUN.
5. [Gated integration runbook](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/poc/00-contract-tests/INTEGRATION_RUNBOOK.md): cổng 1.1, thứ tự chín adapter và bằng chứng Windows/3 giờ/playback/crash/quota/restore/PWA.
6. [TRACKER.md](TRACKER.md): đã đọc checkpoint + HEAD của chín worker, cập nhật 04 READY_FOR_REVIEW local 16/16, tám luồng còn lại IN_PROGRESS, không gán PASS từ báo cáo mô phỏng. Giao việc cụ thể và ghi 3 đề xuất hợp đồng cho đợt tích hợp, không sửa COMMON.

## Cách chạy chính xác từ checkout sạch

```bash
git clone --single-branch --branch gemini/20261115-00-command https://github.com/cavoixanh638/Bien-ban-hop.git
cd Bien-ban-hop/poc/00-contract-tests
npm test
npm run test:json > run.json
```

Kỳ vọng: 17 test, 0 FAIL. Chỉ khi chạy và xác nhận trên file từ commit đúng, cập nhật `Tested SHA` và log thành PASS. Không hứa đã làm bước này.

## Ranh giới và việc chưa làm

- **Chưa tích hợp mã worker, chưa thay đổi main/STATUS, chưa merge/deploy/DNS.** Đợt này là fixture test chuẩn bị Gói 1.6, không phải bản ứng dụng hoàn chỉnh.
- Toàn bộ TC01–TC38 trên runtime tích hợp: **NOT_RUN**. Cổng 1.1 cần UniKey/EVKey Telex/VNI Windows thực; cần ghi 3 giờ, player C1/C2 thực, OPFS/crash/quota, restore .mochop lớn/máy khác, SW/migration, DOCX Word.
- **Chặn DONE độc lập:** chưa chạy đúng file vừa push từ fresh checkout bằng Node. Không có block kỹ thuật từ worker cho fixture. Không kế thừa V8/mock PASS thành production PASS.

WIP/chưa push: không (mọi artifact được push qua GitHub connector). **Checkpoint này cần commit làm HEAD**, kiểm lại git tree sau ghi; mã source không thêm bất cứ file nào ngoài phạm vi 00.
