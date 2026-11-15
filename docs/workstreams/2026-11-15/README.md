# Giao việc Gemini · Mốc Họp V1.2

Gửi mỗi chat một link entrypoint. Mở cả 10 chat đồng thời. Repo riêng tư, các chat sử dụng quyền GitHub đã được cấp cho repo.

Baseline [6142f56](https://github.com/cavoixanh638/Bien-ban-hop/commit/6142f56a6efdb27aa9445920c9321f7930c0d5fd). Có 9 worker PoC và một tổng chỉ huy với test harness dùng fixture tự tạo. Mỗi luồng làm và tự kiểm được từ đầu đến cuối trên nhánh của mình. Đợt tích hợp thực tế tách riêng.

[Quy ước và hợp đồng đóng băng](COMMON.md) · [Tracker](TRACKER.md)

| Entrypoint | Nhánh | Thư mục mã sở hữu | Tiếp quản |
|---|---|---|---|
| [00-command · Tổng chỉ huy và bộ kiểm thử hợp đồng](00-command.md) | `gemini/20261115-00-command` | `poc/00-contract-tests/` | [Checkpoint](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-00-command/docs/workstreams/2026-11-15/CHECKPOINT.md) |
| [01-editor · Editor, timeSpan và bộ gõ tiếng Việt](01-editor.md) | `gemini/20261115-01-editor` | `poc/01-editor/` | [Checkpoint](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-01-editor/docs/workstreams/2026-11-15/checkpoints/01-editor.md) |
| [02-capture · Thu âm và vận chuyển dữ liệu](02-capture.md) | `gemini/20261115-02-capture` | `poc/02-capture/` | [Checkpoint](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-02-capture/docs/workstreams/2026-11-15/checkpoints/02-capture.md) |
| [03-opfs · Ghi OPFS, checkpoint và khôi phục audio](03-opfs.md) | `gemini/20261115-03-opfs` | `poc/03-opfs/` | [Checkpoint](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-03-opfs/docs/workstreams/2026-11-15/checkpoints/03-opfs.md) |
| [04-timeline · Timeline và ánh xạ mốc](04-timeline.md) | `gemini/20261115-04-timeline` | `poc/04-timeline/` | [Checkpoint](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-04-timeline/docs/workstreams/2026-11-15/checkpoints/04-timeline.md) |
| [05-player · Phát nhiều đoạn và nghe chậm](05-player.md) | `gemini/20261115-05-player` | `poc/05-player/` | [Checkpoint](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-05-player/docs/workstreams/2026-11-15/checkpoints/05-player.md) |
| [06-notes · Cuộc họp, tìm kiếm và tự lưu văn bản](06-notes.md) | `gemini/20261115-06-notes` | `poc/06-notes/` | [Checkpoint](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-06-notes/docs/workstreams/2026-11-15/checkpoints/06-notes.md) |
| [07-backup · Sao lưu và khôi phục .mochop](07-backup.md) | `gemini/20261115-07-backup` | `poc/07-backup/` | [Checkpoint](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-07-backup/docs/workstreams/2026-11-15/checkpoints/07-backup.md) |
| [08-export · Xuất DOCX, TXT, Markdown và CSV](08-export.md) | `gemini/20261115-08-export` | `poc/08-export/` | [Checkpoint](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-08-export/docs/workstreams/2026-11-15/checkpoints/08-export.md) |
| [09-pwa · PWA offline, cập nhật và khóa đa tab](09-pwa.md) | `gemini/20261115-09-pwa` | `poc/09-pwa/` | [Checkpoint](https://github.com/cavoixanh638/Bien-ban-hop/blob/gemini/20261115-09-pwa/docs/workstreams/2026-11-15/checkpoints/09-pwa.md) |

Câu gửi từng chat: “Đọc link này, làm và tự kiểm toàn bộ nhiệm vụ theo entrypoint. Nếu tiếp quản, tiếp tục từ checkpoint đến hết phần việc của nhánh.”
