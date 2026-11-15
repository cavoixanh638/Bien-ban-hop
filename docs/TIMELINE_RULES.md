# QUY TẮC THỜI GIAN, GÕ TIẾNG VIỆT VÀ CHỈNH SỬA — V1.2

**Đặc tả hành vi chuẩn** cho InputTracking, timeSpan Mark và Timeline. Mọi trường hợp chưa thể nhận diện chắc chắn phải **giữ nguồn hoặc đánh dấu không liên kết**, không bịa thời điểm audio.

## 1. Định nghĩa mốc

Mốc gốc timeSpan = recordingId + audioOffsetMs, sinh khi người dùng gõ ở một ngữ cảnh có nguồn audio phù hợp. typedAt lưu thời điểm thao tác nhập. Mốc này **không khẳng định** lời người nói bắt đầu ở đó.

Phát lại dùng playStart=max(0, audioOffsetMs−preRollMs), không ghi playStart ngược vào Mark.

Các nguồn: live_recording (đang thu); imported_playback (đang nghe file); playback_paused (dừng file rồi gõ); historical_edit (sửa phần chữ cũ); paste; unlinked.

## 2. Quy trình tạo anchor trên thao tác nhập

1. Nhận tín hiệu thao tác nhập và thời gian đơn điệu gần thời điểm thực.
2. Xác định selection/cursor, text trước/sau và transaction thực.
3. Phân loại thao tác: nhập mới / biến đổi từ đang gõ / sửa nội dung cũ / paste / cut-move / format / history.
4. Hỏi Timeline lấy audio context tại thời điểm thao tác.
5. Áp dụng Mark giữ/sửa/để unlinked theo quy tắc bên dưới.
6. Lưu transaction/snapshot không chặn nhập liệu.

Không dùng duy nhất keydown: bộ gõ Việt có thể tiêm Backspace/chuỗi thay thế hoặc composition. Không dùng duy nhất DOM position hay bảng from/to độc lập làm nguồn liên kết.

## 3. Ghi trực tiếp

- Khi mic đang thu và audio coverage hợp lệ: văn bản mới lấy mốc theo đồng hồ nhập đã ánh xạ với audio timeline.
- Khi đang gõ từ/cụm liên tục: có thể giữ mốc mở đầu và gộp các thao tác trong ngưỡng đã thử, ví dụ 1–2 giây; không gộp nếu làm sai lệch thời gian.
- Không yêu cầu xuống dòng. Ngừng gõ lâu rồi tiếp tục tạo anchor mới.
- Khi pause chủ động hoặc micro mất: text vẫn lưu nhưng unlinked/pending/gap phù hợp; không tự gán vào khối audio trước/sau gap.

## 4. Ghi chú trên file nhập

- Nếu file đang phát: lấy current playback position của **file được chọn**, không lấy giờ hệ điều hành.
- Nếu người dùng pause rồi gõ: mọi ký tự thuộc lượt ghi chú đó neo vào vị trí pause, dù gõ lâu.
- Nếu seek sang chỗ khác: phần nhập mới lấy vị trí mới.
- Không tự chuyển mốc sau khi người dùng bấm Play trong lúc đang sửa chữ cũ; phân biệt thao tác sửa với ý mới.

## 5. Quy tắc sửa, di chuyển, dán

| Tình huống | Quy tắc |
|---|---|
| Chữ mới ở cuối hoặc đoạn trống | Mark theo audio position hiện tại nếu hợp lệ |
| Chữ mới tiếp nối cụm đang nhập | Có thể kế thừa/gộp Mark theo chính sách grouping |
| Thêm dấu vào từ đang nhập | Giữ anchor của đầu từ/cụm |
| Sửa chính tả từ đã viết | Giữ anchor gốc, cập nhật nội dung |
| Viết thêm **ý mới** vào giữa văn bản cũ khi đang ghi | Tạo anchor mới hoặc trạng thái nguồn rõ ràng; không đơn giản kế thừa mốc cũ |
| Xóa chữ | Xóa phần chữ và cập nhật Mark tương ứng, không đổi mốc vùng còn lại |
| Định dạng | Không đổi mốc |
| Split/join paragraph | Bảo toàn Mark từng vùng, không gộp khác nguồn |
| Copy/cut/move trong cuộc họp | Giữ nguồn audio của chữ di chuyển |
| Paste từ ngoài | Không giả chuỗi mốc theo từng từ; mặc định unlinked hoặc source=paste với mốc paste nếu người dùng chọn chính sách |
| Paste từ cuộc họp khác | Không làm link trỏ nhầm tới media của cuộc họp hiện tại; giữ external ref chỉ khi được hỗ trợ |
| Undo/Redo | Khôi phục Mark đúng với text, không tạo các mốc mới theo thời điểm Undo |
| Mất audio sau khi text đã gắn mốc | Giữ Mark, trạng thái nghe lại suy ra missing/gap từ Manifest |

Không thể suy ra “ý mới” và “sửa chính tả” bằng một điều kiện thời gian đơn lẻ. Định nghĩa heuristic dựa cursor/selection, diff và ngữ cảnh; khi không chắc chắn, phải ưu tiên giữ mốc đã có, không phá liên kết.

## 6. Cơ chế timeSpan Mark

Mark là dữ liệu trên cây ProseMirror; các text node có thể bị tách/gộp khi edit. timeSpan chứa anchorId, recordingId, audioOffsetMs, typedAt, source, schemaVersion; **không** chứa trạng thái audio thay đổi theo flush.

Thử inclusive=false để tránh text ở biên kế thừa nhầm mốc, nhưng phải có logic transaction để:
- thêm chữ ở đầu/cuối Mark;
- thêm chữ giữa hai Mark;
- thay thế một phần từ;
- đảo selection/cut/paste;
- giữ stored marks đúng;
- bảo toàn trong Undo/Redo.

Không khẳng định ProseMirror tự “đúng 100%” chỉ nhờ inclusive=false.

## 7. Bẫy Unikey/EVKey Windows

Unikey/EVKey có thể dùng luồng Backspace + chèn lại text, không luôn gửi compositionstart/compositionend. Vì vậy:
- Theo dõi beforeinput/input/composition (nếu có) và transaction thực tế.
- Quan sát vùng từ đang nhập, con trỏ, chuỗi text trước/sau và thời gian các sự kiện.
- Nhận diện “rapid delete + insert burst” như **một tín hiệu**, không coi ngưỡng 30–50 ms là luật tuyệt đối.
- Nếu biến đổi cùng từ đang nhập, Mark giữ mốc lúc bắt đầu từ, không sinh anchor tại thời điểm thêm dấu.
- Không dùng filterTransaction ngăn các giao dịch nhập liệu đáng ngờ; ưu tiên hậu xử lý chính xác và tránh làm vỡ bộ gõ.
- Thu trace bằng Unikey/EVKey thật: Telex/VNI, đổi dấu muộn, sửa dấu liên tiếp, gõ nhanh/chậm, máy tải nặng, Undo/Redo, dấu câu.
- Test cả gõ từ cũ, chèn giữa câu, text node có marks in đậm và paste.

## 8. Gộp mốc (coalescing)

Gộp các đoạn liền kề chỉ khi:
- Cùng recordingId + source, trong cùng lượt nhập.
- Khoảng thời gian đủ gần theo ngưỡng PoC xác nhận.
- Không bỏ qua ranh giới gap/pause/seek hoặc sự kiện sửa text cũ.
- Không làm mốc đại diện vượt sai lệch cho phép.

Không cố làm JSON nhỏ bằng mọi giá. Đo kích thước và độ trễ khi gõ tài liệu dài rồi mới chốt chiến lược.

## 9. Trạng thái liên kết và playback

- NoteDocument chứa Mark bất biến tương đối.
- Audio Manifest biết vùng audio thực sự đã lưu/đọc được.
- Link được tính valid/pending/missing/gap/unsupported/unlinked từ manifest.
- Hover chỉ có ▶ nếu valid; khi thiếu báo vì sao không phát.
- Không tự dịch mốc qua gap sang segment kế tiếp mà không có chủ ý.

Pre-roll mặc định tham khảo: live 5 giây, playback đang chạy 5 giây, playback_paused 10 giây, mốc tự ghim 0 giây. Mọi con số cần có thể đổi; pre-roll không ghi đè anchor gốc.

## 10. Cách nghe mà vẫn sửa như Word

- **Nhấp thường:** đặt con trỏ/bôi đen, không play.
- **Alt + Click:** yêu cầu phát từ vị trí chữ, kiểm thử xung đột hệ thống.
- **Phím tắt tại con trỏ:** phát mốc của vùng chữ đang đặt con trỏ; không cần chuột.
- **▶ khi hover:** nút nhỏ hiện theo vùng có audio, không che văn bản.

Không bắt chuyển Xem/Sửa, không áp đặt gán nhãn hay người nói. Không tô karaoke-style từng chữ vì thiếu align speech.

## 11. Bộ kiểm thử tối thiểu

- Hai phút gõ một đoạn dài không Enter, bấm các vị trí gần đầu/giữa/cuối cho các mốc khác nhau.
- Unikey/EVKey thật: từ “trường”, “tiếng”, dấu đặt sau, thay dấu liên tục; không mất chữ/Mark.
- Sửa lỗi đoạn cũ và chèn ý mới giữa đoạn trong lúc vẫn ghi; anchor không nhảy nhầm.
- Copy/move/Undo/Redo/format/paste từ Word, web và cuộc họp khác.
- Pause/micro mất/audio segment missing; không gán fake.
- Nhập file, pause ghi lâu, seek tới chỗ khác, pre-roll không sửa Mark.

Đo lệch mốc bằng tín hiệu kiểm thử; mục tiêu ≤1 giây trong bộ thử chuẩn. Không tuyên bố đây là độ chính xác từng từ phát biểu.

Xem [ACCEPTANCE_TESTS.md](ACCEPTANCE_TESTS.md) và [DATA_MODEL.md](DATA_MODEL.md).
