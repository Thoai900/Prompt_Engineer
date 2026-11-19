import { describe, it, expect } from 'vitest';
import { toSkillMd, toCursorrules, toAgentsMd, toClaudeMd } from '../utils/exporters';
import { AiSkill, AiRule } from '../types';

const skill: AiSkill = {
  id: 's', title: 'PDF Helper', description: 'Xử lý PDF',
  inputs: [{ name: 'file', type: 'text', required: true, description: 'đường dẫn' }],
  steps: [{ id: 'a', order: 1, title: 'Đọc', description: 'đọc file' }],
  instructions: 'Làm việc với {{file}}', updatedAt: '',
};
const rule: AiRule = {
  id: 'r', title: 'Code Rules', description: 'quy tắc',
  content: '# Rules\n- luôn test', type: 'system-rules', tags: [], updatedAt: '',
};

describe('exporters', () => {
  it('toSkillMd: frontmatter name/description + inputs/steps/instructions', () => {
    const md = toSkillMd(skill);
    expect(md.startsWith('---\nname: PDF Helper\ndescription: Xử lý PDF\n---')).toBe(true);
    expect(md).toContain('`file`');
    expect(md).toContain('1. Đọc');
    expect(md).toContain('{{file}}');
  });

  it('toSkillMd cho rule dùng content', () => {
    const md = toSkillMd(rule);
    expect(md).toContain('name: Code Rules');
    expect(md).toContain('# Rules');
  });

  it('toCursorrules: tiêu đề + body, KHÔNG frontmatter', () => {
    const c = toCursorrules(rule);
    expect(c).toContain('# Code Rules');
    expect(c).not.toContain('---\nname:');
  });

  it('toAgentsMd và toClaudeMd cùng nội dung, có tiêu đề', () => {
    expect(toClaudeMd(rule)).toBe(toAgentsMd(rule));
    expect(toAgentsMd(rule)).toContain('# Code Rules');
  });
});

// ── Prompt Graph → Agent Skill ──────────────────────────────────────────────
import { graphToSkillMd, graphSkillInstallCommands } from '../utils/exporters';
import { DOWNLOAD_TARGETS } from '../utils/agentInstall';
import { PromptProject } from '../types';

const graph = (content: string, variables: any[] = [], over: Partial<PromptProject> = {}): PromptProject => ({
  id: 'g', name: 'Viết thơ: lục bát', description: '', globalEvalCriteria: [], nodes: [], createdAt: '', updatedAt: '',
  schemaVersion: 3,
  graphNodes: [{ id: 'root', kind: 'root', title: 'Gốc', content, position: { x: 0, y: 0 }, enabled: true, variables } as any],
  edges: [], ...over,
});

describe('graphToSkillMd', () => {
  it('frontmatter slug + description trong nháy kép, giữ {{biến}}, liệt kê biến', () => {
    const md = graphToSkillMd(graph('Viết bài thơ về {{chude}} cho {{lop}}.', [
      { name: 'chude', type: 'text', required: true, description: 'chủ đề', defaultValue: 'mùa thu' },
    ]))!;
    expect(md.startsWith('---\nname: viet-tho-luc-bat\ndescription: "Chạy prompt \\"Viết thơ: lục bát\\"')).toBe(true);
    expect(md).toContain('cần: chude, lop');
    expect(md).toContain('- `chude` (bắt buộc): chủ đề — mặc định: "mùa thu"');
    expect(md).toContain('- `lop` (bắt buộc)');
    expect(md).toContain('## Cách dùng');
    expect(md).toContain('Viết bài thơ về {{chude}} cho {{lop}}.'); // mặc định KHÔNG bị điền vào
  });

  it('dùng mô tả project nếu có; không biến → bỏ mục Inputs/Cách dùng', () => {
    const md = graphToSkillMd(graph('Tóm tắt văn bản.', [], { description: 'Tóm tắt: ngắn gọn' }))!;
    expect(md).toContain('description: "Tóm tắt: ngắn gọn"');
    expect(md).not.toContain('## Inputs');
    expect(md).toContain('## Instructions\n[');
  });

  it('legacy hoặc prompt trống → null', () => {
    expect(graphToSkillMd(graph('x', [], { schemaVersion: undefined, graphNodes: undefined }))).toBeNull();
    expect(graphToSkillMd(graph('   '))).toBeNull();
  });
});

describe('graphSkillInstallCommands', () => {
  it('một lệnh heredoc cho mỗi thư mục agent, delimiter trong nháy đơn', () => {
    const cmds = graphSkillInstallCommands(graph('Giá $5 và `lệnh` {{x}}'));
    expect(cmds).toHaveLength(DOWNLOAD_TARGETS.length);
    const c = cmds[0].command;
    expect(c.startsWith(`mkdir -p ${DOWNLOAD_TARGETS[0].dir}/viet-tho-luc-bat && cat > ${DOWNLOAD_TARGETS[0].dir}/viet-tho-luc-bat/SKILL.md <<'PB_SKILL_EOF'\n`)).toBe(true);
    expect(c.endsWith('\nPB_SKILL_EOF')).toBe(true);
    expect(c).toContain('Giá $5 và `lệnh` {{x}}');
  });

  it('nội dung chứa dòng trùng delimiter → đổi delimiter', () => {
    const c = graphSkillInstallCommands(graph('a\nPB_SKILL_EOF\nb'))[0].command;
    expect(c).toContain("<<'PB_SKILL_EOF_2'");
    expect(c.endsWith('\nPB_SKILL_EOF_2')).toBe(true);
  });

  it('không xuất được → []', () => {
    expect(graphSkillInstallCommands(graph(''))).toEqual([]);
  });
});
