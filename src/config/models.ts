/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Nguồn sự thật duy nhất cho tên model AI dùng trong toàn bộ app.
 * Tránh hardcode chuỗi rải rác (vốn từng gây bug model "gemini-3.5-flash" không tồn tại).
 *
 * Khi Google/Groq ra model mới, chỉ cần sửa ở đây.
 */

// --- Gemini (Google) ---
/** Model nhanh, rẻ — dùng cho tác vụ đơn giản, điền JSON, sinh nội dung khối. */
export const GEMINI_FLASH = 'gemini-2.5-flash';
/** Model suy luận sâu — dùng khi cần reasoning chất lượng cao. */
export const GEMINI_PRO = 'gemini-2.5-pro';

// --- Groq (Llama) ---
export const GROQ_LLAMA_8B = 'llama-3.1-8b-instant';

// --- OpenAI-compatible (qua proxy) ---
export const GPT_MINI = 'gpt-4o-mini';

/** Default chung khi không chỉ định: ưu tiên tốc độ. */
export const DEFAULT_MODEL = GEMINI_FLASH;
export const DEFAULT_REASONING_MODEL = GEMINI_PRO;

/** Lựa chọn Gemini hiển thị trong các dropdown của UI. */
export const GEMINI_MODEL_OPTIONS = [
  { value: GEMINI_FLASH, label: 'Gemini 2.5 Flash (Nhanh)' },
  { value: GEMINI_PRO, label: 'Gemini 2.5 Pro (Pro)' },
] as const;
