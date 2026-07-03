import { GoogleGenAI } from '@google/genai';
import { SignJWT, importPKCS8 } from 'jose';

// ─────────────────────────────────────────────────────────────────────────────
// Vercel Cron (H3): tự động chạy Prompt Health cho các suite bật `cronEnabled`.
// TỰ CHỨA HOÀN TOÀN (không import file phụ) — giống api/ai.ts / api/optimize.ts.
//
// Cách hoạt động:
//  1. Vercel Cron gọi endpoint này theo lịch trong vercel.json, kèm
//     Authorization: Bearer ${CRON_SECRET} (env BẮT BUỘC — thiếu thì từ chối chạy).
//  2. Đăng nhập Google bằng SERVICE ACCOUNT (env FIREBASE_SERVICE_ACCOUNT = JSON
//     của service account, cần role Cloud Datastore User) → access token OAuth.
//     Token này đi qua Firestore REST và BỎ QUA security rules (IAM-authorized).
//  3. Query healthSuites where cronEnabled == true → chạy từng test bằng
//     Gemini/Groq (key trong env, xoay vòng model khi 429) → chấm điểm → ghi
//     run mới vào đầu mảng runs (giữ tối đa 10) + updatedAt.
//  4. Client (HealthPanel) mở lên sẽ thấy run mới + delta hồi quy như run tay.
// ─────────────────────────────────────────────────────────────────────────────

export const config = { maxDuration: 60 };

const PROJECT_ID = 'eduai-nexus';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const TRIGGER = 'Hãy thực hiện theo chỉ dẫn hệ thống ở trên.';
const MAX_SUITES_PER_RUN = 10;
const MAX_TESTS_PER_SUITE = 10;
const MAX_RUNS_KEPT = 10;

// Chuỗi model dự phòng — trùng CÓ CHỦ ĐÍCH với api/optimize.ts (function tự chứa).
const MODEL_CHAIN: { provider: 'gemini' | 'groq'; model: string }[] = [
  { provider: 'gemini', model: 'gemini-2.5-flash' },
  { provider: 'gemini', model: 'gemini-3.5-flash' },
  { provider: 'gemini', model: 'gemini-2.5-pro' },
  { provider: 'groq', model: 'llama-3.1-8b-instant' },
];

// ── OAuth service account (jose, không cần firebase-admin) ──────────────────
interface ServiceAccount { client_email: string; private_key: string }

function readServiceAccount(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Thiếu env FIREBASE_SERVICE_ACCOUNT (JSON service account có role Cloud Datastore User).');
  const sa = JSON.parse(raw);
  if (!sa.client_email || !sa.private_key) throw new Error('FIREBASE_SERVICE_ACCOUNT thiếu client_email/private_key.');
  return { client_email: sa.client_email, private_key: String(sa.private_key).replace(/\\n/g, '\n') };
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const key = await importPKCS8(sa.private_key, 'RS256');
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/datastore' })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(sa.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!r.ok) throw new Error(`OAuth token ${r.status}: ${await r.text()}`);
  const data: any = await r.json();
  if (!data.access_token) throw new Error('OAuth không trả access_token.');
  return data.access_token;
}

// ── Chuyển đổi Firestore REST Value ↔ JS ─────────────────────────────────────
function fromFsVal(v: any): any {
  if (v === null || v === undefined) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFsVal);
  if ('mapValue' in v) return fromFsFields(v.mapValue.fields || {});
  return null;
}

function fromFsFields(fields: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields || {})) out[k] = fromFsVal(v);
  return out;
}

function toFsVal(v: any): any {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsVal) } };
  if (typeof v === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) fields[k] = toFsVal(val);
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

// ── Gọi AI (xoay vòng model khi lỗi/429) ─────────────────────────────────────
async function callGemini(model: string, system: string, user: string, temperature: number, json: boolean): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Server thiếu GEMINI_API_KEY.');
  const ai = new GoogleGenAI({ apiKey: key });
  const cfg: any = { systemInstruction: system, temperature };
  if (json) cfg.responseMimeType = 'application/json';
  const resp = await ai.models.generateContent({ model, contents: user, config: cfg });
  return resp.text || (json ? '{}' : '');
}

async function callGroq(model: string, system: string, user: string, temperature: number, json: boolean): Promise<string> {
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

async function callAny(preferredModel: string, system: string, user: string, temperature: number, json: boolean): Promise<string> {
  // Ưu tiên model của suite (nếu thuộc chain), sau đó xoay vòng phần còn lại.
  const chain = [
    ...MODEL_CHAIN.filter((m) => m.model === preferredModel),
    ...MODEL_CHAIN.filter((m) => m.model !== preferredModel),
  ];
  let lastErr: any = null;
  for (const { provider, model } of chain) {
    try {
      return provider === 'groq'
        ? await callGroq(model, system, user, temperature, json)
        : await callGemini(model, system, user, temperature, json);
    } catch (e) { lastErr = e; }
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
  const last = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (last === -1) return null;
  try { return JSON.parse(s.slice(first, last + 1)) as T; } catch { return null; }
}

// ── Chạy health cho một suite ────────────────────────────────────────────────
interface SuiteDoc {
  docId: string;
  name: string;
  prompt: string;
  model: string;
  testCases: { id: string; input: string; criteria: string[] }[];
  runs: any[];
}

async function scoreOutput(preferredModel: string, output: string, criteria: string[]): Promise<{ score: number; feedback: string }> {
  const criteriaText = (criteria || []).length > 0
    ? criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')
    : '1. Hữu ích, chính xác, đúng trọng tâm.\n2. Rõ ràng, mạch lạc.';
  const text = await callAny(
    preferredModel,
    'Bạn là giám khảo trung lập chấm chất lượng đầu ra theo tiêu chí. Khắt khe, nhất quán.',
    `[BỘ TIÊU CHÍ]\n${criteriaText}\n\n[ĐẦU RA CẦN CHẤM]\n${output}\n\nChỉ trả về JSON: {"score": <0-100>, "feedback": "<ngắn gọn>"}`,
    0.2,
    true,
  );
  const parsed = extractJsonSafe<{ score?: number; feedback?: string }>(text);
  const score = typeof parsed?.score === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 50;
  return { score, feedback: typeof parsed?.feedback === 'string' ? parsed.feedback : '' };
}

async function runSuite(suite: SuiteDoc): Promise<{ at: string; model: string; avgScore: number; results: any[] }> {
  const tests = (suite.testCases || []).slice(0, MAX_TESTS_PER_SUITE);
  const results = await Promise.all(tests.map(async (t) => {
    try {
      const output = await callAny(suite.model, suite.prompt || '', (t.input || '').trim() || TRIGGER, 0.7, false);
      const { score, feedback } = await scoreOutput(suite.model, output, t.criteria || []);
      return { testId: t.id, score, feedback };
    } catch (e: any) {
      return { testId: t.id, score: 0, feedback: `Lỗi: ${e?.message || 'không xác định'}` };
    }
  }));
  const avgScore = results.length ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0;
  return { at: new Date().toISOString(), model: suite.model || 'gemini-2.5-flash', avgScore, results };
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: any, res: any) {
  // Chỉ Vercel Cron (hoặc người giữ CRON_SECRET) được gọi. Thiếu secret → khoá hẳn.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(500).json({ error: 'Chưa đặt env CRON_SECRET — đặt ở Vercel để bật cron an toàn.' });
    return;
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'Sai hoặc thiếu CRON_SECRET.' });
    return;
  }

  try {
    const sa = readServiceAccount();
    const token = await getAccessToken(sa);
    const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    // Query các suite bật cron (single-field filter — không cần composite index).
    const qr = await fetch(`${FIRESTORE_BASE}:runQuery`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'healthSuites' }],
          where: { fieldFilter: { field: { fieldPath: 'cronEnabled' }, op: 'EQUAL', value: { booleanValue: true } } },
          limit: MAX_SUITES_PER_RUN,
        },
      }),
    });
    if (!qr.ok) throw new Error(`Firestore query ${qr.status}: ${await qr.text()}`);
    const rows: any[] = await qr.json();

    const suites: SuiteDoc[] = rows
      .filter((r) => r.document)
      .map((r) => {
        const data = fromFsFields(r.document.fields || {});
        return {
          docId: String(r.document.name).split('/').pop() as string,
          name: data.name || '',
          prompt: data.prompt || '',
          model: data.model || 'gemini-2.5-flash',
          testCases: Array.isArray(data.testCases) ? data.testCases : [],
          runs: Array.isArray(data.runs) ? data.runs : [],
        };
      })
      .filter((s) => s.testCases.length > 0);

    const summary: { id: string; name: string; avgScore: number; delta: number | null }[] = [];

    for (const suite of suites) {
      const run = await runSuite(suite);
      const prevAvg = suite.runs.length > 0 && typeof suite.runs[0]?.avgScore === 'number' ? suite.runs[0].avgScore : null;
      const newRuns = [run, ...suite.runs].slice(0, MAX_RUNS_KEPT);

      const patch = await fetch(
        `${FIRESTORE_BASE}/healthSuites/${encodeURIComponent(suite.docId)}?updateMask.fieldPaths=runs&updateMask.fieldPaths=updatedAt`,
        {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({
            fields: {
              runs: toFsVal(newRuns),
              updatedAt: { timestampValue: new Date().toISOString() },
            },
          }),
        },
      );
      if (!patch.ok) throw new Error(`Firestore patch ${patch.status}: ${await patch.text()}`);

      summary.push({
        id: suite.docId,
        name: suite.name,
        avgScore: run.avgScore,
        delta: prevAvg === null ? null : run.avgScore - prevAvg,
      });
    }

    res.status(200).json({ processed: summary.length, results: summary });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Lỗi cron health-check.' });
  }
}
