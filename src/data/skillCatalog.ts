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

// SEED — mỗi rawUrl đã verify 200 (curl) ở Step 5 trước khi giữ lại.
export const SKILL_CATALOG: CatalogEntry[] = [
  {
    id: 'anthropic-pdf', category: 'skill', format: 'skill-md',
    title: 'PDF toolkit', description: 'Đọc/điền/ghép/tách PDF, OCR, trích bảng.',
    tags: ['pdf', 'document', 'office'], icon: '📄', collection: 'agent-skills',
    repo: 'anthropics/skills', path: 'skills/pdf/SKILL.md',
    rawUrl: 'https://raw.githubusercontent.com/anthropics/skills/main/skills/pdf/SKILL.md',
    htmlUrl: 'https://github.com/anthropics/skills/blob/main/skills/pdf/SKILL.md',
    license: 'See repo', author: 'anthropics',
  },
  {
    id: 'anthropic-docx', category: 'skill', format: 'skill-md',
    title: 'Word (.docx) toolkit', description: 'Tạo/sửa/đọc tài liệu Word, template.',
    tags: ['docx', 'word', 'office'], icon: '📝', collection: 'agent-skills',
    repo: 'anthropics/skills', path: 'skills/docx/SKILL.md',
    rawUrl: 'https://raw.githubusercontent.com/anthropics/skills/main/skills/docx/SKILL.md',
    htmlUrl: 'https://github.com/anthropics/skills/blob/main/skills/docx/SKILL.md',
    license: 'See repo', author: 'anthropics',
  },
  {
    id: 'anthropic-xlsx', category: 'skill', format: 'skill-md',
    title: 'Excel (.xlsx) toolkit', description: 'Tạo/sửa bảng tính, công thức, biểu đồ.',
    tags: ['xlsx', 'excel', 'data'], icon: '📊', collection: 'agent-skills',
    repo: 'anthropics/skills', path: 'skills/xlsx/SKILL.md',
    rawUrl: 'https://raw.githubusercontent.com/anthropics/skills/main/skills/xlsx/SKILL.md',
    htmlUrl: 'https://github.com/anthropics/skills/blob/main/skills/xlsx/SKILL.md',
    license: 'See repo', author: 'anthropics',
  },
  {
    id: 'cursor-react-ts', category: 'rule', format: 'cursorrules',
    title: 'React + TypeScript rules', description: 'Quy tắc code React/TS cho Cursor.',
    tags: ['react', 'typescript', 'cursor'], icon: '⚛️', collection: 'coding-rules',
    repo: 'PatrickJS/awesome-cursorrules', path: 'rules/typescript-react-cursorrules-prompt-file.mdc',
    rawUrl: 'https://raw.githubusercontent.com/PatrickJS/awesome-cursorrules/main/rules/typescript-react-cursorrules-prompt-file.mdc',
    htmlUrl: 'https://github.com/PatrickJS/awesome-cursorrules/blob/main/rules/typescript-react-cursorrules-prompt-file.mdc',
    license: 'CC0-1.0', author: 'PatrickJS',
  },
  {
    id: 'cursor-nextjs', category: 'rule', format: 'cursorrules',
    title: 'Next.js rules', description: 'Quy tắc code Next.js (App Router) cho Cursor.',
    tags: ['nextjs', 'react', 'cursor'], icon: '▲', collection: 'coding-rules',
    repo: 'PatrickJS/awesome-cursorrules', path: 'rules/nextjs-react-typescript-cursorrules-prompt-file.mdc',
    rawUrl: 'https://raw.githubusercontent.com/PatrickJS/awesome-cursorrules/main/rules/nextjs-react-typescript-cursorrules-prompt-file.mdc',
    htmlUrl: 'https://github.com/PatrickJS/awesome-cursorrules/blob/main/rules/nextjs-react-typescript-cursorrules-prompt-file.mdc',
    license: 'CC0-1.0', author: 'PatrickJS',
  },
  {
    id: 'sysprompt-linux-terminal', category: 'config', format: 'system-prompt',
    title: 'Linux Terminal', description: 'Persona giả lập terminal Linux.',
    tags: ['developer', 'terminal', 'persona'], icon: '🖥️', collection: 'system-prompts',
    repo: 'mustvlad/ChatGPT-System-Prompts', path: 'prompts/utility/linux-terminal.md',
    rawUrl: 'https://raw.githubusercontent.com/mustvlad/ChatGPT-System-Prompts/main/prompts/utility/linux-terminal.md',
    htmlUrl: 'https://github.com/mustvlad/ChatGPT-System-Prompts/blob/main/prompts/utility/linux-terminal.md',
    license: 'MIT', author: 'mustvlad',
  },
  {
    id: 'sysprompt-socratic', category: 'config', format: 'system-prompt',
    title: 'Socratic Tutor', description: 'Gia sư khơi gợi tư duy, không giải hộ.',
    tags: ['education', 'tutor', 'persona'], icon: '🎓', collection: 'system-prompts',
    repo: 'mustvlad/ChatGPT-System-Prompts', path: 'prompts/educational/socratic-tutor.md',
    rawUrl: 'https://raw.githubusercontent.com/mustvlad/ChatGPT-System-Prompts/main/prompts/educational/socratic-tutor.md',
    htmlUrl: 'https://github.com/mustvlad/ChatGPT-System-Prompts/blob/main/prompts/educational/socratic-tutor.md',
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
