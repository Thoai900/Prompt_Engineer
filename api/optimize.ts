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
const CANDIDATE_MODEL = 'gemini-2.5-flash';
const JUDGE_MODEL = 'gemini-2.5-flash';
const TRIGGER = 'Hãy thực hiện theo chỉ dẫn hệ thống ở trên.';

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

async function verifyFirebaseToken(authHeader?: string): Promise<boolean> {
  if (!authHeader) return false;
  const m = authHeader.match(/^Bearer (.+)$/);
  if (!m) return false;
  try {
    await jwtVerify(m[1], getJwks(), {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });
    return true;
  } catch {
    return false;
  }
}

async function callGemini(model: string, system: string, user: string, temperature: number, json: boolean): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Server thiếu GEMINI_API_KEY (đặt trong Vercel → Settings → Environment Variables, rồi redeploy).');
  const ai = new GoogleGenAI({ apiKey: key });
  const config: any = { systemInstruction: system, temperature };
  if (json) config.responseMimeType = 'application/json';
  const resp = await ai.models.generateContent({ model, contents: user, config });
  return resp.text || (json ? '{}' : '');
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

  const text = await callGemini(CANDIDATE_MODEL, system, user, 0.9, true);
  const parsed = extractJsonSafe<{ variants?: string[] }>(text);
  const variants = (parsed?.variants || []).filter((v) => typeof v === 'string' && v.trim().length > 0);
  return variants.slice(0, n);
}

async function scoreCandidate(output: string, criteria: string[]): Promise<{ score: number; feedback: string }> {
  const system = 'Bạn là giám khảo trung lập chấm chất lượng đầu ra theo tiêu chí. Khắt khe, nhất quán.';
  const user = `[BỘ TIÊU CHÍ]\n${criteriaText(criteria)}\n\n[ĐẦU RA CẦN CHẤM]\n${output}\n\nChỉ trả về JSON: {"score": <0-100>, "feedback": "<ngắn gọn>"}`;
  const text = await callGemini(JUDGE_MODEL, system, user, 0.2, true);
  const parsed = extractJsonSafe<{ score?: number; feedback?: string }>(text);
  const score = typeof parsed?.score === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 50;
  return { score, feedback: typeof parsed?.feedback === 'string' ? parsed.feedback : '' };
}

async function evaluate(prompt: string, testInput: string, criteria: string[]): Promise<Candidate> {
  const output = await callGemini(CANDIDATE_MODEL, prompt, testInput, 0.7, false);
  const { score, feedback } = await scoreCandidate(output, criteria);
  return { prompt, score, feedback, output: output.slice(0, 600) };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Chỉ hỗ trợ POST.' }); return; }

  try {
    const ok = await verifyFirebaseToken(req.headers.authorization);
    if (!ok) { res.status(401).json({ error: 'Chưa xác thực: vui lòng đăng nhập để dùng AI.' }); return; }

    let body: OptimizeBody = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { res.status(400).json({ error: 'Body JSON không hợp lệ.' }); return; }
    }
    if (!body || !body.basePrompt || !body.basePrompt.trim()) {
      res.status(400).json({ error: 'Thiếu basePrompt.' }); return;
    }

    const basePrompt = body.basePrompt.trim();
    const criteria = Array.isArray(body.criteria) ? body.criteria.filter((c) => typeof c === 'string' && c.trim()) : [];
    const testInput = (body.testInput && body.testInput.trim()) || TRIGGER;
    const populationN = clampInt(body.populationN, 3, 2, 5);
    const rounds = clampInt(body.rounds, 2, 1, 3);

    const history: { round: number; best: Candidate; candidates: Candidate[] }[] = [];
    const baseline = await evaluate(basePrompt, testInput, criteria);
    let best: Candidate = baseline;

    for (let round = 1; round <= rounds; round++) {
      const variants = await generateVariants(basePrompt, criteria, populationN, round === 1 ? undefined : best.prompt);
      const evaluated = await Promise.all(variants.map((v) => evaluate(v, testInput, criteria)));

      const pool = [best, ...evaluated];
      pool.sort((a, b) => b.score - a.score);
      best = pool[0];

      history.push({ round, best, candidates: evaluated });
    }

    res.status(200).json({
      bestPrompt: best.prompt,
      bestScore: best.score,
      baselineScore: baseline.score,
      improvement: best.score - baseline.score,
      history,
    });
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message || 'Lỗi máy chủ khi tối ưu prompt.' });
    }
  }
}
