# ADR-001: Chuyển mô hình Đèn Lồng sang Nhiên liệu nguyên (`fuelTicks`) & Luật thắng Sống sót tới Bình Minh

- **Trạng thái:** Đã áp dụng (Phase 3 — TICKET-03, Contract v1.2)
- **Bối cảnh:** Ở Phase 1–2, đèn thắp xong sáng vĩnh viễn và game thắng ngay (`all_lit`) khi đủ đèn, khiến nửa sau Đêm thiếu kịch tính. TICKET-03 yêu cầu đèn hao dầu liên tục, Bóng Mực hút dầu đèn yếu (`fuel < 30`), và mục tiêu chuyển sang duy trì ánh sáng tới bình minh (`dawn_survived`).

## 1. Quyết định về mô hình trạng thái Đèn Lồng
- **Lưu nhiên liệu bằng số nguyên `fuelTicks` (đơn vị `1/60` fuel, phạm vi `0..6000`):**
  - Tránh hoàn toàn sai số cộng dồn dấu phẩy động (`0.1 + 0.2 !== 0.3`) trên 18.000+ tick và đảm bảo tính tất định byte-by-byte giữa các nền tảng.
  - Ngưỡng `fuel < 30` tương ứng chính xác `fuelTicks < 1800` (đúng `1800` tức `30.0` vẫn giữ vùng an toàn `safe_radius`).
  - Hao hụt tự nhiên = `-1 fuelTick/tick`; mỗi Bóng Mực ở trạng thái `drain` trừ thêm `-5 fuelTicks/tick`; mỗi đom đóm châm dầu cộng `+600 fuelTicks`.
- **Tách `everLit` và `relitCount` khỏi `lit`:**
  - Khi `fuelTicks <= 0`, đèn tắt (`lit = false`, `deposited = 0`, `fuelTicks = 0`) nhưng vẫn giữ `everLit = true` để lần thắp lại chỉ tốn `5` đom đóm (`relight_cost`) và thưởng `+40` điểm thay vì `+100`.
  - Khi tương tác, bộ chọn đèn chỉ xét đèn *nhận được đom đóm* (`!lit || fuelTicks < 6000`), ưu tiên gần nhất rồi tới `id` nhỏ hơn. Đèn đầy dầu không bị chọn và không phát sự kiện.

## 2. Quyết định về AI Bóng Mực (`drain`) và Vùng an toàn
- Bổ sung trạng thái thứ 6 `drain` vào máy trạng thái Bóng Mực (`spawning`, `wander`, `chase`, `recoil`, `stunned`, `drain`).
- Tách hàm kiểm tra vùng an toàn thành `hasSafeRadius(lantern) = lantern.lit && lantern.fuelTicks >= 1800`.
- Chỉ Bóng Mực ở trạng thái `wander` mới đi tìm đèn yếu (`fuel < 30`) gần nhất; khi vào `<= 2m` chuyển sang `drain`, ghi sự kiện `fuel_drain` mỗi `60` tick.
- Nếu đèn được châm dầu từ `< 30` lên `>= 30`, mọi Bóng Mực trong bán kính `6m` bị đẩy ra mép trong tối đa `30` tick và không gây sát thương trong lúc bị đẩy.

## 3. Quyết định về Luật thắng mới & Sức chứa tăng dần
- Loại bỏ nhánh thắng sớm `all_lit` ở Bước 11; bổ sung kiểm tra `timeLeftS <= 0` với ngưỡng `litCount >= Math.ceil(0.6 * lanterns.length)` → `dawn_survived` (ngược lại `dawn`). Nhánh `flames <= 0` (`no_flames`) luôn được ưu tiên xét trước cả `dawn_survived`.
- Sức chứa tính động qua getter `getPlayerCapacity() = Math.min(20, 10 + 2 * player.successfulLights)`. Đèn đặt sẵn bằng `--scenario` không làm tăng `successfulLights`.

## 4. Hệ quả với bộ test cũ
- Các test Phase 1/2 kiểm tra thắng sớm `all_lit`, điểm `+10`/đom đóm nạp, thưởng thời gian, và đèn sáng không nhận thêm đom đóm đều bị thay thế bởi luật mới. Toàn bộ các test này đã được **cập nhật rõ ràng** theo Contract v1.2 trong `tests/unit.test.js` và `scripts/verify-phase3.js` (không skip âm thầm).
