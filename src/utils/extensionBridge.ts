import { PromptTemplate } from '../types';
import { blocksToText } from './templateVersionUtils';

// Cầu nối app ↔ tiện ích trình duyệt (thư mục `extension/`). App gửi thư viện prompt qua
// window.postMessage; content script `extension/sync.js` (chạy trên trang PromptBuilder) nhận,
// hỏi người dùng xác nhận lần đầu với mỗi trang, lưu vào chrome.storage và trả ACK.
// Định dạng PHẢI khớp `extension/lib/core.js` (validatePayload).

export const SYNC_MESSAGE = 'PROMPTBUILDER_SYNC';
export const SYNC_ACK = 'PROMPTBUILDER_SYNC_ACK';
export const PAYLOAD_VERSION = 1;
export const MAX_SYNC_PROMPTS = 200;
export const MAX_PROMPT_CHARS = 20_000;

export interface ExtensionPrompt {
  id: string;
  title: string;
  description: string;
  category: string;
  text: string;
  variables: string[];
}

export interface ExtensionPayload {
  version: number;
  syncedAt: string;
  prompts: ExtensionPrompt[];
}

// Cú pháp biến của TEMPLATE (Builder, hooks/usePromptBlocks.ts): `{{tên bất kỳ}}` hoặc
// `{{tên: lựa chọn 1, lựa chọn 2}}` — tên có thể có dấu/khoảng trắng (vd `{{Môn học}}`).
const VAR_RE = /\{\{([^}]+)\}\}/g;

/** Tên biến trong văn bản (phần trước dấu ":"), không trùng, giữ thứ tự xuất hiện. */
export function extractVariables(text: string): string[] {
  const out: string[] = [];
  for (const m of (text || '').matchAll(VAR_RE)) {
    const name = m[1].split(':')[0].trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

/** Template → mục prompt cho tiện ích (văn bản ghép từ các khối, giống "Gửi sang Lab"). */
export function templateToExtensionPrompt(t: PromptTemplate): ExtensionPrompt | null {
  const text = blocksToText(t.blocks).trim();
  if (!text || text.length > MAX_PROMPT_CHARS) return null;
  return {
    id: t.id,
    title: (t.title || 'Prompt').slice(0, 200),
    description: (t.description || '').slice(0, 500),
    category: (t.category || '').slice(0, 100),
    text,
    variables: extractVariables(text),
  };
}

/** Gói đồng bộ: bỏ trùng id, bỏ prompt trống / quá dài, tối đa MAX_SYNC_PROMPTS mục. */
export function buildExtensionPayload(templates: PromptTemplate[], now: Date = new Date()): ExtensionPayload {
  const seen = new Set<string>();
  const prompts: ExtensionPrompt[] = [];
  for (const t of templates) {
    if (seen.has(t.id) || prompts.length >= MAX_SYNC_PROMPTS) continue;
    const p = templateToExtensionPrompt(t);
    if (!p) continue;
    seen.add(t.id);
    prompts.push(p);
  }
  return { version: PAYLOAD_VERSION, syncedAt: now.toISOString(), prompts };
}

/** Thuộc tính content script của tiện ích gắn lên <html> khi chạy trên trang (có = đã cài). */
export const EXT_MARKER_ATTR = 'data-promptbuilder-ext';

export function isExtensionInstalled(doc: Document = document): boolean {
  return doc.documentElement.hasAttribute(EXT_MARKER_ATTR);
}

/**
 * Gửi gói sang tiện ích. Trả số prompt tiện ích đã lưu; null nếu không có phản hồi trong
 * `timeoutMs` (chưa cài tiện ích, hoặc người dùng từ chối ở hộp xác nhận).
 */
export function syncToExtension(payload: ExtensionPayload, timeoutMs = 15_000): Promise<number | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: number | null) => {
      if (done) return;
      done = true;
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      resolve(v);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window || e.origin !== window.location.origin) return;
      const d = e.data;
      if (d && d.type === SYNC_ACK) finish(d.ok ? Number(d.count) || 0 : null);
    };
    window.addEventListener('message', onMessage);
    const timer = setTimeout(() => finish(null), timeoutMs);
    window.postMessage({ type: SYNC_MESSAGE, payload }, window.location.origin);
  });
}
