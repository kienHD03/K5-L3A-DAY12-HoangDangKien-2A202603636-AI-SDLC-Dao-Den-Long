# Đảo Đèn Lồng — Phase 1 (Đêm 1: Đảo Bến)

Game 3D cổ tích góc nhìn thứ ba: điều khiển **Mây** (người giữ đèn đội nón lá) thu thập đom đóm, thắp sáng 5 Đèn Lồng Lớn trên Đảo Bến và xua đuổi Bóng Mực trước khi bình minh lên.

---

## Cài đặt và chạy (tối đa 3 lệnh)

Yêu cầu: **Node.js >= 20** (chạy trực tiếp trên macOS, Linux và Windows).

```bash
npm install
npm run dev
```

Mở trình duyệt tại địa chỉ Vite hiển thị (mặc định `http://localhost:5173`).

Để chạy toàn bộ bộ kiểm chứng (unit tests + 7 kịch bản headless Test Contract v1.0 + kiểm tra tính tất định):

```bash
npm run verify
```

Chạy riêng chế độ headless theo Test Contract v1.0:

```bash
node src/headless.js --seed 42 --night 1 --ticks 600 --out out.jsonl
```

---

## Điều khiển

| Phím / Chuột | Hành động |
|---|---|
| `W / A / S / D` hoặc `↑ / ↓` | Di chuyển Mây theo hướng camera |
| `Space` | Nhảy |
| Kéo chuột trái hoặc `← / →` | Xoay camera 3D quanh Mây |
| `E` (hoặc `R`) | Nạp đom đóm vào Đèn Lồng Lớn gần nhất (trong `2.5m`) |
| `F` hoặc Chuột phải | Tỏa sáng (Pulse) xua và làm choáng Bóng Mực (tốn `2` đom đóm) |

---

## Cách tính điểm

Mọi thông số được đọc trực tiếp từ [`game.contract.json`](game.contract.json):

| Sự kiện | Điểm |
|---|---|
| Nhặt 1 đom đóm (`per_mote`) | `+10` |
| Thắp sáng 1 Đèn Lồng Lớn (`per_lantern`, cần `5` đom đóm) | `+100` |
| Làm choáng 1 Bóng Mực bằng Pulse (`per_stun`) | `+25` |
| Thưởng thời gian còn lại khi thắng (`per_second_left`) | `+2 × floor(time_left_s)` |
| Thưởng ngọn lửa còn lại khi thắng (`per_flame_left`) | `+50 × flames` |

**Lưu ý về rơi khỏi đảo (`fall_enabled: true`):** Đảo Bến không có rào chắn quanh mép (`r = 35m`). Nếu Mây chạy quá mép đảo và rơi xuống biển mây (`Y <= -6m`), Mây mất `1` ngọn lửa, đánh rơi `50%` số đom đóm đang mang (`hit_drop_ratio: 0.5`) và hồi sinh tại tâm đảo `(0, 0, 0)`.

---

## Sáng tạo của tôi

Để tăng không khí cổ tích ấm áp nhưng **không làm ảnh hưởng đến lõi game và Test Contract v1.0**, phần hiển thị 3D (`src/render/`) bổ sung:

1. **Chuyển sắc bầu trời & sương mù theo tiến độ thắp đèn:** Mỗi khi thắp thêm một Đèn Lồng Lớn (`0/5` → `5/5`), bầu trời đêm tím đen và mật độ sương mù dịu dần sang sắc bình minh ấm, đồng thời ánh sáng trên đảo sáng lên rõ rệt.
2. **Biển mây trôi & vòng bảo hộ ánh sáng:** Các đám mây trôi chậm quanh hòn đảo lơ lửng, cùng vòng sáng vàng cam dịu hiển thị ranh giới `safe_radius` quanh mỗi đèn đã thắp.
3. **Âm thanh tổng hợp bằng Web Audio API (`src/render/audio.js`):** Tự tạo tiếng chuông gió khi nhặt đom đóm, hợp âm ấm khi thắp đèn, tiếng sóng ánh sáng khi Pulse — không cần tải file asset ngoài.

**Bằng chứng phần lõi & headless không bị ảnh hưởng:** Toàn bộ mã sáng tạo nằm riêng trong `src/render/` và không bao giờ được import bởi `src/sim/` hay `src/headless.js`. Chạy `npm run verify` xác nhận 8/8 bài kiểm tra (bao gồm kịch bản Test Contract v1.0 và kiểm tra tính tất định từng byte) đều **PASS**.

---

## Tài liệu Phase 1 & Harness AI

- [`game.contract.json`](game.contract.json): Khai báo Test Contract v1.0 và bảng `tuning`.
- [`AGENTS.md`](AGENTS.md): File hướng dẫn harness cho AI agent.
- [`.github/workflows/ci.yml`](.github/workflows/ci.yml): CI tự động chạy `npm run verify` và `npm run build` mỗi lần push.
- [`docs/ASSUMPTIONS.md`](docs/ASSUMPTIONS.md): Giả định chi tiết và tiêu chí nghiệm thu Phase 1.
- [`docs/EVIDENCE_PHASE1.md`](docs/EVIDENCE_PHASE1.md): Bảng truy vết yêu cầu → bằng chứng kiểm chứng Phase 1.
- [`docs/AI_LOG.md`](docs/AI_LOG.md): Nhật ký làm việc cùng AI và quản lý token Phase 1.
