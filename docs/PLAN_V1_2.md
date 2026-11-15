# KẾ HOẠCH PHÁT TRIỂN MỐC HỌP V1.2

**Hệ thống ghi chú văn bản đồng bộ tự động với âm thanh cuộc họp**

| Trường | Giá trị |
|---|---|
| Phiên bản | V1.2, hợp nhất và thay thế V1.0/V1.1 |
| Ngày | 15/11/2026 |
| Phạm vi | Giai đoạn 1: ghi chú, ghi âm, đồng bộ, nghe lại, lưu trữ |
| Trạng thái | Kế hoạch triển khai; chưa có ứng dụng được nghiệm thu |
| Môi trường | Windows, Chrome/Edge, WebApp/PWA |

> **Cấu trúc tài liệu tinh gọn:** đây là nguồn chính thức cho *sản phẩm, yêu cầu chức năng, phạm vi và lộ trình*. Schema/module thuộc [ARCHITECTURE.md](ARCHITECTURE.md); quy tắc gõ và thời gian thuộc [TIMELINE_RULES.md](TIMELINE_RULES.md); thu/phát âm thanh thuộc [AUDIO_DESIGN.md](AUDIO_DESIGN.md). Trạng thái thực tế và quyết định đã chốt chỉ ghi tại [STATUS.md](STATUS.md). **Tất cả mới là kế hoạch, chưa có PoC hay nghiệm thu.**

## I. Mục tiêu

**Nội dung người dùng tự gõ là trung tâm.** Mốc Họp là trình soạn thảo giống Word có khả năng tự liên kết phần chữ với thời điểm trong bản ghi âm, không phải phần mềm ghi âm có thêm ô nhập. Người dùng tự chọn ý quan trọng để ghi; ứng dụng không cố ghi lại mọi lời nói.

Mỗi phần văn bản được gõ khi có nguồn âm thanh phù hợp tự ghi lại mốc thời gian, kể cả trong một đoạn dài không xuống dòng; không phải tạo thẻ, chọn nhãn, chọn người nói hay bấm Lưu. Mốc là lúc người dùng **gõ**, không phải thời điểm lời nói chính xác bắt đầu. Khi nghe lại áp dụng độ lùi có thể tùy chỉnh, không sửa mốc gốc.

## II. Nguyên tắc bất biến

1. Gõ, sửa, xóa, cắt/dán, định dạng, Undo/Redo như Word; ít phải dùng chuột, không bắt buộc tạo mốc.
2. Văn bản vẫn luôn sửa được. Nhấp thường đặt con trỏ; nghe từ vị trí chữ bằng phím tắt, Alt + nhấp hoặc nút ▶ nhỏ khi hover. **Không bắt chuyển chế độ Xem/Sửa**.
3. Trong một đoạn có nhiều mốc; không chỉ gắn mốc ở đầu đoạn hoặc lúc nhấn Enter.
4. Xử lý Unikey/EVKey/Telex/VNI thật trên Windows, không phụ thuộc riêng composition hoặc ngưỡng Backspace 30–50 ms.
5. Không phá vỡ liên kết đã có khi chỉnh sửa. Phần chữ không có âm thanh phải được nhận diện rõ, không tạo nguồn giả.
6. Văn bản và âm thanh tự lưu độc lập, chỉ báo thành công khi đã xác nhận, không hứa giữ dữ liệu chưa lưu.
7. Âm thanh dài lưu định kỳ có checkpoint/khôi phục; người dùng thấy một Virtual Timeline dù lưu nhiều đoạn.
8. Phải phân biệt tạm dừng chủ động với khoảng gián đoạn/mất dữ liệu; không dịch sai mốc.
9. Hoạt động cục bộ/offline sau lần tải/thiết lập; có sao lưu **ngoài** trình duyệt.
10. Không xây dựng backend hoặc tính năng AI trong V1.2.

## III. Phạm vi

**Bắt buộc:** ghi âm micro; nhập file ghi âm tương thích; soạn thảo cơ bản; timeSpan tự động; giữ mốc qua sửa/dán; nghe lại theo chữ/con trỏ, lùi mốc, tốc độ, A–B; virtual multi-segment playback; nhiều cuộc họp, tìm kiếm, tự lưu; backup/restore, xuất DOCX/TXT/Markdown/CSV; PWA offline và nâng cấp an toàn.

**Có điều kiện:** thu âm thanh hệ thống/họp trực tuyến và trộn micro khi trình duyệt/Windows hỗ trợ; đánh dấu/nút phân loại người nói, sóng âm, xuất clip. Không làm các tùy chọn này thành bắt buộc và không chặn lõi micro.

**Ngoài phạm vi:** AI chép lời, tách/nhận diện người nói, tóm tắt, soạn biên bản/thông báo kết luận, tài khoản, cộng tác, backend/cloud bắt buộc.

## IV. Quy trình

**Trước họp:** Tạo cuộc họp (tên mặc định ngày giờ), kiểm tra micro/quyền/dung lượng/tab đang ghi, bấm Bắt đầu. Con trỏ vào trang soạn thảo. Văn bản chuẩn bị từ trước không được gắn thời điểm ghi âm giả.

**Trong họp:** Người dùng chỉ gõ. Hệ thống ghi thời điểm nhập hợp lệ, liên kết phần chữ với nguồn audio, tự lưu hai loại dữ liệu, theo dõi lỗi thu/lưu. Ngừng gõ rồi viết tiếp có mốc mới.

**Sau họp:** Nghe lại bằng thao tác ngữ cảnh/phím tắt tại vị trí chữ; sửa nội dung ngay trên cùng trang. Tua, phát/tạm dừng, lùi 0/3/5/10/15/30 giây, tốc độ 0,5–2×, nghe lặp A–B; tìm kiếm, xuất và sao lưu.

**File có sẵn:** Khi đang phát, mốc lấy theo vị trí phát của file; khi pause để ghi chú thì lấy vị trí pause; khi tua rồi gõ lấy vị trí mới. Nếu file không hỗ trợ giải mã, thông báo rõ.

## V. Giao diện

Một trang gồm thanh trên cùng rất gọn (cuộc họp, ghi âm, thời lượng, trạng thái lưu), vùng soạn thảo lớn, thanh phát lại thu gọn. Không hiện các nút KL/GV/SL/DX/KT hoặc bộ lọc chiếm không gian mặc định. Nhấp thường đặt con trỏ; phát bằng Alt + nhấp, phím tắt hoặc pill ▶ nhỏ. Phím tắt phải thử tránh xung đột Windows/Chrome/Edge/Unikey/EVKey; không mặc định Alt + Space. Hover hiển thị mốc của vùng có audio; vùng không liên kết không giả nút phát. Không tô sáng karaoke vì chưa có căn chỉnh lời nói.

## VI. Danh mục yêu cầu chức năng chính

Bảng sau hợp nhất các yêu cầu trong phiên bản tài liệu cũ `REQUIREMENTS.md`. **Mọi mục Must thuộc Giai đoạn 1**; các chức năng Conditional chỉ triển khai sau khi lõi đã đạt và môi trường hỗ trợ.

| Mã | Nhóm | Yêu cầu bắt buộc |
|---|---|---|
| REQ-01 | Soạn thảo là trung tâm | Vùng viết lớn; văn bản, tiêu đề, đậm/nghiêng, danh sách, thụt dòng, copy/cut/paste, Undo/Redo và tìm kiếm; không phải bấm Save hay tạo thẻ |
| REQ-02 | Mốc tự động | Gắn theo từ/cụm trong cùng đoạn, không phụ thuộc Enter; phân biệt thời điểm gõ với thời điểm nói; chữ không có audio phải được ghi rõ là unlinked |
| REQ-03 | Nghe lại và sửa | Nhấp thường đặt con trỏ; nghe tại chữ qua Alt + Click/phím tắt/▶ ngữ cảnh, tua/tốc độ 0,5–2×/A–B/pre-roll; không chuyển Xem/Sửa |
| REQ-04 | Gõ Việt và chỉnh sửa | Unikey/EVKey Telex/VNI; đổi dấu không mất anchor từ; sửa/cắt/dán/di chuyển/Undo/Redo giữ liên kết còn hợp lệ |
| REQ-05 | Thu và nhập file | Chọn và kiểm tra micro, ghi/pause/resume/stop, ghi dài và lưu định kỳ; nhập MP3/WAV/WebM/M4A nếu decoder hỗ trợ; audio online là Conditional |
| REQ-06 | Timeline và player | Một dòng thời gian logic qua nhiều segment, tua/phát xuyên file; phân biệt pause, gap và file missing; không phát sai nguồn |
| REQ-07 | Quản lý/lưu | Nhiều cuộc họp, tìm toàn văn; xác nhận lưu text/audio độc lập, cảnh báo mic/quota; bảo vệ nhiều tab cùng ghi |
| REQ-08 | Sao lưu/xuất | Gói .mochop streaming gồm tài liệu/Mark/audio/manifest/checksum; khôi phục có kiểm tra; DOCX/TXT/Markdown/CSV, xuất sạch hoặc kèm mốc |
| REQ-09 | Offline và nâng cấp | PWA ngoại tuyến sau lần tải đầu; Service Worker không tự reload khi ghi; migration kiểm thử; Wake Lock chỉ là hỗ trợ |

### Ngoại lệ cần xử lý

| Tình huống | Hành vi mong đợi |
|---|---|
| Micro bị rút/hết quyền | Cảnh báo, đánh dấu khoảng mất âm thanh, vẫn cho gõ |
| Hết quota | Cảnh báo trước; khi ghi thất bại không báo đã lưu |
| Đóng tab giữa lúc ghi | Khôi phục phần audio/text đã xác nhận ghi; phần còn thiếu được báo rõ |
| Hai tab cùng mở | Chỉ một tab ghi; không overwrite |
| Dán đoạn từ ngoài | Không tạo fake per-word audio timestamps |
| Sửa mốc cũ | Giữ bản chất nguồn và chỉ đổi vị trí khi người dùng chủ động |
| Nhấp vào vùng không có âm thanh | Không play, giải thích liên kết thiếu |
| Cập nhật PWA khi đang thu | Hoãn kích hoạt/reload đến lúc an toàn |

### Ưu tiên và giới hạn

- **Must:** REQ-01–REQ-09, ngoại trừ các thành phần đã ghi Conditional; không có tính năng nào được “PASS” khi mới có mô tả hay nút UI.
- **Conditional/Should:** thu âm thanh hệ thống và trộn micro khi Chrome/Edge/Windows có audio track; nhãn/người nói thủ công, waveform, xuất đoạn âm.
- **Ngoài Giai đoạn 1:** AI chép lời, nhận diện người nói, tóm tắt, tự soạn biên bản/thông báo kết luận, backend/cloud/tài khoản bắt buộc.

## VII. Cách sử dụng dự kiến (chưa phải hướng dẫn bản chạy)

1. Tạo cuộc họp, cấp quyền micro và bấm **Bắt đầu ghi âm**; có thể chuẩn bị nội dung trước khi ghi nhưng phần đó không được tự gắn audio giả.
2. **Chỉ cần gõ như Word.** Ứng dụng tự ghi mốc và lưu. Trong cuộc họp không yêu cầu gán nhãn, người nói hay nút Lưu.
3. Kết thúc thu, vẫn sửa văn bản ngay trên cùng trang. Nghe tại con trỏ bằng phím tắt, Alt + nhấp hoặc ▶ nhỏ khi hover; nhấp thường đặt con trỏ.
4. Có thể nhập file âm thanh có sẵn; nếu đang phát hoặc pause, mốc mới lấy từ vị trí audio đang chọn. Tua đến chỗ khác rồi gõ sẽ lấy vị trí mới.
5. Tìm kiếm, xuất DOCX khi cần soạn biên bản; định kỳ xuất **.mochop** ra ngoài trình duyệt để giữ cả audio và mốc. DOCX không thay thế bản sao lưu tương tác.

**Trường hợp bất thường:** Mất micro, bộ nhớ đầy, trình duyệt/tài liệu bị đóng hoặc máy Sleep phải được thông báo trung thực; chỉ phần đã lưu thành công mới có thể khôi phục. Screen Wake Lock không cam kết ngăn Windows Sleep.

## VIII. Sáu gói thực hiện và cổng nghiệm thu

| Gói | Công việc | Điều kiện qua cổng |
|---|---|---|
| **1.1** | timeSpan + nhận diện nhập Việt + sửa/cắt/dán/Undo/Redo | PoC và test thực tế không mất chữ/sai mốc nghiêm trọng |
| **1.2** | PoC AudioWorklet/PCM vs MediaRecorder, Worker/OPFS/checkpoint, ghi 3 giờ, crash; khảo sát audio online có điều kiện | Chọn engine bằng số liệu; khôi phục phần đã lưu |
| **1.3** | Timeline: clock mapping, segments, pause/gap, nhập file, liên kết suy ra | Không phát nhầm nguồn; sai lệch đạt bài thử |
| **1.4** | Player đa đoạn, UI chỉnh sửa luôn bật, shortcut/▶, pre-roll, speed, A–B | Nghe lại từ chữ không cản trở sửa; phát xuyên file |
| **1.5** | Nhiều cuộc họp, tìm kiếm, tự lưu, backup/restore, xuất, khóa tab, PWA/migration | Khôi phục gói hợp lệ trên môi trường khác, giữ links/audio |
| **1.6** | Kiểm thử tích hợp và thực tế, sửa lỗi, phát hành | Không còn lỗi Critical/High; có biên bản nghiệm thu |

Chưa có gói nào được báo cáo PASS ở thời điểm soạn tài liệu. Cần commit/checkpoint và chứng cứ test sau mỗi gói; không xây toàn bộ app trước khi Gói 1.1 đạt.

## IX. Tiêu chí và mục tiêu đo

Bộ kiểm thử chi tiết: [ACCEPTANCE_TESTS.md](ACCEPTANCE_TESTS.md), TC01–TC38.

- Gõ 2 phút không Enter vẫn có nhiều mốc; Unikey/EVKey Telex/VNI thật không lỗi.
- Sửa/cắt/dán/định dạng/Undo/Redo bảo toàn nguồn hoặc đánh dấu unlinked.
- Ghi âm 3 giờ, phát/tua đầu-giữa-cuối, pause, mất micro, crash recovery.
- Phát qua ranh giới segment, A–B xuyên file, seek theo Virtual Timeline; không mất/lặp tiếng bất thường.
- Mục tiêu sai lệch mốc trong test chuẩn **≤1 giây** (không phải chính xác từng từ được nói).
- Mục tiêu P95 trễ nhập **<100 ms** trên máy thử đã ghi cấu hình.
- Mục tiêu tổn thất **dữ liệu chưa xác nhận lưu** trong sự cố giả lập: văn bản khoảng 2 giây, âm thanh khoảng 10 giây; không cam kết tuyệt đối.
- Backup/checksum/migration/đa tab/offline đạt test. Thu âm online chỉ nghiệm thu theo các môi trường được công bố.

## X. Rủi ro và chất lượng

Critical: mất dữ liệu đã xác nhận lưu, phát nhầm nguồn, hỏng dữ liệu không thể khôi phục. High: lỗi gõ Việt, sai mốc, không ghi/phát chức năng cốt lõi. Không phát hành khi có Critical hoặc High.

Rủi ro chính: bộ gõ backspace burst, Mark sai sau transaction, PCM dung lượng lớn, WebM seek, lệch mốc nhiều segment, Storage/Editor bất đồng, tab tranh chấp, xóa dữ liệu trình duyệt, PWA cache cũ, migration phá dữ liệu, hạn chế thu audio online.

**Đích nghiệm thu V1.2:** người dùng chỉ tập trung nghe và gõ nội dung thấy quan trọng; mỗi phần chữ có mốc hoặc được nhận diện rõ là chưa liên kết, có thể nghe lại đúng nguồn mà không phải chuyển chế độ hay ghi thời gian thủ công.

## XI. Phân công nguồn tài liệu và chuẩn hoàn thành

| Nội dung | Nguồn chính thức |
|---|---|
| Mục tiêu, nguyên tắc bất biến, yêu cầu, phạm vi và gói triển khai | **PLAN_V1_2.md** |
| Module, hợp đồng, dữ liệu, OPFS/IndexedDB, backup schema, migration | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Các tình huống nhập/sửa, Unikey/EVKey và ánh xạ thời gian | [TIMELINE_RULES.md](TIMELINE_RULES.md) |
| Bộ ghi âm, lưu an toàn, checkpoint, player đa đoạn | [AUDIO_DESIGN.md](AUDIO_DESIGN.md) |
| Tiêu chuẩn TC01–TC38, bằng chứng và phép đo | [ACCEPTANCE_TESTS.md](ACCEPTANCE_TESTS.md) |
| Tiến độ thực tế, tác vụ, checkpoint và quyết định có bằng chứng | [STATUS.md](STATUS.md) |
| Hướng dẫn AI/Codex | [../AGENTS.md](../AGENTS.md) |

**Điều kiện hoàn thành:** Có bản chạy được, gõ tiếng Việt và mốc đúng sau mọi thao tác thường gặp; ghi được nhiều giờ và khôi phục được phần đã lưu; nghe lại xuyên file; sao lưu/khôi phục dữ liệu; không còn lỗi Critical/High; có commit cùng bằng chứng nghiệm thu. Không gọi PoC là sản phẩm hoàn thiện.

*Cập nhật cấu trúc tài liệu, **không thay đổi mục tiêu V1.2**. Mọi kết quả triển khai phải ghi tại STATUS.md thay vì sửa kế hoạch thành báo cáo tiến độ.*
