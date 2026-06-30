// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { withPersona } from '../services/aiService';

describe('withPersona', () => {
  const base = 'Bạn là trợ lý.';

  it('trả nguyên systemInstruction khi không có persona', () => {
    expect(withPersona(base)).toBe(base);
    expect(withPersona(base, undefined)).toBe(base);
  });

  it('bỏ qua persona chỉ gồm khoảng trắng', () => {
    expect(withPersona(base, '   ')).toBe(base);
  });

  it('chèn persona làm tiền tố [PERSONA] khi có nội dung', () => {
    const out = withPersona(base, 'Senior Coder.');
    expect(out).toBe(`[PERSONA]\nSenior Coder.\n\n${base}`);
    expect(out.indexOf('[PERSONA]')).toBe(0);
    expect(out.endsWith(base)).toBe(true);
  });
});
