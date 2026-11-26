# Biên bản họp — Ghi chú liên kết âm thanh

**Biên bản họp** là ứng dụng đang tích hợp thử nghiệm, dành cho việc **gõ ghi chú như Word và tự gắn mốc âm thanh**, để nghe lại đúng đoạn từ chính chữ người dùng đã ghi. Không bắt tạo dấu mốc, chọn nhãn hoặc bấm Lưu khi đang ghi chú.

> **Trạng thái thực tế:** Nhánh `main` giữ tài liệu đường cơ sở; [nhánh tích hợp G10](https://github.com/cavoixanh638/Bien-ban-hop/tree/integration/20261115-g10-v1.2) có WebApp **INTEGRATION_ALPHA** tại `app/` cùng các PoC tại `poc/`. Đã có CI mã/browser nhưng **chưa nghiệm thu phần cứng hoặc phát hành**. Xem [STATUS](docs/STATUS.md) và [app/README.md](app/README.md).

## Bộ tài liệu gọn — 9 tệp

| Đọc khi cần | Tệp chính thức |
|---|---|
| Hiểu ngay dự án và cách tìm tài liệu | README.md (tệp này) |
| Bàn giao và quy tắc ChatGPT/Codex | [AGENTS.md](AGENTS.md) |
| Mục tiêu, quy trình, yêu cầu V1.2 và 6 gói triển khai | [docs/PLAN_V1_2.md](docs/PLAN_V1_2.md) |
| Kiến trúc, hợp đồng module và **mô hình dữ liệu** | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Quy tắc `timeSpan`, gõ tiếng Việt, sửa/dán và thời gian | [docs/TIMELINE_RULES.md](docs/TIMELINE_RULES.md) |
| Ghi âm an toàn, lựa chọn engine và phát đa đoạn | [docs/AUDIO_DESIGN.md](docs/AUDIO_DESIGN.md) |
| **Nghiên cứu 17 nhóm lựa chọn công nghệ (4 phương án/nhóm), căn cứ và PoC** | **[docs/TECHNICAL_OPTIONS.md](docs/TECHNICAL_OPTIONS.md)** |
| Danh sách và bằng chứng nghiệm thu TC01–TC38 | [docs/ACCEPTANCE_TESTS.md](docs/ACCEPTANCE_TESTS.md) |
| Công việc hiện tại, mức hoàn thành, quyết định và blocker | [docs/STATUS.md](docs/STATUS.md) |

## Khởi đầu công việc

1. Đọc **PLAN_V1_2.md** và **STATUS.md**.
2. Kiểm tra HEAD/checkpoint nhánh tích hợp và CI đúng SHA; tiếp tục các cổng còn NOT_RUN, nhất là Unikey/EVKey trên Windows thật.
3. Làm từng gói, chỉ ghi PASS khi có mã nguồn và bằng chứng kiểm thử.
4. Cập nhật **STATUS.md** với commit, test, lỗi và bước tiếp theo.
5. Không coi hướng dẫn dự kiến hoặc PoC là ứng dụng đã phát hành.

**Chỉ Giai đoạn 1:** chưa làm AI chép lời/người nói/tóm tắt/soạn biên bản; không cần backend hay cloud.

**Dữ liệu:** không commit ghi âm cuộc họp, tài liệu nội bộ nhạy cảm, token hoặc bản backup thật lên GitHub. OPFS/IndexedDB là lưu trữ cục bộ, không thay bản sao lưu độc lập.

## Lịch sử

Bộ tài liệu gốc gồm 11 tệp đã được hợp nhất thành 8 tệp để giảm trùng lặp. Sau đó bổ sung **tệp nghiên cứu lựa chọn kỹ thuật thứ 9** theo yêu cầu; không tạo thêm hệ thống hồ sơ điều phối mới. Git vẫn giữ nội dung cũ trong lịch sử commit; **không duy trì song song các bản V1.0/V1.1 hoặc các tệp chuyên môn bị thay thế**.
