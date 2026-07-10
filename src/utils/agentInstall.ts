import { CatalogEntry } from '../data/skillCatalog';
import { RepoHit } from './repoInference';

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

// ─────────────────────────────────────────────────────────────────────────────
// Lệnh cấp REPO — tải TOÀN BỘ repo về máy (dùng chung, ai cũng chạy được) +
// prompt "ra lệnh cho Agent tự tải & kích hoạt". Dùng cho mỗi repo tìm được.
// ─────────────────────────────────────────────────────────────────────────────

/** Câu lệnh tải toàn bộ repo, độc lập agent (git clone / degit). */
export interface UniversalDownload {
  label: string;
  command: string;
  note?: string;
}

/** Một cách để một agent tự tải & kích hoạt repo: lệnh terminal + prompt dán vào agent. */
export interface AgentRepoAction {
  agent: string;
  command: string;   // lệnh terminal tải repo vào workspace của agent
  prompt: string;    // prompt dán vào agent để nó tự đọc & kích hoạt
  note?: string;
}

export interface RepoCommands {
  universal: UniversalDownload[];   // "câu lệnh chung để riêng"
  agents: AgentRepoAction[];
}

/** Tên thư mục repo (phần sau dấu "/") — an toàn cho đường dẫn (GitHub repo name không có khoảng trắng). */
export function repoFolderName(fullName: string): string {
  const base = fullName.split('/').pop() || fullName;
  return base.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'repo';
}

/**
 * Sinh bộ lệnh cấp repo cho một RepoHit tìm được:
 *  - universal: git clone + degit (tải toàn bộ repo, để riêng cho mọi người dùng);
 *  - agents: mỗi coding agent một lệnh terminal + prompt để tự tải & kích hoạt.
 */
export function buildRepoCommands(repo: RepoHit): RepoCommands {
  const full = repo.fullName;
  const dir = repoFolderName(full);
  const httpsUrl = `https://github.com/${full}.git`;
  const pageUrl = repo.htmlUrl || `https://github.com/${full}`;

  const universal: UniversalDownload[] = [
    {
      label: 'git clone (kèm lịch sử)',
      command: `git clone ${httpsUrl}`,
      note: 'Tải toàn bộ repo vào thư mục hiện tại — cần cài git.',
    },
    {
      label: 'degit (nhẹ, không .git)',
      command: `npx degit ${full} ${dir}`,
      note: 'Chỉ tải file mới nhất, không kèm lịch sử git.',
    },
  ];

  const activate = (place: string) =>
    `Tôi muốn dùng repo ${full} (${pageUrl}). Hãy tải nó về ${place}, đọc README và mọi file SKILL.md để hiểu năng lực, ` +
    `rồi cài đặt và kích hoạt để dùng trong phiên này. Sau đó tóm tắt repo này giúp được gì cho tôi.`;

  const agents: AgentRepoAction[] = [
    {
      agent: 'Claude Code',
      command: `git clone ${httpsUrl} ~/.claude/skills/${dir}`,
      prompt: activate('thư mục skills của bạn (~/.claude/skills/' + dir + ')'),
    },
    {
      agent: 'Codex',
      command: `git clone ${httpsUrl} ~/.codex/skills/${dir}`,
      prompt: activate('thư mục skills của Codex (~/.codex/skills/' + dir + ')'),
      note: 'Xác nhận đường dẫn skills của Codex.',
    },
    {
      agent: 'Antigravity',
      command: `agy plugin install ${full}`,
      prompt: `Hãy cài repo ${full} làm plugin/skill (thử \`agy plugin install ${full}\`, hoặc clone ${pageUrl} nếu không hỗ trợ), ` +
        `đọc README để hiểu năng lực rồi kích hoạt cho tôi.`,
      note: 'Cú pháp agy plugin install cần xác nhận.',
    },
  ];

  return { universal, agents };
}
