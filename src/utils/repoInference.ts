import { CatalogEntry, CatalogCategory, CatalogFormat } from '../data/skillCatalog';

// Kết quả một repo từ GitHub Repo Search (rút gọn cho UI live-search).
export interface RepoHit {
  fullName: string;      // "owner/repo"
  description: string;
  stars: number;
  htmlUrl: string;       // https://github.com/owner/repo
  defaultBranch: string; // để dựng raw URL
  license?: string;
  // Trường bổ sung (tuỳ chọn) để hiển thị card repo phong phú hơn.
  owner?: string;        // login chủ repo
  ownerAvatar?: string;  // ảnh đại diện chủ repo
  language?: string;     // ngôn ngữ chính
  topics?: string[];     // nhãn chủ đề
  forks?: number;
  updatedAt?: string;    // ISO — lần push gần nhất
}

function basename(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

/**
 * Suy loại một file trong repo (theo path) thành CatalogEntry để dùng lại pipeline
 * import của Đợt 1. Trả null nếu file không thuộc loại ta quan tâm (skill/rule/guide).
 */
export function inferEntryFromPath(repo: RepoHit, path: string): CatalogEntry | null {
  const lower = path.toLowerCase();
  const base = basename(lower);

  let category: CatalogCategory | null = null;
  let format: CatalogFormat | null = null;

  if (base === 'skill.md') {
    category = 'skill'; format = 'skill-md';
  } else if (base === '.cursorrules' || lower.endsWith('.mdc') || lower.includes('.cursor/rules/')) {
    category = 'rule'; format = 'cursorrules';
  } else if (base === 'agents.md' || base === 'claude.md') {
    category = 'rule'; format = 'markdown';
  } else if (base.endsWith('.md')) {
    // Guide phải HIGH-SIGNAL: README ở GỐC repo, hoặc .md trong prompts/personas/guides.
    // Cố tình BỎ docs/** (đầy plan/tài liệu nội bộ → nhiễu) và README lồng sâu.
    const isRootReadme = base.startsWith('readme') && !path.includes('/');
    const inPromptDir = /(^|\/)(prompts?|personas?|guides?)\//.test(lower);
    if (isRootReadme || inPromptDir) { category = 'guide'; format = 'markdown'; }
  }

  if (!category || !format) return null;

  const owner = repo.fullName.split('/')[0] || '';
  const segs = path.split('/');
  const title = format === 'skill-md' && segs.length >= 2 ? segs[segs.length - 2] : basename(path);

  const id = `gh-${repo.fullName}-${path}`
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return {
    id,
    category,
    format,
    title,
    description: repo.description || repo.fullName,
    tags: [],
    collection: 'github-search',
    repo: repo.fullName,
    path,
    rawUrl: `https://raw.githubusercontent.com/${repo.fullName}/${repo.defaultBranch}/${path}`,
    htmlUrl: `${repo.htmlUrl}/blob/${repo.defaultBranch}/${path}`,
    license: repo.license,
    author: owner,
  };
}
