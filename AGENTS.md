# AGENTS.md — Đảo Đèn Lồng (Phase 2 — Contract v1.1)

## Lệnh cốt lõi
- Cài đặt: `npm install`
- Chạy game 3D: `npm run dev`
- Chạy headless: `node src/headless.js --seed 42 --night 1 --ticks 600 --out out.jsonl` (hỗ trợ `--night 1|2|3`)
- Kiểm chứng toàn bộ (unit + scenario Phase 1/2 + determinism + benchmark): `npm run verify`

## Kiến trúc bắt buộc
- `src/sim/`: Logic game thuần JS ESM (`maps.js`, `engine.js`, `inputs.js`, `config.js`, `rng.js`), **tuyệt đối không** import Three.js, DOM, hay `Math.random()`.
- `src/render/`: Hiển thị 3D (Three.js), bảng màu chuẩn, Menu/Pause/Settings, HUD, âm thanh Web Audio. Chỉ đọc state từ `GameSim` và gửi input vào `GameSim`.
- `game.contract.json`: Nguồn chân lý duy nhất (Single Source of Truth) cho mọi hằng số `tuning` (Contract v1.1).

## Quy ước Test Contract v1.1
- Fixed timestep `1/60`s; trục Y hướng lên; góc bản đồ đo từ `+X` ngược chiều kim đồng hồ trên mặt phẳng XZ (`x = r*cosθ, z = r*sinθ`).
- Tuân thủ đúng **thứ tự 12 bước trong 1 tick** (xử lý `pause` đầu tiên; khi paused `tick` tăng nhưng `sim_tick` và mọi timer đứng yên).
- Trạng thái Bóng Mực bắt buộc dùng đúng tên: `spawning`, `wander`, `chase`, `recoil`, `stunned`.
- Điểm chuẩn hóa: `+10` mỗi đom đóm **nạp**, `+100` mỗi đèn thắp, `+5` mỗi Bóng Mực trúng Pulse, `+floor(time_left_s)*2 + flames*50` khi thắng.
- Snapshot tick `0` ghi trước khi áp dụng input; dựng `--scenario` không phát event và không cộng điểm.
- Lỗi định dạng file `--inputs` hoặc `--scenario` in lỗi ra `stderr` và thoát mã `2`.
- Chạy headless một Đêm đầy đủ (tối đa `21.600` tick) phải xong trong `≤ 30` giây và tất định từng byte.
- Mọi tính năng sáng tạo chỉ chạy ở `src/render/`, không thay đổi output headless.

## Quy tắc kiểm chứng & tài liệu
- Không kết thúc task khi `npm run verify` hoặc `npm run build` đang đỏ.
- Không sửa tay file output bằng chứng; mọi bằng chứng phải sinh từ lệnh chạy thật.
- **Không sửa `README.md` gốc của đề lab**; hướng dẫn game ghi trong `GAME_README.md`.
- Khi yêu cầu phase sau thay đổi luật phase trước, phải cập nhật test kèm lý do rõ ràng trong `docs/SPEC_PHASE2.md`.
