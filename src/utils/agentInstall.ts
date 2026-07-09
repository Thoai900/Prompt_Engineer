import { CatalogEntry } from '../data/skillCatalog';

// Một câu lệnh cài skill cho một coding agent.
export interface AgentCommand {
  agent: string;                 // nhãn hiển thị
  kind: 'download' | 'native';
  command: string;               // copy-paste được
  note?: string;
}

/** Tên skill → slug kebab-case an toàn cho đường dẫn thư mục. */
export function slugifySkill(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'skill';
}

interface DownloadTarget { label: string; dir: string; note?: string; }

// Bảng đích tải theo agent — dễ sửa. Đường dẫn Codex cần người dùng xác nhận.
const DOWNLOAD_TARGETS: DownloadTarget[] = [
  { label: 'Claude Code (user)', dir: '~/.claude/skills' },
  { label: 'Claude Code (project)', dir: '.claude/skills' },
  { label: 'Codex', dir: '~/.codex/skills', note: 'Xác nhận đường dẫn skills của Codex.' },
];

/**
 * Sinh danh sách câu lệnh cài nhanh cho một skill (chỉ áp dụng entry category 'skill').
 * Universal download snippet vào thư mục skills từng agent + biến thể tải cả folder (degit).
 */
export function buildInstallCommands(entry: CatalogEntry): AgentCommand[] {
  if (entry.category !== 'skill') return [];
  const slug = slugifySkill(entry.title);
  const cmds: AgentCommand[] = [];

  for (const t of DOWNLOAD_TARGETS) {
    cmds.push({
      agent: t.label,
      kind: 'download',
      command: `mkdir -p ${t.dir}/${slug} && curl -fsSL ${entry.rawUrl} -o ${t.dir}/${slug}/SKILL.md`,
      note: t.note,
    });
  }

  // Skill nằm trong thư mục con → cho lệnh tải CẢ folder (gồm scripts/references nếu có) qua degit.
  const dir = entry.path.replace(/\/?SKILL\.md$/i, '');
  if (dir) {
    cmds.push({
      agent: 'Claude Code (cả folder)',
      kind: 'download',
      command: `npx degit ${entry.repo}/${dir} ~/.claude/skills/${slug}`,
      note: 'Tải toàn bộ thư mục skill (gồm scripts/ nếu có).',
    });
  }

  // Antigravity dùng trình cài riêng (theo ghi nhớ agy plugin install) — cú pháp cần xác nhận.
  cmds.push({
    agent: 'Antigravity',
    kind: 'native',
    command: `agy plugin install ${entry.repo}`,
    note: 'Cú pháp agy plugin install cần xác nhận; hoặc tải thủ công như Claude Code.',
  });

  return cmds;
}
