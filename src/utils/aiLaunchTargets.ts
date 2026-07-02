// Danh sách các nền tảng AI chat lớn để "mở nhanh" prompt vừa build xong.
// Tách thuần (không import React) để unit-test được logic build URL.

export interface AiLaunchTarget {
  id: string;
  name: string;
  /** Trang chat gốc — luôn mở được, người dùng dán prompt từ clipboard. */
  baseUrl: string;
  /** Tiền tố URL prefill (prompt encode nối vào sau) — chỉ khai báo nếu nền tảng hỗ trợ. */
  prefillPrefix?: string;
  /** Class Tailwind cho chấm màu nhận diện thương hiệu. */
  accentClass: string;
}

// Vượt ngưỡng này thì URL dễ bị trình duyệt/nền tảng cắt cụt → mở trang gốc, dựa vào clipboard.
export const PREFILL_URL_LIMIT = 1900;

export const AI_LAUNCH_TARGETS: AiLaunchTarget[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    baseUrl: 'https://chatgpt.com/',
    prefillPrefix: 'https://chatgpt.com/?q=',
    accentClass: 'bg-emerald-500',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    baseUrl: 'https://gemini.google.com/app',
    accentClass: 'bg-blue-500',
  },
  {
    id: 'claude',
    name: 'Claude',
    baseUrl: 'https://claude.ai/new',
    prefillPrefix: 'https://claude.ai/new?q=',
    accentClass: 'bg-orange-500',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://chat.deepseek.com/',
    accentClass: 'bg-indigo-500',
  },
  {
    id: 'grok',
    name: 'Grok',
    baseUrl: 'https://grok.com/',
    prefillPrefix: 'https://grok.com/?q=',
    accentClass: 'bg-slate-500',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    baseUrl: 'https://www.perplexity.ai/',
    prefillPrefix: 'https://www.perplexity.ai/search?q=',
    accentClass: 'bg-teal-500',
  },
  {
    id: 'copilot',
    name: 'Copilot',
    baseUrl: 'https://copilot.microsoft.com/',
    accentClass: 'bg-sky-500',
  },
];

export interface AiLaunchUrl {
  url: string;
  /** true = prompt đã được nhét sẵn vào URL; false = chỉ mở trang gốc (dán tay). */
  prefilled: boolean;
}

export function buildAiLaunchUrl(target: AiLaunchTarget, prompt: string): AiLaunchUrl {
  const trimmed = prompt.trim();
  if (target.prefillPrefix && trimmed) {
    const url = target.prefillPrefix + encodeURIComponent(trimmed);
    if (url.length <= PREFILL_URL_LIMIT) {
      return { url, prefilled: true };
    }
  }
  return { url: target.baseUrl, prefilled: false };
}
