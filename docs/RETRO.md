# Retrospective — Đảo Đèn Lồng (4 Phases · Day 12 AI SDLC)

## 1. Tổng hợp Evaluation qua 4 Phase

| Phase | Mục tiêu chính | Kết quả kiểm chứng | Nhận xét |
|---|---|---|---|
| **Phase 1** (`phase-1`) | Lõi simulation tách biệt, Đêm 1, Test Contract v1.0 | `8/8` checks PASS (`7` unit tests + `7` headless scenarios), build `1.10s` | Quyết định tách `src/sim/` thuần JS ESM + Single Source of Truth `game.contract.json` tạo nền tảng cực vững cho mọi phase sau |
| **Phase 2** (`phase-2`) | Chuẩn hóa số liệu, 3 Đêm (Đảo Bến/Cau/Chuông), Dash, Pause, Gió Lạc, Bùa Gió, Contract v1.1 | `11/11` checks PASS (`13` unit tests), Đêm 3 `21.600` ticks trong `101.1 ms` | Unit test tự động phát hiện ngay lỗi rơi 1 tick ở cuối Dash; refactor bản đồ 3 tầng + dốc sạch sẽ |
| **Phase 3** (`phase-3`) | Change Request: nhiên liệu nguyên `fuelTicks`, Bóng Mực `drain`, luật thắng `dawn_survived`, sức chứa động, chế độ mù màu (Contract v1.2) | `8/8` checks PASS (`13` unit tests), Đêm 3 `18.000` ticks trong `215.0 ms` | Ghi ADR + Changelog rõ ràng; dùng số nguyên `1/60` fuel giúp loại bỏ hoàn toàn sai số dấu phẩy động |
| **Phase 4** (`phase-4` / `v1.0.0`) | Benchmark 1280×720 (200 Shades + 100 Motes), Soak 10 Đêm, Bảng xếp hạng cục bộ, Trợ năng đầy đủ, Release `v1.0.0` (Contract v1.3) | `npm run verify` PASS, Soak `0` crashes (`mem_end <= 1.2 * mem_start`), Benchmark đạt chuẩn, `vite build` xanh | Dùng `THREE.InstancedMesh` cho cảnh benchmark giúp giảm từ 300 draw calls xuống 2 draw calls |

---

## 2. Điều gì hiệu quả & chưa hiệu quả khi làm việc với AI

### Hiệu quả nhất
1. **Lập kế hoạch & chốt giả định trước khi sinh code:** Mỗi phase đều tách rõ yêu cầu bắt buộc (Test Contract) khỏi chỗ mơ hồ trước khi viết code → hầu như không phải viết lại kiến trúc.
2. **Tách hoàn toàn lõi `src/sim/` khỏi hiển thị `src/render/`:** Mọi tính năng mới (Dash, Drifter, Fuel/Drain, Soak Test) đều kiểm chứng được bằng `node` trong `< 1 giây` mà không cần mở trình duyệt.
3. **Gom việc theo batch độc lập:** Viết song song các file độc lập và chạy 1 lệnh `npm run verify` duy nhất sau mỗi giai đoạn giúp tiết kiệm rất nhiều lượt trao đổi.

### Chưa hiệu quả
- Ở Phase 1, AI tự ý ghi đè `README.md` gốc của đề lab thay vì tạo file riêng khi chưa có quy tắc cấm rõ ràng trong `AGENTS.md`.
- Khi thử cài `npm install` lần đầu trong sandbox bị treo vì không có mạng, mất ~1 phút trước khi chuyển sang chạy ngoài sandbox.

---

## 3. Các lỗi của AI đã phát hiện & cách sửa Harness

1. **Sửa nhầm `README.md` gốc (Phase 1):**
   - *Phát hiện:* Sinh viên kiểm tra git diff.
   - *Khắc phục:* Khôi phục `README.md` từ `HEAD`, tách sang `GAME_README.md`, và **thêm quy tắc cứng vào `AGENTS.md`** → suốt Phase 2, 3, 4 không bao giờ tái diễn.
2. **Lỗi vật lý tick cuối của Dash trên không (Phase 2):**
   - *Phát hiện:* Unit test `Dash moves at 14 m/s for 12 ticks, holds air altitude` báo sai `Y = 1.9944` thay vì `2.0` do `dashTicks` bị giảm từ `1 → 0` trước nhánh kiểm tra trọng lực.
   - *Khắc phục:* Lưu cờ `isDashingThisTick` trước khi trừ `dashTicks` → test xanh ngay lập tức.
3. **Bẫy tọa độ xuất phát Đêm 3 (Phase 2):**
   - *Phát hiện:* Khi thiết kế `src/sim/maps.js`, nhận ra tâm `(0, 0, 0)` của Đêm 3 nằm bên trong tháp chuông trụ `r = 2m` trên tầng 2 (`Y = 6`).
   - *Khắc phục:* Đặt điểm xuất phát Đêm 3 tại `(0, 0, -10)` trên tầng 0 (thông thoáng, hướng về dốc và tầng 2) trong khi vẫn tôn trọng `scenario.player.pos` nếu bài test chỉ định.

---

## 4. Harness AI giúp ích nhiều nhất
1. **`npm run verify` (`scripts/verify-phase*.js`):** Hữu ích số 1 — bắt lỗi logic thực sự (như bug Dash) chỉ trong `< 0.5 giây`, đảm bảo không phá regression phase trước.
2. **`AGENTS.md` ngắn gọn (~30 dòng):** Khóa chặt 3 bất biến sống còn (không import Three.js/DOM trong `src/sim/`, Single Source of Truth `game.contract.json`, không sửa `README.md` gốc) mà tốn rất ít ngữ cảnh.
3. **GitHub Actions CI (`.github/workflows/ci.yml`):** Đảm bảo mọi commit push lên đều xanh trên Ubuntu (đúng môi trường chấm Linux).

---

## 5. Quản lý Token & Chi phí AI
- **Ước tính sử dụng:** ~120k–160k token tổng cộng cho cả 4 phase (khoảng ~30–40k token/phase), thấp hơn nhiều so với việc chạy thử-sai liên tục.
- **Cách tiết kiệm token đã áp dụng:**
  - Chốt kiến trúc JS ESM thuần + `node --test` tích hợp sẵn (không tốn token cấu hình/sửa lỗi TypeScript, Webpack, Jest).
  - Giữ `AGENTS.md` dưới 35 dòng; chỉ đọc những file thực sự cần thiết.
  - Không trau chuốt UI/UX sớm ở Phase 1 (vì Phase 2 & 4 thay đổi mạnh HUD/Accessibility), tránh làm lại 2 lần.

---

## 6. Nếu làm lại dự án, sẽ đổi gì?
- Thiết lập ngay quy tắc bảo vệ file đề bài (`README.md`) trong `AGENTS.md` từ Checkpoint 0.
- Viết sẵn `scripts/run.js` và `THREE.InstancedMesh` ngay từ Phase 2 để sang Phase 4 chỉ cần nối cờ `--bench` mà không phải viết thêm nhánh render riêng.
