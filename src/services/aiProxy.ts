import { auth } from '../firebase';
import { recordUsage } from '../utils/usageStats';
import { CLAUDE_OPUS, GEMINI_FLASH_LATEST, GROQ_LLAMA_8B } from '../config/models';

// Client gọi backend proxy (Firebase Cloud Function `aiProxy`) để dùng key MẶC ĐỊNH
// của ứng dụng mà KHÔNG lộ key ra bundle trình duyệt. Bắt buộc đăng nhập: mỗi request
// đính kèm Firebase ID token, backend xác thực rồi mới gọi Gemini/Groq bằng key giấu
// trong Secrets của Functions.

export interface ProxyMessage {
  role: 'user' | 'assistant' | 'model' | 'system';
  content: string;
}

export interface ProxyRequest {
  provider: 'gemini' | 'groq' | 'anthropic';
  model?: string;
  system?: string;
  user?: string;
  messages?: ProxyMessage[];
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  json?: boolean;
}

// Mặc định dùng đường dẫn cùng-origin /api/ai (Vercel Serverless Function api/ai.ts).
// Khi dev chạy `vercel dev` thì /api/ai cũng có sẵn cùng origin. Nếu frontend và
// backend khác origin (ví dụ frontend trên Firebase Hosting), đặt VITE_AI_PROXY_URL
// trỏ tới URL đầy đủ của hàm trên Vercel.
const env = (import.meta as any).env || {};
const PROXY_URL: string = env.VITE_AI_PROXY_URL || '/api/ai';
// Endpoint Auto-Optimizer (api/optimize.ts). Mặc định cùng-origin; nếu proxy đặt
// cross-origin qua VITE_AI_PROXY_URL thì suy ra endpoint optimize tương ứng.
const OPTIMIZE_URL: string =
  env.VITE_AI_OPTIMIZE_URL ||
  (env.VITE_AI_PROXY_URL ? String(env.VITE_AI_PROXY_URL).replace(/\/ai$/, '/optimize') : '/api/optimize');

// Thống kê usage (M2): model hiệu dụng + tổng ký tự đầu vào của một request proxy.
function effectiveModel(req: ProxyRequest): string {
  if (req.model) return req.model;
  if (req.provider === 'groq') return GROQ_LLAMA_8B;
  if (req.provider === 'anthropic') return CLAUDE_OPUS;
  return GEMINI_FLASH_LATEST;
}

function requestInputChars(req: ProxyRequest): number {
  return (req.system?.length || 0) + (req.user?.length || 0)
    + (req.messages || []).reduce((s, m) => s + (m.content?.length || 0), 0);
}

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error(
      'Bạn cần đăng nhập để sử dụng AI bằng key mặc định của ứng dụng, hoặc nhập API key riêng trong phần cài đặt.'
    );
  }
  const token = await user.getIdToken();
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export async function proxyGenerate(req: ProxyRequest): Promise<string> {
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ ...req, stream: false }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI proxy error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  if (data?.error) throw new Error(data.error);
  const text = data?.text || (req.json ? '{}' : '');
  recordUsage(effectiveModel(req), requestInputChars(req), text.length);
  return text;
}

// ── Auto-Optimizer (Lab · Tầng 1) ───────────────────────────────────────────
export interface OptimizeRequest {
  basePrompt: string;
  criteria?: string[];
  testInput?: string;
  populationN?: number;
  rounds?: number;
}

export interface OptimizeCandidate {
  prompt: string;
  score: number;
  feedback: string;
  output: string;
}

export interface OptimizeResult {
  bestPrompt: string;
  bestScore: number;
  baselineScore: number;
  improvement: number;
  history: { round: number; best: OptimizeCandidate; candidates: OptimizeCandidate[] }[];
}

/** Sự kiện tiến trình từ Auto-Optimizer (M6): baseline xong / xong từng vòng. */
export interface OptimizeProgress {
  type: 'baseline' | 'round';
  round?: number;
  rounds?: number;
  score?: number;      // điểm baseline (type: 'baseline')
  bestScore?: number;  // điểm tốt nhất tới hiện tại (type: 'round')
  scores?: number[];   // điểm từng biến thể của vòng vừa xong
}

/**
 * Gọi vòng tối ưu prompt ở backend (api/optimize.ts). Cần đăng nhập (Firebase token).
 * Truyền onProgress để nhận tiến trình SSE từng vòng (M6); bỏ trống = JSON một lần như cũ.
 */
export async function optimizePrompt(
  req: OptimizeRequest,
  onProgress?: (p: OptimizeProgress) => void,
): Promise<OptimizeResult> {
  const response = await fetch(OPTIMIZE_URL, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(onProgress ? { ...req, stream: true } : req),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Optimize error ${response.status}: ${errorText}`);
  }

  if (!onProgress) {
    const data = await response.json();
    if (data?.error) throw new Error(data.error);
    return data as OptimizeResult;
  }

  // Chế độ SSE: gom sự kiện tiến trình, trả kết quả khi gặp 'done'.
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Không đọc được luồng tiến trình từ Optimizer.');
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let result: OptimizeResult | null = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const cleaned = line.trim();
      if (!cleaned || cleaned === 'data: [DONE]') continue;
      if (!cleaned.startsWith('data: ')) continue;
      let json: any;
      try { json = JSON.parse(cleaned.substring(6)); } catch { continue; }
      if (json.error) throw new Error(json.error);
      if (json.type === 'done') result = json.result as OptimizeResult;
      else if (json.type === 'baseline' || json.type === 'round') onProgress(json as OptimizeProgress);
    }
  }
  if (!result) throw new Error('Optimizer kết thúc mà không trả kết quả — thử lại.');
  return result;
}

export async function proxyGenerateStream(
  req: ProxyRequest,
  onChunk: (chunk: string) => void
): Promise<void> {
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ ...req, stream: true }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI proxy error ${response.status}: ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Không đọc được luồng dữ liệu từ AI proxy.');

  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let outChars = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const cleaned = line.trim();
        if (!cleaned || cleaned === 'data: [DONE]') continue;
        if (!cleaned.startsWith('data: ')) continue;
        let json: any;
        try {
          json = JSON.parse(cleaned.substring(6));
        } catch {
          continue; // bỏ qua dòng SSE lẻ không parse được
        }
        if (json.error) throw new Error(json.error);
        if (json.text) {
          outChars += json.text.length;
          onChunk(json.text);
        }
      }
    }
  } finally {
    // Ghi cả khi stream đứt giữa chừng — phần đã phát vẫn là usage thật.
    recordUsage(effectiveModel(req), requestInputChars(req), outChars);
  }
}
