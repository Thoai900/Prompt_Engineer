import { GoogleGenAI } from '@google/genai';
import { createRemoteJWKSet, jwtVerify } from 'jose';

// ─────────────────────────────────────────────────────────────────────────────
// Vercel Serverless Function: Auto-Optimizer (Lab · Tầng 1, mũi nhọn).
// TỰ CHỨA HOÀN TOÀN (không import file phụ) — giống api/ai.ts — để tránh rủi ro
// Vercel không bundle được module phụ (gây FUNCTION_INVOCATION_FAILED lúc nạp).
// Vòng tiến hoá BOUNDED trong một lần gọi; N/rounds cap thấp; xin maxDuration 60s.
// ─────────────────────────────────────────────────────────────────────────────

export const config = { maxDuration: 60 };

const PROJECT_ID = 'eduai-nexus';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const TRIGGER = 'Hãy thực hiện theo chỉ dẫn hệ thống ở trên.';

// Chuỗi model dự phòng: mỗi model free-tier có HẠN MỨC RIÊNG (Gemini) + Groq quota
// riêng. Khi một model chạm giới hạn (429), tự xoay sang model kế tiếp thay vì chờ.
const MODEL_CHAIN: { provider: 'gemini' | 'groq'; model: string }[] = [
  { provider: 'gemini', model: 'gemini-2.5-flash' },
  { provider: 'gemini', model: 'gemini-3.5-flash' },
  { provider: 'gemini', model: 'gemini-2.5-pro' },
  { provider: 'groq', model: 'llama-3.1-8b-instant' },
];

function isRateLimitError(e: any): boolean {
  const msg = (e?.message || String(e || '')).toLowerCase();
  return msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota')
    || msg.includes('exceeded') || msg.includes('rate limit') || msg.includes('rate-limit');
}

// JWKS tạo lười để không ném lỗi lúc nạp module.
let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!_jwks) {
    _jwks = createRemoteJWKSet(
      new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
    );
  }
  return _jwks;
}

/** Xác thực Firebase ID token; trả uid (payload.sub) nếu hợp lệ, null nếu không. */
async function verifyFirebaseToken(authHeader?: string): Promise<string | null> {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer (.+)$/);
  if (!m) return null;
  try {
    const { payload } = await jwtVerify(m[1], getJwks(), {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });
    return typeof payload.sub === 'string' && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

// ── Gia cố (C1) — trùng lặp CÓ CHỦ ĐÍCH với api/ai.ts (function tự chứa, xem đầu file).
// Optimize đắt hơn nhiều lần /api/ai (mỗi run = hàng chục lời gọi model) → ngưỡng thấp hơn.
const RL_PER_MIN = Math.max(1, Number(process.env.OPTIMIZE_RATE_LIMIT_PER_MIN) || 3);
const RL_PER_HOUR = Math.max(1, Number(process.env.OPTIMIZE_RATE_LIMIT_PER_HOUR) || 20);
const MAX_PROMPT_CHARS = 50_000;
const MAX_CRITERIA = 10;
const rlBuckets = new Map<string, number[]>();

function checkRateLimit(uid: string): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
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

function resolveCorsOrigin(req: any): string | null {
  const origin: string | undefined = req.headers?.origin;
  if (!origin) return null;
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

async function callGeminiModel(model: string, system: string, user: string, temperature: number, json: boolean): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Server thiếu GEMINI_API_KEY (đặt trong Vercel → Settings → Environment Variables, rồi redeploy).');
  const ai = new GoogleGenAI({ apiKey: key });
  const config: any = { systemInstruction: system, temperature };
  if (json) config.responseMimeType = 'application/json';
  const resp = await ai.models.generateContent({ model, contents: user, config });
  return resp.text || (json ? '{}' : '');
}

async function callGroqModel(model: string, system: string, user: string, temperature: number, json: boolean): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('Server thiếu GROQ_API_KEY.');
  const body: any = {
    model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    temperature,
  };
  if (json) body.response_format = { type: 'json_object' };
  const r = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Groq API ${r.status}: ${await r.text()}`);
  const data: any = await r.json();
  return data?.choices?.[0]?.message?.content || (json ? '{}' : '');
}

// Gọi AI có XOAY VÒNG model: gặp lỗi (đặc biệt 429/giới hạn) thì thử model kế tiếp
// trong MODEL_CHAIN. Nhờ vậy chạm hạn mức một model không làm hỏng cả lượt chạy.
async function callAny(system: string, user: string, temperature: number, json: boolean): Promise<string> {
  let lastErr: any = null;
  for (const { provider, model } of MODEL_CHAIN) {
    try {
      return provider === 'groq'
        ? await callGroqModel(model, system, user, temperature, json)
        : await callGeminiModel(model, system, user, temperature, json);
    } catch (e) {
      lastErr = e;
      // Lỗi giới hạn → chắc chắn thử model khác; lỗi khác cũng thử tiếp cho bền.
    }
  }
  if (isRateLimitError(lastErr)) {
    throw new Error('Tất cả model khả dụng đều đang chạm giới hạn hạn mức (free tier). Thử lại sau ít phút, hoặc giảm "Số biến thể/vòng".');
  }
  throw lastErr || new Error('Tất cả model đều thất bại.');
}

function extractJsonSafe<T = any>(text: string): T | null {
  if (!text) return null;
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const first = s.search(/[[{]/);
  if (first === -1) return null;
  const lastBrace = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (lastBrace === -1) return null;
  try { return JSON.parse(s.slice(first, lastBrace + 1)) as T; } catch { return null; }
}

interface OptimizeBody {
  basePrompt: string;
  criteria?: string[];
  testInput?: string;
  populationN?: number;
  rounds?: number;
  /** M6: true → trả tiến trình từng vòng qua SSE thay vì im lặng tới khi xong. */
  stream?: boolean;
}

interface Candidate { prompt: string; score: number; feedback: string; output: string; }

function clampInt(v: any, def: number, min: number, max: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

function criteriaText(criteria: string[]): string {
  return criteria.length > 0
    ? criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')
    : '1. Hữu ích, chính xác, đúng trọng tâm.\n2. Rõ ràng, mạch lạc, đúng định dạng yêu cầu.';
}

async function generateVariants(base: string, criteria: string[], n: number, improveFrom?: string): Promise<string[]> {
  const system = 'Bạn là chuyên gia tối ưu Prompt Engineering. Bạn cải tiến prompt để đạt tiêu chí tốt hơn.';
  const user = `${improveFrom
    ? `Đây là prompt đang tốt nhất hiện tại:\n"""${improveFrom}"""\nHãy tạo ${n} BIẾN THỂ CẢI TIẾN khác nhau, mỗi biến thể thử một hướng nâng cấp riêng.`
    : `Đây là prompt gốc:\n"""${base}"""\nHãy tạo ${n} BIẾN THỂ CẢI TIẾN khác nhau của nó.`}

Mục tiêu là đạt các tiêu chí sau tốt hơn:
${criteriaText(criteria)}

Mỗi biến thể là một prompt HOÀN CHỈNH, dùng được ngay. Đa dạng cách tiếp cận.
CHỈ trả về JSON, không markdown: {"variants": ["<prompt 1>", "<prompt 2>", ...]}`;

  const text = await callAny(system, user, 0.9, true);
  const parsed = extractJsonSafe<{ variants?: string[] }>(text);
  const variants = (parsed?.variants || []).filter((v) => typeof v === 'string' && v.trim().length > 0);
  return variants.slice(0, n);
}

async function scoreCandidate(output: string, criteria: string[]): Promise<{ score: number; feedback: string }> {
  const system = 'Bạn là giám khảo trung lập chấm chất lượng đầu ra theo tiêu chí. Khắt khe, nhất quán.';
  const user = `[BỘ TIÊU CHÍ]\n${criteriaText(criteria)}\n\n[ĐẦU RA CẦN CHẤM]\n${output}\n\nChỉ trả về JSON: {"score": <0-100>, "feedback": "<ngắn gọn>"}`;
  const text = await callAny(system, user, 0.2, true);
  const parsed = extractJsonSafe<{ score?: number; feedback?: string }>(text);
  const score = typeof parsed?.score === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 50;
  return { score, feedback: typeof parsed?.feedback === 'string' ? parsed.feedback : '' };
}

async function evaluate(prompt: string, testInput: string, criteria: string[]): Promise<Candidate> {
  const output = await callAny(prompt, testInput, 0.7, false);
  const { score, feedback } = await scoreCandidate(output, criteria);
  return { prompt, score, feedback, output: output.slice(0, 600) };
}

export default async function handler(req: any, res: any) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Chỉ hỗ trợ POST.' }); return; }

  try {
    const uid = await verifyFirebaseToken(req.headers.authorization);
    if (!uid) { res.status(401).json({ error: 'Chưa xác thực: vui lòng đăng nhập để dùng AI.' }); return; }

    const rl = checkRateLimit(uid);
    if (!rl.ok) {
      res.setHeader('Retry-After', String(rl.retryAfterSec));
      res.status(429).json({ error: `Auto-Optimizer đang bị giới hạn tần suất — thử lại sau ~${rl.retryAfterSec}s.` });
      return;
    }

    let body: OptimizeBody = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { res.status(400).json({ error: 'Body JSON không hợp lệ.' }); return; }
    }
    if (!body || !body.basePrompt || !body.basePrompt.trim()) {
      res.status(400).json({ error: 'Thiếu basePrompt.' }); return;
    }
    if (body.basePrompt.length > MAX_PROMPT_CHARS) {
      res.status(400).json({ error: `Prompt quá dài (> ${MAX_PROMPT_CHARS} ký tự).` }); return;
    }
    if (body.testInput && body.testInput.length > MAX_PROMPT_CHARS) {
      res.status(400).json({ error: `Input thử quá dài (> ${MAX_PROMPT_CHARS} ký tự).` }); return;
    }

    const basePrompt = body.basePrompt.trim();
    const criteria = (Array.isArray(body.criteria) ? body.criteria.filter((c) => typeof c === 'string' && c.trim()) : [])
      .slice(0, MAX_CRITERIA)
      .map((c) => c.slice(0, 500));
    const testInput = (body.testInput && body.testInput.trim()) || TRIGGER;
    const populationN = clampInt(body.populationN, 3, 2, 5);
    const rounds = clampInt(body.rounds, 2, 1, 3);

    // M6: vòng tiến hoá có "emit" — chế độ SSE phát tiến trình sau baseline và
    // sau MỖI vòng (UI không còn câm lặng tới 60s); chế độ cũ giữ nguyên JSON.
    const runOptimization = async (emit?: (ev: Record<string, unknown>) => void) => {
      const history: { round: number; best: Candidate; candidates: Candidate[] }[] = [];
      const baseline = await evaluate(basePrompt, testInput, criteria);
      emit?.({ type: 'baseline', score: baseline.score, rounds });
      let best: Candidate = baseline;

      for (let round = 1; round <= rounds; round++) {
        const variants = await generateVariants(basePrompt, criteria, populationN, round === 1 ? undefined : best.prompt);
        const evaluated = await Promise.all(variants.map((v) => evaluate(v, testInput, criteria)));

        const pool = [best, ...evaluated];
        pool.sort((a, b) => b.score - a.score);
        best = pool[0];

        history.push({ round, best, candidates: evaluated });
        emit?.({ type: 'round', round, rounds, bestScore: best.score, scores: evaluated.map((c) => c.score) });
      }

      return {
        bestPrompt: best.prompt,
        bestScore: best.score,
        baselineScore: baseline.score,
        improvement: best.score - baseline.score,
        history,
      };
    };

    if (body.stream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      if (typeof res.flushHeaders === 'function') res.flushHeaders();
      const send = (obj: Record<string, unknown>) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
      try {
        const result = await runOptimization(send);
        send({ type: 'done', result });
        res.write('data: [DONE]\n\n');
      } catch (err: any) {
        send({ error: err?.message || 'Lỗi máy chủ khi tối ưu prompt.' });
      }
      res.end();
      return;
    }

    res.status(200).json(await runOptimization());
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message || 'Lỗi máy chủ khi tối ưu prompt.' });
    } else {
      try { res.end(); } catch { /* đã đóng */ }
    }
  }
}
