# Đảo Đèn Lồng — Phase 2 (Ba Hòn Đảo · Contract v1.1)

Game 3D cổ tích góc nhìn thứ ba: điều khiển **Mây** (người giữ đèn đội nón lá) vượt qua **3 Đêm** — **Đảo Bến**, **Đảo Cau** và **Đảo Chuông** — thu thập đom đóm, thắp sáng các Đèn Lồng Lớn, né Bóng Mực và Gió Lạc trước khi bình minh lên.

---

## Cài đặt và chạy (tối đa 3 lệnh)

Yêu cầu: **Node.js >= 20** (chạy trực tiếp trên macOS, Linux và Windows).

```bash
npm install
npm run dev
```

Mở trình duyệt tại địa chỉ Vite hiển thị (mặc định `http://localhost:5173`).

Chạy toàn bộ bộ kiểm chứng (unit tests + regression Phase 1 + scenarios Phase 2 + tất định + benchmark 21.600 ticks):

```bash
npm run verify
```

Chạy riêng chế độ headless theo Test Contract v1.1 (`--night 1 | 2 | 3`):

```bash
node src/headless.js --seed 42 --night 3 --ticks 1800 --out out.jsonl
```

---

## Điều khiển

| Phím / Chuột | Hành động |
|---|---|
| `W / A / S / D` hoặc `↑ / ↓` | Di chuyển Mây theo hướng camera |
| `Space` | Nhảy |
| `Shift` | Lướt nhanh (Dash: `14 m/s`, `0.2s`, hồi chiêu `1.5s`, giữ nguyên độ cao trên không) |
| Kéo chuột trái hoặc `← / →` | Xoay camera 3D quanh Mây |
| `E` (hoặc `R`) | Nạp đom đóm vào Đèn Lồng Lớn chưa sáng gần nhất (trong `2.0m`) |
| `F` hoặc Chuột phải | Tỏa Sáng (Pulse: tốn `3` đom đóm, bán kính 3D `5m`, hồi chiêu `3s`) |
| `Esc` hoặc `P` | Tạm dừng (Pause) / Mở menu tạm dừng |

---

## Cách tính điểm (Chuẩn hóa Contract v1.1)

Mọi thông số đọc trực tiếp từ [`game.contract.json`](game.contract.json):

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm **nạp** vào đèn (`per_mote`) | `+10` |
| Thắp sáng 1 Đèn Lồng Lớn (`per_lantern`, cần `10` đom đóm) | `+100` |
| Mỗi Bóng Mực trúng Tỏa Sáng (`per_stun`, kể cả con đang choáng) | `+5` |
| Thưởng thời gian còn lại khi thắng (`per_second_left`) | `+2 × floor(time_left_s)` |
| Thưởng Ngọn Lửa còn lại khi thắng (`per_flame_left`) | `+50 × flames` |

Tổng điểm hành trình là tổng điểm của các Đêm đã thắng.

---

## Sáng tạo của tôi

Toàn bộ phần sáng tạo chỉ nằm trong `src/render/` nên **không ảnh hưởng đến đầu ra headless Test Contract v1.1**:

1. **Nhạc nền đêm & bộ 13 hiệu ứng âm thanh tổng hợp bằng Web Audio API (`src/render/audio.js`):** Tự sinh giai điệu ngũ cung dịu êm cùng âm thanh cho nhặt, nạp, thắp đèn, nhảy, lướt, tỏa sáng, bùa gió, gió thổi, Bóng Mực xuất hiện, Gió Lạc cướp, bị đánh, đếm ngược 10s cuối, thắng/thua — điều chỉnh được âm lượng và lưu `localStorage`.
2. **Hiệu ứng gió lá bay & vòng bảo hộ ánh sáng:** Lá bay trực quan khi gió Đêm 3 sắp thổi/đang thổi và vòng sáng quanh mỗi Đèn Lồng đã thắp biểu thị `safe_radius = 6m`.

---

## Tài liệu & Harness AI

- [`game.contract.json`](game.contract.json): Test Contract v1.1 và bảng `tuning` chuẩn.
- [`AGENTS.md`](AGENTS.md): File hướng dẫn harness AI (đã cập nhật cho Phase 2).
- [`.github/workflows/ci.yml`](.github/workflows/ci.yml): CI tự động chạy `npm run verify` và `npm run build`.
- [`docs/SPEC_PHASE2.md`](docs/SPEC_PHASE2.md): Acceptance criteria Phase 2 và bảng giải thích các test Phase 1 được cập nhật theo số chuẩn.
- [`docs/EVIDENCE_PHASE2.md`](docs/EVIDENCE_PHASE2.md): Bảng truy vết yêu cầu → bằng chứng kiểm chứng Phase 2.
- [`docs/AI_LOG.md`](docs/AI_LOG.md): Nhật ký AI, lỗi phát hiện và cách tiết kiệm token.
