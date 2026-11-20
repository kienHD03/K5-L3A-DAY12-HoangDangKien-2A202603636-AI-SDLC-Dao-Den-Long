# Bằng chứng Kiểm chứng — Phase 2 (TICKET-02: "Ba hòn đảo" · Contract v1.1)

## 1. Bảng truy vết Yêu cầu → Bằng chứng

| Yêu cầu TICKET-02 / Contract v1.1 | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| `game.contract.json` v1.1 đủ khóa mới & đúng số chuẩn Phần 1 | Đọc trực tiếp từ `src/sim/config.js` | `game.contract.json`, `src/sim/config.js` | **Đạt** |
| Regression Phase 1 với số chuẩn (nhặt, nạp 10, thắng `all_lit`, thua `no_flames`/`dawn`, `safe_radius`, rơi `Y<-10`) | Unit tests + Scenarios 1–3 | `tests/unit.test.js`, `scripts/verify-phase2.js` (PASS) | **Đạt** |
| Lướt (`Dash`: `14 m/s`, `12 tick`, giữ độ cao trên không, hồi chiêu `90 tick`) | Unit test + Scenario 4 | `tests/unit.test.js`, `verify-phase2.js` Scenario 4 (PASS) | **Đạt** |
| Tạm dừng (`Pause`/`Resume`: đứng yên `sim_tick`, thời gian, hồi chiêu) | Unit test + Scenario 5 | `tests/unit.test.js`, `verify-phase2.js` Scenario 5 (PASS) | **Đạt** |
| Bản đồ 3 Đêm (Đảo Bến 40m, Đảo Cau 2 đảo + cầu tre + 2 bục nhảy, Đảo Chuông 3 tầng + 2 dốc + tháp chuông + bục nhảy) | Unit tests bục nhảy Đêm 2 & Đêm 3 + Scenarios 6–7 + Build 3D | `src/sim/maps.js`, `tests/unit.test.js`, `src/render/main.js` (PASS) | **Đạt** |
| Gió Lạc (`D1, D2`: `idle/chase/flee/removed`, cướp tối đa 3, Pulse làm thả đom đóm) | Unit test + Scenario 6 | `tests/unit.test.js`, `verify-phase2.js` Scenario 6 (PASS) | **Đạt** |
| Bùa Gió (`C1, C2`: tốc độ `7.2 m/s`, Lướt hồi chiêu 0s trong 600 tick, hồi sau 2700 tick) | Unit test + Scenario 6 | `tests/unit.test.js`, `verify-phase2.js` Scenario 6 (PASS) | **Đạt** |
| Gió mạnh Đêm 3 (mỗi 30s, báo trước 2s, thổi 5s đẩy 2 m/s) | Scenario 7 | `verify-phase2.js` Scenario 7 (PASS) | **Đạt** |
| Lỗi định dạng file inputs thoát mã `2` + Tính tất định Đêm 3 giống hệt từng byte | Scenarios 8–9 | `verify-phase2.js` Scenarios 8–9 (PASS) | **Đạt** |
| Hiệu năng headless: chạy hết Đêm 3 (`21.600` tick) `≤ 30s` | Benchmark Scenario 10 | **101.1 ms** (nhanh hơn ngưỡng ~296 lần) | **Đạt** |
| Chuỗi 3 Đêm, Menu, Pause, Cài đặt lưu `localStorage`, Âm thanh Web Audio, HUD đầy đủ, Bảng màu hex chuẩn | Build sạch `npm run build` + kiểm tra mã nguồn | `dist/` build `1.16s` không lỗi; `src/render/main.js`, `src/render/audio.js`, `index.html`, `src/style.css` | **Đạt** |

## 2. Kết quả chạy `npm run verify` thực tế

```text
✔ PRNG is deterministic for the same seed (0.9375ms)
✔ transformMove matches Test Contract formula and normalizes length > 1 (0.2786ms)
✔ Phase 1 regression (v1.1 numbers): pickup, deposit (+10/mote on deposit), lantern_lit, win (1.968ms)
✔ Pulse (v1.1): 3D radius 5m from Y+0.8, 120-tick stun, 4m push over 15 ticks, +5 score (2.042ms)
✔ Shade cannot enter safe_radius of a lit lantern (0.9961ms)
✔ Fall off island (Y < -10): ignores invuln, loses all carried, waits 60 ticks, respawns with invuln (0.5046ms)
✔ Dash moves at 14 m/s for 12 ticks, holds air altitude, triggers 90-tick cooldown (0.2882ms)
✔ Pause freezes sim_tick and time_left_s while tick advances (0.2316ms)
✔ Drifter steals up to 3 motes and drops them when hit by Pulse while fleeing (0.5082ms)
✔ Wind Charm grants 7.2 m/s speed and zero dash cooldown for 600 ticks (0.3077ms)
✔ Night 2 jump pad launches player from Island A to Island B (0.5392ms)
✔ Night 3 jump pad launches player from Tier 1 (Y=3) to Tier 2 (Y=6) (0.5355ms)
✔ validateInputs rejects non-increasing ticks (0.6166ms)
ℹ tests 13
ℹ pass 13
ℹ fail 0
PASS  Unit tests (node --test)
PASS  Scenario 1 (P1 Regression): Pickup -> Deposit -> Win (all_lit)
PASS  Scenario 2 (P1 Regression): Shade hit -> Lose (no_flames)
PASS  Scenario 3 (P1 Regression): Timeout -> Lose (dawn)
PASS  Scenario 4 (P2 Dash): Dash event + speed + cooldown
PASS  Scenario 5 (P2 Pause): Freeze sim_tick & time_left_s while paused
PASS  Scenario 6 (P2 Night 2): Drifter steal/drop + Charm + Jump Pad
PASS  Scenario 7 (P2 Night 3): Wind activates at 30s and pushes player
PASS  Scenario 8: Malformed inputs file exits with code 2
PASS  Scenario 9: Determinism (Night 3 byte-identical across 2 runs)
      Full Night 3 headless run finished in 101.1 ms
PASS  Scenario 10 (Performance DoD): Full Night 3 (21,600 ticks) <= 30s

Summary: 11/11 checks passed.
```
