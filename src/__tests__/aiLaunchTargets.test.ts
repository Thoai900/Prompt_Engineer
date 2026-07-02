import { describe, it, expect } from 'vitest';
import { AI_LAUNCH_TARGETS, buildAiLaunchUrl, PREFILL_URL_LIMIT } from '../utils/aiLaunchTargets';

const chatgpt = AI_LAUNCH_TARGETS.find(t => t.id === 'chatgpt')!;
const deepseek = AI_LAUNCH_TARGETS.find(t => t.id === 'deepseek')!;

describe('AI_LAUNCH_TARGETS', () => {
  it('id không trùng nhau và URL đều là https', () => {
    const ids = AI_LAUNCH_TARGETS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    AI_LAUNCH_TARGETS.forEach(t => {
      expect(t.baseUrl.startsWith('https://')).toBe(true);
      if (t.prefillPrefix) expect(t.prefillPrefix.startsWith('https://')).toBe(true);
    });
  });

  it('có đủ các nền tảng chính', () => {
    const ids = AI_LAUNCH_TARGETS.map(t => t.id);
    ['chatgpt', 'gemini', 'claude', 'deepseek'].forEach(id => expect(ids).toContain(id));
  });
});

describe('buildAiLaunchUrl', () => {
  it('nền tảng hỗ trợ prefill → nhét prompt đã encode vào URL', () => {
    const { url, prefilled } = buildAiLaunchUrl(chatgpt, 'Viết bài về AI & prompt');
    expect(prefilled).toBe(true);
    expect(url).toBe('https://chatgpt.com/?q=' + encodeURIComponent('Viết bài về AI & prompt'));
  });

  it('nền tảng KHÔNG hỗ trợ prefill → mở trang gốc', () => {
    const { url, prefilled } = buildAiLaunchUrl(deepseek, 'Xin chào');
    expect(prefilled).toBe(false);
    expect(url).toBe(deepseek.baseUrl);
  });

  it('prompt quá dài vượt giới hạn URL → rơi về trang gốc', () => {
    const longPrompt = 'a'.repeat(PREFILL_URL_LIMIT + 1);
    const { url, prefilled } = buildAiLaunchUrl(chatgpt, longPrompt);
    expect(prefilled).toBe(false);
    expect(url).toBe(chatgpt.baseUrl);
  });

  it('prompt rỗng/chỉ khoảng trắng → trang gốc, không prefill', () => {
    const { url, prefilled } = buildAiLaunchUrl(chatgpt, '   ');
    expect(prefilled).toBe(false);
    expect(url).toBe(chatgpt.baseUrl);
  });
});
