# Bằng chứng Kiểm chứng — Phase 3 (TICKET-03: "Đèn cạn dầu" · Contract v1.2)

## 1. Bảng truy vết Yêu cầu → Bằng chứng

| Yêu cầu TICKET-03 / Contract v1.2 | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| `game.contract.json` v1.2 đủ khóa mới & thời lượng Đêm 240/270/300s | `src/sim/config.js` đọc trực tiếp | `game.contract.json`, `src/sim/config.js` | **Đạt** |
| Nhiên liệu nguyên (`fuelTicks = 1/60`), hao `1.0/s`, tắt đèn `lantern_out`, thắp lại tốn `5` (`relight: true`, `+40`) | Unit test + Scenario 2 | `tests/unit.test.js`, `scripts/verify-phase3.js` Scenario 2 (PASS) | **Đạt** |
| Châm dầu (`refuel`, `ceil((100-fuel)/10)`), bỏ qua đèn đầy dầu | Unit test + Scenario 3 | `tests/unit.test.js`, `verify-phase3.js` Scenario 3 (PASS) | **Đạt** |
| Bóng Mực hút dầu (`drain`, `5/s`, `fuel_drain` mỗi 60 tick), mất vùng an toàn `< 30` (đúng `30` còn), Pulse con `drain` `+15`, châm dầu lên `>= 30` đẩy ra | Unit tests + Scenario 3 | `tests/unit.test.js`, `verify-phase3.js` Scenario 3 (PASS) | **Đạt** |
| Luật thắng mới (`dawn_survived` khi `lit >= ceil(0.6 * total)` lúc hết giờ, không thắng sớm, `no_flames` luôn ưu tiên trước) | Unit test + Scenario 1 | `tests/unit.test.js`, `verify-phase3.js` Scenario 1 (PASS) | **Đạt** |
| Sức chứa tăng dần (`10 + 2 * successful_lights`, max `20`) | Unit test + Scenario 2 | `tests/unit.test.js`, `verify-phase3.js` Scenario 2 (PASS) | **Đạt** |
| Chế độ mù màu ("Bảng màu dễ phân biệt": `#00B3FF`, `#FFFFFF + ⚠`, đèn tắt xẹp 20% + vết rách, thanh dầu 3D & nhấp nháy 1 Hz) | Build `npm run build` + kiểm tra DOM/Three.js | `index.html`, `src/style.css`, `src/render/main.js` | **Đạt** |
| ADR + Changelog breaking changes + Regression Phase 1–2 + Determinism + Hiệu năng | Tài liệu + `verify-phase3.js` Scenarios 4–7 | `docs/ADR_PHASE3_FUEL_AND_WIN.md`, `docs/CHANGELOG.md`, `verify-phase3.js` (8/8 PASS, 18.000 ticks trong `215.0 ms`) | **Đạt** |

## 2. Kết quả chạy `npm run verify` thực tế

```text
✔ PRNG is deterministic for the same seed (1.169ms)
✔ transformMove matches Test Contract formula and normalizes length > 1 (0.2272ms)
✔ Phase 3 lighting: deposit (+5/mote), first light (+100, relight:false), no early win, capacity +2 (2.1019ms)
✔ Phase 3 fuel decay, lantern_out, relight cost 5 (+40 score, relight:true) (0.4056ms)
✔ Phase 3 refuel: ceil((100-fuel)/10) motes, full lantern skipped (0.5688ms)
✔ Phase 3 shade drain: fuel < 30 loses safe_radius, drains 5/s, Pulse gives +15 score (0.8526ms)
✔ Phase 3 win at dawn: >= 3/5 lit -> dawn_survived + dawn score; < 3/5 -> dawn loss (0.4254ms)
✔ Shade cannot enter safe_radius when lantern fuel >= 30 (0.9036ms)
✔ Dash moves at 14 m/s for 12 ticks, holds air altitude, triggers 90-tick cooldown (0.365ms)
✔ Pause freezes sim_tick, time_left_s, and lantern fuel (0.2413ms)
✔ Drifter steals up to 3 motes and drops them when hit by Pulse while fleeing (0.5284ms)
✔ Night 2 & Night 3 jump pads land on target islands/tiers (1.1806ms)
✔ validateInputs rejects non-increasing ticks (0.9103ms)
ℹ tests 13 | pass 13 | fail 0
PASS  Unit tests (node --test)
PASS  Scenario 1 (P3 Dawn Survived): 3/5 lit at dawn -> won (dawn_survived)
PASS  Scenario 2 (P3 Fuel/Relight/Capacity): lantern_out -> relight (5 motes) -> capacity 12
PASS  Scenario 3 (P3 Drain & Refuel): Shade drains weak lantern -> refuel pushes shade out
PASS  Scenario 4 (P1/P2 Regression): Shade hit -> Lose (no_flames)
PASS  Scenario 5 (P2 Regression): Night 2 Drifter steal/drop + Charm
PASS  Scenario 6: Malformed inputs file exits with code 2
      Full Night 3 (18,000 ticks) finished in 215.0 ms
PASS  Scenario 7 (Determinism + Performance): Full Night 3 (18,000 ticks) byte-identical & <= 30s

Summary: 8/8 checks passed.
```
