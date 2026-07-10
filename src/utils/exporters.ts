import { AiSkill, AiRule } from '../types';

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
