import { describe, it, expect } from 'vitest';
import { parseLabSeed } from '../services/labSeed';

describe('parseLabSeed', () => {
  it('seed cũ chỉ có mode + prompt vẫn đọc được', () => {
    expect(parseLabSeed(JSON.stringify({ mode: 'bakeoff', prompt: 'p' }))).toEqual({ mode: 'bakeoff', prompt: 'p' });
  });

  it('đọc trường mở rộng, lọc phần tử rỗng/sai kiểu, bỏ trường lạ', () => {
    const seed = parseLabSeed(JSON.stringify({
      mode: 'optimizer', prompt: 'p', templateId: 't1', suiteId: 's1',
      testInputs: ['a', '', 3], criteria: ['c'], evil: 'x',
    }));
    expect(seed).toEqual({ mode: 'optimizer', prompt: 'p', templateId: 't1', suiteId: 's1', testInputs: ['a'], criteria: ['c'] });
  });

  it('mode lạ, thiếu prompt, JSON hỏng hoặc rỗng → null', () => {
    expect(parseLabSeed(JSON.stringify({ mode: 'linter', prompt: 'p' }))).toBeNull();
    expect(parseLabSeed(JSON.stringify({ mode: 'health' }))).toBeNull();
    expect(parseLabSeed('{bad')).toBeNull();
    expect(parseLabSeed(null)).toBeNull();
  });
});
