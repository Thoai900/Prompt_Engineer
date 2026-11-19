import { describe, it, expect } from 'vitest';
import { parseLabSeed } from '../services/labSeed';

describe('parseLabSeed', () => {
  it('seed cũ chỉ có mode + prompt vẫn đọc được', () => {
    expect(parseLabSeed(JSON.stringify({ mode: 'bakeoff', prompt: 'p' }))).toEqual({ mode: 'bakeoff', prompt: 'p' });
  });

  it('đọc trường mở rộng, bỏ chuỗi rỗng/sai kiểu và trường lạ', () => {
    const seed = parseLabSeed(JSON.stringify({
      mode: 'health', prompt: '', templateId: 't1', templateTitle: 'Blog', suiteId: 3, evil: 'x',
    }));
    expect(seed).toEqual({ mode: 'health', prompt: '', templateId: 't1', templateTitle: 'Blog' });
  });

  it('mode lạ, thiếu prompt, JSON hỏng hoặc rỗng → null', () => {
    expect(parseLabSeed(JSON.stringify({ mode: 'linter', prompt: 'p' }))).toBeNull();
    expect(parseLabSeed(JSON.stringify({ mode: 'health' }))).toBeNull();
    expect(parseLabSeed('{bad')).toBeNull();
    expect(parseLabSeed(null)).toBeNull();
  });
});
