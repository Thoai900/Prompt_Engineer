# Thiết kế: "Tạo nhanh prompt từ ý tưởng" trong Prompt Builder

- **Ngày:** 2026-06-27
- **Trạng thái:** Đã duyệt thiết kế, chờ review spec
- **Phạm vi:** Thêm lối tạo prompt từ một câu ý tưởng ngay tại empty-state của canvas Builder.

## 1. Bối cảnh & vấn đề

Hiện tại luồng "tạo prompt từ 1 câu" chỉ tồn tại ở trang chủ (`HomeTab`, mục "Thử ngay"), gọi
`generateStructuredTemplateFromTopic()` rồi sinh ra một template multi-block hoàn chỉnh với nút
"Mở trong Builder".

Trong Builder có `QuickPromptModal` (nhãn "Hoàn thiện AI") nhưng nó **chỉ bơm nội dung vào các khối
đã có sẵn** — bắt buộc `blocks.length > 0`. Khi người dùng vào thẳng Builder với canvas trống thì bế
tắc: muốn tạo nhanh từ ý tưởng phải quay lại trang chủ. Empty-state hiện tại chỉ là một hộp thụ động
"Chưa có thành phần nào" tại [`PromptBlockList.tsx:99`](../../../src/components/builder/PromptBlockList.tsx#L99).

Mục tiêu: cho phép người dùng "hiện thực hóa ý tưởng một cách trực quan" ngay trong Builder.

## 2. Quyết định cốt lõi (đã chốt với người dùng)

1. **Cách hiện kết quả:** đổ thẳng các khối vào canvas để chỉnh tại chỗ (không stream từng khối,
   không thẻ preview trung gian).
2. **Metadata:** giữ lại `title/description/category/tags` từ kết quả AI để prefill khi "Lưu Template".
3. **Phạm vi UI:** đầy đủ như trang chủ — ô nhập + chip gợi ý + loader `StepNarrator` + xử lý lỗi.

## 3. Phân vai với tính năng cũ

- **Tạo từ ý tưởng** (mới): canvas trống → sinh khung multi-block từ con số 0.
- **Hoàn thiện AI** (`QuickPromptModal`, giữ nguyên): canvas đã có khối → bơm nội dung vào khối có sẵn.

Hai luồng tách bạch, không gộp, để tránh nhầm lẫn.

## 4. Components

Nguyên tắc: mỗi đơn vị một nhiệm vụ, giao tiếp qua props rõ ràng.

### `EmptyStateGenerator.tsx` (mới — `src/components/builder/`)
Thuần trình bày (presentational), không tự gọi AI. Render:
- ô nhập ý tưởng dùng `GhostTextInput` (đồng nhất với HomeTab),
- hàng chip gợi ý nhanh,
- nút "Tạo" (disabled khi input rỗng),
- loader `StepNarrator` với flow `quick-fill` (đã có) khi đang sinh,
- khối báo lỗi + nút "Thử lại" khi lỗi,
- dòng phụ "…hoặc kéo thả khối từ cột trái" để giữ lối cũ.

Props:
```
value: string
onValueChange: (next: string) => void
onGenerate: () => void
isGenerating: boolean
error: string | null
onRetry?: () => void
```

### `PromptBlockList.tsx` (sửa)
Thêm prop tùy chọn `emptyState?: React.ReactNode`. Khi `blocks.length === 0`:
- nếu `emptyState` được truyền → render nó thay cho hộp "Chưa có thành phần nào" mặc định,
- giữ nguyên `Droppable` để vẫn kéo-thả khối từ sidebar vào được.

### `BuilderTab.tsx` (sửa)
Chủ sở hữu state + handler; truyền `<EmptyStateGenerator/>` xuống `PromptBlockList` qua prop `emptyState`.

## 5. State & luồng dữ liệu (trong `BuilderTab`)

State mới:
- `ideaInput: string`
- `isGeneratingFromIdea: boolean`
- `ideaError: string | null`

`handleGenerateFromIdea()`:
1. Bảo vệ: bỏ qua nếu `ideaInput.trim()` rỗng.
2. Đặt `isGeneratingFromIdea = true`, xóa `ideaError`.
3. Gọi `generateStructuredTemplateFromTopic(ideaInput.trim())`.
4. **Thành công:**
   - `loadBlocksFromTemplate(result)` → đổ `result.blocks` vào canvas
     ([`usePromptBlocks.ts:241`](../../../src/hooks/usePromptBlocks.ts#L241)).
   - Prefill metadata để dành cho "Lưu Template"
     ([state tại `BuilderTab.tsx:116-119`](../../../src/components/tabs/BuilderTab.tsx#L116)):
     - `setTemplateTitle(result.title)`
     - `setTemplateDesc(result.description)`
     - `setTemplateCategory(result.category)` (nếu có)
     - `setTemplateTags((result.tags ?? []).join(', '))`
5. **Lỗi:** set `ideaError` (thông báo + cho thử lại), không thay đổi canvas — theo đúng pattern
   `errorMessage` ở HomeTab.
6. `finally`: `isGeneratingFromIdea = false`.

Khi thành công, `blocks.length > 0` nên empty-state tự biến mất, canvas hiển thị các khối.

## 6. Các trạng thái UI

`idle` (ô nhập + chips) → `generating` (loader `StepNarrator`, khóa input/nút) →
`success` (empty-state ẩn, canvas hiện khối) hoặc `error` (thông báo + nút thử lại).

## 7. Edge cases

- Input rỗng → nút Tạo disabled.
- AI trả JSON thiếu `blocks` (hoặc rỗng) → coi như lỗi, hiển thị `ideaError`, không xóa/đổi gì trên canvas.
- AI throw (sai API key, mất mạng) → bắt trong `catch`, set `ideaError`.
- `result.category`/`result.tags` thiếu → prefill bằng giá trị mặc định hiện hành, không vỡ.

## 8. Kiểm thử

Unit test cho `handleGenerateFromIdea` (mock `generateStructuredTemplateFromTopic`), theo style các
test sẵn có trong `src/__tests__`:
- Thành công → gọi `loadBlocksFromTemplate` với kết quả và set đúng 4 state metadata.
- Engine throw → set `ideaError`, không gọi `loadBlocksFromTemplate`.
- Kết quả thiếu `blocks` → set `ideaError`, canvas không đổi.

## 9. Loại trừ phạm vi (YAGNI)

- Không stream nội dung từng khối.
- Không thẻ preview trung gian.
- Không nút "lưu thư viện" riêng tại empty-state (dùng nút "Lưu Template" sẵn có, đã được prefill).
- Không thêm entry point ở toolbar — chỉ xuất hiện ở empty-state canvas.
