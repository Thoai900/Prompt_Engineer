import { describe, expect, it } from 'vitest';
import { buildSearchEntries, filterSearchEntries } from '../utils/globalSearch';
import { PromptTemplate } from '../types';

const template = (id: string, title: string, description = ''): PromptTemplate => ({
  id, title, description, blocks: [],
});

describe('buildSearchEntries', () => {
  it('gom mọi nguồn thành danh sách phẳng, đúng kind/tab', () => {
    const entries = buildSearchEntries({
      templates: [template('t1', 'Viết blog SEO')],
      projects: [{ id: 'p1', name: 'Gia sư Socratic', description: '' }],
      rules: [{ id: 'r1', title: 'Rule TypeScript', description: '' }],
      skills: [{ id: 's1', title: 'Skill dịch thuật', description: '' }],
    });
    expect(entries).toHaveLength(4);
    expect(entries.map((e) => e.kind)).toEqual(['template', 'project', 'rule', 'skill']);
    expect(entries[0].tab).toBe('builder');
    expect(entries[0].template?.id).toBe('t1');
    expect(entries[1].tab).toBe('projectchain');
    expect(entries[2].tab).toBe('rulesskills');
  });

  it('nguồn rỗng/thiếu không gây lỗi', () => {
    expect(buildSearchEntries({})).toEqual([]);
  });
});

describe('filterSearchEntries', () => {
  const entries = buildSearchEntries({
    templates: [
      template('t1', 'Tối ưu hóa mảng JavaScript'),
      template('t2', 'Viết email chuyên nghiệp', 'tối ưu giọng văn công sở'),
    ],
    projects: [{ id: 'p1', name: 'Toi uu landing page', description: '' }],
  });

  it('khớp không phân biệt dấu tiếng Việt', () => {
    const result = filterSearchEntries(entries, 'toi uu');
    expect(result.map((e) => e.id)).toContain('template-t1');
    expect(result.map((e) => e.id)).toContain('project-p1');
  });

  it('xếp hạng: bắt đầu tiêu đề > chứa trong tiêu đề > chứa trong mô tả', () => {
    const result = filterSearchEntries(entries, 'tối ưu');
    // t1 và p1 khớp tiêu đề (startsWith) đứng trước t2 (chỉ khớp mô tả).
    expect(result[result.length - 1].id).toBe('template-t2');
    expect(result[0].title.toLowerCase()).toMatch(/^t[oố]i [uư]u/);
  });

  it('truy vấn rỗng trả mảng rỗng, tôn trọng limit', () => {
    expect(filterSearchEntries(entries, '   ')).toEqual([]);
    expect(filterSearchEntries(entries, 'tối', 1)).toHaveLength(1);
  });
});
