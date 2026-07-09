# Thiết kế Đợt 2: GitHub live search + câu lệnh cài skill + trích repo làm nền rules/config

Ngày: 2026-07-09
Trạng thái: đã duyệt hướng, implement thẳng (người dùng chọn KHÔNG viết plan)

## Bối cảnh & Mục tiêu

Sau Đợt 1 (Thư viện năng lực AI — catalog tĩnh + import), người dùng muốn 3 thứ:
1. **Live GitHub search** — "khám phá GitHub" hiện tĩnh; cần chủ động tìm repo chất lượng.
2. **Câu lệnh tải nhanh skill** cho coding agent (Claude Code, Codex, Antigravity).
3. **Trích một phần dữ liệu repo** làm nền cho Rules và LLM Config (không chỉ Skills).

Ba tính năng dùng chung bề mặt "duyệt repo → file", nên gom thành Đợt 2 một spec.

## Quyết định đã chốt (hỏi–đáp)

- **Cơ chế tìm**: **Repo Search API theo topic/sao** → chọn repo → duyệt file → preview/import.
- **Câu lệnh cài**: **snippet tải về** vào thư mục skills từng agent (universal); Antigravity dùng `agy plugin install` (native, xác nhận cú pháp sau).
- **Trích repo → rule/config**: **trích trực tiếp file nền** (AGENTS.md/CLAUDE.md/.cursorrules/README), KHÔNG AI.
- **Vận hành**: **bắt buộc `GITHUB_TOKEN`** (env server Vercel) để search dùng được; thiếu token → degrade về tab Tuyển chọn.

## Phần A — Kiến trúc: mở rộng nguồn, giữ nền Đợt 1

`LibraryExplorer` có 2 chế độ nguồn:
- **Tuyển chọn** (`staticCatalogSource` — Đợt 1, giữ nguyên).
- **Tìm GitHub** (mới) — điều hướng 2 tầng: repo → file.

Nguồn live cần API rộng hơn `CatalogSource.list()` phẳng → thêm interface con (đặt trong `catalogService.ts`):
```ts
export interface RepoHit {
  fullName: string;      // "owner/repo"
  description: string;
  stars: number;
  htmlUrl: string;
  defaultBranch: string;
  license?: string;
}
export interface RepoSearchSource {
  searchRepos(query: string): Promise<RepoHit[]>;
  listRepoFiles(repo: RepoHit): Promise<CatalogEntry[]>;  // đã suy loại
}
```
`fetchContent(entry)` dùng lại proxy raw Đợt 1 (rawUrl dựng từ owner/repo/branch/path).

## Phần B — Backend `api/github.ts` (thêm action, tự chứa)

- `action:'search'` → `GET https://api.github.com/search/repositories?q=<q>&sort=stars&per_page=30`, header `Authorization: Bearer ${process.env.GITHUB_TOKEN}`. Trả mảng repo rút gọn.
- `action:'tree'` → `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1` (fallback Contents API), trả danh sách path (lọc file text ≤ giới hạn số lượng).
- Giữ allow-list (`api.github.com` đã có), rate-limit per uid, cap. `GITHUB_TOKEN` thiếu → `search`/`tree` trả 400 rõ ràng "cần cấu hình GITHUB_TOKEN"; `raw` vẫn chạy (không cần token).

## Phần C — Suy loại file (thuần) — `src/utils/repoInference.ts`

`inferEntryFromPath(repo, path): CatalogEntry | null` — map path/tên → `{category, format}` + dựng rawUrl/htmlUrl:
- `**/SKILL.md` → `skill / skill-md`
- `.cursorrules`, `**/*.mdc`, `.cursor/rules/**` → `rule / cursorrules`
- `AGENTS.md`, `CLAUDE.md` → `rule / markdown` (guide)
- `README*`, `**/*.md` trong `docs/`/`prompts/`/`personas/` → `guide`
- Ngược lại → `null` (bỏ). Trả `CatalogEntry` để **dùng lại pipeline import + routeImport Đợt 1**.
Thuần → unit-test. Đây là chỗ #3 gặp #1.

## Phần D — UI `LibraryExplorer` thêm chế độ "Tìm GitHub"

Toggle nguồn đầu modal (Tuyển chọn ↔ Tìm GitHub). Chế độ Tìm: ô search + chip topic → lưới **repo card** (tên, ⭐, mô tả, license) → chọn repo → cột phải liệt kê **file hợp lệ** (đã suy loại) → chọn file → preview raw + Import (route như Đợt 1). Breadcrumb `repo ‹ files`. Thiếu token → banner "cần GITHUB_TOKEN", ẩn chế độ Tìm.

## Phần E — #2: Câu lệnh cài cho agent — `src/utils/agentInstall.ts` (thuần)

`buildInstallCommands(entry): AgentCommand[]` theo bảng config `AGENT_TARGETS` (dễ sửa):

| Agent | Kiểu | Lệnh mẫu |
|---|---|---|
| Claude Code (user) | download | `mkdir -p ~/.claude/skills/<slug> && curl -fsSL <raw> -o ~/.claude/skills/<slug>/SKILL.md` |
| Claude Code (project) | download | `… .claude/skills/<slug>/…` |
| Folder skill | degit | `npx degit <owner>/<repo>/<dir> ~/.claude/skills/<slug>` |
| Codex | download | `~/.codex/…` *(đường dẫn: xác nhận với người dùng)* |
| Antigravity | native | `agy plugin install …` *(cú pháp: xác nhận với người dùng)* |

`<slug>` = kebab-case tên skill (escape an toàn). UI: khối **"Cài cho agent"** trong preview panel khi entry là **skill** — nút copy theo agent. Thuần → unit-test.

## Phần F — #3: Trích file repo làm nền rules / llm config (trực tiếp)

Nhờ C+D, file rule/guide → nhập thành Rule (đã có `entryToRule`). Bổ sung:
- **Chọn đích khi nhập** file mơ hồ (README/docs): nút "Nhập thành **Rule**" hoặc "Nhập thành **LLM Config**".
- LLM Config: nội dung repo đổ vào ô **Context** (nền dự án) — thêm `entryToProfileContext()` thuần (giống `entryToProfile` nhưng gán `context` thay vì `role`).

## Phần G — An toàn / quota / vận hành

- **Bắt buộc `GITHUB_TOKEN`** trên Vercel (Production) để search/tree chạy; redeploy sau khi set. Không token → chỉ mất chế độ Tìm, phần còn lại nguyên vẹn.
- Cache kết quả search/tree ngắn (localStorage theo query/repo). Rate-limit per uid. Markdown render không HTML thô.
- Token chỉ ở server; KHÔNG bao giờ `VITE_`.

## Phần H — Kiểm thử

- `repoInference` (suy loại theo path, bỏ file lạ, dựng URL đúng).
- `agentInstall` (sinh lệnh đúng agent/entry, slug escape an toàn, chỉ áp cho skill).
- `filterCatalog`/route giữ nguyên. Backend action: type-check api.
- CI 4 bước xanh.

## Phạm vi & phân đoạn (khi implement)

1. Backend `search`/`tree` + `GithubSearchSource` + `repoInference` (+test).
2. UI chế độ "Tìm GitHub" (repo → file → import).
3. `agentInstall` + khối "Cài cho agent" trong preview.
4. Chọn-đích khi nhập + `entryToProfileContext` (F).
(3)(4) có thể tách nếu muốn nhỏ hơn.

## Ngoài phạm vi (sau)

Code search theo nội dung; native install cho mọi agent; nhập tài nguyên phụ (scripts) của skill; AI tổng hợp rule/config từ repo (đã chọn bản trích trực tiếp).
