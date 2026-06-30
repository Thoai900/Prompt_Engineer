import { auth } from '../firebase';

// Client gọi backend proxy (Firebase Cloud Function `aiProxy`) để dùng key MẶC ĐỊNH
// của ứng dụng mà KHÔNG lộ key ra bundle trình duyệt. Bắt buộc đăng nhập: mỗi request
// đính kèm Firebase ID token, backend xác thực rồi mới gọi Gemini/Groq bằng key giấu
// trong Secrets của Functions.

export interface ProxyMessage {
  role: 'user' | 'assistant' | 'model' | 'system';
  content: string;
}

export interface ProxyRequest {
  provider: 'gemini' | 'groq';
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
  return data?.text || (req.json ? '{}' : '');
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

/** Gọi vòng tối ưu prompt ở backend (api/optimize.ts). Cần đăng nhập (Firebase token). */
export async function optimizePrompt(req: OptimizeRequest): Promise<OptimizeResult> {
  const response = await fetch(OPTIMIZE_URL, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Optimize error ${response.status}: ${errorText}`);
  }
  const data = await response.json();
  if (data?.error) throw new Error(data.error);
  return data as OptimizeResult;
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
      if (json.text) onChunk(json.text);
    }
  }
}
