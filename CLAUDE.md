# PromptBuilder — hướng dẫn cho AI agent

Ứng dụng web xây dựng & tối ưu prompt (React 19 + Vite + TypeScript, Firebase, deploy Vercel).

## Kiến trúc

- **Frontend**: React 19, Vite, Tailwind v4, `motion`, `lucide-react`. Vào từ `src/main.tsx` → `src/App.tsx`.
- **Điều hướng**: KHÔNG dùng router lib — `activeTab` đồng bộ với `window.location.hash` (`#builder`, `#lab`…) trong App.tsx. Deep-link phụ dùng query-param (`?t=`, `?app=`) đọc trong tab tương ứng, không đụng App.tsx.
- **Nhóm điều hướng**: `src/utils/navGroups.ts` (thuần) gom tab thành 4 nhóm Tạo/Thư viện/Thử nghiệm/Học — sidebar desktop có tiêu đề nhóm; mobile có thanh tab đáy (4 nhóm + "Thêm") và hàng tab con. Thêm tab mới thì nhớ thêm vào một nhóm (test `navGroups.test.ts` bắt lỗi thiếu).
- **Tab**: Home (eager) + các tab lazy: Studio, Builder, ProjectChain, Rules&Skills, LLM Config, Library, Learn, **Lab**. Tab mount-khi-mở, giữ nguyên state (`visitedTabs`). Tab đã gỡ (`#enhancer` → Studio chế độ "Tăng cường nhanh" `?studio=quick`; `#aifuture` → Learn bản tin `?learn=news`) được chuyển hướng qua `resolveLegacyTab` trong `navGroups.ts`.
- **Lab** (`src/components/tabs/LabTab.tsx`): trung tâm "sức mạnh AI" 4 chế độ, mỗi chế độ một panel trong `src/components/lab/`:
  Bake-off (so tài model) · Auto-Optimizer (tối ưu prompt tiến hoá, chạy backend) · Prompt Health (CI cho prompt) · Cá nhân hoá (taste model). Tab khác gửi prompt sang Bake-off/Optimizer qua `sendToLab()` (`src/services/labSeed.ts`, sessionStorage + sự kiện `pb:lab-seed`).
  Đã chuyển đi: Gia sư → Learn (`src/components/learn/TutorPanel.tsx`, mở từ PersonalGuide); Chain→App → Project Chain (`src/components/project-chain/AppPanel.tsx`, nút "Chạy như App"; link `?app=<id>#lab` cũ chuyển hướng về `#projectchain`).
- **Prompt Inspector** (`src/components/common/PromptInspector.tsx`): chỗ "soi" prompt dùng chung — token/chi phí (`PromptMeter`) + linter AI (`lintPrompt`) + lối tắt "So tài model"/"Tối ưu" sang Lab. Gắn ở Builder, Prompt Graph (tab Prompt), Auto-Optimizer. Danh sách lỗi dùng chung `LintIssueList` (cả bước Kiểm tra của Studio); hàm thuần ở `src/utils/lintIssues.ts`. Linter không còn là chế độ riêng của Lab.
- **Project Chain v3 = "Prompt Graph"** (node-graph kiểu Blender trên `@xyflow/react`): 1 node Prompt Gốc (compiler — nội dung lõi TUỲ CHỌN, có cổng `Nhiệm vụ` để swap Task Node) với các cổng input đặt tên, node thuộc tính kéo dây cắm vào, bật/tắt (mute), prompt cuối lắp ráp realtime. 5 dạng node (`nodeType`): `text` · `preset` (Modifier dropdown/slider — thư viện `src/utils/graphPresets.ts`) · `fewshot` (cặp Input→Output) · `web` (cào URL qua `api/fetch-url.ts`, cache snapshot vào node — compile KHÔNG fetch) · `group` (Bundle: gom nhiều node thành 1 card, mỗi thành viên tự vào đúng cổng, KHÔNG cần dây; template nhiều block import vào sẽ nở thành group). Panel Chạy thử có vòng tự sửa lỗi 0–3 (self-correction loop — chiến lược THỰC THI, không phải node). Logic thuần ở `src/utils/graphCompile.ts` (compile/layout/chống chu trình/renderNodeText) + `graphMigration.ts` (migrate v2→v3, backup localStorage); UI ở `src/components/project-chain/` (GraphWorkspace là orchestrator). Cú pháp biến DUY NHẤT `{{ten_bien}}` — các cú pháp `{{output_N}}`/`{{parent.output}}` đã khai tử; `chainUtils.ts` chỉ còn đường tương thích cho Shared App legacy.
- **Thư viện năng lực AI** (`src/components/library-explorer/`): modal khám phá + nhập skill/rule/persona từ GitHub. Lớp `CatalogSource` (`src/services/catalogService.ts`) — đợt 1 `StaticCatalogSource` đọc manifest `src/data/skillCatalog.ts`, tải raw on-demand qua `api/github.ts`; logic parse/route thuần ở `src/utils/skillCatalog.ts`. Skill nhập về là `AiSkill.kind='document'`. Mở từ RulesSkillsTab + UtilityBeltTab; import route theo `category`. **Đợt 2**: chế độ "Tìm GitHub" live (repo search → duyệt file) qua `api/github.ts` action `search`/`tree` (cần env `GITHUB_TOKEN`); suy loại file `src/utils/repoInference.ts`; câu lệnh cài skill cho agent `src/utils/agentInstall.ts`; trích file repo làm nền Rule/LLM Config (`routeImportAs`/`entryToProfileContext`). **Đợt 2.1**: card repo giàu thông tin (`RepoCard`: avatar/sao/ngôn ngữ/topic/cập nhật — `search` map thêm các trường vào `RepoHit`) + panel lệnh cấp REPO khi mở repo chưa chọn file (`RepoCommandsPanel`): `buildRepoCommands()` sinh lệnh tải TOÀN BỘ repo dùng chung (`git clone`/`degit`, để riêng) + mỗi agent một lệnh terminal + prompt "tự tải & kích hoạt".
- **Authoring wizard** (`src/components/authoring/AuthoringWizard.tsx`): nút "✨ Tạo bằng AI" ở cả 3 tab (RulesSkillsTab/SkillsPanel/UtilityBeltTab) → modal mô tả-1-câu → `aiService.draft{Skill,Rule,Profile}FromBrief` (JSON) → review + lint (`src/utils/authoringLint.ts`, thuần) → lưu qua `persistImport`. Xuất đa định dạng `src/utils/exporters.ts` (SKILL.md/.cursorrules/AGENTS.md/CLAUDE.md, thuần) — dùng trong wizard và dropdown xuất của editor Rule.
- **Preset theo ngành**: preset built-in gắn `domain?` (rules/skills ở `src/presets.ts`, config ở `src/data/llmConfigPresets.ts`). Lọc bằng `DomainChips` + `filterByDomain`/`listDomains` (`src/utils/presetFilter.ts`, thuần) ở sidebar 3 tab. Nhóm chuyên môn cao (pháp lý/tài chính) có câu disclaimer trong nội dung.
- **State chung**: `src/context/WorkspaceContext.tsx` = nguồn chân lý cho user/auth/API keys/workspaces/personas (đồng bộ Firestore hoặc localStorage). Đừng thêm mảng workspace/persona hardcode vào App.
- **Backend**: Vercel serverless trong `api/` — `ai.ts` (proxy Gemini/Groq, giấu key), `optimize.ts` (vòng tối ưu). Mỗi function **tự chứa** (không import file helper cục bộ — Vercel không bundle). Auth bằng Firebase ID token.
- **Firebase**: Auth (Google) + Firestore. Collections: templates, projects, rules, skills, workspaces, personas, bookmarks, healthSuites, sharedApps, suggestionModels — tất cả owner-only trừ template/sharedApp có phần public.

## Quy ước (QUAN TRỌNG)

- **Thông báo**: `toast()` / `toast.success|error|info` từ `components/common/Toaster.tsx` (KHÔNG `alert()`).
- **Xác nhận**: `await confirmDialog({message,danger?,confirmText?})` từ `components/common/ConfirmDialog.tsx` (KHÔNG `window.confirm`).
- **Tên model AI**: chỉ khai báo ở `src/config/models.ts` — KHÔNG hardcode chuỗi model.
- **Màu/theme**: dùng token ngữ nghĩa (`bg-surface/panel/glass`, `text-ink/muted/faint`, `border-line`) — tự đổi light/dark. `src/index.css` có lớp override `!important` remap các utility slate/white theo theme; tránh dựa vào `bg-slate-*` cho bề mặt cố định.
- **AI service**: `src/services/aiService.ts` — mọi hàm nhận `systemInstruction`. Persona chèn bằng `withPersona()`. Đa số hàm có fallback Gemini→Groq.

## Kiểm thử & CI

- `npm run lint` (tsc) · `npm test` (vitest) · `npm run build` (vite). Tests trong `src/__tests__/`.
- **`api/` bị loại khỏi tsconfig** → type-check riêng: `npx tsc --noEmit --skipLibCheck --moduleResolution bundler --module esnext --target es2020 --types node api/*.ts`.
- CI (`.github/workflows/ci.yml`) chạy cả 4 bước trên mỗi push/PR.
- Ưu tiên tách hàm THUẦN ra `src/utils/` hoặc service để unit-test được.

## Deploy

Xem `DEPLOY.md`. Tóm tắt: frontend+api → Vercel (`git push`); rules → `firebase deploy --only firestore:rules` (bắt buộc khi đổi collection); env `GEMINI_API_KEY`/`GROQ_API_KEY` đặt ở Vercel rồi **redeploy**.

## Nợ kỹ thuật còn lại

Tách God-component (RulesSkillsTab, aiService — ProjectChainTab đã xong ở v3), TanStack Query, i18n, a11y toàn site, lịch health-check tự động (Vercel Cron), node AI biến đổi cho Prompt Graph (v3.1 — xem mục 11 của spec `docs/superpowers/specs/2026-07-04-project-chain-v3-prompt-graph-design.md`).
