import { describe, it, expect } from 'vitest';
import { lintSkill, lintRule, lintProfile } from '../utils/authoringLint';
import { AiSkill, AiRule, CustomProfile } from '../types';

const mkSkill = (o: Partial<AiSkill>): AiSkill => ({
  id: '', title: 'X', description: '', inputs: [], steps: [], instructions: 'x', updatedAt: '', ...o,
});
const mkRule = (o: Partial<AiRule>): AiRule => ({
  id: '', title: 'T', description: '', content: '# H\nnội dung đủ dài để không bị cảnh báo ngắn', type: 'system-rules', tags: [], updatedAt: '', ...o,
});
const mkProfile = (o: Partial<CustomProfile>): CustomProfile => ({
  id: '', name: '', role: '', context: '', constraints: '', outputFormat: '', ...o,
});

describe('lintSkill', () => {
  it('biến dùng nhưng chưa khai → error; khai nhưng chưa dùng → warn', () => {
    const f = lintSkill(mkSkill({ inputs: [{ name: 'a', type: 'text', required: true }], instructions: 'dùng {{b}}' }));
    expect(f.some((x) => x.level === 'error' && x.message.includes('{{b}}'))).toBe(true);
    expect(f.some((x) => x.level === 'warn' && x.message.includes('"a"'))).toBe(true);
  });
  it('biến khai + dùng khớp → không lỗi biến', () => {
    const f = lintSkill(mkSkill({ inputs: [{ name: 'a', type: 'text', required: true }], instructions: 'dùng {{a}}' }));
    expect(f.some((x) => x.message.includes('{{a}}'))).toBe(false);
  });
  it('instructions rỗng + title rỗng → ≥2 error', () => {
    const f = lintSkill(mkSkill({ title: '', instructions: '' }));
    expect(f.filter((x) => x.level === 'error').length).toBeGreaterThanOrEqual(2);
  });
});

describe('lintRule', () => {
  it('content rỗng → error', () => {
    expect(lintRule(mkRule({ content: '' })).some((x) => x.level === 'error')).toBe(true);
  });
  it('ngắn + không heading → warn', () => {
    const f = lintRule(mkRule({ content: 'ngắn' }));
    expect(f.some((x) => x.level === 'warn')).toBe(true);
  });
});

describe('lintProfile', () => {
  it('tất cả rỗng → error', () => {
    expect(lintProfile(mkProfile({})).some((x) => x.level === 'error')).toBe(true);
  });
  it('có context, thiếu role → warn (không error)', () => {
    const f = lintProfile(mkProfile({ context: 'có bối cảnh dự án' }));
    expect(f.some((x) => x.level === 'warn')).toBe(true);
    expect(f.some((x) => x.level === 'error')).toBe(false);
  });
});
