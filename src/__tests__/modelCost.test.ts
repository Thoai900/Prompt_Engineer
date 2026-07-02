import { describe, it, expect } from 'vitest';
import { estimateTokens, estimateCostUSD, MODEL_COSTS, GEMINI_FLASH, GROQ_LLAMA_8B } from '../config/models';

describe('estimateTokens', () => {
  it('~ 4 ký tự / token, làm tròn lên', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });
});

describe('estimateCostUSD', () => {
  it('0 cho model không có bảng giá', () => {
    expect(estimateCostUSD('unknown-model', 'xxxx', 'yyyy')).toBe(0);
  });

  it('cộng chi phí input + output theo bảng giá', () => {
    const inText = 'a'.repeat(4000); // ~1000 token
    const outText = 'b'.repeat(4000); // ~1000 token
    const c = MODEL_COSTS[GEMINI_FLASH];
    const expected = (1000 / 1_000_000) * c.inputPer1M + (1000 / 1_000_000) * c.outputPer1M;
    expect(estimateCostUSD(GEMINI_FLASH, inText, outText)).toBeCloseTo(expected, 10);
  });

  it('model rẻ hơn cho chi phí thấp hơn với cùng nội dung', () => {
    const t = 'x'.repeat(4000);
    expect(estimateCostUSD(GROQ_LLAMA_8B, t, t)).toBeLessThan(estimateCostUSD(GEMINI_FLASH, t, t));
  });
});
