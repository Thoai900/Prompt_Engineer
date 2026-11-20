# Tiện ích trình duyệt PromptBuilder

Gọi thư viện prompt ngay trong ChatGPT, Claude, Gemini: tìm prompt, điền `{{biến}}`, chèn vào ô soạn tin.
Chrome / Edge / Brave (Manifest V3). Không cần build — thuần JavaScript.

## Cài (chế độ nhà phát triển)

1. Mở `chrome://extensions`, bật **Developer mode**.
2. **Load unpacked** → chọn thư mục `extension/` này.
3. (Tuỳ chọn) Ghim tiện ích lên thanh công cụ. Phím tắt mở nhanh: **Alt+Shift+P**.

## Đồng bộ thư viện

1. Mở PromptBuilder → **Thư viện** → nút **"Đồng bộ sang tiện ích"**.
2. Lần đầu, tiện ích hỏi xác nhận cho trang đó (chống trang lạ nhét prompt). Đồng ý một lần là nhớ.
3. Gói gồm template **Của tôi** và các template **đã lưu** (bookmark). Mỗi lần đồng bộ thay toàn bộ danh sách.

Trang PromptBuilder được nhận diện ở `*.vercel.app` và `localhost`. Nếu bạn chạy app ở **tên miền riêng**,
thêm tên miền đó vào `matches` của content script đầu tiên trong `manifest.json` rồi tải lại tiện ích.

## Dùng

Mở trang chat → bấm biểu tượng tiện ích (hoặc Alt+Shift+P) → gõ để tìm (không cần dấu) → Enter →
điền biến → **Chèn vào trang**. Trang khác hoặc không tìm thấy ô soạn tin: tiện ích tự **sao chép** để bạn dán.

## Cấu trúc

| File | Vai trò |
| --- | --- |
| `lib/core.js` | Logic thuần (kiểm gói, tìm kiếm, điền biến) — test ở `src/__tests__/extensionCore.test.ts` |
| `sync.js` | Content script trên trang PromptBuilder: nhận gói qua `postMessage`, xác nhận, lưu `chrome.storage` |
| `insert.js` | Content script trên trang chat: chèn văn bản vào ô soạn tin |
| `popup.*` | Giao diện tìm / điền biến / chèn |

Định dạng gói khớp `src/utils/extensionBridge.ts` phía app.
