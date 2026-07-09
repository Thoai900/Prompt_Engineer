# Thư viện năng lực AI — GitHub Skills/Rules/Config Library (Đợt 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép người dùng duyệt → xem trước → 1-click nhập skill/rule/system-prompt chất lượng từ GitHub vào thư viện cá nhân, tự route về đúng kho (Skills / Rules / LLM Config).

**Architecture:** Lớp `CatalogSource` trừu tượng (đợt 1 = `StaticCatalogSource` đọc manifest bundled + fetch raw on-demand qua proxy `api/github.ts`; đợt sau cắm live GitHub search cùng interface). Logic parse/route là hàm thuần trong `src/utils/skillCatalog.ts` (unit-test được). UI là component dùng chung `LibraryExplorer` mở từ cả Rules&Skills và LLM Config; import route theo `category`, không theo tab. `AiSkill` thêm `kind: 'structured' | 'document'` cho skill markdown nhập về.

**Tech Stack:** React 19 + Vite + TypeScript, Tailwind, Firebase (Auth + Firestore), Vercel serverless (`api/`), Vitest, ReactMarkdown + remark-gfm.

## Global Constraints

- **Thông báo**: `toast()` / `toast.success|error` từ [Toaster.tsx](../../../src/components/common/Toaster.tsx) — KHÔNG `alert()`.
- **Xác nhận**: `await confirmDialog(...)` từ [ConfirmDialog.tsx](../../../src/components/common/ConfirmDialog.tsx) — KHÔNG `window.confirm`.
- **Tên model AI**: chỉ ở [src/config/models.ts](../../../src/config/models.ts) — KHÔNG hardcode chuỗi model.
- **Theme**: dùng token ngữ nghĩa; modal overlay theo house dùng `bg-white dark:bg-slate-900` như modal hiện có; tránh dựa `bg-slate-*` cho bề mặt "sáng cố định" mới (lớp override `!important` ở [index.css](../../../src/index.css) remap slate/white theo theme).
- **Firebase field mới đều optional** trên doc owner-only → KHÔNG cần đổi Firestore rules.
- **api/ tách khỏi tsconfig** → type-check riêng: `npx tsc --noEmit --skipLibCheck --moduleResolution bundler --module esnext --target es2020 --types node api/*.ts`.
- **Function `api/` phải TỰ CHỨA** (Vercel không bundle import cục bộ) → api/github.ts không import helper trong `src/`.
- **CI 4 bước** phải xanh khi xong: `npm run lint` · `npm test` · `npm run build` · type-check api.
- Nhánh làm việc: `feat/github-skills-library` (đã tạo, spec đã commit).

---

### Task 1: Mô hình dữ liệu + manifest catalog

**Files:**
- Modify: `src/types.ts` (thêm `ContentSource`, `AiSkill.kind`, `AiSkill.source`, `AiRule.source`, chuyển `CustomProfile` vào types)
- Create: `src/data/skillCatalog.ts` (types catalog + seed + collections)
- Modify: `src/components/tabs/UtilityBeltTab.tsx:16-23` (dùng `CustomProfile` từ types thay vì khai báo cục bộ)
- Test: `src/__tests__/skillCatalog.test.ts` (phần "manifest integrity")

**Interfaces:**
- Produces: `ContentSource`, `AiSkill.kind`, `AiSkill.source`, `AiRule.source`, `CustomProfile` (đã dời sang types + `source?`), `CatalogEntry`, `CatalogCategory`, `CatalogFormat`, `SKILL_CATALOG`, `CATALOG_COLLECTIONS`.

- [ ] **Step 1: Thêm types vào `src/types.ts`**

Chèn ngay TRƯỚC `export interface AiRule` (dòng 13) khối:

```ts
/** Xuất xứ của một mục nhập từ nguồn ngoài (GitHub). undefined ⇒ do người dùng tự tạo. */
export interface ContentSource {
  origin: 'github';
  repo: string;         // "anthropics/skills"
  path: string;         // "document-skills/pdf/SKILL.md"
  htmlUrl?: string;     // link xem trên GitHub
  license?: string;     // "MIT" | "Apache-2.0" | ...
  author?: string;
  importedAt: string;   // ISO
  sha?: string;         // để phát hiện cũ / re-sync (đợt sau)
}
```

Trong `AiRule` (đang ở dòng 13-22) thêm ngay trên `isPreset?`:

```ts
  source?: ContentSource; // có nếu nhập từ GitHub
```

Trong `AiSkill` (dòng 40-49) thêm ngay dưới `description: string;`:

```ts
  /** undefined ⇒ 'structured' (mọi skill cũ). 'document' = skill markdown nhập từ GitHub. */
  kind?: 'structured' | 'document';
  source?: ContentSource;
```

Thêm ở CUỐI file `src/types.ts`:

```ts
// ── LLM Config (UtilityBeltTab) — dời khỏi component để dùng chung khi import ──
export interface CustomProfile {
  id: string;
  name: string;
  role: string;
  context: string;
  constraints: string;
  outputFormat: string;
  source?: ContentSource; // có nếu nhập từ GitHub
}
```

- [ ] **Step 2: Cập nhật `UtilityBeltTab.tsx` dùng `CustomProfile` từ types**

Tại [UtilityBeltTab.tsx:16-23](../../../src/components/tabs/UtilityBeltTab.tsx) XÓA khối `interface CustomProfile {...}` cục bộ. Thêm vào import types hiện có phía trên (sau dòng `import { useWorkspace }...`):

```ts
import { CustomProfile } from '../../types';
```

(Nếu chưa có import types nào khác trong file thì thêm dòng trên là đủ.)

- [ ] **Step 3: Tạo manifest `src/data/skillCatalog.ts` (types + seed nháp)**

```ts
// Manifest catalog "Thư viện năng lực AI" — tuyển chọn skill/rule/config/guide từ GitHub.
// Noi theo src/data/templateShowcase.ts: dữ liệu tĩnh, co-located với type.
// rawUrl PHẢI trỏ host GitHub công khai; nội dung tải lazy qua /api/github khi preview/import.

export type CatalogCategory = 'skill' | 'rule' | 'config' | 'guide';
export type CatalogFormat = 'skill-md' | 'cursorrules' | 'markdown' | 'system-prompt';

export interface CatalogEntry {
  id: string;                 // duy nhất trong manifest
  category: CatalogCategory;  // QUYẾT ĐỊNH kho đích khi import
  format: CatalogFormat;      // gợi ý cách hiển thị/parse
  title: string;
  description: string;
  tags: string[];
  icon?: string;              // emoji
  collection: string;         // id họ nguồn (nhóm ở sidebar)
  repo: string;               // "owner/name"
  path: string;               // đường dẫn file trong repo
  rawUrl: string;             // raw.githubusercontent.com/...
  htmlUrl?: string;           // github.com/... (xem nguồn)
  license?: string;
  author?: string;
}

export interface CatalogCollection {
  id: string;
  label: string;
  category: CatalogCategory;
  description?: string;
}

export const CATALOG_COLLECTIONS: CatalogCollection[] = [
  { id: 'agent-skills',   label: 'Agent Skills (SKILL.md)', category: 'skill',  description: 'Skill chuẩn markdown + frontmatter' },
  { id: 'coding-rules',   label: 'Rules agent coding',      category: 'rule',   description: 'Cursor / AGENTS.md / CLAUDE.md' },
  { id: 'system-prompts', label: 'System prompt & persona', category: 'config', description: 'Vai trò cho ChatGPT/Gemini/Claude' },
  { id: 'prompt-guides',  label: 'Prompt framework & guide',category: 'guide',  description: 'Cẩm nang kỹ thuật prompt' },
];

// SEED NHÁP — mỗi rawUrl PHẢI verify 200 ở Step 5 trước khi giữ lại.
export const SKILL_CATALOG: CatalogEntry[] = [
  {
    id: 'anthropic-pdf', category: 'skill', format: 'skill-md',
    title: 'PDF toolkit', description: 'Đọc/điền/ghép/tách PDF, OCR, trích bảng.',
    tags: ['pdf', 'document', 'office'], icon: '📄', collection: 'agent-skills',
    repo: 'anthropics/skills', path: 'document-skills/pdf/SKILL.md',
    rawUrl: 'https://raw.githubusercontent.com/anthropics/skills/main/document-skills/pdf/SKILL.md',
    htmlUrl: 'https://github.com/anthropics/skills/blob/main/document-skills/pdf/SKILL.md',
    license: 'See repo', author: 'anthropics',
  },
  {
    id: 'anthropic-docx', category: 'skill', format: 'skill-md',
    title: 'Word (.docx) toolkit', description: 'Tạo/sửa/đọc tài liệu Word, template.',
    tags: ['docx', 'word', 'office'], icon: '📝', collection: 'agent-skills',
    repo: 'anthropics/skills', path: 'document-skills/docx/SKILL.md',
    rawUrl: 'https://raw.githubusercontent.com/anthropics/skills/main/document-skills/docx/SKILL.md',
    htmlUrl: 'https://github.com/anthropics/skills/blob/main/document-skills/docx/SKILL.md',
    license: 'See repo', author: 'anthropics',
  },
  {
    id: 'anthropic-xlsx', category: 'skill', format: 'skill-md',
    title: 'Excel (.xlsx) toolkit', description: 'Tạo/sửa bảng tính, công thức, biểu đồ.',
    tags: ['xlsx', 'excel', 'data'], icon: '📊', collection: 'agent-skills',
    repo: 'anthropics/skills', path: 'document-skills/xlsx/SKILL.md',
    rawUrl: 'https://raw.githubusercontent.com/anthropics/skills/main/document-skills/xlsx/SKILL.md',
    htmlUrl: 'https://github.com/anthropics/skills/blob/main/document-skills/xlsx/SKILL.md',
    license: 'See repo', author: 'anthropics',
  },
  {
    id: 'cursor-react-ts', category: 'rule', format: 'cursorrules',
    title: 'React + TypeScript rules', description: 'Quy tắc code React/TS cho Cursor.',
    tags: ['react', 'typescript', 'cursor'], icon: '⚛️', collection: 'coding-rules',
    repo: 'PatrickJS/awesome-cursorrules', path: 'rules/react-typescript-cursorrules-prompt-file/.cursorrules',
    rawUrl: 'https://raw.githubusercontent.com/PatrickJS/awesome-cursorrules/main/rules/react-typescript-cursorrules-prompt-file/.cursorrules',
    htmlUrl: 'https://github.com/PatrickJS/awesome-cursorrules/blob/main/rules/react-typescript-cursorrules-prompt-file/.cursorrules',
    license: 'CC0-1.0', author: 'PatrickJS',
  },
  {
    id: 'cursor-nextjs', category: 'rule', format: 'cursorrules',
    title: 'Next.js rules', description: 'Quy tắc code Next.js (App Router) cho Cursor.',
    tags: ['nextjs', 'react', 'cursor'], icon: '▲', collection: 'coding-rules',
    repo: 'PatrickJS/awesome-cursorrules', path: 'rules/nextjs-react-typescript-cursorrules-prompt-fil/.cursorrules',
    rawUrl: 'https://raw.githubusercontent.com/PatrickJS/awesome-cursorrules/main/rules/nextjs-react-typescript-cursorrules-prompt-fil/.cursorrules',
    htmlUrl: 'https://github.com/PatrickJS/awesome-cursorrules/blob/main/rules/nextjs-react-typescript-cursorrules-prompt-fil/.cursorrules',
    license: 'CC0-1.0', author: 'PatrickJS',
  },
  {
    id: 'sysprompt-linux-terminal', category: 'config', format: 'system-prompt',
    title: 'Linux Terminal', description: 'Persona giả lập terminal Linux.',
    tags: ['developer', 'terminal', 'persona'], icon: '🖥️', collection: 'system-prompts',
    repo: 'mustvlad/ChatGPT-System-Prompts', path: 'prompts/developer/linux-terminal.md',
    rawUrl: 'https://raw.githubusercontent.com/mustvlad/ChatGPT-System-Prompts/main/prompts/developer/linux-terminal.md',
    htmlUrl: 'https://github.com/mustvlad/ChatGPT-System-Prompts/blob/main/prompts/developer/linux-terminal.md',
    license: 'MIT', author: 'mustvlad',
  },
  {
    id: 'sysprompt-socratic', category: 'config', format: 'system-prompt',
    title: 'Socratic Tutor', description: 'Gia sư khơi gợi tư duy, không giải hộ.',
    tags: ['education', 'tutor', 'persona'], icon: '🎓', collection: 'system-prompts',
    repo: 'mustvlad/ChatGPT-System-Prompts', path: 'prompts/education/socratic-method.md',
    rawUrl: 'https://raw.githubusercontent.com/mustvlad/ChatGPT-System-Prompts/main/prompts/education/socratic-method.md',
    htmlUrl: 'https://github.com/mustvlad/ChatGPT-System-Prompts/blob/main/prompts/education/socratic-method.md',
    license: 'MIT', author: 'mustvlad',
  },
  {
    id: 'guide-prompting-intro', category: 'guide', format: 'markdown',
    title: 'Prompt Engineering — Nhập môn', description: 'Nguyên tắc nền tảng viết prompt hiệu quả.',
    tags: ['guide', 'basics'], icon: '📘', collection: 'prompt-guides',
    repo: 'dair-ai/Prompt-Engineering-Guide', path: 'guides/prompts-intro.md',
    rawUrl: 'https://raw.githubusercontent.com/dair-ai/Prompt-Engineering-Guide/main/guides/prompts-intro.md',
    htmlUrl: 'https://github.com/dair-ai/Prompt-Engineering-Guide/blob/main/guides/prompts-intro.md',
    license: 'MIT', author: 'dair-ai',
  },
  {
    id: 'guide-advanced-techniques', category: 'guide', format: 'markdown',
    title: 'Kỹ thuật prompt nâng cao', description: 'Few-shot, CoT, self-consistency…',
    tags: ['guide', 'advanced', 'chain-of-thought'], icon: '🧠', collection: 'prompt-guides',
    repo: 'dair-ai/Prompt-Engineering-Guide', path: 'guides/prompts-advanced-usage.md',
    rawUrl: 'https://raw.githubusercontent.com/dair-ai/Prompt-Engineering-Guide/main/guides/prompts-advanced-usage.md',
    htmlUrl: 'https://github.com/dair-ai/Prompt-Engineering-Guide/blob/main/guides/prompts-advanced-usage.md',
    license: 'MIT', author: 'dair-ai',
  },
];
```

- [ ] **Step 4: Viết test manifest integrity**

Tạo `src/__tests__/skillCatalog.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SKILL_CATALOG, CATALOG_COLLECTIONS } from '../data/skillCatalog';

describe('SKILL_CATALOG integrity', () => {
  it('id là duy nhất', () => {
    const ids = SKILL_CATALOG.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('mọi entry có trường bắt buộc + category/format hợp lệ', () => {
    const cats = new Set(['skill', 'rule', 'config', 'guide']);
    const fmts = new Set(['skill-md', 'cursorrules', 'markdown', 'system-prompt']);
    for (const e of SKILL_CATALOG) {
      expect(cats.has(e.category), `${e.id}.category`).toBe(true);
      expect(fmts.has(e.format), `${e.id}.format`).toBe(true);
      expect(e.title.trim(), `${e.id}.title`).not.toBe('');
      expect(e.description.trim(), `${e.id}.description`).not.toBe('');
      expect(Array.isArray(e.tags), `${e.id}.tags`).toBe(true);
    }
  });

  it('rawUrl là https tới host GitHub công khai', () => {
    const hosts = new Set(['raw.githubusercontent.com', 'github.com', 'api.github.com']);
    for (const e of SKILL_CATALOG) {
      const u = new URL(e.rawUrl);
      expect(u.protocol, `${e.id}`).toBe('https:');
      expect(hosts.has(u.hostname), `${e.id} host`).toBe(true);
    }
  });

  it('collection của mỗi entry tồn tại trong CATALOG_COLLECTIONS', () => {
    const known = new Set(CATALOG_COLLECTIONS.map(c => c.id));
    for (const e of SKILL_CATALOG) {
      expect(known.has(e.collection), `${e.id}.collection=${e.collection}`).toBe(true);
    }
  });
});
```

- [ ] **Step 5: Verify rawUrl sống + chạy test**

Verify từng URL (sửa/loại entry 404, tối thiểu giữ ≥1 entry mỗi collection):

```bash
for u in \
  "https://raw.githubusercontent.com/anthropics/skills/main/document-skills/pdf/SKILL.md" \
  "https://raw.githubusercontent.com/PatrickJS/awesome-cursorrules/main/rules/react-typescript-cursorrules-prompt-file/.cursorrules" \
  "https://raw.githubusercontent.com/mustvlad/ChatGPT-System-Prompts/main/prompts/education/socratic-method.md" \
  "https://raw.githubusercontent.com/dair-ai/Prompt-Engineering-Guide/main/guides/prompts-intro.md" ; do \
  echo "$(curl -s -o /dev/null -w '%{http_code}' "$u")  $u"; done
```

Expected: mỗi dòng in `200 <url>`. Với URL trả `404`, mở repo trên GitHub tìm đường dẫn đúng (hoặc nhánh `master` thay `main`) và cập nhật `rawUrl`/`htmlUrl`/`path` trong manifest. Sau đó:

Run: `npm test -- skillCatalog`
Expected: PASS toàn bộ describe `SKILL_CATALOG integrity`.

- [ ] **Step 6: Lint + commit**

Run: `npm run lint`
Expected: không lỗi type mới.

```bash
git add src/types.ts src/data/skillCatalog.ts src/components/tabs/UtilityBeltTab.tsx src/__tests__/skillCatalog.test.ts
git commit -m "feat(library): mô hình dữ liệu + manifest catalog GitHub"
```

---

### Task 2: Pipeline import thuần (`src/utils/skillCatalog.ts`)

**Files:**
- Create: `src/utils/skillCatalog.ts`
- Test: `src/__tests__/skillCatalog.test.ts` (thêm describe mới)

**Interfaces:**
- Consumes: `CatalogEntry` (Task 1), `AiSkill`/`AiRule`/`CustomProfile`/`ContentSource` (Task 1).
- Produces: `isAllowedGithubRawUrl(raw: string): boolean`; `parseFrontmatter(md: string): { data: Record<string,string>; body: string }`; `entryToSkill(entry, rawText): AiSkill`; `entryToRule(entry, rawText): AiRule`; `entryToProfile(entry, rawText): CustomProfile`; `routeImport(entry, rawText): RoutedImport`; type `ImportTarget = 'skill'|'rule'|'config'`; interface `RoutedImport { target: ImportTarget; skill?: AiSkill; rule?: AiRule; profile?: CustomProfile }`.

- [ ] **Step 1: Viết test cho các hàm thuần (thêm vào `src/__tests__/skillCatalog.test.ts`)**

Thêm vào cuối file (giữ import cũ, bổ sung import mới):

```ts
import {
  isAllowedGithubRawUrl, parseFrontmatter, entryToSkill, entryToRule, entryToProfile, routeImport,
} from '../utils/skillCatalog';
import type { CatalogEntry } from '../data/skillCatalog';

const mkEntry = (over: Partial<CatalogEntry>): CatalogEntry => ({
  id: 't1', category: 'skill', format: 'skill-md', title: 'T', description: 'D', tags: ['a'],
  collection: 'agent-skills', repo: 'o/r', path: 'p/SKILL.md',
  rawUrl: 'https://raw.githubusercontent.com/o/r/main/p/SKILL.md', ...over,
});

describe('isAllowedGithubRawUrl', () => {
  it('chấp nhận raw.githubusercontent.com https', () => {
    expect(isAllowedGithubRawUrl('https://raw.githubusercontent.com/o/r/main/x.md')).toBe(true);
  });
  it('từ chối host khác / http', () => {
    expect(isAllowedGithubRawUrl('https://evil.com/x')).toBe(false);
    expect(isAllowedGithubRawUrl('http://raw.githubusercontent.com/x')).toBe(false);
    expect(isAllowedGithubRawUrl('not a url')).toBe(false);
  });
});

describe('parseFrontmatter', () => {
  it('tách frontmatter YAML phẳng + body', () => {
    const md = '---\nname: PDF\ndescription: "Xử lý PDF"\n---\n# Body\nnội dung';
    const r = parseFrontmatter(md);
    expect(r.data.name).toBe('PDF');
    expect(r.data.description).toBe('Xử lý PDF');
    expect(r.body).toContain('# Body');
  });
  it('không có frontmatter → data rỗng, body = nguyên văn', () => {
    const r = parseFrontmatter('# chỉ có tiêu đề');
    expect(r.data).toEqual({});
    expect(r.body).toBe('# chỉ có tiêu đề');
  });
  it('giá trị chứa dấu ":" vẫn giữ nguyên phần sau dấu ":" đầu', () => {
    const r = parseFrontmatter('---\ntitle: A: B: C\n---\nx');
    expect(r.data.title).toBe('A: B: C');
  });
});

describe('entryToSkill', () => {
  it('tạo skill kind=document, ưu tiên name/description từ frontmatter, gắn source', () => {
    const entry = mkEntry({ category: 'skill' });
    const skill = entryToSkill(entry, '---\nname: PDF\ndescription: Xử lý PDF\n---\nHướng dẫn dùng');
    expect(skill.kind).toBe('document');
    expect(skill.title).toBe('PDF');
    expect(skill.description).toBe('Xử lý PDF');
    expect(skill.instructions).toContain('Hướng dẫn dùng');
    expect(skill.inputs).toEqual([]);
    expect(skill.steps).toEqual([]);
    expect(skill.source?.origin).toBe('github');
    expect(skill.source?.repo).toBe('o/r');
  });
  it('không có frontmatter → dùng title/description của entry', () => {
    const entry = mkEntry({ title: 'Entry Title', description: 'Entry Desc' });
    const skill = entryToSkill(entry, 'chỉ body');
    expect(skill.title).toBe('Entry Title');
    expect(skill.description).toBe('Entry Desc');
    expect(skill.instructions).toBe('chỉ body');
  });
});

describe('entryToRule', () => {
  it('category guide → markdown-guide; rule → system-rules; giữ content + tags + source', () => {
    const guide = entryToRule(mkEntry({ category: 'guide', format: 'markdown', tags: ['g'] }), '# guide');
    expect(guide.type).toBe('markdown-guide');
    expect(guide.content).toBe('# guide');
    expect(guide.tags).toEqual(['g']);
    expect(guide.source?.origin).toBe('github');
    const rule = entryToRule(mkEntry({ category: 'rule', format: 'cursorrules' }), 'rules text');
    expect(rule.type).toBe('system-rules');
  });
});

describe('entryToProfile', () => {
  it('dồn toàn bộ nội dung vào role, tên từ frontmatter nếu có', () => {
    const p = entryToProfile(mkEntry({ category: 'config', format: 'system-prompt' }), '---\nname: Tutor\n---\nBạn là gia sư.');
    expect(p.name).toBe('Tutor');
    expect(p.role).toContain('Bạn là gia sư.');
    expect(p.context).toBe('');
    expect(p.constraints).toBe('');
    expect(p.outputFormat).toBe('');
    expect(p.source?.origin).toBe('github');
  });
});

describe('routeImport', () => {
  it('route theo category', () => {
    expect(routeImport(mkEntry({ category: 'skill' }), 'x').target).toBe('skill');
    expect(routeImport(mkEntry({ category: 'rule' }), 'x').target).toBe('rule');
    expect(routeImport(mkEntry({ category: 'guide' }), 'x').target).toBe('rule');
    expect(routeImport(mkEntry({ category: 'config' }), 'x').target).toBe('config');
  });
  it('payload đúng nhánh', () => {
    const r = routeImport(mkEntry({ category: 'skill' }), 'x');
    expect(r.skill).toBeTruthy();
    expect(r.rule).toBeUndefined();
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `npm test -- skillCatalog`
Expected: FAIL — `Cannot find module '../utils/skillCatalog'` (chưa tạo).

- [ ] **Step 3: Viết `src/utils/skillCatalog.ts`**

```ts
import { AiSkill, AiRule, CustomProfile, ContentSource } from '../types';
import { CatalogEntry } from '../data/skillCatalog';

const ALLOWED_HOSTS = ['raw.githubusercontent.com', 'github.com', 'api.github.com'];

/** Chỉ cho phép URL https tới host GitHub công khai (chống SSRF phía client trước khi gọi proxy). */
export function isAllowedGithubRawUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && ALLOWED_HOSTS.includes(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export interface Frontmatter { data: Record<string, string>; body: string; }

/** Parser YAML-frontmatter tối giản: chỉ cặp key: value phẳng của SKILL.md. */
export function parseFrontmatter(md: string): Frontmatter {
  const m = md.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: md };
  const data: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) data[key] = val;
  }
  return { data, body: m[2] };
}

function makeSource(entry: CatalogEntry): ContentSource {
  return {
    origin: 'github',
    repo: entry.repo,
    path: entry.path,
    htmlUrl: entry.htmlUrl,
    license: entry.license,
    author: entry.author,
    importedAt: new Date().toISOString(),
  };
}

export function entryToSkill(entry: CatalogEntry, rawText: string): AiSkill {
  const { data, body } = parseFrontmatter(rawText);
  return {
    id: `skill-gh-${entry.id}-${Date.now()}`,
    title: data.name || data.title || entry.title,
    description: data.description || entry.description,
    kind: 'document',
    inputs: [],
    steps: [],
    instructions: body,
    source: makeSource(entry),
    updatedAt: new Date().toISOString(),
  };
}

export function entryToRule(entry: CatalogEntry, rawText: string): AiRule {
  return {
    id: `rule-gh-${entry.id}-${Date.now()}`,
    title: entry.title,
    description: entry.description,
    content: rawText,
    type: entry.category === 'guide' ? 'markdown-guide' : 'system-rules',
    tags: entry.tags,
    source: makeSource(entry),
    updatedAt: new Date().toISOString(),
  };
}

export function entryToProfile(entry: CatalogEntry, rawText: string): CustomProfile {
  const { data, body } = parseFrontmatter(rawText);
  return {
    id: `profile-gh-${entry.id}-${Date.now()}`,
    name: data.name || data.title || entry.title,
    role: (body || rawText).trim(),
    context: '',
    constraints: '',
    outputFormat: '',
    source: makeSource(entry),
  };
}

export type ImportTarget = 'skill' | 'rule' | 'config';
export interface RoutedImport {
  target: ImportTarget;
  skill?: AiSkill;
  rule?: AiRule;
  profile?: CustomProfile;
}

/** Chọn kho đích + dựng payload theo category của entry. */
export function routeImport(entry: CatalogEntry, rawText: string): RoutedImport {
  switch (entry.category) {
    case 'skill':  return { target: 'skill',  skill: entryToSkill(entry, rawText) };
    case 'config': return { target: 'config', profile: entryToProfile(entry, rawText) };
    case 'rule':
    case 'guide':
    default:       return { target: 'rule',   rule: entryToRule(entry, rawText) };
  }
}
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npm test -- skillCatalog`
Expected: PASS toàn bộ (integrity + các describe mới).

- [ ] **Step 5: Lint + commit**

Run: `npm run lint`
Expected: sạch.

```bash
git add src/utils/skillCatalog.ts src/__tests__/skillCatalog.test.ts
git commit -m "feat(library): pipeline parse/route import thuần + test"
```

---

### Task 3: Backend proxy `api/github.ts`

**Files:**
- Create: `api/github.ts`

**Interfaces:**
- Produces: endpoint `POST /api/github` với body `{ action: 'raw', url: string }` → `200 { text: string, truncated: boolean }`; lỗi → `{ error }`. Auth Firebase ID token (như `fetch-url`).

- [ ] **Step 1: Tạo `api/github.ts` (tự chứa, nhân khuôn fetch-url)**

```ts
import { createRemoteJWKSet, jwtVerify } from 'jose';

// ─────────────────────────────────────────────────────────────────────────────
// Vercel Serverless Function: proxy tải nội dung RAW từ GitHub cho "Thư viện
// năng lực AI" (client bị CORS + rate-limit khi gọi thẳng GitHub).
// Tự chứa (không import helper cục bộ). Auth Firebase ID token như api/ai.ts.
// Allow-list host GitHub + chống SSRF + cap dung lượng.
// action:'search' để dành cho đợt sau (live GitHub search) — chưa bật.
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT_ID = 'eduai-nexus';
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

const FETCH_TIMEOUT_MS = 10_000;
const MAX_TEXT_CHARS = 50_000;       // SKILL.md/guide dài hơn 15k của fetch-url; text thuần nên an toàn
const MAX_DOWNLOAD_BYTES = 3_000_000;
const ALLOWED_HOSTS = new Set(['raw.githubusercontent.com', 'github.com', 'api.github.com']);

const RL_PER_MIN = Math.max(1, Number(process.env.GITHUB_RATE_LIMIT_PER_MIN) || 20);
const rlBuckets = new Map<string, number[]>();

function checkRateLimit(uid: string): boolean {
  const now = Date.now();
  if (rlBuckets.size > 5000) rlBuckets.clear();
  const stamps = (rlBuckets.get(uid) || []).filter((t) => now - t < 60_000);
  if (stamps.length >= RL_PER_MIN) return false;
  stamps.push(now);
  rlBuckets.set(uid, stamps);
  return true;
}

function resolveCorsOrigin(req: any): string | null {
  const origin: string | undefined = req.headers?.origin;
  if (!origin) return null;
  try {
    const o = new URL(origin);
    if (req.headers?.host && o.host === req.headers.host) return origin;
    if (o.hostname === 'localhost' || o.hostname === '127.0.0.1') return origin;
  } catch { return null; }
  const extra = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return extra.includes(origin) ? origin : null;
}

function applyCors(req: any, res: any): void {
  const origin = resolveCorsOrigin(req);
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

async function verifyFirebaseToken(authHeader?: string): Promise<string | null> {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer (.+)$/);
  if (!m) return null;
  try {
    const { payload } = await jwtVerify(m[1], JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });
    return typeof payload.sub === 'string' && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

function validateGithubUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('URL không hợp lệ.'); }
  if (url.protocol !== 'https:') throw new Error('Chỉ hỗ trợ https.');
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('Chỉ cho phép tải từ GitHub (raw.githubusercontent.com).');
  }
  return url;
}

export default async function handler(req: any, res: any) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const uid = await verifyFirebaseToken(req.headers?.authorization);
  if (!uid) return res.status(401).json({ error: 'Cần đăng nhập (Firebase ID token không hợp lệ).' });
  if (!checkRateLimit(uid)) return res.status(429).json({ error: 'Tải quá nhanh — thử lại sau một phút.' });

  const action = typeof req.body?.action === 'string' ? req.body.action : 'raw';
  if (action !== 'raw') {
    return res.status(400).json({ error: `action "${action}" chưa được hỗ trợ.` });
  }

  const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  if (!rawUrl) return res.status(400).json({ error: 'Thiếu url.' });

  let url: URL;
  try { url = validateGithubUrl(rawUrl); }
  catch (e: any) { return res.status(400).json({ error: e.message }); }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PromptBuilderBot/1.0; +ai-power-library)',
        Accept: 'text/plain, text/markdown, application/json;q=0.9, */*;q=0.5',
      },
    });
    clearTimeout(timer);

    if (!response.ok) {
      return res.status(422).json({ error: `GitHub trả về HTTP ${response.status}.` });
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_DOWNLOAD_BYTES) {
      return res.status(422).json({ error: 'Tệp quá lớn (>3MB).' });
    }
    let text = new TextDecoder('utf-8').decode(buffer).trim();
    const truncated = text.length > MAX_TEXT_CHARS;
    text = text.slice(0, MAX_TEXT_CHARS);
    if (!text) return res.status(422).json({ error: 'Tệp rỗng.' });

    return res.status(200).json({ text, truncated });
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? 'Hết thời gian chờ (10s).' : (err?.message || 'Không tải được tệp.');
    return res.status(422).json({ error: msg });
  }
}
```

- [ ] **Step 2: Type-check api**

Run:
```bash
npx tsc --noEmit --skipLibCheck --moduleResolution bundler --module esnext --target es2020 --types node api/*.ts
```
Expected: không lỗi.

- [ ] **Step 3: Commit**

```bash
git add api/github.ts
git commit -m "feat(library): proxy api/github tải raw từ GitHub (allow-list + cap)"
```

---

### Task 4: Client catalog service (`src/services/catalogService.ts`)

**Files:**
- Create: `src/services/catalogService.ts`
- Test: `src/__tests__/skillCatalog.test.ts` (thêm describe `filterCatalog`)

**Interfaces:**
- Consumes: `SKILL_CATALOG`, `CatalogEntry`, `CatalogCategory` (Task 1); `isAllowedGithubRawUrl` (Task 2); `auth` từ `../firebase`.
- Produces: `CatalogQuery`; `CatalogSource`; `filterCatalog(entries, query): CatalogEntry[]`; `fetchCatalogContent(entry): Promise<string>`; `staticCatalogSource: CatalogSource`.

- [ ] **Step 1: Viết test cho `filterCatalog` (thêm vào `src/__tests__/skillCatalog.test.ts`)**

```ts
import { filterCatalog } from '../services/catalogService';

describe('filterCatalog', () => {
  const sample: CatalogEntry[] = [
    mkEntry({ id: 'a', category: 'skill', collection: 'agent-skills', title: 'PDF', tags: ['pdf'] }),
    mkEntry({ id: 'b', category: 'rule', collection: 'coding-rules', title: 'React', tags: ['react'] }),
    mkEntry({ id: 'c', category: 'config', collection: 'system-prompts', title: 'Tutor', tags: ['edu'] }),
  ];
  it('lọc theo category', () => {
    expect(filterCatalog(sample, { category: 'skill' }).map(e => e.id)).toEqual(['a']);
  });
  it('lọc theo collection', () => {
    expect(filterCatalog(sample, { collection: 'coding-rules' }).map(e => e.id)).toEqual(['b']);
  });
  it('lọc theo text (title/description/tags, không phân biệt hoa thường)', () => {
    expect(filterCatalog(sample, { text: 'react' }).map(e => e.id)).toEqual(['b']);
    expect(filterCatalog(sample, { text: 'PDF' }).map(e => e.id)).toEqual(['a']);
  });
  it('query rỗng → trả tất cả', () => {
    expect(filterCatalog(sample, {}).length).toBe(3);
  });
});
```

- [ ] **Step 2: Chạy test xác nhận FAIL**

Run: `npm test -- skillCatalog`
Expected: FAIL — `Cannot find module '../services/catalogService'`.

- [ ] **Step 3: Viết `src/services/catalogService.ts`**

```ts
import { auth } from '../firebase';
import { SKILL_CATALOG, CatalogEntry, CatalogCategory } from '../data/skillCatalog';
import { isAllowedGithubRawUrl } from '../utils/skillCatalog';

export interface CatalogQuery {
  category?: CatalogCategory;
  collection?: string;
  text?: string;
}

/** Nguồn catalog trừu tượng — đợt 1 dùng static; đợt sau cắm GitHub live cùng interface. */
export interface CatalogSource {
  id: string;
  label: string;
  list(query: CatalogQuery): Promise<CatalogEntry[]>;
  fetchContent(entry: CatalogEntry): Promise<string>;
}

/** Lọc thuần — tách để unit-test. */
export function filterCatalog(entries: CatalogEntry[], query: CatalogQuery): CatalogEntry[] {
  const text = (query.text || '').trim().toLowerCase();
  return entries.filter((e) => {
    if (query.category && e.category !== query.category) return false;
    if (query.collection && e.collection !== query.collection) return false;
    if (text) {
      const hay = `${e.title} ${e.description} ${e.tags.join(' ')}`.toLowerCase();
      if (!hay.includes(text)) return false;
    }
    return true;
  });
}

/** Tải nội dung raw của một entry qua proxy /api/github (mirror webFetchService). */
export async function fetchCatalogContent(entry: CatalogEntry): Promise<string> {
  if (!isAllowedGithubRawUrl(entry.rawUrl)) {
    throw new Error('URL nguồn không thuộc GitHub hợp lệ.');
  }
  const user = auth.currentUser;
  if (!user) throw new Error('Bạn cần đăng nhập để tải nội dung từ GitHub.');
  const token = await user.getIdToken();

  const res = await fetch('/api/github', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'raw', url: entry.rawUrl }),
  });

  let data: any = null;
  try { data = await res.json(); } catch { /* body không phải JSON */ }
  if (!res.ok) throw new Error(data?.error || `Lỗi tải nội dung (HTTP ${res.status}).`);
  if (!data?.text) throw new Error('Không nhận được nội dung từ GitHub.');
  return data.text as string;
}

export const staticCatalogSource: CatalogSource = {
  id: 'static',
  label: 'Tuyển chọn (GitHub)',
  async list(query) { return filterCatalog(SKILL_CATALOG, query); },
  fetchContent(entry) { return fetchCatalogContent(entry); },
};
```

- [ ] **Step 4: Chạy test xác nhận PASS + lint**

Run: `npm test -- skillCatalog`
Expected: PASS.
Run: `npm run lint`
Expected: sạch.

- [ ] **Step 5: Commit**

```bash
git add src/services/catalogService.ts src/__tests__/skillCatalog.test.ts
git commit -m "feat(library): CatalogSource + StaticCatalogSource + filter thuần"
```

---

### Task 5: Persist import + component `LibraryExplorer`

**Files:**
- Create: `src/services/importService.ts`
- Create: `src/components/library-explorer/CatalogCard.tsx`
- Create: `src/components/library-explorer/CatalogPreviewPanel.tsx`
- Create: `src/components/library-explorer/LibraryExplorer.tsx`

**Interfaces:**
- Consumes: `routeImport`, `RoutedImport`, `ImportTarget` (Task 2); `staticCatalogSource`, `CatalogQuery` (Task 4); `CatalogEntry`, `CatalogCategory`, `CATALOG_COLLECTIONS` (Task 1); `toast` (Toaster).
- Produces: `persistImport(routed: RoutedImport, user: User | null): Promise<void>`; component `LibraryExplorer` với props `{ open: boolean; onClose: () => void; user: User | null; defaultCategory?: CatalogCategory; categories: CatalogCategory[]; onImported: (target: ImportTarget) => void }`.

- [ ] **Step 1: Viết `src/services/importService.ts`**

```ts
import { User } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { RoutedImport } from '../utils/skillCatalog';

function readArr<T>(key: string): T[] {
  try {
    const r = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(r) ? (r as T[]) : [];
  } catch { return []; }
}

/**
 * Ghi mục nhập vào đúng kho theo target: localStorage (mọi trường hợp) + Firestore
 * (skills/rules khi đăng nhập). Profile (LLM config) hiện chỉ localStorage như tab.
 */
export async function persistImport(routed: RoutedImport, user: User | null): Promise<void> {
  if (routed.target === 'skill' && routed.skill) {
    const list = readArr<any>('custom_skills');
    list.push(routed.skill);
    localStorage.setItem('custom_skills', JSON.stringify(list));
    if (user) {
      await setDoc(doc(db, 'skills', routed.skill.id), {
        userId: user.uid,
        title: routed.skill.title,
        description: routed.skill.description,
        kind: routed.skill.kind ?? 'structured',
        inputs: routed.skill.inputs,
        steps: routed.skill.steps,
        instructions: routed.skill.instructions,
        source: routed.skill.source ?? null,
        updatedAt: serverTimestamp(),
        authorName: user.displayName || 'User',
      });
    }
  } else if (routed.target === 'rule' && routed.rule) {
    const list = readArr<any>('custom_rules');
    list.push(routed.rule);
    localStorage.setItem('custom_rules', JSON.stringify(list));
    if (user) {
      await setDoc(doc(db, 'rules', routed.rule.id), {
        userId: user.uid,
        title: routed.rule.title,
        description: routed.rule.description,
        content: routed.rule.content,
        type: routed.rule.type,
        tags: routed.rule.tags,
        source: routed.rule.source ?? null,
        updatedAt: serverTimestamp(),
        authorName: user.displayName || 'User',
      });
    }
  } else if (routed.target === 'config' && routed.profile) {
    const list = readArr<any>('llm_custom_profiles');
    list.push(routed.profile);
    localStorage.setItem('llm_custom_profiles', JSON.stringify(list));
  }
}
```

- [ ] **Step 2: Viết `src/components/library-explorer/CatalogCard.tsx`**

```tsx
import React from 'react';
import { CatalogEntry } from '../../data/skillCatalog';

interface Props {
  entry: CatalogEntry;
  selected: boolean;
  onClick: () => void;
}

const CATEGORY_LABEL: Record<string, string> = {
  skill: 'Skill', rule: 'Rule', config: 'Config', guide: 'Guide',
};

export default function CatalogCard({ entry, selected, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
        selected
          ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-900/60 shadow-sm'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-xs text-slate-700 dark:text-slate-200 truncate flex items-center gap-1.5">
          <span>{entry.icon || '📦'}</span>{entry.title}
        </span>
        <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded-full shrink-0">
          {CATEGORY_LABEL[entry.category]}
        </span>
      </div>
      <span className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-2">{entry.description}</span>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[9px] text-slate-400">{entry.repo}</span>
        {entry.license && (
          <span className="text-[9px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{entry.license}</span>
        )}
      </div>
    </button>
  );
}
```

- [ ] **Step 3: Viết `src/components/library-explorer/CatalogPreviewPanel.tsx`**

```tsx
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { RefreshCw, Download, ExternalLink, AlertTriangle } from 'lucide-react';
import { CatalogEntry } from '../../data/skillCatalog';

interface Props {
  entry: CatalogEntry | null;
  content: string;
  loading: boolean;
  error: string | null;
  importing: boolean;
  onImport: () => void;
}

export default function CatalogPreviewPanel({ entry, content, loading, error, importing, onImport }: Props) {
  if (!entry) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-xs italic p-6 text-center">
        Chọn một mục ở danh sách bên trái để xem trước nội dung.
      </div>
    );
  }
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-sm text-slate-800 dark:text-white truncate flex items-center gap-1.5">
            <span>{entry.icon || '📦'}</span>{entry.title}
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {entry.repo}{entry.license ? ` · ${entry.license}` : ''}{entry.author ? ` · @${entry.author}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {entry.htmlUrl && (
            <a href={entry.htmlUrl} target="_blank" rel="noopener noreferrer"
              className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-350 flex items-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-800">
              <ExternalLink size={12} /> GitHub
            </a>
          )}
          <button onClick={onImport} disabled={loading || importing || !content}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
            {importing ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
            <span>Nhập vào thư viện</span>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        {loading ? (
          <p className="text-slate-400 italic text-xs flex items-center gap-2">
            <RefreshCw size={13} className="animate-spin" /> Đang tải nội dung từ GitHub…
          </p>
        ) : error ? (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-xs">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{error}{entry.htmlUrl ? ' — bạn vẫn có thể mở trên GitHub.' : ''}</span>
          </div>
        ) : (
          <>
            {entry.format === 'skill-md' && (
              <p className="mb-3 text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 rounded-lg px-3 py-2">
                Chỉ nhập nội dung <strong>SKILL.md</strong>; tài nguyên phụ (scripts/, references/) không được nhập — xem trên GitHub nếu cần.
              </p>
            )}
            <div className="prose prose-slate dark:prose-invert prose-sm max-w-none text-xs leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Viết `src/components/library-explorer/LibraryExplorer.tsx`**

```tsx
import { toast } from '../common/Toaster';
import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { Compass, Search, X } from 'lucide-react';
import { CatalogEntry, CatalogCategory, CATALOG_COLLECTIONS } from '../../data/skillCatalog';
import { staticCatalogSource } from '../../services/catalogService';
import { routeImport, ImportTarget } from '../../utils/skillCatalog';
import { persistImport } from '../../services/importService';
import CatalogCard from './CatalogCard';
import CatalogPreviewPanel from './CatalogPreviewPanel';

// Cache nội dung raw qua localStorage để mở lại tức thì giữa các phiên (spec Phần D).
const CACHE_PREFIX = 'gh_catalog_cache_';
function readCachedContent(id: string): string | null {
  try { return localStorage.getItem(CACHE_PREFIX + id); } catch { return null; }
}
function writeCachedContent(id: string, text: string): void {
  try { localStorage.setItem(CACHE_PREFIX + id, text); } catch { /* quota — bỏ qua */ }
}

interface Props {
  open: boolean;
  onClose: () => void;
  user: User | null;
  defaultCategory?: CatalogCategory;
  categories: CatalogCategory[];          // chip lọc hiển thị
  onImported: (target: ImportTarget) => void;
}

const CAT_LABEL: Record<CatalogCategory, string> = {
  skill: 'Skills', rule: 'Rules', config: 'Configs', guide: 'Guides',
};

export default function LibraryExplorer({ open, onClose, user, defaultCategory, categories, onImported }: Props) {
  const [category, setCategory] = useState<CatalogCategory | 'all'>(defaultCategory || 'all');
  const [text, setText] = useState('');
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [selected, setSelected] = useState<CatalogEntry | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [cache] = useState<Map<string, string>>(() => new Map());

  // Reset bộ lọc mặc định mỗi lần mở.
  useEffect(() => {
    if (open) { setCategory(defaultCategory || 'all'); setText(''); setSelected(null); setContent(''); setError(null); }
  }, [open, defaultCategory]);

  // Liệt kê theo bộ lọc.
  useEffect(() => {
    if (!open) return;
    staticCatalogSource
      .list({ category: category === 'all' ? undefined : category, text })
      .then(setEntries);
  }, [open, category, text]);

  // Tải nội dung khi chọn — cache trong phiên (Map) + localStorage (giữ giữa các phiên).
  useEffect(() => {
    if (!selected) return;
    const id = selected.id;
    const memo = cache.get(id) ?? readCachedContent(id);
    if (memo !== undefined && memo !== null) {
      cache.set(id, memo); setContent(memo); setError(null); setLoading(false); return;
    }
    setLoading(true); setError(null); setContent('');
    staticCatalogSource.fetchContent(selected)
      .then((t) => { cache.set(id, t); writeCachedContent(id, t); setContent(t); })
      .catch((e) => setError(e?.message || 'Không tải được nội dung.'))
      .finally(() => setLoading(false));
  }, [selected, cache]);

  const handleImport = async () => {
    if (!selected || !content) return;
    setImporting(true);
    try {
      const routed = routeImport(selected, content);
      await persistImport(routed, user);
      toast.success(`Đã nhập "${selected.title}" vào ${CAT_LABEL[selected.category]}.`);
      onImported(routed.target);
    } catch (e) {
      console.error(e);
      toast.error('Nhập thất bại. Vui lòng thử lại.');
    } finally {
      setImporting(false);
    }
  };

  if (!open) return null;

  const chips: (CatalogCategory | 'all')[] = ['all', ...categories];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999] animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-250 dark:border-slate-800 shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-2">
            <Compass className="text-indigo-600 w-5 h-5" />
            <h2 className="font-bold text-sm text-slate-800 dark:text-white">Thư viện năng lực AI — Khám phá GitHub</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Filter bar */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 flex-wrap">
          <div className="flex bg-slate-100 dark:bg-slate-950 p-0.5 rounded-xl border border-slate-200/50 dark:border-slate-800">
            {chips.map((c) => (
              <button key={c} onClick={() => setCategory(c)}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  category === c ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {c === 'all' ? 'Tất cả' : CAT_LABEL[c]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 flex-1 min-w-[160px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5">
            <Search size={13} className="text-slate-400" />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Tìm skill, rule, persona…"
              className="flex-1 bg-transparent text-xs focus:outline-none text-slate-700 dark:text-slate-200" />
          </div>
        </div>

        {/* Body: list + preview */}
        <div className="flex-1 flex min-h-0">
          <div className="w-2/5 border-r border-slate-100 dark:border-slate-800 overflow-y-auto custom-scrollbar p-3 space-y-2">
            {entries.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-3">Không có mục nào khớp bộ lọc.</p>
            ) : (
              entries.map((e) => (
                <CatalogCard key={e.id} entry={e} selected={selected?.id === e.id} onClick={() => setSelected(e)} />
              ))
            )}
          </div>
          <CatalogPreviewPanel entry={selected} content={content} loading={loading} error={error} importing={importing} onImport={handleImport} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Build + lint**

Run: `npm run build`
Expected: build thành công (không lỗi type/JSX).
Run: `npm run lint`
Expected: sạch.

- [ ] **Step 6: Commit**

```bash
git add src/services/importService.ts src/components/library-explorer/
git commit -m "feat(library): LibraryExplorer (list + preview + import) + persistImport"
```

---

### Task 6: Nối vào SkillsPanel — hỗ trợ skill `document` + nút Khám phá

**Files:**
- Modify: `src/components/rulesskills/SkillsPanel.tsx`

**Interfaces:**
- Consumes: `LibraryExplorer` (Task 5); `ImportTarget` (Task 2).
- Produces: hành vi — skill `kind==='document'` hiển thị editor markdown đơn + banner nguồn; `buildSkillSpec` trả instructions cho document; nút "Khám phá GitHub" mở modal; sau import bump reload đọc lại localStorage.

- [ ] **Step 1: Import + state cho modal & kind**

Trong [SkillsPanel.tsx](../../../src/components/rulesskills/SkillsPanel.tsx) thêm import (sau import `remarkGfm`):

```tsx
import LibraryExplorer from '../library-explorer/LibraryExplorer';
import { ExternalLink, Compass } from 'lucide-react';
```

(Nếu `ExternalLink`/`Compass` chưa có trong dòng import `lucide-react` sẵn — dùng dòng import riêng trên là được, không trùng.)

Thêm state cạnh các `useState` skill (sau `const [syncError, ...]`):

```tsx
  const [skillKind, setSkillKind] = useState<'structured' | 'document'>('structured');
  const [explorerOpen, setExplorerOpen] = useState(false);
```

- [ ] **Step 2: `selectSkill` set kind; đọc kind/source khi load localStorage + sync**

Trong `selectSkill` (đang set các field) thêm dòng:

```tsx
    setSkillKind(skill.kind === 'document' ? 'document' : 'structured');
```

Trong effect mount đọc localStorage, `parsedSkills` giữ nguyên (đối tượng đã có kind/source). Trong `syncSkills`, tại `dbSkills.push({...})` thêm 2 field để không mất khi sync từ Firestore:

```tsx
        dbSkills.push({
          id: docSnap.id,
          title: data.title,
          description: data.description || '',
          kind: data.kind === 'document' ? 'document' : 'structured',
          inputs: data.inputs || [],
          steps: data.steps || [],
          instructions: data.instructions || '',
          source: data.source || undefined,
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
```

- [ ] **Step 3: `handleSaveSkill` + `buildSkillSpec` xử lý document**

Trong `handleSaveSkill`, trong object `updatedSkill` thêm `kind: skillKind,` và giữ `source` nếu có — đổi khai báo:

```tsx
    const existing = skills.find(s => s.id === selectedSkillId);
    const updatedSkill: AiSkill = {
      id: selectedSkillId,
      title: skillTitle,
      description: skillDesc,
      kind: skillKind,
      inputs: skillInputs,
      steps: skillSteps,
      instructions: skillInstructions,
      source: existing?.source,
      updatedAt: new Date().toISOString(),
    };
```

Và trong `setDoc(...)` Firestore của skill, thêm `kind: skillKind,` và `source: updatedSkill.source ?? null,`.

Trong `buildSkillSpec`, thêm ở ĐẦU hàm (trước phần dựng structured):

```tsx
    if (skillKind === 'document') {
      return skillInstructions || `# ${skillTitle}\n\n(Skill nhập từ GitHub — chưa có nội dung.)`;
    }
```

- [ ] **Step 4: Nút "Khám phá GitHub" + banner document + render modal**

Trong header sidebar Kỹ năng AI (khối `<h3>Kỹ năng AI</h3>` + nút `Plus`), thêm nút cạnh nút tạo mới:

```tsx
            <button
              onClick={() => setExplorerOpen(true)}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-500 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200/50"
              title="Khám phá & nhập skill từ GitHub"
            >
              <Compass size={16} />
            </button>
```

Ngay dưới khối "Skill Basic Info" (grid tên+mô tả), thêm banner khi là document:

```tsx
              {skillKind === 'document' && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 text-[11px] text-indigo-700 dark:text-indigo-300">
                  <span className="font-bold">📥 Skill dạng tài liệu (nhập từ GitHub)</span>
                  {(() => { const s = skills.find(x => x.id === selectedSkillId); return s?.source?.htmlUrl ? (
                    <a href={s.source.htmlUrl} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 font-semibold hover:underline">
                      <ExternalLink size={11} /> Nguồn{s.source.license ? ` · ${s.source.license}` : ''}
                    </a>
                  ) : null; })()}
                </div>
              )}
```

Bọc khối managers inputs/steps (grid `xl:grid-cols-2` "Khai báo biến đầu vào" + "Định nghĩa Quy trình") bằng điều kiện ẩn khi document — đổi mở khối thành:

```tsx
              {skillKind === 'structured' && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-2">
```
và thêm `)}` đóng ngay sau `</div>` kết thúc grid managers (trước khối "Instructions Markdown Editor").

Cuối cùng, ngay trước `</>` đóng của return (sau `</div>` ngoài cùng của grid chính), render modal:

```tsx
      <LibraryExplorer
        open={explorerOpen}
        onClose={() => setExplorerOpen(false)}
        user={user}
        defaultCategory="skill"
        categories={['skill']}
        onImported={() => {
          // Đọc lại localStorage (không phụ thuộc đăng nhập) để skill mới xuất hiện.
          const parsed = safeParseArray<AiSkill>(localStorage.getItem('custom_skills')).filter(sk => !sk.isPreset);
          setSkills([...PRESET_SKILLS, ...parsed]);
          setExplorerOpen(false);
          if (user) syncSkills();
        }}
      />
```

- [ ] **Step 5: Build + lint**

Run: `npm run build`
Expected: thành công.
Run: `npm run lint`
Expected: sạch.

Kiểm tra thủ công nhanh (mô tả, không bắt buộc script): mở tab Rules&Skills → Skills → nút la bàn mở modal; chọn 1 skill → preview; Nhập → skill mới xuất hiện ở sidebar với banner "Skill dạng tài liệu", chạy thử được ở tab "Chạy thử".

- [ ] **Step 6: Commit**

```bash
git add src/components/rulesskills/SkillsPanel.tsx
git commit -m "feat(library): SkillsPanel hỗ trợ skill document + nút Khám phá GitHub"
```

---

### Task 7: Nối vào RulesSkillsTab (rules) + UtilityBeltTab (config)

**Files:**
- Modify: `src/components/tabs/RulesSkillsTab.tsx`
- Modify: `src/components/tabs/UtilityBeltTab.tsx`

**Interfaces:**
- Consumes: `LibraryExplorer` (Task 5).
- Produces: nút "Khám phá GitHub" ở header 2 tab; sau import đọc lại localStorage kho tương ứng.

- [ ] **Step 1: RulesSkillsTab — import + state + đọc source khi sync**

Trong [RulesSkillsTab.tsx](../../../src/components/tabs/RulesSkillsTab.tsx) thêm import:

```tsx
import LibraryExplorer from '../library-explorer/LibraryExplorer';
import { Compass } from 'lucide-react';
```

Thêm state (cạnh `syncToken`):

```tsx
  const [explorerOpen, setExplorerOpen] = useState(false);
```

Trong `syncDataWithFirestore`, tại `dbRules.push({...})` thêm `source: data.source || undefined,` (ngay trước `updatedAt`).

- [ ] **Step 2: RulesSkillsTab — nút mở modal (chỉ hiện ở sub-tab rules) + render modal**

Trong header (khối chứa nút "Đồng bộ đám mây" + switch rules/skills), thêm nút NGAY TRƯỚC cụm switch:

```tsx
          <button
            onClick={() => setExplorerOpen(true)}
            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900/50 text-xs font-semibold text-indigo-700 dark:text-indigo-400 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
            title="Khám phá & nhập rule/skill/persona từ GitHub"
          >
            <Compass size={14} />
            <span>Khám phá GitHub</span>
          </button>
```

Ngay trước `</div>` đóng ngoài cùng của tab (trước dấu đóng return cuối), render:

```tsx
      <LibraryExplorer
        open={explorerOpen}
        onClose={() => setExplorerOpen(false)}
        user={user}
        defaultCategory="rule"
        categories={['skill', 'rule', 'guide']}
        onImported={(target) => {
          if (target === 'rule') {
            const parsed = safeParseArray<AiRule>(localStorage.getItem('custom_rules')).filter(r => !r.isPreset);
            setRules([...PRESET_RULES, ...parsed]);
          } else if (target === 'skill') {
            setSyncToken(t => t + 1); // SkillsPanel đọc lại
          }
          setExplorerOpen(false);
        }}
      />
```

*(Ghi chú: khi target='skill' import từ đây, `setSyncToken` khiến SkillsPanel re-sync/đọc lại — SkillsPanel đã thêm đọc localStorage ở Task 6 onImported; ở đây bump syncToken là đủ vì SkillsPanel mount-lại effect sync. Nếu người dùng đang ở sub-tab rules, skill vẫn được lưu, hiện khi mở tab Skills.)*

- [ ] **Step 3: UtilityBeltTab — import + state + nút + đọc lại profiles**

Trong [UtilityBeltTab.tsx](../../../src/components/tabs/UtilityBeltTab.tsx) thêm import:

```tsx
import LibraryExplorer from '../library-explorer/LibraryExplorer';
import { Compass } from 'lucide-react';
```

Thêm state (cạnh các `useState`):

```tsx
  const [explorerOpen, setExplorerOpen] = useState(false);
```

Trong header (cụm nút phải, cạnh "Tạo Cấu Hình Mới"), thêm NGAY TRƯỚC nút tạo mới:

```tsx
          <button
            onClick={() => setExplorerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 rounded-xl transition-all cursor-pointer active:scale-95"
            title="Khám phá & nhập persona/system-prompt từ GitHub"
          >
            <Compass size={14} />
            Khám phá GitHub
          </button>
```

Ngay trước `</div>` đóng ngoài cùng của return, render:

```tsx
      <LibraryExplorer
        open={explorerOpen}
        onClose={() => setExplorerOpen(false)}
        user={user}
        defaultCategory="config"
        categories={['config']}
        onImported={(target) => {
          if (target === 'config') {
            try {
              const stored = localStorage.getItem('llm_custom_profiles');
              const list: CustomProfile[] = stored ? JSON.parse(stored) : [];
              setProfiles(list);
              if (list.length) setActiveProfileId(list[list.length - 1].id);
            } catch { /* bỏ qua */ }
          }
          setExplorerOpen(false);
        }}
      />
```

- [ ] **Step 4: Build + lint**

Run: `npm run build`
Expected: thành công.
Run: `npm run lint`
Expected: sạch.

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs/RulesSkillsTab.tsx src/components/tabs/UtilityBeltTab.tsx
git commit -m "feat(library): nút Khám phá GitHub ở RulesSkillsTab + UtilityBeltTab"
```

---

### Task 8: Verify toàn phần + tài liệu

**Files:**
- Modify: `CLAUDE.md` (một dòng mô tả tính năng mới ở phần kiến trúc, nếu phù hợp)

**Interfaces:** không có mã mới; đảm bảo CI 4 bước xanh.

- [ ] **Step 1: Chạy đủ 4 bước CI**

Run: `npm run lint`
Expected: sạch.
Run: `npm test`
Expected: mọi test PASS (gồm `skillCatalog`, giữ nguyên `skillRunner`, `groqConfig`, `templateShowcase`).
Run: `npm run build`
Expected: build thành công.
Run:
```bash
npx tsc --noEmit --skipLibCheck --moduleResolution bundler --module esnext --target es2020 --types node api/*.ts
```
Expected: không lỗi.

- [ ] **Step 2: Ghi chú kiến trúc vào CLAUDE.md**

Thêm 1 gạch đầu dòng vào mục "Kiến trúc" của [CLAUDE.md](../../../CLAUDE.md), sau dòng mô tả tab:

```markdown
- **Thư viện năng lực AI** (`src/components/library-explorer/`): modal khám phá + nhập skill/rule/persona từ GitHub. Lớp `CatalogSource` (`src/services/catalogService.ts`) — đợt 1 `StaticCatalogSource` đọc manifest `src/data/skillCatalog.ts`, tải raw on-demand qua `api/github.ts`; logic parse/route thuần ở `src/utils/skillCatalog.ts`. Skill nhập về là `AiSkill.kind='document'`. Mở từ RulesSkillsTab + UtilityBeltTab; import route theo `category`.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: ghi chú kiến trúc Thư viện năng lực AI vào CLAUDE.md"
```

---

## Ghi chú triển khai (đọc trước khi bắt đầu)

- **Thứ tự phụ thuộc**: Task 1 → 2 → (3 song song được) → 4 → 5 → 6 → 7 → 8. Task 3 (proxy) độc lập, có thể làm bất cứ lúc nào sau Task 1.
- **Không phá test cũ**: `skillRunner`, `groqConfig`, `templateShowcase` phải giữ xanh; các neo test UI (nút "Remix", grid `.grid.pb-20`) không nằm trong phạm vi sửa.
- **`document` skill trong luồng cũ**: `validateRun` chỉ soi biến required → skill không biến chạy trực tiếp; `renderSkillPrompt(instructions, {})` giữ nguyên `{{token}}` không có giá trị (an toàn). `handlePushSkillToPromptBuilder` dùng `buildSkillSpec()` → đã có nhánh document (Task 6 Step 3).
- **Rủi ro rawUrl 404**: manifest verify ở Task 1 Step 5; runtime 404 → `CatalogPreviewPanel` báo lỗi mềm + link GitHub, không vỡ modal.
- **Phạm vi ngoài (đợt sau)**: live GitHub search (`action:'search'` + `GITHUB_TOKEN`), authoring wizard/xuất đa định dạng, mở rộng preset built-in, nhập tài nguyên phụ (scripts) của Agent Skill, re-sync theo `sha`.
