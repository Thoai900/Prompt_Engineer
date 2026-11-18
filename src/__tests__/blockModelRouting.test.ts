import { describe, it, expect, vi, beforeEach } from 'vitest';

// Chặn lớp proxy (cần Firebase/đăng nhập) — ghi lại provider/model của từng lời gọi.
const calls: { provider: string; model?: string }[] = [];
let failProvider: string | null = null;
vi.mock('../services/aiProxy', () => ({
  proxyGenerate: vi.fn(),
  proxyGenerateStream: vi.fn(async (req: { provider: string; model?: string }, onChunk: (c: string) => void) => {
    calls.push({ provider: req.provider, model: req.model });
    if (req.provider === failProvider) throw new Error(`${req.provider} down`);
    onChunk(`from-${req.provider}`);
  }),
}));

import { generateAutoBlockStream, pickBlockModel } from '../services/aiService';
import { GEMINI_FLASH, GEMINI_FLASH_LATEST, GEMINI_PRO } from '../config/models';

describe('pickBlockModel', () => {
  it('mặc định dùng model flash mới nhất', () => {
    expect(pickBlockModel('role')).toBe(GEMINI_FLASH_LATEST);
  });
  it('tôn trọng model người dùng chọn', () => {
    expect(pickBlockModel('role', { model: GEMINI_FLASH })).toBe(GEMINI_FLASH);
  });
  it('suy luận sâu thắng model chọn sẵn với khối phức tạp', () => {
    expect(pickBlockModel('task', { model: GEMINI_FLASH, useDeepReasoning: true })).toBe(GEMINI_PRO);
  });
  it('khối đơn giản không dùng model suy luận', () => {
    expect(pickBlockModel('format', { model: GEMINI_FLASH, useDeepReasoning: true })).toBe(GEMINI_FLASH);
  });
});

describe('generateAutoBlockStream định tuyến', () => {
  beforeEach(() => { calls.length = 0; failProvider = null; });

  it('gọi Gemini trước với model đã chọn, không gọi Groq', async () => {
    let out = '';
    await generateAutoBlockStream('role', 'Vai trò', '', [], 'auto', 2, (c) => { out += c; }, { model: GEMINI_FLASH });
    expect(calls).toEqual([{ provider: 'gemini', model: GEMINI_FLASH }]);
    expect(out).toBe('from-gemini');
  });

  it('Gemini lỗi → tự chuyển sang Groq', async () => {
    failProvider = 'gemini';
    let out = '';
    await generateAutoBlockStream('role', 'Vai trò', '', [], 'auto', 2, (c) => { out += c; });
    expect(calls.map((c) => c.provider)).toEqual(['gemini', 'groq']);
    expect(out).toBe('from-groq');
  });
});
