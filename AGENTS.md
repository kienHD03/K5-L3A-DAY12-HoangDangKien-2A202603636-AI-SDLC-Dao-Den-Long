# AGENTS.md — Đảo Đèn Lồng (Phase 3 — Contract v1.2)

## Lệnh cốt lõi
- Cài đặt: `npm install`
- Chạy game 3D: `npm run dev`
- Chạy headless: `node src/headless.js --seed 42 --night 1 --ticks 600 --out out.jsonl` (`--night 1|2|3`)
- Kiểm chứng toàn bộ (unit + regression P1/P2 + scenarios P3 + determinism + benchmark): `npm run verify`

## Kiến trúc bắt buộc
- `src/sim/`: Logic game thuần JS ESM (`maps.js`, `engine.js`, `inputs.js`, `config.js`, `rng.js`), **tuyệt đối không** import Three.js, DOM, hay `Math.random()`.
- `src/render/`: Hiển thị 3D (Three.js), bảng màu chuẩn + chế độ mù màu, Menu/Pause/Settings, HUD, âm thanh Web Audio. Chỉ đọc state từ `GameSim` và gửi input vào `GameSim`.
- `game.contract.json`: Nguồn chân lý duy nhất (Single Source of Truth) cho mọi hằng số `tuning` (Contract v1.2).

## Quy ước Test Contract v1.2
- Fixed timestep `1/60`s; trục Y hướng lên; góc bản đồ đo từ `+X` ngược chiều kim đồng hồ trên mặt phẳng XZ (`x = r*cosθ, z = r*sinθ`).
- Nhiên liệu đèn tính bằng số nguyên `fuelTicks` (đơn vị `1/60` dầu, tối đa `6000` = `100.0`), làm tròn 1 chữ số thập phân khi xuất snapshot; đèn tắt có `fuel: 0`.
- Thứ tự xử lý 12 bước: bước 2 trừ dầu (hao `1/60` + bị hút `5/60` mỗi con `drain`), ngay sau bước 2 tắt đèn có `fuel <= 0` (`lantern_out`).
- Trạng thái Bóng Mực bắt buộc: `spawning`, `wander`, `chase`, `recoil`, `stunned`, `drain`. Đèn có `fuel < 30` mất vùng an toàn (`fuel == 30` vẫn còn).
- Luật thắng mới: không thắng sớm khi thắp hết đèn; thắng khi sống sót tới bình minh (`time_left_s <= 0`) với số đèn sáng `>= ceil(0.6 * total)` (`dawn_survived`). Hết Ngọn Lửa luôn thua `no_flames` trước.
- Điểm mới: `+5`/đom đóm nạp/châm dầu, `+100` thắp lần đầu, `+40` thắp lại (`ever_lit`), `+5` Pulse thường / `+15` Pulse con đang `drain`, bình minh thắng: `+(50 + floor(fuel))`/đèn sáng + `50 * flames`. Bỏ thưởng thời gian.
- Snapshot tick `0` ghi trước khi áp dụng input; dựng `--scenario` không phát event, không cộng điểm, không tăng `successful_lights`.
- Lỗi định dạng file `--inputs` hoặc `--scenario` in lỗi ra `stderr` và thoát mã `2`.

## Quy tắc kiểm chứng & tài liệu
- Không kết thúc task khi `npm run verify` hoặc `npm run build` đang đỏ.
- Không sửa tay file output bằng chứng; mọi bằng chứng phải sinh từ lệnh chạy thật.
- **Không sửa `README.md` gốc của đề lab**; hướng dẫn game ghi trong `GAME_README.md`.
- Khi luật mới thay thế luật cũ, phải cập nhật test kèm lý do rõ ràng (không skip âm thầm), ghi ADR và Changelog.
