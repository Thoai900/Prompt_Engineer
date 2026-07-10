# Thiết kế Đợt 3b: Preset built-in theo ngành

Ngày: 2026-07-10
Trạng thái: đã duyệt hướng, build thẳng (user chọn KHÔNG viết plan)

## Mục tiêu
Mở rộng preset built-in (~24–32) cho Rules & Skills + LLM Config theo 4 nhóm ngành, gắn nhãn `domain`
và thêm bộ lọc ngành nhẹ ở sidebar 3 tab.

## Quyết định đã chốt
- 4 nhóm: Kỹ thuật & Dữ liệu · Kinh doanh & Marketing · Giáo dục & Sáng tạo · Chuyên môn cao (kèm disclaimer).
- Độ sâu: ~24–32 preset, mỗi preset gắn `domain` (nhãn hiển thị).
- Lọc theo `domain` (chip data-driven) ở sidebar 3 tab. Build thẳng inline.

## Phần A — Mô hình
Thêm `domain?: string` (optional, backward-compat) vào `AiRule`, `AiSkill`, `CustomProfile`. User tự tạo → undefined → nhóm "Khác".

## Phần B — Lọc thuần (`src/utils/presetFilter.ts`, test)
```
export function listDomains<T extends { domain?: string; isPreset?: boolean }>(items: T[]): string[]  // distinct domain, có thứ tự xuất hiện
export function filterByDomain<T extends { domain?: string }>(items: T[], domain: string | null): T[]  // null/'' → tất cả; 'Khác' → item không domain
```

## Phần C — Nội dung (~24–32 preset)
- Rules/Skills mở rộng trong `src/presets.ts` (PRESET_RULES, PRESET_SKILLS), mỗi entry thêm `domain`.
- Config presets: **tách khỏi** UtilityBeltTab.tsx sang `src/data/llmConfigPresets.ts` (gọn component) rồi mở rộng, mỗi entry thêm `domain`.
- Phủ ví dụ: dev (review code, sinh test, tối ưu SQL, DevOps), business (SEO, ads copy, email, biên bản họp), edu/creative (giáo án, chấm bài+rubric, kịch bản, dịch), chuyên môn (soát hợp đồng, thuế cá nhân, sức khỏe tổng quát, JD tuyển dụng — KÈM disclaimer).
- Chất lượng ngang preset hiện có: nội dung ra lệnh trực tiếp, sẵn dùng.

## Phần D — UI lọc
Chip domain (từ `listDomains`) + "Tất cả" ở sidebar: RulesSkillsTab (rules), SkillsPanel (skills), UtilityBeltTab (profiles). Dùng `filterByDomain` để lọc danh sách hiển thị.

## Phần E — Test & CI
- `presetFilter` (listDomains distinct, filterByDomain 'Khác'/null).
- Integrity: id duy nhất, domain preset không rỗng, nội dung không rỗng (mở rộng test presets nếu có).
- Không phá test cũ. CI 4 bước.

## Ngoài phạm vi (sau)
Preset cộng đồng/chia sẻ; sinh preset theo ngành bằng AI hàng loạt; đa ngôn ngữ.
