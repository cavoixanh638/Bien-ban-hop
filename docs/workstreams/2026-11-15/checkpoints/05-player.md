# Checkpoint · 05-player — PoC C1/C2

- Chủ sở hữu: ChatGPT, luồng 05-player; một writer, phạm vi chỉ \`poc/05-player/\` và tệp checkpoint này.
- Nhánh: \`gemini/20261115-05-player\`
- Baseline: \`6142f56a6efdb27aa9445920c9321f7930c0d5fd\`
- Code HEAD đã push trước cập nhật checkpoint: \`e672933842fd8e28e539d3607f6eccac0eddc9c8\`
- Trạng thái: **IMPLEMENTED_WITH_UNVERIFIED_BROWSER / HOLD**. Không được đánh dấu Gói 1.4 DONE.
- Mã kiểm thử commit trên GitHub: **NOT_RUN tại đúng SHA**; Node 9/9 PASS trên bản local tham chiếu được triển khai cùng hợp đồng, **không phải chứng nhận SHA GitHub**.
- Browser: **NOT_RUN** (môi trường hạn chế), Windows Chrome/Edge thật: **NOT_RUN**.
- Chủ trương production: **HOLD**, chưa chọn C1 hay C2.

Entrypoint: [05-player](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/05-player.md) · [COMMON](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/COMMON.md)

## Đã hoàn thành trong phạm vi độc lập

- [player.js](../../../poc/05-player/player.js): 36 segment tổng hợp, 3 giờ, 16 kHz mono, resolver \`valid/pending/missing/gap/unsupported/unlinked\`. Mark fixture theo hợp đồng.
- **C1:** hai \`HTMLAudioElement\`, WAV Blob chỉ sinh cho những segment được cần, preload nguồn tiếp theo, \`preservesPitch=true\`, revoke Blob URL khi rời phạm vi và destroy. \`play()\` khi qua biên không bảo đảm gapless.
- **C2:** \`AudioContext\` lập lịch PCM cửa sổ ~160 ms, lookahead 750 ms, \`AudioBufferSourceNode\`, dừng và giải phóng buffer khi seek/pause. Không decode cả bản 3 giờ. \`playbackRate\` không giữ cao độ.
- [index.html](../../../poc/05-player/index.html): play/pause, timeline, seek 90/170, 0,5–2×, A–B 04:58–05:02, pre-roll 0/3/5/10/15/30, editor giả lập, click thường giữ con trỏ, Alt+click / Ctrl+Alt+P / ▶ mốc; bỏ phím tắt trong IME composition.
- [player.test.js](../../../poc/05-player/player.test.js), [package.json](../../../poc/05-player/package.json), [browser_smoke.py](../../../poc/05-player/browser_smoke.py) và [README.md](../../../poc/05-player/README.md) độc lập, có lệnh tái hiện. Không phụ thuộc artefact từ worker khác.
- Kiểm tra lại blob SHA/đường dẫn trên GitHub: đủ 6 tệp tính cả README, script Node, browser script. Không thay đổi ngoài thư mục và checkpoint.

## Bằng chứng và giới hạn

| Hạng mục | Trạng thái | Bằng chứng / giải thích |
| --- | --- | --- |
| Cấu trúc fixture, 36 đoạn, sample start | PASS_LOCAL | Node.js v22.16.0, 9/9 unit kiểm thử ở local reference |
| Mapping 04:58→05:02, phút 90/170, A–B | PASS_LOCAL_LOGIC | Unit logic; chưa phải phép đo âm thanh qua trình duyệt |
| Missing, gap, pause, pending, nguồn sai | PASS_LOCAL_LOGIC | Fixture resolver; hành vi chuyển audio thực cần kiểm lại |
| Pre-roll 0/3/5/10, Mark gốc bất biến | PASS_LOCAL_LOGIC | Unit so sánh mark trước/sau |
| C1/C2 runtime tại SHA đã push | NOT_RUN | Chưa chạy được browser smoke trên bản đã push |
| Browser Chromium trong container | BLOCKED | Chromium local từ Playwright trả \`net::ERR_BLOCKED_BY_ADMINISTRATOR\` với cả \`http://127.0.0.1:8765/index.html\` và \`file:///.../index.html\`; không có phiên demo chạy thực trong môi trường này |
| C1 gap/drop/lặp ở biên 05:00 | NOT_RUN | Cần audio loopback/sóng âm; thời gian resolve của Promise play không đủ kết luận |
| C2 scheduling gap/drop/lặp, underrun | NOT_RUN | Cần đo loopback thực, CPU load và chuyển tab |
| Seek latency phút 90/170 (ms) | NOT_RUN | Logic target đúng, chưa đo runtime/browser |
| Peak RAM thật, decoder/JS heap | NOT_RUN | Có bộ đếm estimate trong \`stats\`, không có máy đo trình duyệt |
| Nghe giọng tại 0,75×/0,9× | NOT_RUN | Tín hiệu thử là hình sin, không phải giọng người; C2 làm đổi pitch theo thiết kế |
| Click thường/cursor, IME Telex/VNI, xung đột editor chính | NOT_RUN | Demo đã cài handler; phải chạy thực với editor + Unikey/EVKey Windows |

**Ước lượng không phải benchmark:** Một segment WAV mono PCM16 16kHz × 300s ≈ 9,6 MB; 3 Blob URL ≈ 28,8 MB nguồn; một cửa sổ PCM C2 ~10,24 KB (chưa tính overhead, decoder/RSS). Không ghi các số này là peak RAM đo được.

## Rủi ro cần xử lý trước DONE

1. **Media continuity:** hai thẻ C1 chuyển bằng \`ended\` có thể khựng; C2 Web Audio thay đổi pitch khi giảm tốc; cần nghe thử và đo sample drop/duplicate trên Windows.
2. **Gap nằm giữa segment:** fixture có paused/gap interval nhưng WAV giả lập chứa tone liên tục; demo hiện polling để dừng quanh gap, không thể gọi là sample-accurate. Cần để media timeline/segment thực phản ánh lỗ hổng và giới hạn scheduler ở ranh giới interval. C2 lookahead có \`pending-stop\` và cần chính sách xử lý tại chính timestamp.
3. **Bộ nhớ nguồn:** C1 cần thực đo giải phóng Blob URL, decoder cache và các tình huống seek xa/loop dài; C2 cần đo max pending buffer và underrun.
4. **Tích hợp:** chưa được thử với ProseMirror, timeSpan và IME thật; không gắn chặt phím tắt vào input đang composition.

## Lệnh kiểm

\`\`\`bash
cd poc/05-player
npm test
python3 -m http.server 8765
# Tùy chọn: pip install playwright && playwright install chromium
python3 browser_smoke.py
\`\`\`

Fixture tổng hợp, không có âm thanh họp cá nhân. Không sử dụng API, credential hay dịch vụ worker khác.

**Tiếp theo:** chạy \`npm test\` ở checkout sạch đúng HEAD, chạy \`browser_smoke.py\` trên Windows Chrome/Edge được cấp quyền, đo audio loopback & peak RAM, kiểm chất lượng giọng 0,75×/0,9×, sửa lỗi được xác minh rồi cập nhật chính checkpoint này với Tested SHA và vật chứng. Chỉ quyết định chọn adapter sau các bài đo.
