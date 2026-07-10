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
