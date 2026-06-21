# Tổng Quan Các Tính Năng (Features Overview)

Dự án **Prompt Builder** là một môi trường phát triển tích hợp (IDE) dành cho Prompt Engineering và học tập AI, được xây dựng với 9 thẻ tính năng (Tabs) chính. Tài liệu này mô tả chi tiết chức năng và cơ chế hoạt động của từng thẻ.

---

## 1. Chi Tiết Các Thẻ Tính Năng (Tabs)

### 1.1. Trang Chủ (HomeTab)
*   **Chức năng**: Cung cấp giao diện chào mừng trực quan, nơi người dùng có thể nhập một chủ đề bất kỳ (Topic).
*   **Cơ chế AI**: Sử dụng hàm `generateStructuredTemplateFromTopic` để phân tích chủ đề và trả về một Prompt Template hoàn chỉnh được phân rã sẵn thành các khối vai trò (Role), nhiệm vụ (Task), ngữ cảnh (Context), và định dạng đầu ra (Output format).

### 1.2. Trình Thiết Kế Prompt (BuilderTab)
*   **Chức năng**: Môi trường soạn thảo prompt dạng khối kéo thả (Drag and Drop), cho phép phân tách prompt thành các khối module nhỏ.
*   **Các thành phần chính**:
    *   **Khối (Prompt Blocks)**: Vai trò (Role), Nhiệm vụ (Task), Ngữ cảnh (Context), Ví dụ (Few-shot), Quy tắc (Constraint), Biến số (Variable). Hỗ trợ kéo thả sắp xếp thứ tự thông qua `@hello-pangea/dnd`.
    *   **Bảng quản lý biến (Variables)**: Tự động trích xuất các biến nằm trong cú pháp `{{variable_name}}` hoặc `{{variable_name:fallback}}`. Cho phép người dùng nhập trực tiếp giá trị biến và xem trước prompt sau khi render.
    *   **AI Doctor**: Công cụ phân tích prompt, phát hiện lỗi thiếu logic, mơ hồ hoặc thiếu cấu trúc và đề xuất cách sửa tự động bằng một cú nhấp chuột.
    *   **Chat Playground**: Khung chat giả lập bên cạnh để kiểm thử prompt tức thì với thanh trượt cấu hình nhiệt độ sáng tạo (Temperature).

### 1.3. Chuỗi Dự Án Prompt (ProjectChainTab)
*   **Chức năng**: Cho phép xây dựng chuỗi các prompt liên tiếp (Prompt Workflow / DAG) nơi đầu ra của prompt trước làm đầu vào cho prompt sau.
*   **Các thành phần chính**:
    *   **Canvas đồ thị**: Vẽ các node và các đường liên kết thể hiện luồng xử lý. Người dùng có thể kéo thả node, pan và zoom toàn đồ thị.
    *   **Simulator Panel**: Chạy mô phỏng toàn bộ quy trình từ nút bắt đầu đến nút cuối cùng, hiển thị luồng dữ liệu truyền qua từng node.
    *   **Test Cases Panel**: Chạy thử nghiệm đồng thời nhiều dữ liệu đầu vào. Tự động chấm điểm (Pass/Fail) dựa trên **Tiêu chí đánh giá chất lượng tự động** (AI-based Evaluation Criteria) do người dùng định nghĩa cho toàn bộ dự án.

### 1.4. Trình Cải Tiến AI (EnhancerTab)
*   **Chức năng**: Tối ưu hóa các prompt viết tay đơn giản thành prompt chuyên nghiệp, rõ ràng.
*   **Cấu hình**: Người dùng chọn các chế độ: Cấu trúc (Structure), Ngữ cảnh (Context), Độ rõ ràng (Clarity), và Giọng điệu (Tone) để AI tiến hành viết lại prompt.

### 1.5. Thư Viện Prompt (LibraryTab)
*   **Chức năng**: Bộ sưu tập các mẫu prompt được sắp xếp và phân loại theo nhiều danh mục (Học thuật, Viết lách, Lập trình, Sáng tạo, v.v.).
*   **Hành động**: Hỗ trợ xem trước (Preview), sao chép (Copy), Remix (chuyển thẳng prompt sang tab Builder để chỉnh sửa), và Thêm vào dự án hiện có (Add to project modal).

### 1.6. Vành Đai Tiện Ích (UtilityBeltTab)
*   **Chức năng**: Quản lý cài đặt cấu hình nâng cao của hệ thống.
*   **Cơ chế**: Cho phép thiết lập các System Instruction chung, cấu hình Profile lập trình viên để định hướng cách AI phản hồi.

### 1.7. Quy Tắc & Kỹ Năng (RulesSkillsTab)
*   **Chức năng**: Tạo các Quy tắc ứng xử (AI Rules) và Kỹ năng đặc thù (AI Skills) để đính kèm vào các Prompt Blocks.
*   **Ý nghĩa**: Giúp tái sử dụng các đoạn hướng dẫn hành vi phức tạp (ví dụ: quy tắc định dạng LaTeX, quy tắc không giải hộ bài tập) trên nhiều prompt khác nhau.

### 1.8. Học Tập (LearnTab)
*   **Chức năng**: Hệ thống bài giảng tương tác và trò chơi hóa dành cho học sinh trung học phổ thông tìm hiểu Prompt Engineering.
*   **Quy tắc đặc thù (Gemini Added Memories)**:
    *   **Đóng vai (Persona)**: Trợ lý gia sư AI thân thiện, khuyến khích học sinh.
    *   **Phương pháp Socratic**: Tuyệt đối không giải hộ bài tập hay viết hộ code hoàn chỉnh cho học sinh. Chỉ hướng dẫn từng bước bằng các câu hỏi gợi mở, giúp học sinh tự tìm ra câu trả lời.
    *   **Toán học**: Sử dụng định dạng LaTeX (\(...\) và \[...\]) khi hiển thị các công thức toán học.
    *   **Cấu trúc bài học**:
        *   **Stage 1**: Nhập môn Prompting (Role, Task).
        *   **Stage 2**: Kỹ thuật nâng cao (Few-shot, Chain of Thought).
        *   **Stage 3**: Thực chiến (Chống Prompt Injection, tối ưu hóa).
        *   **Thử thách**: Chế độ sửa lỗi prompt bị hỏng (Debugging Challenge), Đấu đối kháng prompt tốt/xấu (Versus Challenge) và Phòng thí nghiệm theo tên miền chuyên ngành (Domain Labs).

### 1.9. Tương Lai AI (AIFutureTab)
*   **Chức năng**: Hiển thị mô hình 3D tương tác mô phỏng kiến trúc mạng nơ-ron Transformer và các Attention Layers. Cung cấp bảng tin công nghệ real-time để người dùng cập nhật xu hướng AI mới nhất.
