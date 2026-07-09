# Thiết kế: Thư viện năng lực AI — GitHub Skills/Rules/Config Library

Ngày: 2026-07-09
Trạng thái: đã duyệt hướng, chờ viết plan

## Bối cảnh & Mục tiêu

Hai phân hệ "sức mạnh cấu hình AI" của app đang **nghèo nội dung** và **buộc soạn từ đầu**:

- **Rules & Skills** ([RulesSkillsTab.tsx](../../../src/components/tabs/RulesSkillsTab.tsx) +
  [SkillsPanel.tsx](../../../src/components/rulesskills/SkillsPanel.tsx)): chỉ **3 preset rule** +
  **2 preset skill** ([presets.ts](../../../src/presets.ts)). Skill dùng mô hình **có cấu trúc**
  (inputs → steps → instructions `{{biến}}`).
- **LLM Config** ([UtilityBeltTab.tsx](../../../src/components/tabs/UtilityBeltTab.tsx)): profile 4
  trường (role/context/constraints/outputFormat), chỉ **4 preset**.

Định hướng người dùng: (1) thêm skills/config **đa dạng** hơn; (2) tạo **dễ + chuyên nghiệp** hơn;
(3) **tận dụng thư viện skills trên GitHub** để người dùng tham khảo/áp dụng các skill mạnh, chuyên biệt.

Trọng tâm **đợt này** = mảnh (3): một **"Thư viện năng lực AI"** cho phép duyệt → xem trước → **1-click
nhập** các skill/rule/system-prompt chất lượng từ GitHub vào thư viện cá nhân, tự route về đúng kho.
(2) và (3-preset) đưa vào lộ trình đợt sau (Phần I).

## Quyết định đã chốt (qua hỏi–đáp)

- **Cơ chế nguồn**: **catalog tuyển chọn + fetch on-demand** ở đợt 1; thiết kế lớp `CatalogSource`
  trừu tượng để **về sau cắm live GitHub search** vào cùng interface, không phá UI.
- **Mô hình skill**: **mở rộng `AiSkill` thêm `kind: 'structured' | 'document'`**. Skill markdown
  (SKILL.md) nhập về là `document`, vẫn nằm ở **tab Skills**, chạy thử được ngay. Không auto-parse
  sang inputs/steps (chỉ là nút phụ tùy chọn) để tránh lỗi/mất thông tin/tốn token.
- **Vị trí UI**: **một component dùng chung** (`LibraryExplorer`) dạng modal/drawer toàn màn hình,
  mở bằng nút "Khám phá GitHub" ở **cả** Rules&Skills và LLM Config; lọc theo category; import tự
  route về đúng kho.
- **Họ nguồn seed đợt 1** (chọn cả 4): Agent Skills (SKILL.md) · Rules agent-coding
  (awesome-cursorrules, AGENTS.md/CLAUDE.md) · System prompt & persona (awesome-chatgpt-prompts) ·
  Prompt framework & guide.

## Phần A — Kiến trúc: lớp `CatalogSource`

UI không quan tâm nội dung đến từ đâu; mọi nguồn cài cùng interface (đặt ở
`src/services/catalogService.ts`):

```ts
export interface CatalogSource {
  id: string;
  label: string;
  /** Liệt kê mục catalog (đợt 1: đọc manifest tĩnh; đợt sau: gọi GitHub search). */
  list(query: CatalogQuery): Promise<CatalogEntry[]>;
  /** Lấy nội dung raw của một mục (lazy — chỉ khi preview/import). */
  fetchContent(entry: CatalogEntry, idToken?: string): Promise<string>;
}
export interface CatalogQuery { category?: CatalogCategory; text?: string; collection?: string; }
```

- **Đợt 1**: `StaticCatalogSource` — `list()` đọc manifest bundled
  [src/data/skillCatalog.ts](../../../src/data/skillCatalog.ts); `fetchContent()` gọi proxy
  `api/github.ts` tải raw.
- **Đợt sau**: `GithubSearchSource` — `list()` gọi GitHub Search API (server token); `fetchContent()`
  dùng chung proxy. UI/import pipeline **không đổi**.

## Phần B — Mô hình dữ liệu (thêm field, backward-compat)

Theo tiền lệ `nodeType?` thêm vào `GraphNode` — field mới đều optional, dữ liệu cũ vẫn hợp lệ.

```ts
// types.ts — AiSkill thêm:
kind?: 'structured' | 'document';   // undefined ⇒ 'structured' (mọi skill cũ)
source?: ContentSource;             // xuất xứ khi import (undefined ⇒ do người dùng tự tạo)

// AiRule thêm:  source?: ContentSource;
// CustomProfile (LLM config, hiện khai báo cục bộ trong UtilityBeltTab) thêm: source?: ContentSource;

export interface ContentSource {    // provenance dùng chung mọi kho
  origin: 'github';
  repo: string;         // "anthropics/skills"
  path: string;         // "document-skills/pdf/SKILL.md"
  htmlUrl?: string;     // link xem trên GitHub
  license?: string;     // vd "MIT"
  author?: string;
  importedAt: string;   // ISO
  sha?: string;         // để phát hiện cũ / re-sync sau
}
```

Skill `document`: `inputs=[]`, `steps=[]`, `instructions` = **body SKILL.md** → `executeSkill` chạy
thẳng. `buildSkillSpec()` trong SkillsPanel cần nhánh: `document` render thẳng instructions thay vì
ghép inputs/steps. Editor với skill `document` hiển thị **1 editor markdown** (ẩn manager
inputs/steps) + banner "Skill nhập từ GitHub" + link nguồn.

### Manifest catalog — `src/data/skillCatalog.ts` (noi theo templateShowcase.ts)

```ts
export type CatalogCategory = 'skill' | 'rule' | 'config' | 'guide';
export type CatalogFormat = 'skill-md' | 'cursorrules' | 'markdown' | 'system-prompt';

export interface CatalogEntry {
  id: string;
  category: CatalogCategory;   // QUYẾT ĐỊNH kho đích khi import
  format: CatalogFormat;       // QUYẾT ĐỊNH cách parse
  title: string;
  description: string;
  tags: string[];
  icon?: string;               // emoji
  collection: string;          // họ nguồn (nhóm hiển thị ở sidebar)
  repo: string;
  path: string;
  rawUrl: string;              // raw.githubusercontent.com/...
  htmlUrl?: string;
  license?: string;
  author?: string;
}
export const SKILL_CATALOG: CatalogEntry[] = [ /* ~20–30 mục tuyển chọn đợt 1 */ ];
export const CATALOG_COLLECTIONS: { id: string; label: string; category: CatalogCategory }[] = [ ... ];
```

## Phần C — Backend proxy `api/github.ts` (self-contained)

Nhân khuôn [api/fetch-url.ts](../../../api/fetch-url.ts): auth Firebase ID token + chống SSRF +
rate-limit theo uid + CORS. Khác biệt:

- **Allow-list host**: chỉ `raw.githubusercontent.com`, `api.github.com`, `github.com`. Từ chối host khác.
- **Nới cap text** ~50k ký tự (SKILL.md dài hơn 15k cap của fetch-url; skill là text thuần nên an toàn).
- **`action: 'raw'`** (đợt 1): `{ url }` (đã allow-list) → trả `{ text }`.
- **`action: 'search'`** (đợt sau): `{ query, category }` → gọi GitHub Search API với
  `GITHUB_TOKEN` (env server, thêm ở Vercel). Gom mọi mối lo GitHub (token, rate-limit, phân trang)
  vào một endpoint allow-listed.

*Ghi chú:* Vercel Hobby giới hạn ~12 serverless function; hiện có 4 route → thêm 1 an toàn. Phương
án dự phòng rủi ro thấp: đợt 1 tái dùng `fetch-url.ts` cho raw (raw.githubusercontent.com là URL text
công khai), đổi lại mất chỗ allow-list + seam cho search. **Chọn endpoint riêng** vì rõ ràng + sẵn cho đợt sau.

## Phần D — Pipeline import (logic thuần `src/utils/skillCatalog.ts`, unit-test được)

Tách hàm thuần để test theo quy ước CI:

- `parseFrontmatter(md): { data: Record<string,string>, body: string }` — parser YAML-frontmatter tối
  giản, không dependency (chỉ cần `key: value` phẳng của SKILL.md).
- `entryToSkill(entry, rawText): AiSkill` — `skill-md` → `AiSkill{kind:'document', title, description
  (từ frontmatter, fallback entry), instructions: body, source}`.
- `entryToRule(entry, rawText): AiRule` — `cursorrules`/`markdown` → `AiRule{type:'markdown-guide'
  | 'system-rules', content, tags, source}`.
- `entryToProfile(entry, rawText): CustomProfile` — `system-prompt` → best-effort tách
  role/context/constraints/output; không tách được thì **dồn toàn bộ vào `role`** (an toàn, không mất chữ).
- `routeImport(entry, rawText)` → `{ target: 'skill'|'rule'|'config', payload }` theo `category`.

Luồng runtime:
1. Mở modal → `source.list(query)` → lưới card.
2. Chọn mục → `source.fetchContent(entry)` (lazy, qua proxy) → render markdown + metadata.
3. **Import** → `routeImport` → ghi vào kho tương ứng (localStorage + Firestore nếu đăng nhập, dùng
   lại đúng đường lưu hiện có của mỗi tab: collection `skills` / `rules`, và `llm_custom_profiles`).
4. **Cache snapshot** nội dung raw (localStorage theo `entry.id`, TTL nhẹ) → mở lại tức thì, không refetch.

## Phần E — UI `LibraryExplorer` (component dùng chung)

- Thư mục mới `src/components/library-explorer/`: `LibraryExplorer.tsx` (modal orchestrator) +
  `CatalogCard.tsx` + `CatalogPreviewPanel.tsx`.
- Nút **"Khám phá GitHub"** thêm ở header `RulesSkillsTab` và `UtilityBeltTab`, mở cùng modal (state
  cục bộ mỗi tab hoặc nâng lên nơi dùng chung; import xong bắn callback để tab refresh danh sách).
- Bố cục: **sidebar collection/họ nguồn** + **chip lọc category** (Skills/Rules/Configs/Guides) + ô
  search → **lưới card** (icon, title, description ngắn, tag, badge repo/license) → **panel preview**
  bên phải (render markdown đầy đủ + nút **Import** / **Xem trên GitHub**).
- Mở từ LLM Config **mặc định lọc** category=`config`; mở từ Rules&Skills mặc định `skill`+`rule`+`guide`.
- **Theme**: dùng token ngữ nghĩa (`bg-surface/panel/glass`, `text-ink/muted/faint`, `border-line`);
  **tránh** `bg-slate-*` cho bề mặt cố định do lớp override `!important` trong
  [index.css](../../../src/index.css) remap theo theme (dùng class riêng / `bg-[var(--color-panel)]`).
- Thông báo/xác nhận: `toast()` + `confirmDialog()` (không `alert`/`window.confirm`).

## Phần F — An toàn / xuất xứ

- Chỉ fetch host GitHub allow-listed (Phần C). Chống SSRF kế thừa từ khuôn fetch-url.
- Render markdown **không HTML thô**: `ReactMarkdown + remark-gfm` như hiện tại (không `rehype-raw`).
- Hiện **license + link nguồn** rõ ở card & preview; import ghi `source` để truy vết.
- **Không tải/không chạy** script/binary đính kèm của Agent Skill — chỉ lấy **text SKILL.md**. Nếu
  skill tham chiếu file phụ (scripts/, references/), hiện **ghi chú** "skill này kèm tài nguyên phụ
  không được nhập; xem trên GitHub".

## Phần G — Seed catalog đợt 1 (4 họ nguồn)

~20–30 mục tuyển chọn, mỗi mục trỏ `rawUrl` cụ thể + metadata:

- **skill-md** → category `skill`: các Agent Skill phổ biến (vd anthropics/skills: pdf, docx, xlsx,
  pptx, canvas-design, mcp-builder…).
- **cursorrules** → category `rule`: awesome-cursorrules (React/TS, Python, Next.js…), mẫu
  AGENTS.md/CLAUDE.md.
- **system-prompt** → category `config`: awesome-chatgpt-prompts + persona theo vai trò.
- **markdown/guide** → category `guide`: cẩm nang prompt patterns / chain-of-thought / framework.

Tuyển bằng tay đợt 1 (chất lượng > số lượng), ghi thẳng vào `SKILL_CATALOG`. Kiểm license mỗi mục
trước khi đưa vào (ưu tiên repo license mở: MIT/Apache/CC).

## Phần H — Kiểm thử

- `src/__tests__/skillCatalog.test.ts`: `parseFrontmatter` (có/không frontmatter, giá trị có dấu `:`),
  `entryToSkill/Rule/Profile` (đúng target, giữ nội dung, gắn `source`), `routeImport` theo category.
- Không phá test hiện có (skillRunner, groqConfig, templateShowcase).
- `npm run lint` (tsc) · `npm test` · `npm run build`; type-check riêng `api/github.ts` bằng lệnh
  `npx tsc` cho `api/*.ts` như CLAUDE.md.

## Thay đổi mã dự kiến

- **Mới**:
  - [src/data/skillCatalog.ts](../../../src/data/skillCatalog.ts) — manifest + collections.
  - `src/services/catalogService.ts` — interface `CatalogSource` + `StaticCatalogSource`.
  - `src/utils/skillCatalog.ts` — parser + `entryTo*` + `routeImport` (thuần).
  - `src/components/library-explorer/` — `LibraryExplorer.tsx`, `CatalogCard.tsx`, `CatalogPreviewPanel.tsx`.
  - `api/github.ts` — proxy raw (đợt 1) + seam search (đợt sau).
  - `src/__tests__/skillCatalog.test.ts`.
- **Sửa**:
  - [types.ts](../../../src/types.ts) — `AiSkill.kind`, `AiSkill.source`, `AiRule.source`, `ContentSource`.
  - [SkillsPanel.tsx](../../../src/components/rulesskills/SkillsPanel.tsx) — nhánh editor/`buildSkillSpec`
    cho `document`; nút "Khám phá GitHub"; refresh sau import.
  - [RulesSkillsTab.tsx](../../../src/components/tabs/RulesSkillsTab.tsx) — nút mở modal (rules).
  - [UtilityBeltTab.tsx](../../../src/components/tabs/UtilityBeltTab.tsx) — `CustomProfile.source`; nút
    mở modal (mặc định category config); nhận profile nhập vào.
  - Firestore rules nếu cần field mới (chỉ thêm field optional trên doc owner-only → thường không đổi rule).

## Phạm vi

- **Trong phạm vi (đợt 1)**: `CatalogSource` + `StaticCatalogSource`, manifest seed 4 họ nguồn,
  `api/github.ts` raw, pipeline import + route + parse, `LibraryExplorer` mở từ 2 tab, skill `kind:
  document`, provenance/license, cache snapshot, test hàm thuần.
- **Ngoài phạm vi (đợt sau — Phần I)**: live GitHub search (`GithubSearchSource` + `action:search` +
  token); authoring wizard/AI-sinh-nháp/lint/xuất đa định dạng; mở rộng preset built-in theo ngành;
  nhập tài nguyên phụ (scripts) của Agent Skill; re-sync theo `sha`.

## Phần I — Lộ trình đợt

- **Đợt 1 (trọng tâm)**: A–H.
- **Đợt 2**: authoring dễ/pro hơn — wizard từng bước, AI sinh nháp skill/rule/config từ 1 câu mô tả,
  lint/validate, xuất `.cursorrules`/`AGENTS.md`/`CLAUDE.md`/`SKILL.md`.
- **Đợt 3**: mở rộng preset built-in theo ngành (lập trình/marketing/giáo dục/pháp lý/y tế/tài chính)
  + `GithubSearchSource` live + re-sync `sha`.

## Rủi ro / lưu ý

- **Rate-limit/độ tươi raw**: đợt 1 fetch on-demand + cache; nếu repo đổi cấu trúc, `rawUrl` có thể
  404 → UI báo lỗi mềm + link GitHub, không vỡ modal.
- **License**: chỉ seed repo license mở; luôn hiển thị license + nguồn để người dùng tự chịu trách nhiệm khi dùng lại.
- **`document` skill trong luồng cũ**: mọi chỗ đọc `inputs/steps` phải chịu được mảng rỗng; render
  bằng `instructions`. Kiểm kỹ SkillsPanel (compile, push-to-builder, run).
- **Chi phí token**: import là copy text (không AI) → gần như 0; chỉ tốn khi người dùng bấm "chạy thử"
  hoặc "AI chuyển thành skill có cấu trúc".
