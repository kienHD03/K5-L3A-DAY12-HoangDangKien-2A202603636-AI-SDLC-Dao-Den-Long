# Nhật ký dùng AI & Quản lý Token — Phase 1

## 1. Quy trình phối hợp với AI
1. **Lập kế hoạch trước khi code:** Cho AI đọc `GUIDE.md`, `CHECKPOINTS.md`, `RUBRIC.md` và PRD-0, chốt tech stack (Node.js ESM + Vite + Three.js) và giả định (`fall_enabled: true`, không xây rào quanh đảo) trước khi viết dòng code nào.
2. **Xây dựng tách lõi:** Tách hoàn toàn `src/sim/` (pure JS, không phụ thuộc thư viện ngoài) khỏi `src/render/` (Three.js + Web Audio) để chạy headless và unit test ngay lập tức bằng `node`.
3. **Kiểm chứng tự động:** Viết `scripts/verify-phase1.js` kiểm tra cùng lúc 7 unit tests và 7 kịch bản Test Contract v1.0.

## 2. Harness AI đã thiết lập
- [`AGENTS.md`](../AGENTS.md): Ngắn gọn (~30 dòng), khóa kiến trúc tách lõi, Single Source of Truth `game.contract.json`, quy định Test Contract v1.0 và cấm kết thúc khi `npm run verify` đỏ.
- [`scripts/verify-phase1.js`](../scripts/verify-phase1.js): Lệnh kiểm chứng 1 chạm (`npm run verify`) cho cả unit test, scenario headless và tính tất định.
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml): Chạy tự động `npm run verify` và `npm run build` trên Ubuntu mỗi lần push.

## 3. Đánh giá nhanh & tiết kiệm token
- **Đạt:** Toàn bộ yêu cầu lõi PRD-0, Test Contract v1.0 và 3 điểm sáng tạo gọn (chuyển sắc bầu trời, biển mây, Web Audio synth) không ảnh hưởng headless.
- **Cách tiết kiệm token:**
  - Chốt kế hoạch & giả định trước khi sinh code (tránh sửa đi sửa lại).
  - Giữ `AGENTS.md` rất ngắn (~30 dòng).
  - Gom các lệnh đọc/viết file độc lập trong cùng lượt gọi công cụ.
  - Chọn JS ESM + `node --test` tích hợp sẵn để không tốn vòng sửa cấu hình TypeScript/Jest.
- **Lưu ý trước khi gắn tag `phase-1`:** Tự điền trường `"team"` trong `game.contract.json` theo đúng `mssv-ho-ten` và chơi thử nhanh trên trình duyệt bằng `npm run dev`.
