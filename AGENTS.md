# AGENTS.md — Đảo Đèn Lồng

## Lệnh cốt lõi
- Cài đặt: `npm install`
- Chạy game 3D: `npm run dev`
- Chạy headless: `node src/headless.js --seed 42 --night 1 --ticks 600 --out out.jsonl`
- Kiểm chứng toàn bộ (unit + scenario + determinism): `npm run verify`

## Kiến trúc bắt buộc
- `src/sim/`: Logic game thuần JS ESM, **tuyệt đối không** import Three.js, DOM, hay `Math.random()`.
- `src/render/`: Hiển thị 3D (Three.js), HUD, âm thanh Web Audio. Chỉ đọc state từ `GameSim` và gửi input vào `GameSim`.
- `game.contract.json`: Nguồn chân lý duy nhất (Single Source of Truth) cho mọi hằng số `tuning`. Không hardcode số khác trong `src/sim/`.

## Quy ước Test Contract v1.0
- Fixed timestep `1/60`s; mặt đất `Y = 0`; khoảng cách `tuning` đo theo mặt phẳng ngang `XZ` (`dist <= r`).
- Snapshot tick `0` ghi trước khi áp dụng input. Bước `k` đọc input tick `k` → sinh state & event tại `tick = k + 1`.
- Dựng `--scenario` không phát event và không cộng điểm.
- Lỗi định dạng file `--inputs` hoặc `--scenario` phải in lỗi ra `stderr` và thoát mã `2`.
- Cùng `--seed`, `--scenario`, `--inputs` phải cho output JSONL giống hệt nhau từng byte.
- Mọi tính năng sáng tạo (âm thanh, hiệu ứng, trang trí) chỉ chạy ở `src/render/`, không thay đổi output headless.

## Quy tắc kiểm chứng & tài liệu
- Không kết thúc task khi `npm run verify` đang đỏ.
- Không sửa tay file output bằng chứng; mọi bằng chứng phải sinh từ lệnh chạy thật.
- **Không sửa `README.md` gốc của đề lab**; mọi hướng dẫn cài đặt/chạy/sáng tạo của game ghi trong `GAME_README.md`.
