# 05-player · PoC C1/C2

Phạm vi độc lập của worker \`gemini/20261115-05-player\`. Không nhập module từ các luồng khác.

## Chạy từ checkout sạch

\`\`\`bash
cd poc/05-player
npm test
python3 -m http.server 8765
\`\`\`

Mở \`http://localhost:8765/\` trong Chrome hoặc Edge, bấm **Phát** để cấp phép audio. Không dùng \`file://\` nếu trình duyệt chặn ES module.

## Dữ liệu và mốc

Fixture ở \`player.js\`: tổng 3 giờ, 36 đoạn WAV PCM mono 16 kHz × 5 phút, **chỉ sinh Blob của đoạn cần khi phát**. Mẫu tổng hợp toàn cục được lấy theo chỉ số mẫu nên có thể đối chiếu ranh giới 04:58–05:02 (300 s), mốc phút 90 và 170. Đoạn #20 (100–105 phút) thiếu có chủ ý; pause 30:00–30:10 và gap 60:00–60:15. \`resolve(recordingId,offset)\` trả valid, pending, missing, gap, unsupported hoặc unlinked. \`fixture.marks\` tuân thủ trường đã đóng băng (anchorId, recordingId, audioOffsetMs, typedAt, source, schemaVersion).

**C1:** hai \`HTMLAudioElement\`, \`preload=auto\`, \`preservesPitch=true\`, chuyển nguồn tại \`ended\`, giải phóng Blob URL khi rời khu vực và destroy. Việc gọi \`play()\` ở boundary **không** cung cấp nối mẫu chính xác. Một WAV 5 phút PCM16/16k xấp xỉ 9,6 MB; trường hợp ba URL đồng thời xấp xỉ 28,8 MB Blob nguồn, **không** phải đo heap/RSS.

**C2:** \`AudioBufferSourceNode\` lập lịch các cửa sổ 160ms, lookahead ~750ms trên \`AudioContext.currentTime\`, không decode WAV ba giờ. Bỏ buffer sau \`ended\`, stop/disconnect khi pause/seek. Bộ nhớ PCM cho 8 cửa sổ điển hình < 100 KB (chưa tính overhead). \`playbackRate\` **không giữ cao độ**; C2 chỉ là đối chứng.

**Điều khiển:** một timeline, play/pause, seek, 0.5–2×, A–B, chọn 0/3/5/10 giây pre-roll (có 15/30); Alt + click, Ctrl+Alt+P và ▶ ngữ cảnh. Click thường giữ focus/con trỏ editor. Mốc gốc bất biến khi chỉnh pre-roll.

## Cách đo thực tế cần thực hiện

1. Chrome/Edge Windows, tai nghe, audio loopback PCM: chạy 04:58→05:02 bằng C1 và C2, so waveform theo sample count/chirp, thống kê silence, sample duplicate/drop, độ lệch và latency; không dùng thời gian Promise \`play()\` thay số đo âm thanh.
2. Seek 90/170 phút, A–B 04:58–05:02, gap, missing; kiểm không phát nhầm gần boundary và khi quay lại seek.
3. Đo peak RSS/JS heap, bộ đệm media decoder và Blob URL; thao tác 2–3 giờ. Cần phân biệt ước lượng cấp phát trong code với RAM đo thật.
4. Nghe lời nói được phép tại 0.75×, 0.9× (khác với tín hiệu hình sin); ghi chất lượng giọng bằng người nghe. C2 dự kiến đổi cao độ.
5. Thử Unikey/EVKey Telex/VNI ở editor thật khi gõ/Alt-click/phím tắt, quan sát conflict với ProseMirror/timeSpan trên bản tích hợp.

**Caveat:** logic fixture mô phỏng \`gap/paused\` nằm trong cùng segment WAV; sự kiện từ AudioElement \`timeupdate\`/polling **không** đủ chứng nhận sample-exact stop tại gap. C2 \`pending-stop\` tại ranh giới lookahead cũng cần hoàn thiện khi tích hợp. Cần remap/trim media được ghi thực tế để không đưa khoảng không hợp lệ vào player. Không coi đây là sản phẩm được nghiệm thu.

Báo cáo checkpoint: [05-player](../../docs/workstreams/2026-11-15/checkpoints/05-player.md).
