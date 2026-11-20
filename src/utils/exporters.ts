import { AiSkill, AiRule, PromptProject } from '../types';
import { collectGraphVariables } from './graphCompile';
import { compileAppTemplate } from './feedbackUtils';
import { DOWNLOAD_TARGETS, slugifySkill, type AgentCommand } from './agentInstall';

// Xuất skill/rule ra các định dạng file mà coding agent dùng. Hàm thuần (test được);
// downloadText() là side-effect DOM tách riêng.

type Exportable = AiSkill | AiRule;

function oneLine(s: string): string {
  return (s || '').replace(/\r?\n/g, ' ').trim();
}

function frontmatter(name: string, description: string): string {
  return `---\nname: ${oneLine(name)}\ndescription: ${oneLine(description)}\n---\n`;
}

/** Body markdown của skill: inputs → steps → instructions. */
function skillBody(skill: AiSkill): string {
  let md = '';
  if (skill.inputs?.length) {
    md += `## Inputs\n`;
    for (const v of skill.inputs) {
      md += `- \`${v.name}\` (${v.type}${v.required ? ', required' : ''})${v.description ? `: ${v.description}` : ''}\n`;
    }
    md += `\n`;
  }
  if (skill.steps?.length) {
    md += `## Steps\n`;
    for (const s of skill.steps) {
      md += `${s.order}. ${s.title}${s.description ? ` — ${s.description}` : ''}\n`;
    }
    md += `\n`;
  }
  md += `## Instructions\n${skill.instructions || ''}\n`;
  return md;
}

function bodyOf(x: Exportable): string {
  return 'instructions' in x ? skillBody(x as AiSkill) : ((x as AiRule).content || '');
}

/** SKILL.md — frontmatter name/description + body. */
export function toSkillMd(x: Exportable): string {
  return frontmatter(x.title, x.description) + '\n' + bodyOf(x);
}

/** .cursorrules — nội dung thô kèm tiêu đề, không frontmatter. */
export function toCursorrules(x: Exportable): string {
  return `# ${x.title}\n\n${bodyOf(x)}`.trim() + '\n';
}

/** AGENTS.md — tiêu đề + mô tả + body. */
export function toAgentsMd(x: Exportable): string {
  return `# ${x.title}\n\n${x.description ? oneLine(x.description) + '\n\n' : ''}${bodyOf(x)}`.trim() + '\n';
}

/** CLAUDE.md — cùng cấu trúc AGENTS.md (khác tên file). */
export function toClaudeMd(x: Exportable): string {
  return toAgentsMd(x);
}

// ── Prompt Graph → Agent Skill (spec 2026-11-19-graph-export-api-mcp-skill-design.md, Đợt 1) ──

/**
 * SKILL.md từ một Prompt Graph: prompt mẫu (giữ `{{biến}}`) + danh sách biến + hướng dẫn agent điền biến.
 * null nếu app legacy (cây v2, nhiều bước) hoặc prompt trống.
 */
export function graphToSkillMd(project: PromptProject): string | null {
  const template = compileAppTemplate(project);
  if (!template || !template.trim()) return null;
  const vars = collectGraphVariables(project);
  const name = slugifySkill(project.name);
  const description = oneLine(project.description || '') ||
    `Chạy prompt "${oneLine(project.name)}" (dựng bằng PromptBuilder)${vars.length ? ` — cần: ${vars.map((v) => v.name).join(', ')}` : ''}.`;

  // description đặt trong nháy kép (chuỗi JSON là YAML hợp lệ) — tránh vỡ frontmatter khi có dấu ":".
  let md = `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\n---\n\n# ${oneLine(project.name)}\n\n`;
  if (vars.length) {
    md += `## Inputs\n`;
    for (const v of vars) {
      md += `- \`${v.name}\` (${v.required ? 'bắt buộc' : 'tuỳ chọn'})`;
      if (v.description) md += `: ${oneLine(v.description)}`;
      if (v.defaultValue) md += ` — mặc định: ${JSON.stringify(v.defaultValue)}`;
      md += `\n`;
    }
    md += `\n## Cách dùng\nThay mỗi \`{{tên_biến}}\` trong phần Instructions bằng giá trị người dùng cung cấp. ` +
      `Thiếu biến bắt buộc thì hỏi lại người dùng; biến tuỳ chọn bỏ trống thì dùng giá trị mặc định. ` +
      `Sau đó làm theo Instructions như chỉ dẫn hệ thống.\n\n`;
  }
  md += `## Instructions\n${template.trim()}\n`;
  return md;
}

/** Delimiter heredoc không trùng dòng nào trong nội dung (nội dung có thể chứa "EOF"). */
function heredocDelimiter(content: string): string {
  const lines = new Set(content.split('\n'));
  let d = 'PB_SKILL_EOF';
  for (let i = 2; lines.has(d); i++) d = `PB_SKILL_EOF_${i}`;
  return d;
}

/**
 * Lệnh dán-là-chạy tạo `<thư mục skills của agent>/<slug>/SKILL.md` bằng heredoc (không cần host file).
 * Delimiter trong nháy đơn → shell KHÔNG khai triển $, `, \ trong nội dung. [] nếu không xuất được.
 */
export function graphSkillInstallCommands(project: PromptProject): AgentCommand[] {
  const md = graphToSkillMd(project);
  if (!md) return [];
  const slug = slugifySkill(project.name);
  const delim = heredocDelimiter(md);
  return DOWNLOAD_TARGETS.map((t) => ({
    agent: t.label,
    kind: 'download' as const,
    command: `mkdir -p ${t.dir}/${slug} && cat > ${t.dir}/${slug}/SKILL.md <<'${delim}'\n${md}${md.endsWith('\n') ? '' : '\n'}${delim}`,
    note: t.note,
  }));
}

/** Tải một chuỗi text về máy (side-effect DOM). */
export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
