import { verifyFirebaseToken, callProvider, extractJsonSafe } from './_core';

// ─────────────────────────────────────────────────────────────────────────────
// Vercel Serverless Function: Auto-Optimizer (Lab · Tầng 1, mũi nhọn).
// Vòng tiến hoá BOUNDED trong một lần gọi: sinh N biến thể prompt → chạy + chấm
// điểm theo tiêu chí (giám khảo LLM) → giữ tốt nhất → đột biến → lặp vài vòng →
// trả prompt tốt nhất + lịch sử điểm. Tham số N/rounds cap thấp để vừa ngân sách
// thời gian của serverless (xin maxDuration 60s).
// ─────────────────────────────────────────────────────────────────────────────

export const config = { maxDuration: 60 };

const CANDIDATE_MODEL = 'gemini-2.5-flash'; // model sinh/chạy biến thể (nhanh, rẻ)
const JUDGE_MODEL = 'gemini-2.5-flash';     // giám khảo cố định
const TRIGGER = 'Hãy thực hiện theo chỉ dẫn hệ thống ở trên.';

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

  const text = await callProvider({ provider: 'gemini', model: CANDIDATE_MODEL, system, user, temperature: 0.9, json: true });
  const parsed = extractJsonSafe<{ variants?: string[] }>(text);
  const variants = (parsed?.variants || []).filter((v) => typeof v === 'string' && v.trim().length > 0);
  return variants.slice(0, n);
}

async function runCandidate(prompt: string, testInput: string): Promise<string> {
  return callProvider({ provider: 'gemini', model: CANDIDATE_MODEL, system: prompt, user: testInput, temperature: 0.7 });
}

async function scoreCandidate(output: string, criteria: string[]): Promise<{ score: number; feedback: string }> {
  const system = 'Bạn là giám khảo trung lập chấm chất lượng đầu ra theo tiêu chí. Khắt khe, nhất quán.';
  const user = `[BỘ TIÊU CHÍ]\n${criteriaText(criteria)}\n\n[ĐẦU RA CẦN CHẤM]\n${output}\n\nChỉ trả về JSON: {"score": <0-100>, "feedback": "<ngắn gọn>"}`;
  const text = await callProvider({ provider: 'gemini', model: JUDGE_MODEL, system, user, temperature: 0.2, json: true });
  const parsed = extractJsonSafe<{ score?: number; feedback?: string }>(text);
  const score = typeof parsed?.score === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 50;
  return { score, feedback: typeof parsed?.feedback === 'string' ? parsed.feedback : '' };
}

async function evaluate(prompt: string, testInput: string, criteria: string[]): Promise<Candidate> {
  const output = await runCandidate(prompt, testInput);
  const { score, feedback } = await scoreCandidate(output, criteria);
  return { prompt, score, feedback, output: output.slice(0, 600) };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Chỉ hỗ trợ POST.' }); return; }

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

  try {
    const history: { round: number; best: Candidate; candidates: Candidate[] }[] = [];

    // Ứng viên nền tảng = chính prompt gốc (để đo mức cải thiện).
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
    res.status(502).json({ error: err?.message || 'Lỗi khi tối ưu prompt.' });
  }
}
