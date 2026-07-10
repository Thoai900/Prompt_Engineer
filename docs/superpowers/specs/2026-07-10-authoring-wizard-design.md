# Thiết kế Đợt 3a: Authoring dễ & pro hơn (wizard hợp nhất)

Ngày: 2026-07-10
Trạng thái: đã duyệt hướng, build thẳng (user chọn KHÔNG viết plan)

## Mục tiêu

Làm việc TẠO skill/rule/llm config **dễ** (AI dựng nháp từ 1 câu) và **pro** (lint chất lượng + xuất
đa định dạng), gói trong một **wizard hợp nhất**. Áp dụng cả 3 bề mặt: skill · rule · llm config.

## Quyết định đã chốt

- Làm **cả 4 capability**: AI-draft, lint/validate, export đa định dạng, wizard.
- **Wizard hợp nhất**: modal điều phối draft → review + lint → lưu (+ xuất). Editor hiện có cũng
  gắn thêm lint badge + dropdown xuất cho người sửa tay.
- Build thẳng inline, TDD cho hàm thuần.

## Phần A — AI-draft (`src/services/aiService.ts`)

Mirror `generateStructuredTemplateFromTopic` (đã có: topic → object JSON). Thêm 3 hàm, JSON output
(`responseMimeType: 'application/json'`), fallback Gemini→Groq, nhận `options.model`:
```
draftSkillFromBrief(brief, options?): Promise<{ title; description; inputs: SkillVariable[]; steps: SkillStep[]; instructions }>
draftRuleFromBrief(brief, options?): Promise<{ title; description; content; tags: string[] }>
draftProfileFromBrief(brief, options?): Promise<{ name; role; context; constraints; outputFormat }>
```
Prompt yêu cầu model trả JSON đúng schema; parse an toàn (bọc try, tái dùng cách clean JSON hiện có).

## Phần B — Lint thuần (`src/utils/authoringLint.ts`, test được)

```
export interface LintFinding { level: 'error' | 'warn'; message: string; }
lintSkill(skill): LintFinding[]
lintRule(rule): LintFinding[]
lintProfile(profile): LintFinding[]
```
Luật (không gọi AI):
- **skill**: biến `{{x}}` xuất hiện trong `instructions` nhưng KHÔNG khai trong `inputs` → error; input khai
  nhưng KHÔNG dùng trong instructions → warn; `instructions` rỗng → error; không có input lẫn step → warn;
  title rỗng → error.
- **rule**: `content` rỗng → error; quá ngắn (<40 ký tự) → warn; không có heading `#` → warn.
- **profile**: cả role/context/constraints/outputFormat rỗng → error; role rỗng → warn.
- Trích biến `{{name}}` bằng regex `\{\{\s*([a-zA-Z0-9_]+)\s*\}\}` (khớp `renderSkillPrompt`).

## Phần C — Export thuần (`src/utils/exporters.ts`, test được)

Cho **skill & rule** (đầu vào là `AiSkill`/`AiRule`), trả string:
```
toSkillMd(input): string       // frontmatter --- name/description --- + body
toCursorrules(input): string   // nội dung rule/skill thô
toAgentsMd(input): string      // tiêu đề # + nội dung (chuẩn AGENTS.md)
toClaudeMd(input): string      // như AGENTS.md, nhãn CLAUDE.md
```
Gom logic xuất (hiện rải trong RulesSkillsTab) về đây; skill dựng body từ `buildSkillSpec`-style (title,
inputs, steps, instructions). Kèm `downloadText(filename, text)` helper (hoặc tái dùng cách tải hiện có).

## Phần D — Wizard UI (`src/components/authoring/AuthoringWizard.tsx`)

Modal 3 bước, props `{ open, onClose, user, defaultKind?: 'skill'|'rule'|'config', model, onCreated(kind) }`:
1. **Loại + mô tả 1 câu** → nút "AI dựng nháp" (gọi draft*FromBrief; loading; lỗi → toast).
2. **Review**: form các trường (sửa được) + **bảng lint** realtime (gọi lint* trên state).
3. **Lưu**: ghi về đúng kho — tái dùng đường lưu localStorage + Firestore hiện có (không nhân thêm
   logic; gọi helper chung `saveDraft(kind, draft, user)` trong `src/services/authoringSave.ts`). Nút
   **Xuất** (skill/rule) hiện dropdown định dạng.

Mở bằng nút **"✨ Tạo bằng AI"** thêm ở header RulesSkillsTab (rule), SkillsPanel (skill), UtilityBeltTab (config).

## Phần E — Gắn vào editor hiện có

- **Lint badge** trong editor skill (SkillsPanel) + rule (RulesSkillsTab): số cảnh báo, popover chi tiết.
- **Dropdown "Xuất"**: rule thêm AGENTS.md/CLAUDE.md/SKILL.md; skill thêm SKILL.md — dùng `exporters.ts`.

## Phần F — Test & CI

- `authoringLint` (thiếu/thừa biến, mục rỗng, rule ngắn), `exporters` (frontmatter đúng, mỗi format).
- Không phá test cũ. CI 4 bước xanh.

## Ngoài phạm vi (sau)

Preset built-in theo ngành (đợt kế, làm ngay sau authoring); import ngược từ file agent; AI auto-fix
từng finding lint (giờ chỉ báo); wizard cho web/fewshot node của Prompt Graph.
