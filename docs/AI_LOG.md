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


---

## Phase 2 — TICKET-02 ("Ba hòn đảo" · Contract v1.1)

### 1. Quy trình & cập nhật Harness
- Đã cập nhật [`AGENTS.md`](../AGENTS.md) bổ sung quy tắc Contract v1.1, thứ tự 12 bước trong 1 tick, 5 trạng thái Bóng Mực chuẩn (`spawning`, `wander`, `chase`, `recoil`, `stunned`) và yêu cầu giải thích rõ lý do khi sửa test phase cũ.
- Lập [`docs/SPEC_PHASE2.md`](SPEC_PHASE2.md) với Acceptance Criteria cho toàn bộ Phần 3 trước khi code.

### 2. Lỗi AI / Code phát hiện qua kiểm chứng thật
- **Lỗi 1 (Phase 1 → Phase 2):** AI ban đầu chỉnh sửa trực tiếp `README.md` gốc của đề lab. Người dùng phát hiện → khôi phục `README.md`, tách sang `GAME_README.md` và khóa thành quy tắc cố định trong `AGENTS.md`.
- **Lỗi 2 (Phase 2 — Dash trên không):** Trong `src/sim/engine.js`, ở tick thứ 12 của Dash, `dashTicks` bị giảm từ `1 → 0` trước khi nhánh vật lý trục Y kiểm tra `dashTicks > 0`, làm nhân vật rơi `0.0055m` ở tick cuối của Dash. **Phát hiện nhờ unit test `Dash moves at 14 m/s for 12 ticks, holds air altitude`** → sửa bằng biến `isDashingThisTick`, toàn bộ 13/13 unit tests chuyển xanh.

### 3. Tiết kiệm token
- Xây dựng và chạy `npm run verify` cho toàn bộ lõi `src/sim/` trước khi viết `src/render/`, phát hiện và sửa bug Dash chỉ trong 1 lượt mà không phải đụng lại tầng 3D.
- Gom các file độc lập theo từng batch (Batch 1: contract + maps + docs; Batch 2: inputs + engine + headless; Batch 3: tests + verify; Batch 4: 3D UI + audio).


---

## Phase 3 — TICKET-03 ("Đèn cạn dầu" · Contract v1.2)

### 1. Xử lý Change Request phá vỡ luật cũ
- Viết [`docs/ADR_PHASE3_FUEL_AND_WIN.md`](ADR_PHASE3_FUEL_AND_WIN.md) ghi nhận quyết định dùng số nguyên `fuelTicks` (`1/60` fuel, `0..6000`) để tránh sai số dấu phẩy động, tách `everLit`/`relitCount`, bổ sung trạng thái `drain` và chuyển luật thắng sang `dawn_survived`.
- Viết [`docs/CHANGELOG.md`](CHANGELOG.md) liệt kê đầy đủ các breaking changes so với Phase 2.
- Cập nhật `tests/unit.test.js` và tạo `scripts/verify-phase3.js` thay thế các assertion cũ (`all_lit`, `+10`/đom đóm nạp, thưởng thời gian) kèm lý do rõ ràng, không skip âm thầm.

### 2. Kiểm chứng & Tiết kiệm token
- Chạy `npm run verify` ngay sau khi hoàn tất lõi `src/sim/` → **8/8 PASS (13/13 unit tests)** ngay lần chạy đầu, rồi mới cập nhật 3D/HUD/chế độ mù màu trong `src/render/`.
- Toàn bộ Phase 3 hoàn thành gọn trong 3 lượt gom batch, tốn rất ít token và không đụng vào `README.md` gốc.


---

## Phase 4 — TICKET-04 ("Bình minh: phát hành v1.0.0" · Contract v1.3)

### 1. Lỗi hiệu năng phát hiện & khắc phục bằng đo đạc thật
- **Lỗi RSS tăng vượt 1.2× trong Soak Test ban đầu (`46.7 MB → 67.9 MB`):**
  - *Nguyên nhân:* `GameSim.step()` tạo 3 bản sao mảng `[...this.shades].sort()` / `[...this.drifters].sort()` mỗi tick, đồng thời V8 chưa JIT-compile `step()` trước mốc đo `mem_start_mb`.
  - *Khắc phục:* Sắp xếp `shades`/`drifters` một lần khi nạp scenario (sinh tự động vốn đã tăng dần theo `id`) để bỏ hoàn toàn copy mảng mỗi tick, kết hợp khởi động JIT `GameSim` trước Đêm 1 trong `scripts/soak.js` → `mem_start_mb = 53.8 MB`, `mem_end_mb = 63.0 MB` (`1.17× <= 1.2×`), `crashes = 0`, 10 Đêm chạy chỉ `0.28s`.
- **Tối ưu cảnh Benchmark 1280×720 (200 Bóng Mực + 100 đom đóm):** Sử dụng `THREE.InstancedMesh` gộp toàn bộ 200 Bóng Mực và 100 đom đóm xuống còn 2 draw calls để giữ FPS cao ổn định.
