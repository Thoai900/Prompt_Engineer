# Cấu trúc Landing Page: PromptBuilder

Landing Page giới thiệu phần mềm **PromptBuilder** được xây dựng với định hướng thiết kế tối giản cao cấp (dark glassmorphism), kết hợp các gam màu HSL chọn lọc (Violet - Cyan) và các khối Bento hiện đại.

---

## 1. Thanh Điều hướng (Navigation Bar)
* **Logo**: Biểu tượng chữ "P" gradient và nhãn hiệu `PromptBuilder`.
* **Menu liên kết**:
  * *Tính năng*: Bento grid các điểm giá trị cốt lõi.
  * *Prompt Graph*: Tính năng lập trình visual prompt v3.
  * *Prompt Lab*: 7 chế độ thí nghiệm AI nâng cao.
  * *Quy trình*: Chuỗi workflow 6 bước của Prompt Studio.
  * *Công nghệ*: Nền tảng kỹ thuật.
* **Nút hành động (CTA)**: "Khởi chạy Ứng dụng" (Nút nổi bật viền gradient phát sáng).

---

## 2. Phần Đầu trang (Hero Section)
* **Khẩu hiệu chính (Tagline)**: ⚡ Kỹ nghệ câu lệnh chuyên nghiệp.
* **Tiêu đề chính (Headline)**: Lập trình Prompt Bằng Đồ thị Trực quan.
* **Nội dung phụ**: Giới thiệu khái niệm chuyển dịch Prompt từ phỏng đoán sang quy trình khoa học chuẩn hóa, giới thiệu tính năng kéo thả node, kiểm thử tự động, linter và tối ưu tiến hóa.
* **Hình ảnh minh họa chính**: Mockup giao diện Dashboard của PromptBuilder thực tế do AI sinh ra (lưu tại `./public/prompt_builder_hero_dashboard.png`), hiển thị canvas chỉnh sửa node-graph trực quan ở bên trái và khung chat preview kết quả ở bên phải.

---

## 3. Bento Grid - Tuyên ngôn Giá trị (Value Proposition)
Hệ thống bento grid 5 ô mô tả các giá trị kỹ nghệ DevOps được đưa vào Prompt Engineering:
* **Đồ thị Node Graph trực quan**: Quản lý các prompt chain lớn qua canvas kéo thả, chống lặp code.
* **Tối ưu hóa tự động bằng AI**: Giải thuật tiến hóa chạy nền tự động cải tiến prompt.
* **Kiểm thử hồi quy (Health)**: CI/CD liên tục giám sát chất lượng prompt, chống lỗi phát sinh khi LLM cập nhật.
* **So tài Mô hình (Bake-off)**: Thử nghiệm song song Gemini, Groq, Llama để đo tốc độ, chi phí và chất lượng.
* **Rules & Skills Mô-đun hóa**: Tách biệt logic quy tắc hệ thống và kỹ năng bổ sung để tái sử dụng nhanh.

---

## 4. Chi tiết Tính năng 1: Prompt Graph (Project Chain v3)
* **Khái niệm**: Lập trình luồng prompt động trực quan tương tự Blender hoặc Unreal Engine.
* **Mô tả cấu trúc đồ thị node (Simulated Node Layout)**:
  * *Node URL Data Fetcher*: Tự động cào dữ liệu từ URL truyền vào.
  * *Node Format Preset*: Chỉnh định dạng, tone giọng bằng thanh trượt/dropdown.
  * *Node Core Prompt Compiler*: Tổng hợp dữ liệu từ các node trên qua cú pháp `{{biến}}` và kết xuất prompt cuối.
  * *Vòng lặp tự sửa lỗi (Self-Correction)*: Thử nghiệm, phân tích lỗi và sửa tự động tối đa 3 lần.

---

## 5. Chi tiết Tính năng 2: Prompt Lab (Bảng Tương tác Tab)
Thanh Tab tương tác (sử dụng Alpine.js) giúp khám phá chi tiết 7 chế độ thử nghiệm nâng cao của phòng Lab:
* **Auto-Optimizer**: Tự động cải tiến thế hệ prompt dựa trên benchmark.
* **Bake-off**: So tài và đo thông số latencies (ms) giữa các mô hình.
* **Prompt Health**: Kịch bản chạy test suite hồi quy PASS/FAIL.
* **Linter**: Cảnh báo lỗi cú pháp tĩnh và anti-pattern để tiết kiệm token.
* **Chain ➔ App**: Đóng gói đồ thị prompt thành một URL Web App có thể chia sẻ công khai ngay lập tức.

---

## 6. Chi tiết Tính năng 3: Quy trình Prompt Studio 6 Bước
Thanh Stepper và khung Preview tương tác trực tiếp thể hiện 6 giai đoạn phát triển prompt khép kín:
1. **Idea (Ý tưởng thô)**: Nhập mô tả tác vụ bằng tiếng Việt tự nhiên.
2. **Draft (Dựng khung)**: Phân rã thành cấu trúc Multi-block (Vai trò, Ràng buộc, Đầu ra).
3. **Enhance (Tăng cường)**: Chèn thêm Rule hệ thống & Skill nghiệp vụ từ thư viện.
4. **Check (Kiểm định)**: Quét lỗi tĩnh qua Linter và chạy test suite (Đạt điểm số 98/100).
5. **Polish (Đánh bóng)**: Lồng ghép Persona cá tính (ví dụ: Gia sư Socratic giải toán LaTeX).
6. **Finish (Đóng gói)**: Xuất bản endpoint API và lưu đồng bộ đám mây đám mây.

---

## 7. Kiến trúc Công nghệ (Tech Stack)
* **React 19 & Vite**: Đảm bảo tốc độ render và tối ưu hóa bundles.
* **Firebase Suite**: Auth (Google) bảo mật và Firestore realtime sync.
* **Vercel API Proxy**: Các serverless function che giấu API keys an toàn và hỗ trợ cào dữ liệu.
* **Tailwind CSS v4**: Hệ thống utility class và HSL theme mượt mà.
