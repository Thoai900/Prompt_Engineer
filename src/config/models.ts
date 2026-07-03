/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Nguồn sự thật duy nhất cho tên model AI dùng trong toàn bộ app.
 * Tránh hardcode chuỗi rải rác (trước đây từng dùng nhầm tên model không tồn tại → lỗi).
 * LƯU Ý: chỉ khai báo tên model ĐÃ được bật trong API key/dự án thực tế.
 *
 * Khi Google/Groq ra model mới, chỉ cần sửa ở đây.
 */

// --- Gemini (Google) ---
// Mỗi model free-tier có hạn mức RPD (requests/ngày) RIÊNG → cố tình phân bổ tác vụ
// ra nhiều model để cộng dồn quota, thay vì dồn tải vào một model rồi cụt hạn mức.
/** Model flash MỚI NHẤT, chất lượng cao nhất — dùng cho tác vụ sinh nội dung hướng người dùng. */
export const GEMINI_FLASH_LATEST = 'gemini-3.5-flash';
/** Model nhanh, rẻ (workhorse) — dùng cho tác vụ nền tần suất cao: điền JSON, chấm điểm, tin tức. */
export const GEMINI_FLASH = 'gemini-2.5-flash';
/** Model suy luận sâu — dùng khi cần reasoning chất lượng cao. */
export const GEMINI_PRO = 'gemini-2.5-pro';

// --- Groq (Llama) ---
export const GROQ_LLAMA_8B = 'llama-3.1-8b-instant';

// --- Anthropic (Claude, qua proxy — M1) ---
/** Model Opus mạnh nhất — mặc định khi chọn Claude. */
export const CLAUDE_OPUS = 'claude-opus-4-8';
/** Model Claude nhanh, rẻ — cho tác vụ đơn giản/so tài tiết kiệm. */
export const CLAUDE_HAIKU = 'claude-haiku-4-5';

// --- OpenAI-compatible (qua proxy) ---
export const GPT_MINI = 'gpt-4o-mini';

/** Default chung khi không chỉ định: model flash mới nhất (cân bằng tốc độ + chất lượng). */
export const DEFAULT_MODEL = GEMINI_FLASH_LATEST;
export const DEFAULT_REASONING_MODEL = GEMINI_PRO;

// ─────────────────────────────────────────────────────────────────────────────
// Mô tả model cho UI (dropdown chọn provider/model dùng chung).
// `requiresUserKey`: true nếu BẮT BUỘC người dùng nhập key riêng (chưa đi qua backend
// proxy). Gemini/Groq dùng được key mặc định của app qua proxy → false.
// `provider` chừa sẵn 'anthropic' cho giai đoạn bổ sung Claude/Opus qua proxy.
// ─────────────────────────────────────────────────────────────────────────────
export type ModelProvider = 'gemini' | 'groq' | 'openai' | 'anthropic';

export interface ModelOption {
  value: string;
  label: string;
  provider: ModelProvider;
  requiresUserKey: boolean;
}

/** Nguồn master: mọi model app hỗ trợ chọn trong UI. */
export const ALL_MODEL_OPTIONS: readonly ModelOption[] = [
  { value: GEMINI_FLASH_LATEST, label: 'Gemini 3.5 Flash (Mới nhất)',     provider: 'gemini', requiresUserKey: false },
  { value: GEMINI_FLASH,  label: 'Gemini 2.5 Flash (Nhanh)',       provider: 'gemini', requiresUserKey: false },
  { value: GEMINI_PRO,    label: 'Gemini 2.5 Pro (Pro)',           provider: 'gemini', requiresUserKey: false },
  { value: GROQ_LLAMA_8B, label: 'Llama 3.1 8B (Groq · siêu nhanh)', provider: 'groq',  requiresUserKey: false },
  { value: CLAUDE_OPUS,   label: 'Claude Opus 4.8 (Anthropic)',    provider: 'anthropic', requiresUserKey: false },
  { value: CLAUDE_HAIKU,  label: 'Claude Haiku 4.5 (Anthropic · nhanh)', provider: 'anthropic', requiresUserKey: false },
  { value: GPT_MINI,      label: 'GPT-4o mini (OpenAI)',           provider: 'openai', requiresUserKey: true  },
];

/** Lựa chọn Gemini hiển thị trong các dropdown của UI (derive từ master). */
export const GEMINI_MODEL_OPTIONS: readonly ModelOption[] =
  ALL_MODEL_OPTIONS.filter(m => m.provider === 'gemini');

// ─────────────────────────────────────────────────────────────────────────────
// Tham số sinh (temperature/topP) mặc định theo LOẠI TÁC VỤ.
// Gom về một nơi để tránh "magic number" rải rác trong aiService.ts. Mỗi hàm vẫn
// cho phép options ghi đè; đây chỉ là giá trị nền khi người gọi không chỉ định.
// topP để optional: tác vụ chấm điểm cố tình KHÔNG truyền topP (giữ nguyên hành vi cũ).
// ─────────────────────────────────────────────────────────────────────────────
export interface GenDefaults {
  temperature: number;
  topP?: number;
}

export const TASK_DEFAULTS = {
  /** Sinh nội dung khối / phản hồi nhanh / nâng cấp prompt — sáng tạo tiêu chuẩn. */
  blockGeneration: { temperature: 0.7, topP: 0.95 },
  /** Tác vụ có cấu trúc: tối ưu rule, sinh skill, dựng template, chạy skill. */
  structured: { temperature: 0.6, topP: 0.9 },
  /** Điền biến JSON — bám chuẩn, sáng tạo cực thấp. */
  jsonFill: { temperature: 0.1, topP: 0.1 },
  /** Sinh tin tức AI — sáng tạo cao hơn một chút. */
  news: { temperature: 0.8, topP: 0.9 },
  /** Chấm điểm có thang điểm — ưu tiên nhất quán (không đặt topP). */
  evaluation: { temperature: 0.2 },
  /** Đánh giá nhị phân effective/ineffective — quyết đoán nhất (không đặt topP). */
  binaryEval: { temperature: 0.1 },
} as const satisfies Record<string, GenDefaults>;

// ─────────────────────────────────────────────────────────────────────────────
// Chi phí ƯỚC TÍNH theo model (USD / 1 triệu token), dùng cho Model Bake-off ở Lab.
// Giá công khai gần đúng tại thời điểm khai báo — mục đích là SO SÁNH TƯƠNG ĐỐI giữa
// các model, không phải hoá đơn chính xác. Khi giá đổi, chỉ sửa ở đây.
// ─────────────────────────────────────────────────────────────────────────────
export interface ModelCost {
  inputPer1M: number;  // USD / 1M token đầu vào
  outputPer1M: number; // USD / 1M token đầu ra
}

export const MODEL_COSTS: Record<string, ModelCost> = {
  [GEMINI_FLASH_LATEST]: { inputPer1M: 0.10, outputPer1M: 0.40 },
  [GEMINI_FLASH]:        { inputPer1M: 0.075, outputPer1M: 0.30 },
  [GEMINI_PRO]:          { inputPer1M: 1.25, outputPer1M: 10.0 },
  [GROQ_LLAMA_8B]:       { inputPer1M: 0.05, outputPer1M: 0.08 },
  [CLAUDE_OPUS]:         { inputPer1M: 5.00, outputPer1M: 25.0 },
  [CLAUDE_HAIKU]:        { inputPer1M: 1.00, outputPer1M: 5.0 },
  [GPT_MINI]:            { inputPer1M: 0.15, outputPer1M: 0.60 },
};

/** Ước lượng số token thô (~4 ký tự/token) — đủ tốt cho so sánh tương đối. */
export function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}

/** Ước tính chi phí USD cho một lượt chạy (đầu vào + đầu ra) trên một model. */
export function estimateCostUSD(model: string, inputText: string, outputText: string): number {
  const cost = MODEL_COSTS[model];
  if (!cost) return 0;
  const inTok = estimateTokens(inputText);
  const outTok = estimateTokens(outputText);
  return (inTok / 1_000_000) * cost.inputPer1M + (outTok / 1_000_000) * cost.outputPer1M;
}
