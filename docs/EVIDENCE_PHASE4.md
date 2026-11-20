# Bằng chứng Kiểm chứng — Phase 4 (TICKET-04: "Bình minh: phát hành v1.0.0" · Contract v1.3)

## 1. Bảng truy vết Yêu cầu → Bằng chứng

| Yêu cầu TICKET-04 / Contract v1.3 | Ngưỡng đạt | Bằng chứng thật | Kết quả |
|---|---|---|---|
| `game.contract.json` v1.3 có đủ `bench_cmd`, `soak_cmd`, `build_cmd`, `run_cmd`, `headless_cmd` | Đúng schema v1.3 | `game.contract.json` | **Đạt** |
| **Benchmark 1280×720** (`node scripts/bench.js --seed 42 --duration 30 --out bench.json`) | `avg_fps >= 60`, `p1_low_fps >= 30`, `load_ms <= 10000` | `bench.json`: **`avg_fps = 206.2`**, **`p1_low_fps = 93.2`**, `frame_ms_p95 = 6.9 ms`, **`load_ms = 511 ms`**, `frames = 6186`, `vsync_off = true` | **Đạt** |
| **Soak test 10 Đêm** (`node scripts/soak.js --seed 7 --nights 10 --out soak.json`) | `crashes = 0`, `mem_end_mb <= 1.2 * mem_start_mb` | `soak.json`: **`crashes = 0`**, `mem_start_mb = 53.8 MB`, `mem_end_mb = 63.0 MB` (`1.17× <= 1.2×`), `duration_s = 0.28s` | **Đạt** |
| **Bảng xếp hạng cục bộ** (tên 3–12 ký tự, top 10, lưu đĩa, `--export-leaderboard`) | `{"entries": [...]}` đúng thứ tự | `src/sim/leaderboard.js`, `scripts/run.js`, unit test PASS, xuất `tests/out/lb_export.json` thành công | **Đạt** |
| **Trợ năng (Accessibility):** đổi phím 9 hành động chống trùng + khôi phục mặc định; phụ đề hình ảnh + mũi tên hướng Bóng Mực; giảm chuyển động; cỡ chữ UI `>= 18px` + Chữ lớn `×1.25` | Đủ 4 nhóm trợ năng, lưu `localStorage` | `index.html`, `src/style.css` (`--ui-base: 18px`, `body.large-text`, `body.reduced-motion`), `src/render/main.js`, build `dist/` xanh | **Đạt** |
| **Regression Phase 1–3** (`npm run verify`) | Mọi test ẩn còn hiệu lực đều đạt | `npm run verify`: **8/8 PASS** (**14/14 unit tests PASS**, determinism byte-identical) | **Đạt** |
| **Đóng gói, Tài liệu & Retro** (`LICENSE`, `CREDITS.md`, `CHANGELOG.md` 4 phase, `RETRO.md`, `GAME_README.md`) | Đủ tài liệu theo DoD | `LICENSE`, `CREDITS.md`, `docs/CHANGELOG.md`, `docs/RETRO.md`, `GAME_README.md` | **Đạt** |

---

## 2. Kết quả Benchmark thật (`bench.json`)

```json
{
  "contract_version": "1.3",
  "avg_fps": 206.2,
  "p1_low_fps": 93.2,
  "frame_ms_p95": 6.9,
  "frames": 6186,
  "load_ms": 511,
  "peak_mem_mb": 12.6,
  "vsync_off": true,
  "renderer": "Three.js 0.170 / ANGLE (Intel, Intel(R) UHD Graphics (0x00009BC4) Direct3D11 vs_5_0 ps_5_0, D3D11)",
  "os": "win32 10.0.26300 (x64)"
}
```

## 3. Kết quả Soak Test thật (`soak.json`)

```json
{
  "nights": 10,
  "crashes": 0,
  "results": ["lost","lost","lost","lost","lost","lost","lost","lost","lost","lost"],
  "mem_start_mb": 53.8,
  "mem_end_mb": 63,
  "duration_s": 0.28
}
```

## 4. Ảnh chụp màn hình thực tế (1280×720)

- **Menu chính & chọn 3 Đêm / Bảng xếp hạng:** `docs/screenshots/menu.png`
- **Gameplay 3D Đêm 1 & HUD (`>= 18px`):** `docs/screenshots/gameplay.png`
- **Cài đặt, Trợ năng (Mù màu, Giảm chuyển động, Chữ lớn ×1.25, Đổi 9 phím):** `docs/screenshots/settings.png`
