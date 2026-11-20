# AGENTS.md — Đảo Đèn Lồng (Phase 4 — Contract v1.3 · Release v1.0.0)

## Lệnh cốt lõi
- Cài đặt & build: `npm install && npm run build`
- Chạy game 3D: `node scripts/run.js` (hoặc `npm run dev`)
- Xuất bảng xếp hạng: `node scripts/run.js --export-leaderboard out.json`
- Chạy headless: `node src/headless.js --seed 42 --night 1 --ticks 600 --out out.jsonl` (`--night 1|2|3`)
- Benchmark 1280×720: `node scripts/bench.js --seed 42 --duration 30 --out bench.json`
- Soak test 10 Đêm: `node scripts/soak.js --seed 7 --nights 10 --out soak.json`
- Kiểm chứng toàn bộ: `npm run verify`

## Kiến trúc bắt buộc
- `src/sim/`: Logic game thuần JS ESM (`maps.js`, `engine.js`, `inputs.js`, `config.js`, `rng.js`, `leaderboard.js`), **tuyệt đối không** import Three.js, DOM, hay `Math.random()`.
- `src/render/`: Hiển thị 3D (Three.js + InstancedMesh cho hiệu năng benchmark), bảng màu chuẩn + chế độ mù màu, đổi phím + phụ đề hình ảnh + giảm chuyển động + cỡ chữ ≥ 18px, Menu/Pause/Settings/Leaderboard, HUD, Web Audio.
- `game.contract.json`: Nguồn chân lý duy nhất (Single Source of Truth) cho Contract v1.3.

## Quy ước Test Contract v1.3
- Mọi luật v1.0–v1.2 giữ nguyên: fixed timestep `1/60`s, nhiên liệu nguyên `fuelTicks`, 12 bước/tick, 6 trạng thái Bóng Mực (`spawning`, `wander`, `chase`, `recoil`, `stunned`, `drain`), luật thắng `dawn_survived`.
- Benchmark (`bench_cmd`): cửa sổ `1280×720`, 200 Bóng Mực `wander`, 100 đom đóm, `L1–L3` sáng `fuel=100`, camera quay tròn `r=30, Y=15`, `15s/vòng`, 3s khởi động + `--duration` giây đo, tắt hiệu ứng sáng tạo ngoài cảnh chuẩn.
- Soak test (`soak_cmd`): 10 Đêm liên tiếp trong cùng tiến trình (`1→2→3` xoay vòng, seed `base+i`), `crashes = 0`, `mem_end_mb <= 1.2 * mem_start_mb`.

## Quy tắc kiểm chứng & tài liệu
- Không kết thúc task khi `npm run verify` hoặc `npm run build` đang đỏ.
- Không sửa tay file output bằng chứng (`bench.json`, `soak.json`, JSONL); mọi bằng chứng phải sinh từ lệnh chạy thật.
- **Không sửa `README.md` gốc của đề lab**; hướng dẫn game ghi trong `GAME_README.md`.
