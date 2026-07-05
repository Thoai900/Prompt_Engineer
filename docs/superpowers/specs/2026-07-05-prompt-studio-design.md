# Prompt Studio — màn hình chính mới tổng hợp luồng tạo prompt thông minh

**Ngày:** 2026-07-05 · **Trạng thái:** Đã duyệt (user duyệt cả 6 phần, chọn 1C / 2D / 3-tối-thiểu / 4B / 5-yêu-cầu-đăng-nhập)

## Bài toán

PromptBuilder hiện là hộp công cụ 10 tab rời rạc (Builder, Enhancer, Rules & Skills, Library, Lab 7 chế độ…). Người dùng phải tự biết dùng công cụ nào lúc nào và tự bê prompt qua lại giữa các tab. Prompt Studio là **lớp điều phối (orchestration)** biến hộp công cụ thành một quy trình duy nhất: ý tưởng → bản nháp → tăng cường → kiểm tra → hoàn tất.

Nguyên tắc chống God-component: Studio **chỉ gọi service + deep-link sang tab gốc**, tuyệt đối không render lại UI của tab khác.

## 1. Định vị & điều hướng

- Thêm `'studio'` vào `TabType` (`src/types.ts`) và `VALID_TABS` (`src/App.tsx`).
- Hash rỗng (`#`) mở **Studio** thay vì Home. `#home` vẫn hợp lệ; Home và 9 tab kia giữ nguyên trong sidebar — "quay lại giao diện cũ" chính là sidebar hiện có.
- **Yêu cầu đăng nhập**: chưa đăng nhập → Studio hiển thị màn hình chào + nút đăng nhập Google + lối tắt sang Home cũ. Các tab khác không bị chặn.

## 2. Luồng người dùng — wizard 5 bước, bước nào cũng skip được

1. **Ý tưởng** — nhập mô tả + chọn Persona (WorkspaceContext) + thể loại.
2. **Bản nháp** — AI dựng template dạng block (`generateStructuredTemplateFromTopic`), sửa nhanh tại chỗ.
3. **Tăng cường** — AI gợi ý Rules & Skills từ kho người dùng (`localStorage custom_rules/custom_skills` + preset); mỗi gợi ý là thẻ **Áp dụng / Bỏ qua**.
4. **Kiểm tra** — nút "Chấm điểm" chạy `lintPrompt`; mỗi lỗi có nút "Sửa bằng AI" hiện đề xuất cho người dùng duyệt trước khi nhận.
5. **Hoàn tất** — xem prompt cuối đã lắp ráp (blocks + rules + persona); hành động: lưu Library (`handleSaveTemplate`) · mở trong Builder (`handleSelectTemplate`) · copy.

Thanh tiến trình dọc bên trái; đi lui/tới tự do; trạng thái giữ nguyên khi chuyển tab (tab mount-giữ-state sẵn có).

## 3. Kiến trúc

- `src/components/tabs/StudioTab.tsx` (lazy) — orchestrator mỏng: giữ `StudioDraft`, điều phối bước, login gate.
- `src/components/studio/` — mỗi bước một component: `StepRail`, `StepIdea`, `StepDraft`, `StepEnhance`, `StepCheck`, `StepFinish`.
- **`StudioDraft`** = `{ template: PromptTemplate, selectedRuleIds, appliedSkillIds, personaId, lintIssues, currentStep }`. Ruột là `PromptTemplate` nên bàn giao sang Builder/Library miễn phí.
- Lưu draft: localStorage theo uid (`studio_draft_<uid>`); đồng bộ Firestore để đợt sau.
- Logic thuần tách ra **`src/utils/studioFlow.ts`**: lắp ráp prompt cuối (persona → blocks → skills → rules; rào chắn đặt cuối), máy trạng thái bước (next/prev/canGo), tạo/serialize draft, heuristic gợi ý rule ban đầu. Unit-test được.
- **Không backend mới** — mọi lệnh AI qua `aiService` (fallback Gemini→Groq sẵn có).

## 4. Điều phối AI (mức B — đề xuất, người dùng duyệt)

Không có pipeline tự chạy. Mỗi hành động AI = một lượt gọi do người dùng bấm; kết quả luôn hiện dạng đề xuất chờ **Áp dụng / Bỏ qua**. Kiểm soát quota và là nền cho copilot đợt 3 (copilot = "người bấm hộ" các action này).

## 5. Lộ trình tiến hóa (chưa làm đợt này)

- **Đợt 2**: Health check + Optimizer + Bake-off làm bước tùy chọn; điểm chất lượng tổng hợp; xuất node Prompt Graph.
- **Đợt 3**: panel copilot chat thay thanh bước — `StudioDraft` + `studioFlow.ts` giữ nguyên, chỉ thay lớp UI.

## 6. Kiểm thử & lỗi

- Unit test `src/__tests__/studioFlow.test.ts`: lắp ráp prompt (đủ/thiếu rules/persona), máy trạng thái bước, serialize/parse draft.
- Lỗi AI: `toast.error` + nút thử lại từng bước, không mất draft. Dùng `toast`/`confirmDialog` theo quy ước; token màu ngữ nghĩa (`bg-surface/panel`, `text-ink/muted`, `border-line`).
- CI đầy đủ: `npm run lint` · `npm test` · `npm run build`.
