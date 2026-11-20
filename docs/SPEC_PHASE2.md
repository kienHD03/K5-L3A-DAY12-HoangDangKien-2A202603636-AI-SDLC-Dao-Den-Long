# Spec & Acceptance Criteria — Phase 2 (TICKET-02: "Ba hòn đảo")

## 1. Thay đổi so với Phase 1 (Regression & Lý do cập nhật test)

TICKET-02 chuẩn hóa toàn bộ thông số lõi để mọi bản chơi có cảm giác giống nhau (Contract v1.1). Các thay đổi làm ảnh hưởng trực tiếp tới test Phase 1:

| Hạng mục | Phase 1 (tự chọn) | Phase 2 (chuẩn hóa bắt buộc) | Hành động với test cũ |
|---|---|---|---|
| `carry_capacity` & `lantern_cost` | `5` / `5` | `10` / `10` | Cập nhật scenario thắng Phase 1 nạp đủ 10 đom đóm |
| Điểm đom đóm (`per_mote`) | `+10` khi nhặt | `+10` khi **nạp** vào đèn | Cập nhật unit test tính điểm theo sự kiện `deposit` |
| `pulse_cost`, `pulse_radius`, `pulse_push_m`, `pulse_stun_s`, `per_stun` | `2`, `8m`, `6m` tức thì, `3s`, `+25` | `3`, `5m` (3D từ `Y+0.8`), đẩy `4m` trong `15 tick`, `120 tick` (`2s`), `+5` | Cập nhật unit test & scenario Pulse kiểm tra đẩy dần trong 15 tick và `+5` điểm |
| Rơi khỏi đảo | `Y <= -6`, hồi sinh ngay | `Y < -10`, mất toàn bộ đom đóm (`lost`), chờ `60 tick` rồi hồi sinh với `invuln = 90 tick` | Cập nhật unit test & scenario rơi kiểm tra `lost` và `respawn` sau 60 tick |
| Trạng thái Bóng Mực | `chase`, `stunned` | `spawning`, `wander`, `chase`, `recoil`, `stunned` | Cập nhật kiểm tra tên trạng thái chuẩn v1.1 |
| Bán kính Đảo Bến (Đêm 1) | `35m` | `40m` | Cập nhật tọa độ biên đảo trong scenario rơi |

---

## 2. Acceptance Criteria — Phần 3 (Tính năng mới)

1. **Lướt (Dash):**
   - Nhấn `Shift` (hoặc input `dash: true`) lướt `14 m/s` trong `12 tick` (`0.2s`), hồi chiêu `90 tick` (`1.5s`) từ lúc bắt đầu lướt.
   - Hướng theo hướng đang di chuyển; nếu đứng yên thì theo hướng mặt Mây. Lướt trên không giữ nguyên độ cao `Y`. Không bất tử khi lướt. Phát event `dash {}`.
2. **Bản đồ 3 Đêm & Cơ chế địa hình:**
   - **Đêm 1 (Đảo Bến):** Bán kính `40m`, 5 đèn đúng tọa độ chuẩn, 24 điểm sinh đom đóm, 12 điểm sinh Bóng Mực.
   - **Đêm 2 (Đảo Cau):** 2 đảo `r=28m` tại `(0,0)` & `(70,0)`, cầu tre `x∈[26,44], z∈[-2,2]` không lan can, 2 bục nhảy `(20,0,18)` & `(50,0,-18)` phóng `vy=14, vxz=24` sang tâm đảo kia, 6 đèn `L1..L6`.
   - **Đêm 3 (Đảo Chuông):** `r=45m`, 3 tầng (`Y=0`, `Y=3` vành khăn `12–24m, z>0`, `Y=6` đĩa `r≤8m`), vách đứng, 2 dốc `30°/150°` rộng `3m`, bục nhảy `(0,3,13)` lên tầng 2, tháp chuông trụ `r=2m` cản đường, 7 đèn `L1..L7`, Gió mạnh mỗi `30s` (báo trước `2s`, thổi `5s` đẩy `2 m/s`).
3. **Gió Lạc (Drifter — Đêm 2 & 3):**
   - Tối đa 2 con (`D1, D2`), sinh tại tick `1200, 2400, ...` ở điểm sương ngẫu nhiên.
   - `idle (2 m/s) → chase (7 m/s)` khi Mây mang `≥ 5` đom đóm và cách `≤ 15m`; mất điều kiện thì về `idle`.
   - Chạm `XZ ≤ 1.2m` cướp `min(3, carried)` (kể cả khi Mây bất tử hoặc trong vùng an toàn đèn), phát `drifter_steal`, chuyển `flee (240 tick)` rồi biến mất.
   - Trúng Pulse khi `chase` → `flee` không cướp; trúng Pulse khi `flee` có mang đồ → thả toàn bộ đom đóm rơi tại chỗ, phát `drifter_drop`, biến mất sau `120 tick`.
4. **Bùa Gió (Charm — Đêm 2 & 3):**
   - Đêm 2: `C1 (35,0,0)`; Đêm 3: `C1 (30,0,25)`, `C2 (-30,0,25)`.
   - Nhặt theo luật đom đóm → phát `charm_picked`, hiệu lực `600 tick` (tốc độ `7.2 m/s`, Lướt không hồi chiêu), hồi bùa sau `2700 tick`.
5. **Chuỗi 3 Đêm & Menu:**
   - Menu chính → Giới thiệu Đêm (tên đảo + lời Ông Đăng) → Chơi → Kết quả → Đêm kế tiếp. Thắng Đêm 3 hiển thị màn hình Bình Minh với tổng điểm 3 Đêm. Thua được chơi lại Đêm đó.
6. **Tạm dừng (`Esc` / `P`):**
   - Dừng hoàn toàn `sim_tick`, thời gian, hồi chiêu, spawn, TTL; phát `paused` / `resumed`; snapshot ghi `state: "paused"`. Menu có: Tiếp tục, Chơi lại Đêm, Cài đặt, Về menu.
7. **Cài đặt:**
   - Điều chỉnh âm lượng và độ nhạy chuột, lưu bền vững vào `localStorage` giữa các lần mở game.
8. **Âm thanh:**
   - Nhạc nền đêm nhẹ và đầy đủ hiệu ứng Web Audio cho: nhặt, thắp đèn, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 giây cuối.
9. **HUD & Bảng màu chuẩn:**
   - Ngọn Lửa (trên trái), đồng hồ `mm:ss` (trên giữa, đỏ + nhấp nháy khi `≤ 30s`), đèn `k/n` & điểm (trên phải), thanh đom đóm 10 ô (dưới giữa), hồi chiêu Lướt & Tỏa Sáng (dưới phải), nhắc `E — Nạp ánh sáng (x/10)` khi đứng gần đèn, mũi tên chỉ tới đèn chưa sáng gần nhất ngoài màn hình.
   - Bảng màu đúng hex chuẩn (sai lệch 0%) và cường độ ánh sáng môi trường `= 0.15 + 0.55 * (lit / total)`.
10. **Hiệu năng & Headless:**
    - Chạy headless 1 Đêm đầy đủ (`21.600` tick) xong trong `≤ 30s` (mục tiêu `< 1s`).
    - Bản 3D chạy ổn định `≥ 30 FPS` ở `1280×720`.
