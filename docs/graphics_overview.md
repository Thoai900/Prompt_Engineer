# Tổng Quan Về Đồ Họa & Giao Diện (Graphics & Aesthetics Overview)

Dự án **Prompt Builder** được thiết kế với ngôn ngữ giao diện hiện đại, giàu tính thẩm mỹ và tương tác cao. Tài liệu này mô tả chi tiết hệ thống thiết kế (Design System), hiệu ứng chuyển động (Animations) và đồ họa 3D được tích hợp trong ứng dụng.

---

## 1. Ngôn Ngữ Thiết Kế & Thẩm Mỹ (Design System & Aesthetics)

*   **Chủ đề tối (Sleek Dark Mode)**: Giao diện mặc định sử dụng tông màu tối sang trọng với màu nền chủ đạo là các sắc độ của Slate/Slate-950 (`#020617` và `#0f172a`).
*   **Hiệu ứng thủy tinh (Glassmorphism)**: Các bảng điều khiển, modals, và sidebars được thiết kế mờ ảo với lớp kính mờ. Các lớp này sử dụng thuộc tính `backdrop-blur-md`, màu nền bán trong suốt `bg-slate-900/80` kết hợp viền mảnh sáng nhẹ `border-slate-800/50`.
*   **Dải màu chuyển sắc (Gradients)**: Sử dụng các dải màu gradient sinh động như Indigo to Violet (`bg-gradient-to-r from-indigo-500 to-purple-600`), hoặc Slate to Zinc để làm nổi bật các nút hành động chính (Primary Action Buttons), tiêu đề, hoặc trạng thái active của tab.
*   **Thiết kế phản hồi (Responsive Layout)**: Bố cục chia lưới (Grid), Flexbox linh hoạt, tự động co giãn tối ưu cho các kích thước màn hình máy tính bảng và máy tính để bàn lớn.

---

## 2. Hoạt Ảnh & Tương Tác (UI Animations)

Sử dụng thư viện **Motion** (tên mới của Framer Motion, imported từ `motion/react`) để thực hiện các micro-animations tinh tế:

*   **Chuyển đổi thẻ (Tab Transitions)**: Mỗi khi người dùng chuyển đổi tab, toàn bộ nội dung tab mới sẽ được chuyển động mượt mà bằng hiệu ứng mờ dần và trượt nhẹ (`initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}`).
*   **Hộp thoại Modals**: Cửa sổ Modal hiện lên với hiệu ứng co giãn đàn hồi nhẹ (`scale` animation) kết hợp với lớp nền mờ tối dần (`overlay fade`).
*   **Kéo thả Blocks (Drag & Drop Layout)**: Tích hợp hiệu ứng sắp xếp vị trí mượt mà nhờ layout animation của thư viện kéo thả, giúp các khối Prompt tự động trượt về vị trí mới mà không bị giật lag.
*   **Micro-interactions**: Các nút bấm có hiệu ứng phóng to nhẹ khi di chuột qua (`whileHover={{ scale: 1.02 }}`) và thu nhỏ khi nhấn giữ (`whileTap={{ scale: 0.98 }}`).
