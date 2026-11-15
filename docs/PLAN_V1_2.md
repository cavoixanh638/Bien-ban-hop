# KẾ HOẠCH PHÁT TRIỂN MỐC HỌP V1.2

**Hệ thống ghi chú văn bản đồng bộ tự động với âm thanh cuộc họp**

| Trường | Giá trị |
|---|---|
| Phiên bản | V1.2, hợp nhất và thay thế V1.0/V1.1 |
| Ngày | 15/11/2026 |
| Phạm vi | Giai đoạn 1: ghi chú, ghi âm, đồng bộ, nghe lại, lưu trữ |
| Trạng thái | Kế hoạch triển khai; chưa có ứng dụng được nghiệm thu |
| Môi trường | Windows, Chrome/Edge, WebApp/PWA |

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

## VI. Kiến trúc và dữ liệu

| Thành phần | Định hướng |
|---|---|
| Frontend | React + TypeScript + Vite |
| Editor | Tiptap/ProseMirror, Custom Mark **timeSpan** trong NoteDocument |
| Nội dung Mark | anchorId, recordingId, audioOffsetMs, typedAt, source, schemaVersion |
| Trạng thái audio | Suy ra từ Audio Manifest/Storage, **không lưu anchorStatus thay đổi liên tục trong Mark** |
| Bộ gõ | Transaction/diff + events/IME nếu có + chuỗi xóa/chèn nhanh |
| Ghi âm | Ưu tiên PoC AudioWorklet + PCM, so sánh PoC MediaRecorder trước khi chọn production |
| Lưu cấu trúc | IndexedDB |
| Lưu âm thanh | OPFS qua Dedicated Worker, định kỳ checkpoint/flush |
| Phát | Virtual Timeline + Multi-Segment Player |
| Đa tab | Web Locks + BroadcastChannel |
| Sao lưu | Streaming ZIP có manifest, schema version, checksum |
| PWA | Service Worker + cache có phiên bản + update/migration an toàn |

Editor không phụ thuộc trực tiếp vào engine thu. Timeline ánh xạ thời gian nhập ↔ audio source/segment. Player dựa manifest, không dùng currentTime của một file làm thời gian toàn cuộc họp. Marks chỉ lưu liên kết tương đối ổn định; trạng thái valid/pending/missing/gap/unlinked là dẫn xuất, không tạo transaction editor khi Worker flush.

## VII. Thời gian, chỉnh sửa và gõ tiếng Việt

Phân biệt Wall Time, Input Time, Meeting Timeline, Media Timeline. Ghi trực tiếp dựa đồng hồ đơn điệu và các checkpoint với audio thực; khi nhập file thì lấy media playback. Pre-roll chỉ thay đổi điểm **bắt đầu phát**, không thay đổi audioOffsetMs.

Bộ gõ Windows có thể phát chuỗi xóa/chèn để đổi dấu thay vì composition. Theo dõi từ đang gõ, con trỏ, transaction, nội dung trước/sau, sự kiện và thời gian để phân biệt đổi dấu với sửa chủ động. Không nhận diện chỉ bằng ngưỡng 30–50 ms, không chặn transaction nhập liệu chỉ vì nghi là thao tác Unikey. Phải kiểm thử với bàn phím và bộ gõ thật.

Sửa chính tả/đổi dấu từ cũ giữ mốc cũ; chèn ý mới thực sự trong lúc ghi có mốc mới; dán từ ngoài không giả các thời điểm chữ được nói; cắt/di chuyển trong cuộc họp giữ nguồn; dán từ cuộc họp khác không trỏ nhầm audio; Undo/Redo khôi phục cả chữ và liên kết. Trường hợp chưa chắc, ưu tiên giữ nguồn và đánh dấu cần xác minh.

## VIII. Ghi âm và phát nhiều đoạn

AudioWorklet/PCM là phương án thử nghiệm ưu tiên vì thuận lợi đếm mẫu và khôi phục, nhưng phải đo CPU/RAM/quota và tình trạng mất mẫu. PCM mono 16-bit xấp xỉ 115 MB/giờ ở 16 kHz, 173 MB/giờ ở 24 kHz, 346 MB/giờ ở 48 kHz. Nhận đúng sample rate thực tế, không mặc định micro thu trực tiếp 16/24 kHz.

MediaRecorder/WebM là phương án đối chứng: Blob timeslice không mặc nhiên là file độc lập, cần xem xét seek metadata/remux, khởi động lại recorder có thể sinh khoảng hở. Không làm hai engine production song song.

Ghi các đoạn logic khoảng 2–5 phút nhưng flush/checkpoint thường xuyên trong mỗi đoạn (mục tiêu thử nghiệm 1–2 giây). Đoạn đã hoàn tất phải phát độc lập; đoạn đang ghi phải có metadata/phương án khôi phục. WAV cập nhật header không bảo đảm 100% sau mất điện. Chỉ báo âm thanh “đã lưu” khi kết quả ghi thực sự được xác nhận.

Virtual Timeline ánh xạ nguồn, segment, vị trí cục bộ, khoảng pause và gap; Player đọc trước/lập lịch hoặc dùng công nghệ thích hợp với codec. Phải kiểm thử seek/lặp A–B/phát qua boundary và không tự khẳng định hai thẻ audio bảo đảm liền mạch.

Nguồn thu: micro mặc định. Thu audio hệ thống hoặc trộn micro chỉ khi getDisplayMedia và hệ điều hành thực sự trả audio track; phải kiểm tra quyền, thiết bị và thu trùng. Screen Wake Lock có thể bị thu hồi và không bảo đảm ngăn mọi trạng thái Sleep của Windows.

## IX. Lưu trữ, sao lưu, nâng cấp

IndexedDB quản lý NoteDocument/cuộc họp/manifest/nhật ký; OPFS lưu âm thanh. Không có transaction nguyên tử chung, nên cần journal/manifest, reconciliation, derived link status. Web Locks ngăn hai tab cùng ghi, BroadcastChannel thông báo; tab sau đọc-only hoặc có cảnh báo.

Gói sao lưu .mochop là ZIP theo luồng chứa manifest/version/checksum, tài liệu, mốc, metadata và audio; không gom toàn bộ file dài vào RAM. Khôi phục vào vùng tạm, kiểm tra trước khi thay dữ liệu đang dùng. OPFS/IndexedDB không thay thế bản sao ngoài trình duyệt.

PWA trên GitHub Pages cần base path/scope đúng; index HTML có chiến lược kiểm tra phiên bản với fallback offline, asset hash cache theo version. Không dùng skipWaiting/reload ép khi đang ghi. Migration phải có schema version, thử trên backup/dữ liệu cũ, không xóa dữ liệu trước khi kiểm chứng.

## X. Sáu gói thực hiện và cổng nghiệm thu

| Gói | Công việc | Điều kiện qua cổng |
|---|---|---|
| **1.1** | timeSpan + nhận diện nhập Việt + sửa/cắt/dán/Undo/Redo | PoC và test thực tế không mất chữ/sai mốc nghiêm trọng |
| **1.2** | PoC AudioWorklet/PCM vs MediaRecorder, Worker/OPFS/checkpoint, ghi 3 giờ, crash; khảo sát audio online có điều kiện | Chọn engine bằng số liệu; khôi phục phần đã lưu |
| **1.3** | Timeline: clock mapping, segments, pause/gap, nhập file, liên kết suy ra | Không phát nhầm nguồn; sai lệch đạt bài thử |
| **1.4** | Player đa đoạn, UI chỉnh sửa luôn bật, shortcut/▶, pre-roll, speed, A–B | Nghe lại từ chữ không cản trở sửa; phát xuyên file |
| **1.5** | Nhiều cuộc họp, tìm kiếm, tự lưu, backup/restore, xuất, khóa tab, PWA/migration | Khôi phục gói hợp lệ trên môi trường khác, giữ links/audio |
| **1.6** | Kiểm thử tích hợp và thực tế, sửa lỗi, phát hành | Không còn lỗi Critical/High; có biên bản nghiệm thu |

Chưa có gói nào được báo cáo PASS ở thời điểm soạn tài liệu. Cần commit/checkpoint và chứng cứ test sau mỗi gói; không xây toàn bộ app trước khi Gói 1.1 đạt.

## XI. Tiêu chí và mục tiêu đo

Bộ kiểm thử chi tiết: [ACCEPTANCE_TESTS.md](ACCEPTANCE_TESTS.md), TC01–TC38.

- Gõ 2 phút không Enter vẫn có nhiều mốc; Unikey/EVKey Telex/VNI thật không lỗi.
- Sửa/cắt/dán/định dạng/Undo/Redo bảo toàn nguồn hoặc đánh dấu unlinked.
- Ghi âm 3 giờ, phát/tua đầu-giữa-cuối, pause, mất micro, crash recovery.
- Phát qua ranh giới segment, A–B xuyên file, seek theo Virtual Timeline; không mất/lặp tiếng bất thường.
- Mục tiêu sai lệch mốc trong test chuẩn **≤1 giây** (không phải chính xác từng từ được nói).
- Mục tiêu P95 trễ nhập **<100 ms** trên máy thử đã ghi cấu hình.
- Mục tiêu tổn thất **dữ liệu chưa xác nhận lưu** trong sự cố giả lập: văn bản khoảng 2 giây, âm thanh khoảng 10 giây; không cam kết tuyệt đối.
- Backup/checksum/migration/đa tab/offline đạt test. Thu âm online chỉ nghiệm thu theo các môi trường được công bố.

## XII. Rủi ro và chất lượng

Critical: mất dữ liệu đã xác nhận lưu, phát nhầm nguồn, hỏng dữ liệu không thể khôi phục. High: lỗi gõ Việt, sai mốc, không ghi/phát chức năng cốt lõi. Không phát hành khi có Critical hoặc High.

Rủi ro chính: bộ gõ backspace burst, Mark sai sau transaction, PCM dung lượng lớn, WebM seek, lệch mốc nhiều segment, Storage/Editor bất đồng, tab tranh chấp, xóa dữ liệu trình duyệt, PWA cache cũ, migration phá dữ liệu, hạn chế thu audio online.

**Đích nghiệm thu V1.2:** người dùng chỉ tập trung nghe và gõ nội dung thấy quan trọng; mỗi phần chữ có mốc hoặc được nhận diện rõ là chưa liên kết, có thể nghe lại đúng nguồn mà không phải chuyển chế độ hay ghi thời gian thủ công.

## XIII. Tài liệu triển khai

- [REQUIREMENTS.md](REQUIREMENTS.md): hành vi người dùng và UX.
- [ARCHITECTURE.md](ARCHITECTURE.md): module và hợp đồng kỹ thuật.
- [DATA_MODEL.md](DATA_MODEL.md): Mark, Audio Manifest, lưu trữ, migration.
- [TIMELINE_RULES.md](TIMELINE_RULES.md): nhập/sửa/IME/paste/mapping.
- [AUDIO_ENGINE_DECISION.md](AUDIO_ENGINE_DECISION.md): thử nghiệm và tiêu chí chọn engine, **chưa có kết quả**.
- [PLAYBACK_DESIGN.md](PLAYBACK_DESIGN.md): phát đa đoạn.
- [ACCEPTANCE_TESTS.md](ACCEPTANCE_TESTS.md): TC01–TC38.
- [USER_GUIDE.md](USER_GUIDE.md): quy trình thao tác dự kiến.

*Tài liệu này là kế hoạch hiện hành; chưa có bằng chứng rằng chức năng đã được triển khai trên repo.*
