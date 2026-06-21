# Tổng Quan Cấu Trúc Dự Án (Project Structure Overview)

Tài liệu này cung cấp cái nhìn toàn cảnh về cấu trúc thư mục, kiến trúc mã nguồn và các thành phần cốt lõi của dự án **Prompt Builder**. Nó giúp các AI Agent nhanh chóng làm quen và hiểu được tổ chức file của codebase trong mỗi phiên làm việc.

---

## 1. Bản Đồ Thư Mục Dự Án (Directory Map)

Dự án được viết bằng **React**, **Vite**, **TypeScript**, và **Tailwind CSS v4**.

```
Prompt_Builder-main/
├── .firebase/                  # Firebase hosting cache & config tạm
├── archive/                    # Lưu trữ mã nguồn cũ, file nháp, file dump dữ liệu
├── dist/                       # Thư mục build đầu ra (production assets)
├── docs/                       # Tài liệu hướng dẫn & tổng quan dự án (Agent Readme)
│   ├── project_structure.md    # [Tài liệu này] Tổng quan cấu trúc dự án
│   ├── features_overview.md    # Tổng quan về tính năng chi tiết các Tabs
│   └── graphics_overview.md    # Tổng quan về thiết kế đồ họa, animation và 3D
├── public/                     # Static assets (images, icons)
├── src/                        # Thư mục mã nguồn chính
│   ├── __tests__/              # Bộ kiểm thử Unit Test (Vitest)
│   ├── components/             # Các React Components
│   │   ├── builder/            # Các component con của tính năng Prompt Builder
│   │   ├── common/             # Các UI component dùng chung (Renderer, Card...)
│   │   ├── learn/              # Các bài học, game thử thách học Prompt
│   │   ├── modals/             # Các cửa sổ bật lên (Modals) dùng chung
│   │   ├── project-chain/      # Các component con của Canvas chuỗi Prompt
│   │   └── tabs/               # 9 trang màn hình chính (Tabs) tương ứng navigation
│   ├── context/                # Trạng thái toàn cục (React Context)
│   ├── hooks/                  # Custom Hooks đóng gói logic nghiệp vụ
│   ├── services/               # Lớp gọi API ngoài và xử lý AI
│   ├── utils/                  # Hàm tiện ích trợ giúp (Helper functions)
│   ├── App.tsx                 # Giao diện chính, điều phối navigation và theme
│   ├── main.tsx                # Entrypoint khởi tạo React
│   ├── index.css               # CSS toàn cục và định hình Design System
│   ├── types.ts                # Định nghĩa kiểu TypeScript (TypeScript interfaces)
│   ├── data.ts                 # Dữ liệu tĩnh (Templates mặc định, gợi ý)
│   └── presets.ts              # Dữ liệu mẫu (Rules & Skills có sẵn)
├── .env                        # Chứa API key và biến môi trường (không commit)
├── firebase.json               # Cấu hình Firebase Hosting & Firestore rules
├── package.json                # Định nghĩa dependency và scripts chạy dự án
├── tsconfig.json               # Cấu hình trình biên dịch TypeScript
└── vite.config.ts              # Cấu hình đóng gói Vite
```

---

## 2. Các Thành Phần Kiến Trúc Cốt Lõi (Core Architectural Components)

### 2.1. Quản lý trạng thái toàn cục (React Context)
*   **[WorkspaceContext.tsx](file:///c:/Users/THOAI%20PC/Prompt_Builder-main/src/context/WorkspaceContext.tsx)**:
    *   Lưu trữ thông tin người dùng hiện tại (Firebase User).
    *   Quản lý danh sách API Key (Gemini API Key, OpenAI API Key) trong bộ nhớ LocalStorage.
    *   Quản lý dự án / Workspace đang hoạt động để chia sẻ dữ liệu giữa các tab mà không cần prop-drilling.

### 2.2. Đóng gói logic nghiệp vụ (Custom Hooks)
Nằm trong thư mục `src/hooks/`, tách biệt hoàn toàn Logic khỏi giao diện UI:
*   **[usePromptBlocks.ts](file:///c:/Users/THOAI%20PC/Prompt_Builder-main/src/hooks/usePromptBlocks.ts)**: Quản lý trạng thái, thao tác CRUD block, undo/redo lịch sử, biên dịch prompt và trích xuất biến số trong tab Builder.
*   **[usePlaygroundSession.ts](file:///c:/Users/THOAI%20PC/Prompt_Builder-main/src/hooks/usePlaygroundSession.ts)**: Quản lý trạng thái chat, gửi tin nhắn, lưu lịch sử trò chuyện và giao tiếp trực tiếp với AI stream service.
*   **[useCanvasInteraction.ts](file:///c:/Users/THOAI%20PC/Prompt_Builder-main/src/hooks/useCanvasInteraction.ts)**: Xử lý các sự kiện di chuột kéo thả (pan/drag), phóng to/thu nhỏ (zoom) và tính toán tọa độ tự động dàn trang (auto-layout) cho sơ đồ Canvas.
*   **[useProjectPipeline.ts](file:///c:/Users/THOAI%20PC/Prompt_Builder-main/src/hooks/useProjectPipeline.ts)**: Quản lý vòng đời thực thi các Node trong chuỗi, tổng hợp biến số, chạy thử nghiệm hàng loạt (test cases) và chấm điểm chất lượng.

### 2.3. Lớp Dịch Vụ AI (Services)
*   **[aiService.ts](file:///c:/Users/THOAI%20PC/Prompt_Builder-main/src/services/aiService.ts)**:
    *   Điểm giao tiếp chính với các mô hình ngôn ngữ lớn (LLMs). Tích hợp thư viện mới nhất `@google/genai` để gọi mô hình Gemini (Gemini 2.5 Flash, v.v.).
    *   Cung cấp các API: stream chat, tự động tối ưu prompt (Prompt Enhancer), trợ lý chẩn đoán lỗi prompt (AI Doctor), sinh block tự động (Auto-Block Generator) và đánh giá chất lượng prompt theo tiêu chí thiết lập trước.

---

## 3. Bộ Kiểm Thử (Unit Testing)

Sử dụng framework **Vitest** để kiểm tra tính toàn vẹn của logic nghiệp vụ:
*   **[helpers.test.ts](file:///c:/Users/THOAI%20PC/Prompt_Builder-main/src/__tests__/helpers.test.ts)**: Kiểm tra các hàm regex làm sạch JSON (`sanitizeJsonString`, `extractJson`) và trình biên dịch chuỗi prompt tiến hóa của các nodes trong cây.
*   **[usePromptBlocks.test.ts](file:///c:/Users/THOAI%20PC/Prompt_Builder-main/src/__tests__/usePromptBlocks.test.ts)**: Kiểm tra phản ứng của hook quản lý block (thêm, cập nhật, xóa, trích xuất biến số, gán giá trị biến).

Lệnh chạy kiểm thử: `npm run test` (chạy vitest).
Lệnh kiểm tra kiểu: `npm run lint` (chạy tsc --noEmit).
