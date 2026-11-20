# Bằng chứng Kiểm chứng — Phase 1 (Đêm 1: Đảo Bến)

## 1. Bảng truy vết Yêu cầu → Bằng chứng

| Yêu cầu PRD-0 / Contract | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| `game.contract.json` đúng chuẩn v1.0, khớp thông số game | `src/sim/config.js` đọc trực tiếp từ `game.contract.json` (Single Source of Truth) | `game.contract.json`, `src/sim/config.js` | **Đạt** |
| Chạy headless 60 tick/s, snapshot tick 0, output JSONL có `snapshot`, `event`, `end` | `npm run verify` (Scenario 1–5) | `scripts/verify-phase1.js` (PASS) | **Đạt** |
| Nhặt đom đóm, nạp đèn, thắp đủ 5 đèn → thắng (`all_lit`) & tính điểm đúng | Unit test + Headless Scenario 1 | `tests/unit.test.js`, `verify-phase1.js` Scenario 1 (PASS) | **Đạt** |
| Bóng Mực đuổi, chạm mất máu + rơi đom đóm → hết máu thua (`no_flames`) | Headless Scenario 2 | `verify-phase1.js` Scenario 2 (PASS) | **Đạt** |
| Hết thời gian Đêm 1 → thua (`dawn`) | Headless Scenario 3 | `verify-phase1.js` Scenario 3 (PASS) | **Đạt** |
| Tỏa sáng (Pulse) tốn ánh sáng, đẩy lùi & làm choáng (`stunned`) Bóng Mực | Unit test + Headless Scenario 4 | `tests/unit.test.js`, `verify-phase1.js` Scenario 4 (PASS) | **Đạt** |
| Bóng Mực không đi vào `safe_radius` quanh đèn đã sáng | Unit test | `tests/unit.test.js` (`shade cannot enter safe_radius`) (PASS) | **Đạt** |
| Rơi khỏi đảo không rào chắn (`fall_enabled: true`) → mất máu (`by: "fall"`) & hồi sinh | Unit test + Headless Scenario 5 | `tests/unit.test.js`, `verify-phase1.js` Scenario 5 (PASS) | **Đạt** |
| Lỗi định dạng file inputs/scenario thoát mã `2` kèm thông báo `stderr` | Unit test + Headless Scenario 6 | `verify-phase1.js` Scenario 6 (PASS) | **Đạt** |
| Tính tất định (cùng seed + scenario + inputs → output giống hệt nhau) | Headless Scenario 7 (so sánh byte-by-byte 2 lần chạy 600 ticks) | `verify-phase1.js` Scenario 7 (PASS) | **Đạt** |
| Bản 3D chơi được (Mây nón lá + đèn nhỏ, 5 đèn sáng dần, HUD, chơi lại) | Build bundle (`npm run build`) + chạy thực tế trên trình duyệt (`npm run dev`) | `dist/` build sạch không lỗi; `src/render/main.js` | **Đạt** |

## 2. Kết quả chạy `npm run verify` thực tế

```text
✔ PRNG is deterministic for the same seed (0.8591ms)
✔ transformMove matches Test Contract formula and normalizes length > 1 (0.251ms)
✔ mote pickup, deposit, lantern_lit, and win condition (0.9695ms)
✔ pulse stuns and pushes shades in pulse_radius (0.8726ms)
✔ shade cannot enter safe_radius of a lit lantern (0.8133ms)
✔ falling off island triggers player_hit by fall and respawns (0.3777ms)
✔ validateInputs rejects non-increasing ticks (0.5461ms)
PASS  Unit tests (node --test)
PASS  Scenario 1: Pickup -> Deposit -> Lantern Lit -> Win (all_lit)
PASS  Scenario 2: Shade hit -> drop motes -> Lose (no_flames)
PASS  Scenario 3: Timeout -> Lose (dawn)
PASS  Scenario 4: Pulse stuns and pushes Shade
PASS  Scenario 5: Walk off island -> player_hit (fall)
PASS  Scenario 6: Malformed inputs file exits with code 2
PASS  Scenario 7: Determinism (2 runs with same seed/inputs are byte-identical)

Summary: 8/8 checks passed.
```
