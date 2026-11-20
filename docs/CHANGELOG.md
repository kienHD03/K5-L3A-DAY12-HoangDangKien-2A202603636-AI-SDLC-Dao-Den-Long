# Changelog — Đảo Đèn Lồng

## [Phase 3 — Contract v1.2] — TICKET-03 ("Đèn cạn dầu")

### Breaking Changes (Thay đổi phá vỡ tương thích so với Phase 2 / Contract v1.1)
1. **Luật thắng mới (`dawn_survived` thay `all_lit`):**
   - Thắp đủ tất cả đèn **không còn kết thúc Đêm sớm**; mã lý do `all_lit` bị loại bỏ.
   - Người chơi thắng khi sống sót tới lúc hết giờ (`time_left_s <= 0`) với số đèn đang sáng `>= ceil(0.6 * tổng đèn)` (Đêm 1: `3/5`, Đêm 2: `4/6`, Đêm 3: `5/7`).
2. **Thời lượng Đêm rút ngắn:**
   - Đêm 1: `300s → 240s`; Đêm 2: `330s → 270s`; Đêm 3: `360s → 300s`.
3. **Nhiên liệu đèn & Tương tác đèn đang sáng:**
   - Đèn sáng có `fuel = 100`, hao `1.0/s` (`1/60` mỗi tick). Khi `fuel <= 0` đèn tắt (`lantern_out`), `deposited = 0`, `ever_lit = true`.
   - Đèn đang sáng chưa đầy dầu nhận thêm đom đóm (`refuel`, `+10` fuel/đom đóm). Đèn đã từng sáng (`ever_lit`) chỉ cần `5` đom đóm để thắp lại.
4. **Vùng an toàn & Bóng Mực hút dầu (`drain`):**
   - Đèn có `fuel < 30` mất vùng an toàn `safe_radius`. Bóng Mực `wander` sẽ tiến vào hút `5 fuel/s` (`state: "drain"`, phát `fuel_drain` mỗi 60 tick).
5. **Công thức tính điểm mới:**
   - Nạp/châm dầu: `+10 → +5`/đom đóm; thắp lần đầu: `+100`; thắp lại: `+40`; Pulse Bóng Mực thường: `+5`, Pulse Bóng Mực đang `drain`: `+15`; thắng bình minh: `+(50 + floor(fuel))`/đèn sáng + `+50`/Ngọn Lửa. **Bỏ thưởng thời gian (`per_second_left = 0`).**
6. **Schema Contract v1.2:**
   - `contract_version: "1.2"` với các khóa `tuning` mới (`fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`).
   - Snapshot thêm `lanterns[].{fuel, ever_lit, relit_count}`, `player.capacity`; sự kiện `lantern_lit` thêm `relight`; thêm sự kiện `refuel`, `lantern_out`, `fuel_drain`.

### Tính năng mới
- **Sức chứa tăng dần:** `10 + 2 * successful_lights`, tối đa `20`.
- **Chế độ mù màu ("Bảng màu dễ phân biệt"):** Lưu trong Cài đặt; đổi viền/mắt Bóng Mực sang `#00B3FF`, cảnh báo UI sang `#FFFFFF` kèm `⚠`; đèn tắt xẹp `20%` kèm vết rách; đèn `< 30` fuel nhấp nháy `1 Hz` kèm thanh dầu 3D.

---

## [Phase 2 — Contract v1.1] — TICKET-02 ("Ba hòn đảo")
- Chuẩn hóa toàn bộ thông số lõi, mở rộng 3 Đêm (Đảo Bến, Đảo Cau, Đảo Chuông), thêm Lướt (Dash), Gió Lạc (Drifter), Bùa Gió (Charm), Gió mạnh Đêm 3, Tạm dừng (Pause), Menu/Cài đặt, HUD đầy đủ và bảng màu hex chuẩn.

## [Phase 1 — Contract v1.0] — PRD-0
- Xây dựng lõi simulation tách biệt (`src/sim/`), chế độ headless JSONL, Đêm 1 Đảo Bến chơi được trên trình duyệt bằng Three.js.
