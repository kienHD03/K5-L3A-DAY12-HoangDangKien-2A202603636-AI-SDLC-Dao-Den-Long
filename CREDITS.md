# Credits & Attributions — Đảo Đèn Lồng

## 1. Thư viện & Công cụ mã nguồn mở
- **Three.js** (`^0.170.0`, MIT License): Engine dựng hình 3D WebGL.
- **Vite** (`^6.0.0`, MIT License): Công cụ phát triển và đóng gói bundle web tĩnh.
- **Node.js** (`>= 20`, MIT License): Runtime cho chế độ headless, test tự động, soak test, benchmark và máy chủ cục bộ.

## 2. Tài nguyên đồ họa & Âm thanh
- **Mô hình 3D & Bối cảnh:** 100% dựng thủ tục (procedural geometry) bằng Three.js trong mã nguồn (`src/render/main.js`), không sử dụng model ngoài.
- **Âm thanh & Nhạc nền:** 100% tổng hợp trực tiếp bằng Web Audio API trong `src/render/audio.js`, không sử dụng file audio ngoài.
- **Nhân vật & Bối cảnh cốt truyện:** Dựa trên đề bài gốc *Đảo Đèn Lồng* (Day 12 AI SDLC Lab).

## 3. Công cụ AI hỗ trợ phát triển
- **Antigravity (Google DeepMind)** — hỗ trợ lập kế hoạch, sinh mã nguồn, viết kịch bản kiểm chứng, kiểm thử tự động và tài liệu qua 4 phase dưới sự điều phối, kiểm duyệt và chạy kiểm chứng thật của sinh viên.
