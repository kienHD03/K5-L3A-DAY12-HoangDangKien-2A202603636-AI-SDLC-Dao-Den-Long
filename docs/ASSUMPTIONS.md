# Giả định & Tiêu chí Nghiệm thu — Phase 1 (Đêm 1: Đảo Bến)

## 1. Giả định cho các điểm mơ hồ trong PRD-0

| Hạng mục | Giả định áp dụng | Lý do |
|---|---|---|
| Hình dạng & kích thước đảo | Đảo tròn tâm `(0, 0, 0)`, mặt phẳng `Y = 0`, bán kính `ISLAND_RADIUS = 35m` | Đủ rộng để chứa 5 đèn cách nhau thoải mái và chạy trốn Bóng Mực |
| Vị trí 5 Đèn Lồng Lớn | `L1..L5` phân bố đều trên đường tròn bán kính `22m`, bắt đầu từ góc `0°` (`(0, 0, 22)`), cách nhau `72°` | Đối xứng, dễ định hướng và cân bằng thời gian di chuyển |
| Rơi khỏi đảo (`fall_enabled: true`) | Không xây rào chắn; khi khoảng cách từ tâm đảo `> 35m`, nhân vật rơi theo trọng lực. Khi `Y <= -6m`: mất 1 `flame`, rơi `floor(carried * hit_drop_ratio)` đom đóm, phát sự kiện `player_hit` với `by: "fall"`, hồi sinh về `(0, 0, 0)` với thời gian bất tử `invuln_s` | Giữ cảm giác đảo lơ lửng giữa biển mây, đúng yêu cầu người dùng không xây rào |
| Nhảy & trọng lực | `JUMP_VELOCITY = 7.5 m/s`, `GRAVITY = 20 m/s²`, nhảy khi đang chạm đất (`Y == 0` và ở trong bán kính đảo) | Cảm giác nhảy gọn, nhẹ nhàng |
| Nạp ánh sáng vào đèn | Nhấn `interact` (chuyển `false -> true`) khi ở trong `interact_radius` tới đèn chưa sáng gần nhất sẽ nạp `min(carried, lantern_cost - lantern.deposited)` trong 1 lần nhấn | Tránh phải bấm liên tục gây khó chịu và rõ ràng cho test tự động |
| Đom đóm rơi khi bị đánh/rơi | `dropped = Math.floor(carried * hit_drop_ratio)`, trừ khỏi `carried` (không tự cộng lại vào điểm) | Đơn giản, tất định, dễ kiểm chứng |
| Sinh đom đóm ngẫu nhiên (`random_motes: true`) | Khởi đầu có `20` đom đóm rải trong bán kính `4m..31m` (tránh trùng tâm); mỗi `3.5s` sinh thêm 1 con nếu số đom đóm trên đảo `< 20` | Đảm bảo luôn đủ ánh sáng để thắp hết 5 đèn (`25` đom đóm) |
| Sinh Bóng Mực ngẫu nhiên (`random_shades: true`) | Khởi đầu có `2` Bóng Mực ở rìa đảo (`r = 28m`, ngoài `safe_radius` các đèn); mỗi `30s` sinh thêm 1 con tối đa `5` con, phát sự kiện `shade_spawned` | Tạo áp lực tăng dần nhưng vẫn công bằng ở Đêm 1 |
| Hành vi Bóng Mực & `safe_radius` | Bóng Mực đuổi theo Mây theo mặt phẳng XZ với tốc độ `shade_speed`. Nếu di chuyển làm khoảng cách tới bất kỳ đèn **đã sáng** nào `< safe_radius`, Bóng Mực bị đẩy ra ngoài rìa `safe_radius` (không thể xâm nhập vùng sáng). Khi trúng `pulse`, bị đẩy ra xa Mây `pulse_push_m` và giữ trạng thái `stunned` trong `pulse_stun_s` | Đảm bảo Bóng Mực sợ đèn và đứng sát đèn sáng là an toàn |
| Cộng điểm khi thắng | `per_mote` khi nhặt, `per_lantern` khi đèn sáng, `per_stun` cho mỗi Bóng Mực bị choáng bởi `pulse`. Khi thắng (`all_lit`), cộng thêm `Math.floor(time_left_s) * per_second_left + flames * per_flame_left` | Khuyến khích chơi nhanh và giữ máu |
| Thứ tự xử lý trong 1 tick | 1) Input & di chuyển/nhảy → 2) Kiểm tra rơi đảo → 3) Nhặt đom đóm → 4) Nạp đèn (`interact`) → 5) Tỏa sáng (`pulse`) → 6) Cập nhật Bóng Mực & va chạm → 7) Spawn ngẫu nhiên → 8) Kiểm tra thắng/thua & giảm thời gian | Thứ tự rõ ràng, không phụ thuộc hệ điều hành |

## 2. Tiêu chí nghiệm thu Phase 1

1. **Chạy headless đúng Test Contract v1.0:** Đủ tham số `--seed`, `--night`, `--scenario`, `--inputs`, `--ticks`, `--out`, `--snapshot-every`; exit code `0` khi thành công, `2` khi lỗi định dạng inputs/scenario.
2. **Tính tất định:** Hai lần chạy cùng `--seed`, `--scenario`, `--inputs` cho output JSONL giống hệt nhau từng byte.
3. **Nhặt đom đóm & Nạp đèn & Thắng:** Đi qua đom đóm tăng `carried` + điểm + event `mote_picked`; nhấn `interact` gần đèn tăng `deposited` + event `deposit`; đủ `lantern_cost` thì `lit = true` + event `lantern_lit`; đủ 5 đèn thì `state = "won"` + event `game_over (all_lit)`.
4. **Bóng Mực & Mất máu & Thua:** Bóng Mực đuổi Mây, chạm trong `shade_hit_radius` giảm `flames`, rơi đom đóm, bật `invuln_s`, ghi `player_hit (shade)`. Hết `flames` → `lost (no_flames)`; hết giờ → `lost (dawn)`.
5. **Rơi khỏi đảo:** Đi ra ngoài bán kính đảo (`r > 35m`) rơi xuống `Y <= -6m` → mất 1 `flame`, ghi `player_hit (fall)`, hồi sinh về `(0, 0, 0)`.
6. **Tỏa sáng (Pulse):** Tốn `pulse_cost`, bật cooldown `pulse_cooldown_s`, đẩy Bóng Mực trong `pulse_radius` thêm `pulse_push_m` và chuyển trạng thái `stunned` trong `pulse_stun_s`, ghi event `pulse`.
7. **Vùng an toàn (`safe_radius`):** Bóng Mực không đi vào trong bán kính `safe_radius` của đèn đã sáng.
8. **Bản 3D chơi được:** Mở bằng trình duyệt qua `npm run dev`, có Mây đội nón lá + đèn lồng nhỏ, 5 Đèn Lồng Lớn làm sáng dần đảo khi thắp, đom đóm, Bóng Mực, HUD đầy đủ, thắng/thua và nút chơi lại.
