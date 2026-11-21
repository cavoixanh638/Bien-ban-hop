# TRẠNG THÁI VÀ ĐIỀU PHỐI — BIÊN BẢN HỌP

**Ngày khởi tạo:** 15/11/2026  
**Nguồn:** [PLAN_V1_2.md](PLAN_V1_2.md) · [Bộ nghiệm thu](ACCEPTANCE_TESTS.md)  
**Trạng thái chung:** **INTEGRATION_ALPHA / CHƯA NGHIỆM THU PHÁT HÀNH**

Tệp này **kết hợp CURRENT_STATE + WORKBOARD + sổ quyết định gọn**, không phải hồ sơ lịch sử dài. Mọi trạng thái phải có bằng chứng; **không** biến “đã lập kế hoạch” thành PASS.

## G00 — Phát liên tục theo luồng: giữ cao độ + RNNoise + bỏ qua im lặng (22/11/2026)

**Phạm vi hiện hành (thay thế giới hạn nghe tập trung trong checkpoint 21/11 bên dưới):**

- **WAV gốc:** G02/G03 ghi và lưu PCM/OPFS nguyên bản, không lọc khi thu; các hiệu ứng nằm trên nhánh nghe lại, không sửa WAV/manifest, `recordingId`, `timeSpan` hoặc ghi chú.
- **Giữ cao độ mặc định:** `HTMLMediaElement.preservesPitch` trong luồng nghe nhanh/chậm (0,5–2×), dùng chunk WAV riêng **≤6 giây và ≤8 MiB** từ các mẫu OPFS đã xác minh; chỉ giữ đoạn đang phát và một đoạn chuẩn bị, không tạo một Blob cho bản ghi 2–3 giờ. Đổi tốc độ/bộ lọc khi đang phát khởi động lại từ **mốc nguồn hiện tại**, lệnh cuối cùng ưu tiên; các tài nguyên URL/node được giải phóng khi Stop/seek/switch.
- **Bỏ qua im lặng Liên tục:** `ProgressiveSilenceIndex` kiểm RMS theo từng cửa sổ nhìn trước **8 giây**, có kiểm tra PCM từng `seek`, hủy khi Stop, loại bỏ các khoảng index đã phát để tránh tăng RAM theo giờ. Không cần chọn focus 15/30/60 giây. Giữ mép vùng im lặng, không coi gap/lỗi dữ liệu là silence, không bỏ qua phiên khác; đây **không phải AI speech-VAD**, cần test giọng nói nhỏ/thấp.
- **RNNoise:** WASM/AudioWorklet cục bộ 48 kHz, OFF mặc định, có thể hoạt động đồng thời với pitch-preserve và skip-silence qua đường phát lại. EQ vẫn tùy chọn, không đổi file gốc.
- **Nhiều phiên thu:** khi mode Liên tục, tự chuyển sang phiên kế ngay sau nếu phiên trước kết thúc đúng **mẫu bền vững cuối**, phiên sau bắt đầu từ mẫu 0, không có gap/trailing unavailable; vẫn giữ mapping trên timeline ghép phiên. A–B không tự vượt recordingId.
- **Phần chưa chốt:** MediaElement per-chunk chưa chứng minh nối âm **gapless** trên phần cứng thật, có thể có seam/độ trễ nhỏ ở ranh giới chunk; chưa đo CPU/RAM 3h, giọng nhiều người, tiếng xa, RNNoise, Windows/UniKey/EVKey; thao tác phát nhiều giờ thực tế và TC01–TC38 vẫn **NOT_RUN**. Trạng thái sản phẩm **INTEGRATION_ALPHA / RELEASE HOLD**, PR [#1](https://github.com/cavoixanh638/Bien-ban-hop/pull/1) Draft, không merge/deploy.
- **Code SHA = Tested SHA:** `7e4da6755735971763952c1df72201228ccb86d6` trên nhánh `integration/20261115-g10-v1.2`. [GitHub Actions #44931574055](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44931574055) **COMPLETED/SUCCESS**: Node G10 **106/106 PASS trên mỗi hệ Linux và Windows**, Vite build/nhóm PoC PASS; Chromium dev **41 PASS + 1 PWA-only SKIP**, Chromium production/PWA **42/42 PASS**, **0 FAIL**. Bài E2E **phát WAV 16s đi qua ≥2 chunk với tốc độ 2×, giữ pitch+RNNoise+skip đồng thời**, **bật/tắt khi đang nghe** và **tự chuyển hai phiên ghi liền mạch** đều PASS cả dev lẫn production. Bản ghi giả 3h chỉ kiểm giới hạn đọc PCM theo lookahead, không tương đương nghe thật 3h. Các commit tài liệu/checkpoint sau Tested SHA không thay logic mã đã kiểm thử.

## G00 — Kiểm toán chức năng sau lỗi Bỏ qua im lặng (21/11/2026)

**Phát hiện từ ảnh thực tế:** Tùy chọn `Bỏ qua im lặng` có thể bật trong khi `Nghe tập trung` vẫn là `Liên tục` (`focus-duration=0`); `scanVerifiedSilence()` yêu cầu cửa sổ 15/30/60 giây nên khi bấm Phát sẽ báo lỗi. Trước đây E2E chỉ chọn sẵn 15s, đã bỏ sót tương tác thực. Lượt CI sửa giao diện nút ghi ngay trước đó: 91 unit PASS nhưng Chromium dev **FAIL 1** do bắt màu lúc CSS còn transition hover; báo cáo cũ chờ PASS đã được cập nhật chính xác tại đây.

**Đã sửa:** 
- Khi bật Bỏ qua im lặng trong chế độ Liên tục, UI chuyển **ngay** sang **Nghe tập trung 30 giây**, đặt ô chọn thật về 30000 và thông báo lý do bên cạnh tốc độ; khi chủ động quay lại Liên tục, ứng dụng tắt Bỏ qua im lặng. Không ngầm quét hàng giờ hoặc khiến người dùng tưởng vẫn ở Liên tục.
- Giữ cao độ ở tốc độ khác 1× cũng yêu cầu focus; khi bật đồng thời Bỏ qua im lặng và Giữ cao độ ở tốc độ khác 1×, **lựa chọn mới nhất được giữ**, tùy chọn kia tự tắt và báo rõ. Tốc độ 1× không gọi bộ giữ cao độ nên có thể bật cả hai mà không xung đột.
- Bộ phân tích RMS đọc mỗi cửa sổ ≤60 giây, hỗ trợ lặp A–B **0,4–120 giây** (thử 0,4 và 90 giây); không lưu dữ liệu sai, không vượt gap, không sửa mẫu PCM, ID phiên, `timeSpan` hoặc chú thích. **Bỏ qua im lặng nhiều giờ liên tục chưa được triển khai.**
- Lựa chọn Nghe tập trung được đưa lên sát Tốc độ, tránh bị khuất khi cửa sổ hẹp; có trạng thái tùy chọn bằng chữ. Sửa bài E2E màu nút ghi chờ hết CSS transition; không thay logic capture.
- PWA cache shell đổi phiên bản `bien-ban-hop-20261121-g00-silence-options-audit`.

**CI xác nhận mã ứng dụng:** **Code SHA = Tested SHA: `d730b40d763acc0453056d5f27d711a0c35c41a5`** — [GitHub Actions #44908183703](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44908183703) **SUCCESS**. Node **100/100 PASS trên mỗi hệ Linux và Windows**, các bộ PoC liên quan PASS; Chromium dev **38 PASS + 1 PWA-only SKIP**, production/PWA **39/39 PASS**, **0 FAIL**. Ca chạy mô phỏng chính xác lỗi Liên tục+Bỏ qua im lặng, chuyển tập trung, xung đột Giữ cao độ, RNNoise kết hợp, WAV, waveform và các màu nút ghi đều PASS. Các commit sau SHA này chỉ thay cache PWA và tài liệu/checkpoint, CI cuối HEAD cần kiểm chứng riêng.

### Đối chiếu 18 nhóm tính năng (tình trạng có bằng chứng, không tự đánh đồng nghiệm thu)

| # | Nhóm | Bằng chứng kỹ thuật | Giới hạn chưa nghiệm thu |
|---|---|---|---|
| 01 | Soạn thảo Word cơ bản | Unit + Chromium lưu/reopen, font, in đậm/nghiêng, DOCX **PASS** | Word desktop thật **NOT_RUN** |
| 02 | Giãn dòng, lề, thụt, danh sách, Heading | Unit OOXML + Chromium CSS/độ giãn dòng **PASS** | Danh sách dài/lồng sâu Word desktop **NOT_RUN** |
| 03 | Tìm/thay | Chromium tìm/thay text, chặn sửa mark có mốc **PASS** | IME/đoạn dài cực lớn **NOT_RUN** |
| 04 | Bảng, ô gộp | Chromium tạo bảng, xuất DOCX cơ bản **PASS** | Gộp ô phức tạp, bảng qua trang trên Word desktop **NOT_RUN** |
| 05 | DOCX/A4/lề | Unit XML + Chromium xuất DOCX, in A4 **PASS** | Pagination chuẩn Word desktop/PDF hệ điều hành **NOT_RUN** |
| 06 | Nghe tập trung/phím tắt | Chromium click-to-play/mốc ghi, option 15/30/60/continuous; unit mapping **PASS** | Độ chính xác âm thanh trên máy thật **NOT_RUN** |
| 07 | Lặp A–B/tua/tốc độ | Unit vùng contiguous/gap, Playwright UI, CI **PASS** | Nhiều vòng A–B 3h/giật âm thực **NOT_RUN** |
| 08 | Nhập âm thanh sẵn | Chromium nhập WAV PCM16, gõ và phát đúng mốc **PASS** | MP3/M4A dài, codec đặc biệt **NOT_RUN** |
| 09 | Giữ cao độ | Chromium `preservesPitch` khi nghe tập trung và phối hợp RNNoise **PASS** | Chất lượng giọng người thật/máy thật **NOT_RUN** |
| 10 | EQ làm rõ giọng | Unit filter + lựa chọn trên Chromium **PASS** | Đánh giá cảm nhận/CPU với giọng hội họp **NOT_RUN** |
| 11 | Ảnh/link/ngắt trang/PDF | Chromium nhập ảnh, link an toàn, ngắt trang, DOCX export/in PDF **PASS** | Trang dài/cắt ảnh/Word desktop **NOT_RUN** |
| 12 | Tìm toàn cuộc họp | Chromium tìm tiếng Việt không dấu, điều hướng tới kết quả **PASS** | Trọn bộ kết quả nhiều nghìn trang **NOT_RUN** |
| 13 | Đánh dấu quan trọng | Unit mark + Chromium từ chối văn bản thiếu mốc **PASS** | Hành vi đánh dấu/chọn chéo nhiều mốc với UniKey thật **NOT_RUN** |
| 14 | Quota/backup SHA | Unit checksum + Chromium lưu, xác minh ZIP/CRC/SHA và khôi phục qua profile khác **PASS** | File nhiều GiB, mất điện, quota và máy thật **NOT_RUN** |
| 15 | Xuất WAV A–B | Unit kiểm WAV header/mẫu liên tiếp/gap **PASS** | Xác minh tải file WAV và phát nhiều giờ trên Windows thật **NOT_RUN** |
| 16 | Waveform PCM | Unit RMS/gap + Chromium đo vị trí, chiều cao, màu sắc **PASS** | Waveform toàn bộ điểm PCM/âm lượng micro thật **NOT_RUN** |
| 17 | RNNoise WASM | Chromium dev/prod nạp WASM và phát, cả khi kết hợp pitch/skip **PASS** | Chất lượng chống ồn nhiều người, CPU/RAM Windows thật **NOT_RUN** |
| 18 | Bỏ qua im lặng RMS | Unit 0,4/90 giây + Chromium tái hiện & sửa lỗi focus 0; phối hợp RNNoise **PASS** | Không hỗ trợ skip trong Liên tục; không phải voice-VAD ML; âm phòng họp thật **NOT_RUN** |

**Đánh giá:** Tất cả nhóm có mã và một mức chứng cứ tự động, nhưng **không có cơ sở khẳng định cả 18 tính năng đã hoàn thiện/được nghiệm thu trên máy thực**. Trạng thái sản phẩm tiếp tục **INTEGRATION_ALPHA / RELEASE HOLD**, PR #1 Draft, không merge, không deploy. Nếu kiểm tra trên Windows thật, tuyệt đối sử dụng cuộc họp giả lập và sao lưu dữ liệu OPFS/IndexedDB trước; không xóa kho dữ liệu cũ.

## G00 — Sửa waveform khó nhìn và hai nút ghi âm chưa nổi bật (21/11/2026)

- **Nguồn phát hiện:** ảnh giao diện người dùng đang ghi âm 7 phiên (~1 giờ 22 phút): nhãn `Đã lấy mẫu 128 vị trí` nhưng gần như không thấy biểu đồ sóng; `Tạm dừng` và `Kết thúc` đều trắng giống nút thông thường.
- **Sửa hiển thị:** waveform RMS lấy mẫu **không còn nằm trong sọc recorded 18px**; tách thành dải sóng xanh lam phía trên, dải green/gray có/thiếu PCM phía dưới. Khung tua cao 50px; cột có khe, tối thiểu 4px và tỷ lệ tương đối theo RMS đã đo. Có sàn RMS 0,002 để không khuếch đại tiếng nền cực nhỏ thành sóng cao. Khoảng gap giữ `null`, tuyệt đối không vẽ giả hoặc đổi PCM/timeSpan.
- **Sửa nút ghi:** trong trạng thái `capturing`, **Tạm dừng màu vàng cam**, **Kết thúc màu đỏ**, cỡ nút ≥44px/đậm; trong trạng thái `paused`, **Tiếp tục màu xanh lá**, **Kết thúc giữ đỏ**. Nút vô hiệu hóa vẫn thể hiện disabled; thêm focus-visible và dữ liệu `data-mode` từ state ghi âm, không thay hành vi thu/lưu.
- **Bài test mới:** unit `waveformDisplayHeights` kiểm RMS=0, tín hiệu nhỏ, tín hiệu có thật, gap/null và giá trị sai; Chromium E2E đo vị trí/chiều cao/thứ tự lớp và màu sóng khác coverage; bài `app/e2e/recording-button-colors.spec.mjs` thử start→pause→resume→stop, kiểm RGB và trạng thái enabled.
- **Lịch sử kiểm thử:** tại SHA `88be7d4531cb22d7918c771e8d5c815c8e5fa913` tình trạng ban đầu là **NOT_RUN**; lượt CI tiếp theo [#44894497985](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44894497985) **FAIL 1 E2E** vì bắt màu trong CSS transition (91 unit PASS). Đã sửa bài E2E chờ kết thúc chuyển màu, bổ sung regression skip-silence và xác minh lại ở **Code SHA = Tested SHA `d730b40d763acc0453056d5f27d711a0c35c41a5`**, [CI #44908183703](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44908183703) **SUCCESS** (Chromium dev 38 PASS +1 SKIP, production 39/39 PASS). **Windows micro/thiết bị thật: NOT_RUN, RELEASE HOLD**.
- **PWA:** xoay shell cache `bien-ban-hop-20261121-g00-visible-waveform-controls`. Người dùng cần Pull origin để nhận mã mới; chạy `app/START_WINDOWS.cmd`, truy cập `http://127.0.0.1:5173/`.

## G00 — Hoàn thiện nhóm phát lại nâng cao để người dùng kiểm tra (21/11/2026)

- **Code SHA = Tested SHA:** `8cf09646b4800037caadd9cd5e391da94f90af32`, nhánh `integration/20261115-g10-v1.2`. [GitHub Actions #44890639015](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44890639015) **COMPLETED/SUCCESS**: G10 unit **89/89 PASS** trên **mỗi** hệ Windows và Linux, Vite build/PoC PASS; Chromium dev **34 PASS + 1 intentional PWA SKIP**; Chromium production/PWA **35/35 PASS**, **0 FAIL**. E2E thực sự bật giữ cao độ 0,5×, RNNoise WASM và bỏ im lặng ở cả hai môi trường; không suy luận chất lượng âm người từ test micro giả.
- **A–B và WAV đa đoạn (#07/#15):** chấp nhận các WAV có sampleRanges **kề nhau không thiếu mẫu** trong cùng recordingId, phát/lặp/xuất clip trong cửa sổ giới hạn; gặp gap, PCM không đọc được hoặc khác phiên vẫn **fail-closed**. Hợp đồng không bao giờ thêm thời gian tường hoặc chuyển sang audio gần nhất.
- **Giữ cao độ (#09):** opt-in `HTMLAudioElement.preservesPitch` trên một cửa sổ nghe tập trung 15/30/60 giây từ WAV gốc xác minh, ≤32 MiB; thiếu hỗ trợ trình duyệt / chọn Liên tục thì báo lỗi rõ. C2 mặc định không đổi, vẫn có thể thay pitch khi tốc độ ≠1.
- **Lọc RNNoise (#17):** opt-in, pin `@sapphi-red/web-noise-suppressor@0.4.1` trong `package.json` + `package-lock.json`, WASM + AudioWorklet 48kHz, chỉ nối vào đường phát; nạp động để không ảnh hưởng Node test, ghi/OPFS/WAV gốc. Cache cùng-origin cho tài nguyên wasm sau lần nạp khi chạy PWA, không dùng CDN.
- **Bỏ qua im lặng (#18):** opt-in, đọc PCM durable theo luồng của cửa sổ nghe tập trung ≤60s, kiểm RMS năng lượng theo cửa sổ ~25ms, chỉ bỏ đoạn yên tĩnh dài, giữ mép; vẫn giữ timestamp nguồn gốc theo mẫu. Đây là **ngưỡng RMS, không phải speech-VAD**; không dùng đồng thời với pitch-preserve ở tốc độ khác 1×.
- **Các file và hồi quy:** `app/src/pitch-playback.mjs`, `silence-skip.mjs`, `rnnoise-playback.mjs`, `playback-start.mjs`, `replay-tools.mjs`, `audio-clip.mjs`, `audio.mjs`, `main.mjs`, `timeline-ui.mjs`, giao diện, test Node/E2E và PWA cache; đều không thay model `timeSpan`, không đổi kho dữ liệu hoặc định dạng archive v1/v2.
- **Sau Tested SHA:** hướng dẫn/checkpoint được cập nhật và `app/START_WINDOWS.cmd` có bước `npm ci` theo lockfile nếu thiếu package RNNoise (chưa được chạy trên Windows người dùng). Tham khảo `app/README.md` để tự kiểm tra.
- **NOT_RUN / RELEASE HOLD:** Windows micro và UniKey/EVKey thực, chất lượng nghe giọng nhiều người/RNNoise CPU/RAM, ghi 3 giờ, crash/quota/mất điện, Word desktop, các thử nghiệm gói lớn/đổi máy và toàn bộ TC01–TC38 vẫn **NOT_RUN**; PR #1 DRAFT, không merge/deploy. Mã có CI PASS **chưa** đồng nghĩa nghiệm thu ứng dụng.

## G00 — Waveform PCM xấp xỉ, giới hạn dữ liệu (20/11/2026)

- **Mã đã push lên nhánh tích hợp và CI đúng SHA đã SUCCESS.** Bổ sung bộ lập kế hoạch mẫu `app/src/waveform-envelope.mjs`, đọc PCM theo yêu cầu bằng OPFS reader với giới hạn tối đa 128 bins × 1024 frames, tính RMS, hiển thị waveform trên thanh tua, giữ dải recorded/gap làm thẩm quyền dữ liệu; nút **Hiện/Ẩn dạng sóng**.
- Có xử lý hủy khi đổi cuộc họp, đóng worker trong `finally`, và tránh khởi động khi đang ghi hoặc phát. Không sửa nguồn WAV, manifest, `timeSpan` hay ghi chú; không đánh đồng sampled envelope với full waveform.
- **Test bổ sung:** unit `app/tests/waveform-envelope.test.mjs` kiểm giới hạn, gap, độ dài PCM, dữ liệu NaN, hủy đọc; E2E `app/e2e/waveform.spec.mjs` kiểm thu giả lập, dừng, vẽ dạng sóng, không sửa liên kết ghi chú, ẩn lại.
- **Code SHA = Tested SHA:** `c9f4860ab93a19022b5434f9ee156d1c0cd2cd3a`. [GitHub Actions #44578894987](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44578894987) **SUCCESS**. G10 native Node Windows/Linux **80/80 PASS trên mỗi hệ**, Vite build và các PoC PASS; Chromium dev **31 PASS + 1 intentional PWA SKIP**, Chromium production/PWA **32/32 PASS**, **0 FAIL**. Test waveform E2E **PASS** trong cả hai chế độ. Các commit sau đó chỉ sửa hướng dẫn/checkpoint; không thay đổi logic mã đã kiểm thử. **Windows micro/UniKey/EVKey, ghi nhiều giờ, đa máy thật: NOT_RUN.** Giữ **INTEGRATION_ALPHA / RELEASE HOLD**; #09 giữ cao độ, #17 RNNoise, #18 VAD vẫn chưa tích hợp.
- **Lưu ý tài liệu:** Không có TRACKER.md ở gốc; sử dụng `docs/STATUS.md` và `docs/G00_FEATURE_BACKLOG.md` làm hai nguồn điều phối thực tế, theo `AGENTS.md`.

## G00 — Tự kiểm chứng SHA-256/CRC sau khi xuất gói sao lưu (18/11/2026)

- **Code SHA = Tested SHA:** `fad90119530817404d2e57e7bb73b197dde65021` trên `integration/20261115-g10-v1.2`. **CI SUCCESS** [GitHub Actions #44317666582](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44317666582): Windows/Linux G10 native unit **76/76 PASS mỗi hệ**, build/PoC PASS; Chromium dev **30 PASS, 1 PWA-only SKIP**, Chromium production/PWA **31/31 PASS**, **0 FAIL**.
- **Mục #14:** Sau khi ghi và đóng gói `.bbhop` trên File System Access API, tùy chọn mặc định bật kiểm chứng tự động: `handle.getFile()` mở lại đúng tệp vừa lưu; `verifyPortableArchiveV2` đọc từng entry và đối chiếu kích thước, SHA-256, ZIP CRC, các WAV. Chỉ báo **đã sao lưu VÀ kiểm chứng** nếu đọc lại khớp. Nếu `getFile` thiếu, người dùng hủy, hoặc kiểm chứng lỗi, báo rõ **ĐÃ GHI NHƯNG CHƯA XÁC NHẬN AN TOÀN**; dữ liệu gốc không bị thay đổi.
- **Bằng chứng E2E:** Chromium fixture `showSaveFilePicker` có `createWritable` và `getFile`, xác nhận đọc lại/verify ZIP thành công; hai bài thử chuyển 1/2 phiên WAV sang browser profile khác và từ chối WAV bị sửa checksum tiếp tục PASS. Test portable v2 dùng ID fixture xác định dài hợp lệ; không nới điều kiện kiểm tra recordingId.
- **Checkpoint hệ thống:** README, `docs/G00_FEATURE_BACKLOG.md`, phiên bản SW `bien-ban-hop-20261118-postsave-verify`. `docs/PLAN_V1_2.md` cập nhật hiện trạng. **Hạn chế:** tự verify chỉ v2 và browser hỗ trợ `FileSystemFileHandle.getFile`; file >2 GB/hardware thực, hủy đang đọc hoặc mất điện chưa thử với thiết bị thật.
- **NOT_RUN / RELEASE HOLD:** #09 giữ pitch khi nghe chậm, #16 waveform PCM hoàn chỉnh, #17 RNNoise/WASM, #18 skip silence/VAD chưa tích hợp; kiểm thử Windows micro/UniKey/EVKey, MS Word thực, 3 giờ, quota/crash/khôi phục đa máy thật và đầy đủ TC01–TC38 vẫn **NOT_RUN**. Giữ Draft PR; không merge/publish.

## G00 — Hoàn thiện P0/P1 còn thiếu và sửa hồi quy (18/11/2026)

- **Code SHA = Tested SHA:** `8478a1c45f37bca537cdcdf367578fa44809a20c`, nhánh `integration/20261115-g10-v1.2`. **CI SUCCESS**: [GitHub Actions #44314800214](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44314800214); Windows/Linux G10 unit **76/76 PASS trên mỗi hệ**, Vite build/các PoC PASS; Chromium dev **29 PASS + 1 PWA-only SKIP**, Chromium production/PWA **30/30 PASS**, **0 FAIL**.
- **Tìm toàn bộ cuộc họp (#12):** Nhấp vào kết quả sidebar sẽ chọn và cuộn tới nội dung tìm thấy đầu tiên trong ProseMirror; hỗ trợ tiếng Việt không dấu, vùng chữ chia nhiều Mark định dạng; không sửa `timeSpan` hay bật nghe tự động. Nếu chỉ khớp tên cuộc họp, mở cuộc họp và giải thích không có đoạn chữ tương ứng. Đã sửa race khi danh sách search tự làm mới ghi đè thông báo vừa nhảy tới đoạn.
- **Lề Word / In PDF (#05):** thêm 3 preset A4 chung: lề Biên bản (trái 3cm, còn lại 2cm), Cân đối (trái/phải 2,5cm), Lề đều 2cm. Cùng cấu hình twip DOCX và `@page` CSS in; thử trực tiếp XML `word/document.xml`, không sửa bản ghi chú hoặc file sao lưu gốc.
- **Danh sách có cấu trúc trong DOCX (#02):** không còn làm phẳng thành chữ `1.`/`•`; xuất OOXML numbering riêng cho danh sách số/chấm và lồng nhau, giữ khả năng chỉnh danh sách trong Word. Unit mở `word/numbering.xml`, kiểm `w:numPr`, bullet/decimal và bắt đầu từ mục 3. Chưa đối chiếu danh sách dài trong Microsoft Word desktop.
- **Sửa lỗi hồi quy:** thao tác chèn ngắt trang/ảnh sau vùng chọn không được ghi đè chữ gắn liên kết hoặc node ngắt trang; kết quả tìm kiếm phải focus vùng chữ; chỉnh bài E2E kiểm toàn bộ chữ liên kết thay vì bắt Tiptap chỉ tạo đúng 1 thẻ `a`; kiểm CSS `@page` bằng `textContent` (không dùng `innerText` của thẻ `style`).
- **Giới hạn rõ ràng:** mục #09 giữ cao độ 0,5–2×, #16 waveform đầy đủ, #17 RNNoise WASM, #18 tự bỏ qua im lặng **CHƯA TÍCH HỢP**; có yêu cầu PoC độc lập CPU/latency, mốc sample/recordingId, OPFS và kiểm thử âm người thật trước khi can thiệp player. Các trường hợp audio dài, PWA upgrade đang ghi, dữ liệu >2GB/mất nguồn, Microsoft Word desktop, UniKey/EVKey và đầy đủ TC01–TC38 vẫn **NOT_RUN**.
- **RELEASE HOLD:** PR tiếp tục DRAFT; không merge `main`, không publish và không tuyên bố DONE toàn bộ 18 tính năng. Danh mục chi tiết tại [G00_FEATURE_BACKLOG.md](G00_FEATURE_BACKLOG.md).

## G00 — Đối chiếu giãn dòng theo OpenXML Word (18/11/2026)

- **Code SHA = Tested SHA:** `5e19937a69f44ecc4dc029d93fc5b7a9ddf968d2`, nhánh `integration/20261115-g10-v1.2`. [GitHub Actions #44298830946](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44298830946) **SUCCESS** Windows/Linux G10 unit **55/55 PASS** mỗi hệ; Vite build và các PoC PASS; Chromium dev **21 PASS + 1 intentional PWA SKIP**, production/PWA **22/22 PASS**, không FAIL.
- **Kết quả kỹ thuật:** DOCX sinh bởi `docx` dùng `w:spacing w:lineRule="auto"`, `w:line` đúng tỷ lệ **240 (1,0), 276 (1,15), 360 (1,5), 480 (2,0)** theo OpenXML Microsoft (240 đơn vị/dòng). Test thực sự giải ZIP và đọc `word/document.xml`, kiểm `w:before="0"`/`w:after="0"`, legacy inline 1,5 và fallback 1,15; không chỉ kiểm công thức.
- **Web preview:** test Chromium 4 mức `CSS line-height` = 1/1.15/1.5/2 lần `font-size`, paragraph margins 0 và giữ giá trị sau lưu/tải lại. **Cảnh báo**: hệ số đúng nhưng pixel/glyph metrics trên Chrome khác Word, không tuyên bố pixel-perfect. Chọn không có khoảng trắng trước/sau đoạn theo yêu cầu ghi chú, **không giống cấu hình Normal có after-spacing của một số bản Word**.
- **Không cần sửa production:** mã tính `Math.round(240 * height)` và `lineRule:'auto'` đang chính xác; chỉ bổ sung unit/E2E kiểm chứng và giải thích trong `app/README.md`. Không đụng `timeSpan`, audio, backup.
- **NOT_RUN / RELEASE HOLD:** mở đối chiếu DOCX bằng Microsoft Word desktop trên Windows thật, các trường hợp font hỗn hợp/Unicode phức tạp, IME Việt, ghi âm dài/quota/crash và full TC01–TC38. PR tiếp tục Draft; không merge/publish.

## G00 — Sửa khoảng cách đoạn văn khi giãn dòng 1,0 (18/11/2026)

- **Code SHA = Tested SHA:** `c7dedabc328320513a8925984c2aef28a0935ca9`; **CI PASS** [GitHub Actions #44296715379](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44296715379) — Windows và Linux G10 **53/53 unit PASS** mỗi hệ, Vite build/các PoC PASS; Chromium dev **20 PASS + 1 PWA-only SKIP**, Chromium production/PWA **21/21 PASS**, **0 FAIL**.
- **Nguyên nhân:** `.tiptap p{margin:0 0 .75em}` làm mỗi phím Enter tạo thêm `0.75em` khoảng cách sau đoạn, dù kiểu đoạn đã đặt `line-height:1`. Giãn dòng và khoảng cách đoạn là hai thuộc tính khác nhau; trước đây bộ xuất DOCX còn thêm `after:120` twips (6pt).
- **Thay đổi đã kiểm thử:** `.tiptap p{margin:0}` để dòng đơn liên tiếp sát nhau, xuất DOCX `spacing.before=0` và `after=0` cho paragraph, mặc định dropdown giãn dòng `1,15` khớp editor; chọn 1,0 không còn khoảng cách đoạn ẩn, 1,5 tăng tương ứng. SW cache version mới `bien-ban-hop-20261118-paragraph-spacing`.
- **Browser E2E hồi quy:** gõ 3 đoạn bằng Enter, chọn tất cả, đặt 1,0 và 1,5, đo khoảng cách hai đoạn và `getComputedStyle(marginBottom)` = 0, lưu/tải lại, kiểm tra chế độ in A4. Các `timeSpan` và dữ liệu ghi âm không thay đổi.
- **NOT_RUN / RELEASE HOLD:** test UniKey/EVKey và Microsoft Word trên Windows thật, ghi âm nhiều giờ, quota/crash/đổi phiên PWA khi đang ghi và toàn bộ TC01–TC38. PR tiếp tục DRAFT, không merge `main`/publish.

## G00 — Sửa thanh công cụ và định dạng Word (18/11/2026)

- **Code SHA = Tested SHA:** `45d3595186fa2985d7e3a6c32eeccf42a49184ce` trên `integration/20261115-g10-v1.2`. [GitHub Actions #44293515004](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44293515004) **SUCCESS**: Windows/Linux unit G10 **53/53 PASS mỗi hệ**, build + các PoC PASS; Chromium dev **19 PASS, 1 PWA-only SKIP**, Chromium production/PWA **20/20 PASS**, 0 FAIL.
- **Đã sửa theo phản hồi ảnh:** bỏ dòng "Gõ tự nhiên như một tài liệu…" và chip quyền chỉnh sửa/lưu khỏi toolbar; các trạng thái vẫn cập nhật trong vùng trợ năng ẩn, lỗi lưu hiện toast; **căn giữa toolbar, hàng Tìm/Thay và nút bảng**.
- **Nguyên nhân và bản sửa 14pt:** UI cũ gọi `setFontSize('14px')`, tương đương khoảng **10,5 pt**, nên rất nhỏ. Nay UI dùng `14pt` (CSS ~18,67 px ở 96dpi), mặc định editor/print 14pt, và bộ xuất DOCX chuyển đúng sang **28 half-points**. Ghi chú đời cũ dùng `px` vẫn xuất được cỡ tương đương, không thay dữ liệu hàng loạt.
- **Nguyên nhân và bản sửa giãn dòng:** `TextStyleKit` mặc định dùng `span` trong chữ (`textStyle.lineHeight`), không định dạng đúng cả đoạn. Nay tắt inline `lineHeight` và dùng extension `LineHeight` trên `paragraph/heading`; lệnh chỉ cập nhật block có trong lựa chọn, không thay `timeSpan`. Mốc thời gian gốc giữ nguyên; xuất DOCX ưu tiên `node.attrs.lineHeight` và hỗ trợ giá trị inline cũ để tương thích. Giãn dòng trong một đoạn khác với khoảng cách giữa các đoạn.
- **Hồi quy mới:** unit font pt/px, block spacing cả paragraph/heading, và boundary giữ `timeSpan`; Chromium kiểm center, ẩn chip, cỡ chữ thực bằng `getComputedStyle`, thay 1,0 → 1,5, tự lưu, tải lại. **Service Worker** đổi version `bien-ban-hop-20261118-font-spacing`.
- **NOT_RUN / RELEASE HOLD:** Thử bộ gõ Việt UniKey/EVKey trên Windows thật, micro thật, tài liệu dài ghi 3 giờ, quota/crash, PWA upgrade đang ghi âm, đối chiếu DOCX trên Microsoft Word thật và đầy đủ TC01–TC38. Giữ Draft PR; không merge `main`/publish.

## G00 — Chuẩn hóa tên nội bộ thành Biên bản họp (18/11/2026)

- **Code SHA = Tested SHA:** `955dc40a775f174b985e3fa823d6a785a32c3543`, trên `integration/20261115-g10-v1.2`. [GitHub Actions #44284975192](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44284975192) **SUCCESS**, Windows/Linux **49/49 unit G10 PASS**, Chromium dev **17 PASS + 1 PWA-only SKIP**, production/PWA **18/18 PASS**, 0 FAIL. Bài thử nhánh máy thật vẫn **NOT_RUN**.
- **Đã sửa mã:** `app/package.json` tên npm `bien-ban-hop`, 8 package metadata PoC `bien-ban-hop-poc-...`; API gói v2 `exportMeetingArchiveV2`, `importMeetingArchiveV2`, `probeMeetingArchiveVersion`, v1 `importLegacyMeetingArchive`; URL/header WAV localhost mới `/__bien_ban_hop_local_recording/` / `X-BienBanHop-Local`; PWA shell cache mới.
- **Tương thích đã PASS ở CI:** HTTP header/URL cũ và mới truy cập cùng file WAV, checksum SHA-256 bất biến; xuất/nhập gói v2 hợp đồng cũ; import v1/v2 giữ nguyên; không đổi dữ liệu/OPFS/IndexedDB. Khóa bảo trì PWA vẫn dùng tên cũ để nhiều phiên bản giữ cùng khóa.
- **Còn chuỗi cũ do thiết kế:** `format: "mochop"` trong ZIP v1/v2, `mochop-g10-v1` (DB có dữ liệu), `mochop-opfs-poc-v1`, `mochop:poc09:maintenance` (Web Lock), định dạng import `.mochop`, các file/oracle PoC lịch sử. **Không Replace All** tránh mất dữ liệu; bảng giải thích: [NAMING_COMPATIBILITY.md](NAMING_COMPATIBILITY.md).
- **Lockfile đã đồng bộ trên GitHub:** GitHub Actions một lần [#44289487889](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44289487889) đã tạo/commit `app/package-lock.json`, cả hai tên gốc đều là `bien-ban-hop`. Đã xóa workflow tạm và chuyển CI cố định sang `npm ci` để không trôi dependency. **Người dùng không cần chạy npm hoặc Push origin để đổi tên**; chỉ Pull nhánh G00. Trường hợp `package-lock.json` cũ đang untracked cản Pull thì chỉ xử lý đúng file sinh cục bộ đó, không động đến dữ liệu âm thanh.
- **RELEASE HOLD:** Không merge `main`, không publish, chưa nghiệm thu IME/micro Windows thật, ghi 3 giờ, crash/quota, PWA upgrade khi đang ghi và khôi phục liên máy thực tế.

## G00 — Nâng cấp soạn thảo Word, tìm kiếm offline và nghe lại (18/11/2026)

- **Code SHA = Tested SHA:** `ae176ebc8fdda2b43ed4534b56699884a240b654` trên nhánh `integration/20261115-g10-v1.2`. **CI PASS:** [GitHub Actions #44280821059](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44280821059): Windows + Linux `npm test` G10 **45/45 PASS**, các bài PoC và Vite build **PASS**, Chromium dev **17 PASS + 1 PWA-only SKIP**, production/PWA **18/18 PASS**, **0 FAIL**. Test phát hành tại chính Code SHA, không dùng CI của commit cũ.
- **Word/editor đã có mã và CI:** Tiptap 3.33.1 extension định dạng font/cỡ/màu/gạch chân/gạch ngang/căn lề/Heading/giãn dòng, bảng/thêm xóa hàng cột/gộp ô; `Ctrl+F`/`Ctrl+H`; guard không cho thay thế tự động đè vào text có `timeSpan` hợp lệ. Bổ sung `fast-check` sinh test boundary (không thay thế thử UniKey/EVKey thật).
- **DOCX, tìm kiếm:** thư viện `docx` xuất DOCX A4 với paragraph/run format và bảng cơ bản; `MiniSearch` tìm toàn văn qua các cuộc họp offline, hỗ trợ không dấu và không ghi đổi dữ liệu gốc. `Mammoth + DOMPurify` chèn DOCX (dạng nội dung mới *không gắn mốc âm thanh giả*, hạn chế tệp 15 MB, lọc HTML và ảnh); Chrome/Edge native print ra A4/PDF.
- **Nghe lại:** chế độ nghe tập trung 15/30/60 giây hoặc liên tục; bật/tắt EQ làm rõ giọng **chỉ trên đường phát** bằng Web Audio (Gốc/Nhẹ/Rõ hơn); WAV gốc, `timeSpan`, OPFS và manifest không đổi. Đây là EQ đơn giản, **không** phải khử ồn AI hay pitch-preserving time-stretch.
- **PWA:** thay `app/public/sw.js` VERSION thành `g00-rich-editor-20261118` để trình duyệt nhận shell/bundle mới theo quy trình cập nhật an toàn.
- **Đã cân nhắc nhưng KHÔNG tích hợp trực tiếp:** SoundTouchJS (pitch-preserving), RNNoise WASM (lọc nhiễu sâu), zip.js (thay bộ ZIP64), Paged.js (thay in A4 bản địa). Cần PoC riêng chứng minh độ chính xác mốc, nghe nối các segment/CPU, tương thích sao lưu v1/v2 và RAM gói lớn. Không tuyên bố PASS các phần đó.
- **NOT_RUN / RELEASE HOLD:** UniKey/EVKey Telex/VNI trên Windows thật, micro thiết bị thật, ghi 3 giờ, A–B đa phiên, file âm thanh nhập sẵn, độ chính xác ghép giọng/giữ cao độ, gói 0,5–2 GB và >4 GB, quota/crash/mất nguồn, chuyển gói qua 2 máy Windows vật lý và full TC01–TC38. Chưa merge `main` và chưa deploy, PR vẫn DRAFT.

## G00 — Hoàn thiện tên gói sao lưu "Biên bản họp" (17/11/2026)

- **Code SHA = Tested SHA:** `65e23d689c54be7686e3c9062609ca7801d36e5f` trên `integration/20261115-g10-v1.2`.
- **PASS:** [GitHub Actions #44074180067](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44074180067) — Linux/Windows G10 **38/38 unit PASS**, build và các PoC PASS; Chromium dev **11 PASS, 1 PWA-only SKIP**; Chromium production/PWA **12/12 PASS**, không có FAIL. E2E xác nhận giao diện không hiển thị `.mochop`, file mới `.bbhop`, khôi phục v2 bằng `.bbhop`, tái nhập cùng gói với tên đuôi cũ `.mochop`; luồng nhập v1 cũ vẫn chạy qua bài thử.
- **Thay đổi giao diện:** `Sao lưu biên bản và ghi âm` / `Khôi phục biên bản từ tệp`; mô tả, trạng thái, lỗi không nhắc đuôi kỹ thuật cũ. Mặc định xuất `bien-ban-hop-<meetingId>.bbhop`.
- **Tương thích:** chỉ đổi tên tệp và nhãn; ZIP64 v2, định danh `format:mochop`, checksum, metadata, kho IndexedDB/OPFS và endpoint vẫn nguyên. Bộ nhập tiếp nhận cả `.bbhop` mới, `.mochop` cũ (v1/v2) và các ZIP hợp lệ theo manifest. Không đổi/ghi đè các tệp hiện có.
- **NOT_RUN / RELEASE HOLD:** Windows micro/UniKey/EVKey vật lý, ghi 3 giờ, 2 máy thật, quota/crash/mất điện, gói nhiều GiB và toàn bộ TC01–TC38; PR vẫn DRAFT, chưa merge `main`/deploy.

## G00 — Tinh gọn giao diện và tên sản phẩm (17/11/2026)

- **Code SHA = Tested SHA:** `3f92eb11f7b82300533b26de3be69b3591a2df51` (nhánh `integration/20261115-g10-v1.2`, [Draft PR #1](https://github.com/cavoixanh638/Bien-ban-hop/pull/1)).
- **Thay đổi:** chuyển tùy chọn nghe (Dừng/tốc độ/nghe lùi/trạng thái) vào dock thanh tua; bỏ thanh tiêu đề trùng và đặt đổi tên trên danh sách cuộc họp bên trái; giữ chip quyền sửa/lưu tại toolbar; sidebar xanh ngọc sáng; tên hiển thị **Biên bản họp** trong tab, PWA, logo, tài liệu và tên file `bien-ban-hop-*`. Giữ `.mochop`, format ID, IndexedDB/OPFS, REST nội bộ để tương thích sao lưu cũ.
- **PASS (CI đúng SHA):** [Actions #44056625577](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44056625577), Windows/Linux Node **38/38 PASS**, Vite build PASS, Chromium dev **11/11 PASS + 1 PWA-only SKIP**, Chromium production/PWA **12/12 PASS**, 0 FAIL. Hai E2E mới kiểm bố cục, đổi tên, tên file xuất và PWA manifest ở cả dev và production.
- **NOT_RUN / RELEASE HOLD:** Windows micro/UniKey/EVKey thật, ghi 3h, thiết bị thứ hai, ZIP nhiều GiB, quota/crash/mất điện và full TC01–TC38. Không merge `main`, không deploy; bản vẫn `INTEGRATION_ALPHA`.

## Cập nhật G00/G10 tích hợp — 17/11/2026 (không áp dụng cho `main`)

**Nhánh nguồn thực thi:** `integration/20261115-g10-v1.2`, [PR #1](https://github.com/cavoixanh638/Bien-ban-hop/pull/1) ở trạng thái **DRAFT**, không merge/deploy.

- Bản tích hợp **INTEGRATION_ALPHA** đã có mã trong `app/`, với các PoC nguồn ở `poc/`; bảng kế hoạch khởi tạo bên dưới mô tả **trạng thái trước khi triển khai**, không phản ánh mã trên nhánh này. Không nâng gói 1.1–1.6 lên PASS nghiệm thu khi chưa chạy đủ TC01–TC38 và thiết bị thật.
- Kiểm tra baseline `4ceeb9feb0ee8d16c53dfb2a478f7c23b283d3fd`: GitHub Actions [#43927628146](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/43927628146) **SUCCESS**; Node G10 34/34, Chromium dev 9/9 và production 10/10 PASS; Windows/Linux build PASS. Note follow, timeline tổng và import/export đa phiên đã tích hợp ở mức alpha.
- G00 sửa tranh chấp phát audio: commit `4183fff514fa39298d50b4e984e8f95b99b6b221`, **Code SHA = Tested SHA** cho bản sửa này. Actions [#43996623815](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/43996623815) **SUCCESS** Linux/Windows; Node G10 **37/37 PASS**, Chromium dev **9/9 PASS**, production/PWA **10/10 PASS**. Bổ sung 3 regression: dừng giữa async startup, tua liên tiếp khi lệnh cũ lỗi, chuyển cuộc họp trong khi mở reader.
- G00 gia cố kiểm tra WAV trong `app/Recording`: commit `ca66ccd3e654b972d8b1f02ea7ae445750aa1028` (**Code SHA**). So sánh dung lượng **và SHA-256** theo luồng khi tái sử dụng bản sao hoặc xảy ra race upload; không coi hai WAV cùng số byte là giống nhau. Thêm test sửa byte giữ nguyên kích thước. **Tested SHA: `ce41920c8f855fdfc04fff0b3c6c138aeadefcc8`** (chỉ khác Code SHA `ca66ccd3` ở cập nhật tài liệu STATUS). Actions [#44050264332](https://github.com/cavoixanh638/Bien-ban-hop/actions/runs/44050264332) **SUCCESS** Linux/Windows; G10 unit **38/38 PASS**, Chromium dev **9/9 PASS**, production/PWA **10/10 PASS**, 0 FAIL. Run #44050166325 bị **CANCELLED** khi push tài liệu, không dùng làm bằng chứng PASS.
- **NOT_RUN / RELEASE HOLD:** UniKey/EVKey thật (Telex/VNI), micro Windows vật lý, 3 giờ ghi liên tục, sleep/mất điện/quota/crash trên máy thật, stress ZIP 0,5–2 GiB/>4 GiB trên browser, chuyển .mochop giữa 2 máy Windows vật lý, full TC01–TC38. Linux/Windows CI không thay thế các phép thử này.

**Quy tắc đọc:** trạng thái lịch sử trong các mục tiếp theo giữ nguyên để bảo toàn nền kế hoạch và quyết định kỹ thuật; khi nhận việc G00 mới phải dùng **HEAD nhánh tích hợp, PR và Actions tại SHA tương ứng** trước khi lấy kết quả bên dưới làm hiện trạng.

## 1. Đường cơ sở đã kiểm tra

- Repo: `cavoixanh638/Bien-ban-hop`, nhánh chính `main`.
- Commit tài liệu V1.2 gốc: `d12e6fe23373c31132fa61c8e0f1dd51eacfd743`.
- Bộ tài liệu đã được tinh gọn **11 → 8 tệp Markdown** tại commit `2bb1c8c3189cfb3c1401eac5a753f255f9bbda9f`; bản cũ được giữ trong lịch sử Git.
- Ngày 15/11/2026 bổ sung **tệp nghiên cứu công nghệ thứ 9:** [TECHNICAL_OPTIONS.md](TECHNICAL_OPTIONS.md) — 17 nhóm, 4 phương án/nhóm, có nguồn tham khảo và bốn gói PoC. **Đây là khuyến nghị kỹ thuật, không phải triển khai hoặc benchmark PASS.**
- Mã nguồn ứng dụng chạy thực tế: **chưa có trong repo** tại thời điểm lập status.
- PoC và chứng cứ test Gói 1.1–1.6: **chưa có**.
- Bản phát hành/PWA đã nghiệm thu: **chưa có**.
- Lần cập nhật gần nhất của tiến độ thực tế: ngày khởi tạo tệp này. Commit ghi tệp hiện hành xem lịch sử Git.

## 2. Bảng công việc

Trạng thái hợp lệ: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `READY_FOR_REVIEW`, `PASS`, `FAIL`, `DEFERRED`. **Không** tự lấy công việc của luồng AI khác hoặc đánh dấu PASS vì tài liệu đã viết xong.

| Gói | Nội dung | Trạng thái | Phụ trách | Bằng chứng/commit thực thi | Việc tiếp theo |
|---|---|---|---|---|---|
| 1.1 | Editor timeSpan, Unikey/EVKey, chỉnh sửa | NOT_STARTED | Chưa giao | Chưa có | PoC MarkSpec/coalescing + trace/test Windows |
| 1.2 | Thu âm, Worker/OPFS, checkpoint | NOT_STARTED | Chưa giao | Chưa có | Đối chứng capture + batching/MessageChannel/backpressure |
| 1.3 | Timeline, mapping, gap/pause | NOT_STARTED | Chưa giao | Chưa có | Chờ đầu ra 1.1 và 1.2 |
| 1.4 | MultiSegment Player và UI | NOT_STARTED | Chưa giao | Chưa có | PoC C1 HTMLAudio preservesPitch vs C2 Web Audio |
| 1.5 | Quản lý, autosave, backup, PWA | NOT_STARTED | Chưa giao | Chưa có | So sánh ZIP/restore/backpressure, PWA origin riêng |
| 1.6 | Tích hợp, QA, phát hành | NOT_STARTED | Chưa giao | Chưa có | TC01–TC38 và báo cáo nghiệm thu |

**Gói ưu tiên chuẩn bị:** 1.1. **Chưa có AI/nhân sự nào được giao chính thức trong bảng trên.**

## 3. Quyết định và giả thuyết kỹ thuật

| ID | Quyết định / vấn đề | Trạng thái | Cơ sở/việc xác minh tiếp |
|---|---|---|---|
| D01 | Ghi chú trung tâm, tự gắn mốc, luôn sửa được | DESIGN_ACCEPTED | Nguyên tắc sản phẩm tại PLAN, kiểm thử UX ở 1.4 |
| D02 | React + TS + Vite; Tiptap `timeSpan` | PROPOSED_FOR_POC | PoC 1.1, test marks/IME/paste |
| D03 | Trạng thái âm thanh không nằm trong timeSpan Mark | DESIGN_ACCEPTED | Audio Manifest + derived state, tích hợp 1.3 |
| D04 | Ưu tiên AudioWorklet/PCM, đối chứng MediaRecorder | OPEN | Benchmark Gói 1.2; chưa có engine production |
| D05 | OPFS + IndexedDB, Worker/checkpoint | PROPOSED_FOR_POC | Crash/quota/restore test |
| D06 | Virtual Multi-Segment Player | DESIGN_ACCEPTED | Công nghệ phát chọn sau test audio và boundary |
| D07 | Thu âm thanh hệ thống/họp online | CONDITIONAL | Test OS/browser/ứng dụng thật; không chặn lõi micro |
| D08 | PWA offline, cache/migration an toàn | DESIGN_ACCEPTED | Test nâng cấp/khôi phục ở Gói 1.5 |
| D09 | DOCX/TXT/Markdown/CSV và backup .mochop | DESIGN_ACCEPTED | Test xuất/restore trên máy khác |
| D10 | Origin phát hành riêng cho dữ liệu cuộc họp | DESIGN_PREFERRED | Chưa thiết lập DNS/HTTPS; phải xác minh origin trước dữ liệu thật |
| D11 | Thu PCM trước, cân nhắc Opus lưu lâu dài | OPEN | Chọn format sau PoC và test độ chính xác, quota, restore |
| D12 | Player nghe chậm 0,75×/0,9× phải rõ và ít biến giọng | OPEN | PoC C1 HTMLAudioElement đôi với preservesPitch vs C2 Web Audio buffer nhỏ; đo biên, cao độ, RAM; không mặc định crossfade/hybrid |
| D13 | Lựa chọn thư viện .mochop: fflate / client-zip / zip.js | OPEN | PoC nhập/xuất 0,5–2 GB, streaming hoặc random-access, backpressure, ZIP64, checksum, peak RAM; chưa chốt fflate |
| D14 | Clock input monotonic + sample/segment mapping | PROPOSED_FOR_POC | PoC 1.2–1.3, tín hiệu đo, drift/pause/gap |
| D15 | MarkSpec: inclusive:false, excludes:timeSpan, spanning:true; coalescing attrs đồng nhất | DESIGN_PREFERRED | PoC 1.1 xác minh Unikey/EVKey, model vs DOM, typedAt đầu cụm, P95/JSON/TextNode |
| D16 | AudioWorklet dùng MessageChannel riêng + transferable, batch 2.048/4.096 | PROPOSED_FOR_POC | PoC 1.2 đo buffer pool, sequence/sample count, queue backpressure, crash; chưa dùng SAB |
| D17 | playback_paused pre-roll tham khảo 5 giây, cho phép tùy chỉnh | DESIGN_PREFERRED | Thử UX 0/3/5/10 giây Gói 1.4; không thay mốc gốc |
| D18 | SharedArrayBuffer/COOP-COEP không bắt buộc ở V1.2 | DESIGN_PREFERRED | Test transferable/Worker khi crossOriginIsolated=false; chỉ xét SAB và hosting header khi PoC chứng minh cần |
| D19 | Không crossfade vô điều kiện tại ranh giới audio | DESIGN_ACCEPTED | PoC C1/C2 kiểm chứng không mất/trùng tiếng khi phát qua segment |

**DESIGN_ACCEPTED / DESIGN_PREFERRED / PROPOSED_FOR_POC / OPEN** = trạng thái chấp nhận/ưu tiên/cần thử **ở mức thiết kế**, **không** phải đã code hoặc test PASS. Mỗi quyết định chọn production phải có commit và phép đo để chuyển trạng thái; không dựa vào suy luận AI. Mọi quyết định công nghệ quan trọng sau PoC phải có commit + phép đo/test và cập nhật đúng bảng này.

## 4. Vấn đề đang chặn và rủi ro

- Chưa có kết quả chạy bộ gõ Unikey/EVKey thật trên Windows.
- Chưa có benchmark/audio crash/segment/seek để chọn engine chính thức.
- Chưa có bản chạy, CI, dữ liệu mẫu hoặc báo cáo test trên repository.
- Đã nghiên cứu sáu nhận xét kỹ thuật mới (15/11/2026), điều chỉnh thiết kế và bổ sung subcase kiểm thử **nhưng chưa có PoC PASS**. Trạng thái của mọi gói vẫn NOT_STARTED; không nhầm nghiên cứu/commit tài liệu với code hoàn thành.
- Vấn đề về nguồn thu online, quota, đa tab và PWA chưa được chứng minh bằng test.

Các nội dung trên là việc cần thử khi triển khai, **không phải lỗi đã quan sát từ một ứng dụng hiện có**.

## 5. Mẫu cập nhật gọn sau mỗi nhiệm vụ

```text
Ngày / gói / người thực hiện:
Commit SHA / branch / PR:
Phạm vi thay đổi:
Test chạy (TCxx / môi trường / log): PASS / FAIL / NOT_RUN
Quyết định mới / giới hạn:
Trạng thái gói sau cập nhật:
Việc tiếp theo và người nhận:
```

Chỉ cập nhật các dòng liên quan; không viết lại toàn bộ kế hoạch, không xóa kết quả/hồ sơ của luồng khác. Nếu cần lưu báo cáo đo dài, có thể dẫn tới GitHub Actions, PR, issue, hoặc tệp bằng chứng chuyên biệt **khi có bằng chứng thật**.

## 6. Điều kiện PASS và phát hành

PASS một gói khi toàn bộ tiêu chí liên quan có kết quả và bằng chứng; `BLOCKED`/ `READY_FOR_REVIEW` khác PASS. Trước phát hành phải kiểm tra [TC01–TC38](ACCEPTANCE_TESTS.md), ghi âm 3 giờ, bộ gõ thật, phát xuyên file, crash/backup/restore, PWA update, không còn lỗi Critical/High.

Không hứa ghi âm tiếp tục khi tab đóng hoặc máy Windows Sleep. Không đưa dữ liệu họp nhạy cảm vào repository.
