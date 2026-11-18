# Quy ước tên "Biên bản họp" và khả năng tương thích dữ liệu

Cập nhật G00 — 18/11/2026.

## Tên mới phải dùng

- **Sản phẩm, cửa sổ, biểu tượng, PWA, tài liệu gửi người dùng:** **Biên bản họp**.
- **Package npm của ứng dụng:** `bien-ban-hop` (thay `mochop-g10-integration`).
- **Package npm của các PoC:** `bien-ban-hop-poc-XX-...`; chỉ thay metadata npm, không viết lại hồ sơ thử nghiệm lịch sử.
- **Tệp sao lưu mới:** `bien-ban-hop-<meetingId>.bbhop`. Nút bấm chỉ dùng "Sao lưu biên bản và ghi âm" hoặc "Khôi phục biên bản từ tệp".
- **API/HTTP cục bộ mới:** `/__bien_ban_hop_local_recording/`, header `X-BienBanHop-Local`. Vẫn chấp nhận đường dẫn/header cũ khi người dùng chưa đóng tab chạy phiên bản trước.
- **Hàm tích hợp gói v2:** `exportMeetingArchiveV2`, `importMeetingArchiveV2`, `probeMeetingArchiveVersion`; hàm đọc v1 `importLegacyMeetingArchive`.
- **Tên PWA shell cache mới:** `bien-ban-hop-shell-...`.

## Các tên cũ PHẢI giữ vì đang là mã dữ liệu

| Tên/mã lịch sử | Vì sao vẫn còn ở một số dòng code |
| --- | --- |
| `format: "mochop"` trong `manifest.json` của ZIP | Mã định dạng v1/v2. Thay mà không tăng phiên bản schema/migrator sẽ khiến các bản ghi đã xuất trước đó không đọc được hoặc bản cũ không thể nhập gói mới. Vẫn được ghi trong `LEGACY_ARCHIVE_FORMAT`. |
| `.mochop` | Chỉ dùng để **nhập** tệp sao lưu cũ, bao gồm E2E hồi quy v1/v2; **không dùng khi xuất mới**. |
| IndexedDB `mochop-g10-v1`, DB âm thanh `mochop-opfs-poc-v1` | Đây là tên vùng dữ liệu thật trong trình duyệt. Tự đổi tên sẽ làm ứng dụng không nhìn thấy dữ liệu cũ. Cần quy trình migrate và rollback riêng trước khi đổi. |
| PWA Web Lock `mochop:poc09:maintenance` | Tab cũ và mới phải cùng dùng **một khóa** để không cập nhật SW khi đang ghi dữ liệu. Đổi ngay gây nguy cơ hai phiên bản dùng hai khóa độc lập. |
| HTTP cục bộ `/__moc_hop_local_recording/`, `X-MocHop-Local` | Alias chỉ cho client cũ; client mới dùng tên Biên bản họp. Có kiểm thử SHA-256/WAV cho cả hai đường. |
| `poc/07-backup/mochop-web.mjs`, `mochop.py`, các tên bằng chứng PoC | Tên file module/oracle đã dùng trong thử nghiệm và import của bản lịch sử. Đổi trên diện rộng gây lệch chứng cứ, test và các đường dẫn. Đổi sau khi thực hiện refactor riêng có CI, không phải đổi tên sản phẩm. |

Những định danh trên không xuất hiện như nhãn sản phẩm trên màn hình. Tuyệt đối **không** sửa bằng thao tác Replace All `mochop` → `bien-ban-hop`.

## `package-lock.json` trong GitHub Desktop

Tại thời điểm cập nhật này, `app/package-lock.json` **chưa được quản lý trong nhánh tích hợp**; tệp màu xanh trong GitHub Desktop là file npm tạo cục bộ. Nó sao chép tên package từ `app/package.json`, nên vẫn có tên cũ nếu người dùng chưa chạy lại npm.

Sau khi Pull commit đổi tên, trong PowerShell hoặc Terminal tại thư mục dự án:

```powershell
cd app
npm install --package-lock-only --ignore-scripts
```

Lệnh này đồng bộ `"name"` ở đầu lock và `"packages": {"": {"name": ...}}` theo tên `bien-ban-hop`. Sau đó có thể chạy `npm install` và `npm test`. Không xóa `node_modules`, OPFS/IndexedDB hay file ghi âm để đổi tên package. Không commit một lockfile cũ thiếu các dependency mới.

## Kiểm thử bắt buộc trước khi nghiệm thu đổi tên

1. `npm test` kiểm tra tên package app/PoC, lockfile sinh ra (nếu có), và hợp đồng xuất/nhập gói v2.
2. HTTP localhost dùng đường/header mới; đường/header cũ vẫn đọc cùng WAV mà không ghi đè.
3. Playwright xác nhận UI/tiêu đề không còn nhắc tên sản phẩm cũ.
4. Dữ liệu IndexedDB có trước đổi tên vẫn truy cập được; bản sao lưu v1/v2 vẫn nhập được.
5. Windows thật, bộ gõ/micro, PWA upgrade đang ghi và khôi phục trên máy thứ hai vẫn NOT_RUN nếu chưa có bằng chứng.

**Trạng thái:** mới là `INTEGRATION_ALPHA`, không phải nghiệm thu ứng dụng.
