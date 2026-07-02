import { describe, it, expect } from 'vitest';
import { promptToTemplate } from '../utils/labUtils';

describe('promptToTemplate (Lab → workflow)', () => {
  it('bọc prompt thành template 1 block task', () => {
    const t = promptToTemplate('Bạn là trợ lý email.\nViết chuyên nghiệp.', 'auto-optimizer');
    expect(t.blocks).toHaveLength(1);
    expect(t.blocks[0].type).toBe('task');
    expect(t.blocks[0].content).toBe('Bạn là trợ lý email.\nViết chuyên nghiệp.');
  });

  it('tiêu đề lấy từ dòng đầu, cắt 60 ký tự', () => {
    const long = 'x'.repeat(100);
    expect(promptToTemplate(long, 's').title).toHaveLength(60);
    expect(promptToTemplate('Dòng một\nDòng hai', 's').title).toBe('Dòng một');
  });

  it('gắn tag lab + nguồn, id duy nhất', () => {
    const a = promptToTemplate('p', 'linter');
    const b = promptToTemplate('p', 'linter');
    expect(a.tags).toContain('lab');
    expect(a.tags).toContain('linter');
    expect(a.id).not.toBe(b.id);
  });
});
