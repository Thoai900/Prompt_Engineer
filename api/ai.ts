import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { createRemoteJWKSet, jwtVerify } from 'jose';

// ─────────────────────────────────────────────────────────────────────────────
// Vercel Serverless Function: proxy AI giấu API key mặc định (Gemini + Groq/Llama).
// Client gọi POST /api/ai kèm Firebase ID token; hàm này xác thực token (bằng jose,
// không cần service account) rồi gọi nhà cung cấp bằng key trong biến môi trường
// (GEMINI_API_KEY / GROQ_API_KEY đặt ở Vercel → Project Settings → Environment).
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT_ID = 'eduai-nexus';
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant';
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';
const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-4-8';

// ── Gia cố (C1) ──────────────────────────────────────────────────────────────
// Allowlist model: client KHÔNG được truyền tên model tuỳ ý (tránh gọi model đắt
// tiền/không dự kiến bằng key chung). Phải khớp src/config/models.ts.
const ALLOWED_MODELS: Record<'gemini' | 'groq' | 'anthropic', Set<string>> = {
  gemini: new Set(['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.5-pro']),
  groq: new Set(['llama-3.1-8b-instant']),
  anthropic: new Set(['claude-opus-4-8', 'claude-haiku-4-5']),
};
// Trần tham số đầu vào — chặn lạm dụng key chung.
const MAX_OUTPUT_TOKENS_CAP = 8192;
const MAX_INPUT_CHARS = 200_000;

// Rate-limit theo uid: sliding-window TRONG BỘ NHỚ của instance. Best-effort —
// serverless có thể chạy nhiều instance, nhưng instance ấm giữ được state nên vẫn
// chặn hiệu quả kiểu lạm dụng "bắn dồn dập". Đổi ngưỡng qua env không cần sửa code.
const RL_PER_MIN = Math.max(1, Number(process.env.AI_RATE_LIMIT_PER_MIN) || 20);
const RL_PER_HOUR = Math.max(1, Number(process.env.AI_RATE_LIMIT_PER_HOUR) || 240);
const rlBuckets = new Map<string, number[]>();

function checkRateLimit(uid: string): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  // Giữ map bounded — tràn thì reset (best-effort, không rò rỉ bộ nhớ).
  if (rlBuckets.size > 5000) rlBuckets.clear();
  const stamps = (rlBuckets.get(uid) || []).filter((t) => now - t < 3_600_000);
  const lastMinute = stamps.filter((t) => now - t < 60_000);
  if (lastMinute.length >= RL_PER_MIN) {
    return { ok: false, retryAfterSec: Math.ceil((60_000 - (now - lastMinute[0])) / 1000) };
  }
  if (stamps.length >= RL_PER_HOUR) {
    return { ok: false, retryAfterSec: Math.ceil((3_600_000 - (now - stamps[0])) / 1000) };
  }
  stamps.push(now);
  rlBuckets.set(uid, stamps);
  return { ok: true, retryAfterSec: 0 };
}

// CORS: chỉ phản chiếu Origin nếu (1) cùng host với request, (2) localhost dev,
// hoặc (3) nằm trong env ALLOWED_ORIGINS (phân tách bằng dấu phẩy — dùng khi
// frontend host khác origin, vd Firebase Hosting). Origin lạ → không có header
// CORS → trình duyệt chặn đọc kết quả.
function resolveCorsOrigin(req: any): string | null {
  const origin: string | undefined = req.headers?.origin;
  if (!origin) return null; // same-origin/non-browser: không cần header CORS
  try {
    const o = new URL(origin);
    if (req.headers?.host && o.host === req.headers.host) return origin;
    if (o.hostname === 'localhost' || o.hostname === '127.0.0.1') return origin;
  } catch { return null; }
  const extra = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return extra.includes(origin) ? origin : null;
}

function applyCors(req: any, res: any): void {
  const origin = resolveCorsOrigin(req);
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

type Role = 'user' | 'assistant' | 'model' | 'system';
interface ProxyMessage { role: Role; content: string }
interface ProxyBody {
  provider: 'gemini' | 'groq' | 'anthropic';
  model?: string;
  system?: string;
  user?: string;
  messages?: ProxyMessage[];
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  json?: boolean;
  stream?: boolean;
}

/** Xác thực Firebase ID token; trả uid (payload.sub) nếu hợp lệ, null nếu không. */
async function verifyFirebaseToken(authHeader?: string): Promise<string | null> {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer (.+)$/);
  if (!m) return null;
  try {
    const { payload } = await jwtVerify(m[1], JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });
    return typeof payload.sub === 'string' && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

function groqMessages(b: ProxyBody): { role: string; content: string }[] {
  const msgs: { role: string; content: string }[] = [];
  if (b.system) msgs.push({ role: 'system', content: b.system });
  if (b.messages && b.messages.length) {
    for (const m of b.messages) {
      msgs.push({ role: m.role === 'model' ? 'assistant' : m.role, content: m.content });
    }
  } else if (b.user) {
    msgs.push({ role: 'user', content: b.user });
  }
  return msgs;
}

function geminiContents(b: ProxyBody): any {
  if (b.messages && b.messages.length) {
    return b.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
  }
  return b.user || '';
}

// ── Anthropic (Claude, M1) ───────────────────────────────────────────────────
// Ghi chú API: messages chỉ nhận role user/assistant (system nằm top-level);
// Opus 4.8 TỪ CHỐI temperature/top_p → không truyền sampling param cho nhánh này.
function anthropicParams(b: ProxyBody): { system: string; messages: { role: 'user' | 'assistant'; content: string }[] } {
  let system = b.system || '';
  const messages: { role: 'user' | 'assistant'; content: string }[] = [];
  if (b.messages && b.messages.length) {
    for (const m of b.messages) {
      if (m.role === 'system') {
        system = system ? `${system}\n\n${m.content}` : m.content;
        continue;
      }
      messages.push({ role: m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user', content: m.content });
    }
  } else if (b.user) {
    messages.push({ role: 'user', content: b.user });
  }
  // Anthropic không có JSON mode kiểu response_format generic → ép qua system.
  if (b.json) {
    system = `${system}\n\nCHỈ trả về JSON hợp lệ — không markdown fence, không giải thích.`.trim();
  }
  return { system, messages };
}

function buildAnthropicRequest(b: ProxyBody): any {
  const model = b.model || DEFAULT_ANTHROPIC_MODEL;
  const { system, messages } = anthropicParams(b);
  const params: any = {
    model,
    max_tokens: Math.min(b.maxTokens || 4096, MAX_OUTPUT_TOKENS_CAP),
    messages,
  };
  if (system) params.system = system;
  // Opus 4.8: bật adaptive thinking (mặc định tắt khi bỏ trống) — chất lượng tốt hơn
  // cho tác vụ suy luận; Haiku 4.5 chưa hỗ trợ adaptive → bỏ trống.
  if (model.startsWith('claude-opus')) params.thinking = { type: 'adaptive' };
  return params;
}

function anthropicText(resp: any, json?: boolean): string {
  if (resp.stop_reason === 'refusal') {
    throw new Error('Claude từ chối yêu cầu này (safety classifier).');
  }
  const text = (resp.content || [])
    .filter((c: any) => c.type === 'text')
    .map((c: any) => c.text)
    .join('');
  return text || (json ? '{}' : '');
}

function geminiConfig(b: ProxyBody): any {
  const config: any = {};
  if (b.system) config.systemInstruction = b.system;
  if (b.temperature !== undefined) config.temperature = b.temperature;
  if (b.topP !== undefined) config.topP = b.topP;
  if (b.maxTokens) config.maxOutputTokens = b.maxTokens;
  if (b.json) config.responseMimeType = 'application/json';
  return config;
}

async function callProvider(b: ProxyBody): Promise<string> {
  if (b.provider === 'groq') {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('Server thiếu GROQ_API_KEY.');
    const body: any = {
      model: b.model || DEFAULT_GROQ_MODEL,
      messages: groqMessages(b),
      temperature: b.temperature !== undefined ? b.temperature : 0.7,
      top_p: b.topP !== undefined ? b.topP : 0.95,
    };
    if (b.maxTokens) body.max_tokens = b.maxTokens;
    if (b.json) body.response_format = { type: 'json_object' };

    const r = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Groq API ${r.status}: ${await r.text()}`);
    const data: any = await r.json();
    return data?.choices?.[0]?.message?.content || '';
  }

  if (b.provider === 'anthropic') {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('Server thiếu ANTHROPIC_API_KEY (đặt ở Vercel → Settings → Environment Variables, rồi redeploy).');
    const anthropic = new Anthropic({ apiKey: key });
    const resp = await anthropic.messages.create(buildAnthropicRequest(b));
    return anthropicText(resp, b.json);
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Server thiếu GEMINI_API_KEY.');
  const ai = new GoogleGenAI({ apiKey: key });
  const resp = await ai.models.generateContent({
    model: b.model || DEFAULT_GEMINI_MODEL,
    contents: geminiContents(b),
    config: geminiConfig(b),
  });
  return resp.text || (b.json ? '{}' : '');
}

async function streamProvider(b: ProxyBody, onChunk: (t: string) => void): Promise<void> {
  if (b.provider === 'groq') {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('Server thiếu GROQ_API_KEY.');
    const body: any = {
      model: b.model || DEFAULT_GROQ_MODEL,
      messages: groqMessages(b),
      temperature: b.temperature !== undefined ? b.temperature : 0.7,
      top_p: b.topP !== undefined ? b.topP : 0.95,
      stream: true,
    };
    if (b.maxTokens) body.max_tokens = b.maxTokens;

    const r = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Groq API ${r.status}: ${await r.text()}`);

    const reader = (r.body as any)?.getReader();
    if (!reader) throw new Error('Groq stream không khả dụng.');
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const c = line.trim();
        if (!c || c === 'data: [DONE]') continue;
        if (!c.startsWith('data: ')) continue;
        try {
          const j = JSON.parse(c.substring(6));
          const t = j.choices?.[0]?.delta?.content || '';
          if (t) onChunk(t);
        } catch {
          /* bỏ qua dòng SSE lẻ */
        }
      }
    }
    return;
  }

  if (b.provider === 'anthropic') {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('Server thiếu ANTHROPIC_API_KEY (đặt ở Vercel → Settings → Environment Variables, rồi redeploy).');
    const anthropic = new Anthropic({ apiKey: key });
    const stream = anthropic.messages.stream(buildAnthropicRequest(b));
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        onChunk(event.delta.text);
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') {
      throw new Error('Claude từ chối yêu cầu này (safety classifier).');
    }
    return;
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Server thiếu GEMINI_API_KEY.');
  const ai = new GoogleGenAI({ apiKey: key });
  const stream = await ai.models.generateContentStream({
    model: b.model || DEFAULT_GEMINI_MODEL,
    contents: geminiContents(b),
    config: geminiConfig(b),
  });
  for await (const chunk of stream) {
    if (chunk.text) onChunk(chunk.text);
  }
}

export default async function handler(req: any, res: any) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Chỉ hỗ trợ POST.' }); return; }

  const uid = await verifyFirebaseToken(req.headers.authorization);
  if (!uid) { res.status(401).json({ error: 'Chưa xác thực: vui lòng đăng nhập để dùng AI.' }); return; }

  const rl = checkRateLimit(uid);
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfterSec));
    res.status(429).json({ error: `Bạn gọi AI quá nhanh — thử lại sau ~${rl.retryAfterSec}s.` });
    return;
  }

  let body: ProxyBody = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { res.status(400).json({ error: 'Body JSON không hợp lệ.' }); return; }
  }
  if (!body || !body.provider) { res.status(400).json({ error: 'Thiếu tham số bắt buộc (provider).' }); return; }
  if (!body.user && !(body.messages && body.messages.length)) {
    res.status(400).json({ error: 'Thiếu nội dung (user hoặc messages).' });
    return;
  }

  // Allowlist model + trần tham số (bảo vệ key chung).
  const allowed = ALLOWED_MODELS[body.provider];
  if (!allowed) { res.status(400).json({ error: 'Provider không được hỗ trợ.' }); return; }
  if (body.model && !allowed.has(body.model)) {
    res.status(400).json({ error: `Model "${body.model}" không nằm trong danh sách cho phép.` });
    return;
  }
  if (body.maxTokens && body.maxTokens > MAX_OUTPUT_TOKENS_CAP) body.maxTokens = MAX_OUTPUT_TOKENS_CAP;
  const inputChars = (body.system?.length || 0) + (body.user?.length || 0)
    + (body.messages || []).reduce((s, m) => s + (m.content?.length || 0), 0);
  if (inputChars > MAX_INPUT_CHARS) {
    res.status(400).json({ error: `Nội dung quá dài (${inputChars} ký tự > giới hạn ${MAX_INPUT_CHARS}).` });
    return;
  }

  try {
    if (body.stream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      if (typeof res.flushHeaders === 'function') res.flushHeaders();
      await streamProvider(body, (chunk) => {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      });
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      const text = await callProvider(body);
      res.status(200).json({ text });
    }
  } catch (err: any) {
    const message = err?.message || 'Lỗi gọi nhà cung cấp AI.';
    if (body.stream && res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    } else {
      res.status(502).json({ error: message });
    }
  }
}
