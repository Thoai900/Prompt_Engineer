import { createHash } from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { SignJWT, importPKCS8 } from 'jose';

// ─────────────────────────────────────────────────────────────────────────────
// HTTP API cho Prompt Graph (Đợt 2 — spec 2026-11-19-graph-export-api-mcp-skill-design.md).
// TỰ CHỨA (không import file cục bộ) — trùng CÓ CHỦ ĐÍCH với api/health-cron.ts (service account,
// Firestore REST) và api/optimize.ts (chuỗi model, renderVars).
//
//   POST /api/run
//   Authorization: Bearer pb_live_…
//   { "app": "<appId>", "inputs": { "ten_bien": "giá trị" } }
//   → 200 { output, model, usage: { today, quota } | null }
//
// 1. SHA-256 key → apiKeys/{hash} (thiếu/thu hồi → 401).
// 2. sharedApps/{app}: phải apiEnabled + có promptTemplate, cùng chủ với key, trong phạm vi key (else 404).
// 3. Kiểm inputs theo variables (biến lạ / thiếu bắt buộc / quá dài → 400).
// 4. Quota/ngày (UTC) tăng bằng commit có precondition updateTime (thử lại khi tranh chấp) → 429 khi vượt.
//    Header BYOK (X-Gemini-Api-Key / X-Groq-Api-Key) → gọi bằng key của người gọi, KHÔNG tính quota.
// 5. Điền biến vào prompt mẫu → gọi model như runChainApp (system = prompt, user = câu kích hoạt cố định).
// Không lưu input/output — chỉ đếm lượt. Không mở CORS: gọi từ server, không nhúng key vào trang web.
// Env: FIREBASE_SERVICE_ACCOUNT, GEMINI_API_KEY, GROQ_API_KEY, RUN_MAX_DAILY_QUOTA (mặc định 100).
// ─────────────────────────────────────────────────────────────────────────────

export const config = { maxDuration: 60 };

const PROJECT_ID = 'eduai-nexus';
const DOCS = `projects/${PROJECT_ID}/databases/(default)/documents`;
const FIRESTORE = 'https://firestore.googleapis.com/v1';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const TRIGGER = 'Hãy thực hiện theo chỉ dẫn hệ thống ở trên.'; // giống runChainApp
const DEFAULT_GEMINI = 'gemini-3.5-flash-lite';
const DEFAULT_GROQ = 'openai/gpt-oss-20b';
const MAX_VALUE_CHARS = 10_000;
const MAX_TOTAL_CHARS = 50_000;
const RL_PER_MIN = Math.max(1, Number(process.env.RUN_RATE_LIMIT_PER_MIN) || 10);

// Chuỗi model dự phòng — khớp allowlist api/ai.ts và src/config/models.ts.
const MODEL_CHAIN: { provider: 'gemini' | 'groq'; model: string }[] = [
  { provider: 'gemini', model: 'gemini-3.5-flash-lite' },
  { provider: 'gemini', model: 'gemini-3.5-flash' },
  { provider: 'gemini', model: 'gemini-3.8-flash' },
  { provider: 'groq', model: 'openai/gpt-oss-20b' },
];

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) { super(message); }
}

// ── Hàm thuần (export để unit-test) ──────────────────────────────────────────

export function parseBearer(header: unknown): string | null {
  if (typeof header !== 'string') return null;
  const m = header.match(/^Bearer\s+(pb_live_[A-Za-z0-9_-]{20,100})$/);
  return m ? m[1] : null;
}

/** SHA-256 hex — khớp hashApiKey (WebCrypto) ở client src/utils/apiAccess.ts. */
export function hashKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

export function renderVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (m, name) =>
    typeof vars[name] === 'string' && vars[name] !== '' ? vars[name] : m);
}

export interface SnapshotVariable { name: string; required?: boolean; defaultValue?: string }

/**
 * Kiểm & chuẩn hoá inputs theo biến của app: chỉ nhận chuỗi của biến đã khai báo, áp mặc định,
 * báo thiếu biến bắt buộc. Ném HttpError(400) kèm chi tiết.
 */
export function validateInputs(variables: SnapshotVariable[], raw: unknown): Record<string, string> {
  const inputs = raw === undefined || raw === null ? {} : raw;
  if (typeof inputs !== 'object' || Array.isArray(inputs)) throw new HttpError(400, '`inputs` phải là object { tên_biến: chuỗi }.');
  const known = new Set(variables.map((v) => v.name));
  const unknown = Object.keys(inputs).filter((k) => !known.has(k));
  if (unknown.length) throw new HttpError(400, 'Có biến không thuộc app.', { unknown, expected: [...known] });

  const out: Record<string, string> = {};
  let total = 0;
  for (const v of variables) {
    const val = (inputs as Record<string, unknown>)[v.name];
    if (val !== undefined && typeof val !== 'string') throw new HttpError(400, `Biến "${v.name}" phải là chuỗi.`);
    const s = (val as string | undefined)?.trim() || v.defaultValue || '';
    if (s.length > MAX_VALUE_CHARS) throw new HttpError(400, `Biến "${v.name}" quá dài (> ${MAX_VALUE_CHARS} ký tự).`);
    total += s.length;
    out[v.name] = s;
  }
  if (total > MAX_TOTAL_CHARS) throw new HttpError(400, `Tổng inputs quá dài (> ${MAX_TOTAL_CHARS} ký tự).`);
  const missing = variables.filter((v) => v.required && !out[v.name]).map((v) => v.name);
  if (missing.length) throw new HttpError(400, 'Thiếu biến bắt buộc.', { missing });
  return out;
}

/** Ngày quota theo UTC: 'YYYY-MM-DD'. */
export function quotaDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Quota hiệu lực = min(quota của key, trần env); key thiếu/sai → trần. */
export function effectiveQuota(keyQuota: unknown, envCap: number): number {
  const q = Math.floor(Number(keyQuota));
  return Number.isFinite(q) && q > 0 ? Math.min(q, envCap) : envCap;
}

/** Lượt dùng sau khi cộng 1 (reset khi sang ngày mới); exceeded nếu vượt quota. */
export function nextUsage(usage: unknown, day: string, quota: number): { day: string; count: number; exceeded: boolean } {
  const u = (usage && typeof usage === 'object' ? usage : {}) as { day?: unknown; count?: unknown };
  const prev = u.day === day ? Math.max(0, Math.floor(Number(u.count) || 0)) : 0;
  return { day, count: prev + 1, exceeded: prev + 1 > quota };
}

export function keyAllowsApp(appIds: unknown, appId: string): boolean {
  return Array.isArray(appIds) && (appIds.includes('*') || appIds.includes(appId));
}

/** Model dùng khi gọi bằng key server: model của app nếu thuộc chuỗi, ngược lại mặc định. */
export function pickModel(model: unknown): string {
  return MODEL_CHAIN.some((m) => m.model === model) ? (model as string) : DEFAULT_GEMINI;
}

// ── Firestore REST (service account) ─────────────────────────────────────────

let cachedToken: { token: string; exp: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.token;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Thiếu env FIREBASE_SERVICE_ACCOUNT.');
  const sa = JSON.parse(raw);
  const key = await importPKCS8(String(sa.private_key).replace(/\\n/g, '\n'), 'RS256');
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
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!r.ok) throw new Error(`OAuth token ${r.status}`);
  const data: any = await r.json();
  cachedToken = { token: data.access_token, exp: Date.now() + (Number(data.expires_in) || 3000) * 1000 };
  return cachedToken.token;
}

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

async function getDocument(path: string): Promise<{ data: Record<string, any>; updateTime: string } | null> {
  const token = await getAccessToken();
  const r = await fetch(`${FIRESTORE}/${DOCS}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Firestore get ${r.status}`);
  const doc: any = await r.json();
  return { data: fromFsFields(doc.fields || {}), updateTime: doc.updateTime };
}

/** Ghi usage với precondition updateTime. false = tài liệu đã đổi (tranh chấp) → đọc lại & thử lại. */
async function writeUsage(keyHash: string, updateTime: string, usage: { day: string; count: number }): Promise<boolean> {
  const token = await getAccessToken();
  const r = await fetch(`${FIRESTORE}/${DOCS}:commit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      writes: [{
        update: {
          name: `${DOCS}/apiKeys/${keyHash}`,
          fields: { usage: { mapValue: { fields: { day: { stringValue: usage.day }, count: { integerValue: String(usage.count) } } } } },
        },
        updateMask: { fieldPaths: ['usage'] },
        currentDocument: { updateTime },
      }],
    }),
  });
  if (r.ok) return true;
  if (r.status === 400 || r.status === 409) return false; // FAILED_PRECONDITION / ABORTED
  throw new Error(`Firestore commit ${r.status}`);
}

/** Tăng lượt dùng hôm nay (thử lại tối đa 4 lần khi tranh chấp). Trả số lượt sau khi tăng. */
async function consumeQuota(keyHash: string, quota: number): Promise<number> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const doc = await getDocument(`apiKeys/${keyHash}`);
    if (!doc || doc.data.revokedAt) throw new HttpError(401, 'API key không hợp lệ hoặc đã thu hồi.');
    const next = nextUsage(doc.data.usage, quotaDay(), quota);
    if (next.exceeded) throw new HttpError(429, `Đã dùng hết ${quota} lượt hôm nay (reset 00:00 UTC).`, { quota });
    if (await writeUsage(keyHash, doc.updateTime, next)) return next.count;
  }
  throw new HttpError(503, 'Quá nhiều yêu cầu đồng thời — thử lại.');
}

// ── Gọi model ────────────────────────────────────────────────────────────────

async function callGemini(apiKey: string, model: string, system: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const resp = await ai.models.generateContent({ model, contents: TRIGGER, config: { systemInstruction: system, temperature: 0.7 } });
  return resp.text || '';
}

async function callGroq(apiKey: string, model: string, system: string): Promise<string> {
  const r = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: TRIGGER }],
      temperature: 0.7,
      ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
    }),
  });
  if (!r.ok) throw new Error(`Groq API ${r.status}`);
  const data: any = await r.json();
  return data?.choices?.[0]?.message?.content || '';
}

/** Key server: model của app trước, rồi xoay vòng phần còn lại của chuỗi. */
async function runWithServerKeys(preferred: string, system: string): Promise<{ output: string; model: string }> {
  const chain = [...MODEL_CHAIN.filter((m) => m.model === preferred), ...MODEL_CHAIN.filter((m) => m.model !== preferred)];
  let lastErr: unknown = null;
  for (const { provider, model } of chain) {
    const key = provider === 'groq' ? process.env.GROQ_API_KEY : process.env.GEMINI_API_KEY;
    if (!key) continue;
    try {
      const output = provider === 'groq' ? await callGroq(key, model, system) : await callGemini(key, model, system);
      return { output, model };
    } catch (e) { lastErr = e; }
  }
  throw new HttpError(502, 'Không gọi được model.', { detail: lastErr instanceof Error ? lastErr.message : undefined });
}

// ── Rate-limit theo key (bộ nhớ, mỗi instance — chặn burst; quota ngày mới là giới hạn thật) ──
const rlBuckets = new Map<string, number[]>();
function checkRateLimit(id: string): boolean {
  const now = Date.now();
  if (rlBuckets.size > 5000) rlBuckets.clear();
  const stamps = (rlBuckets.get(id) || []).filter((t) => now - t < 60_000);
  if (stamps.length >= RL_PER_MIN) return false;
  stamps.push(now);
  rlBuckets.set(id, stamps);
  return true;
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Chỉ hỗ trợ POST.');

    const apiKey = parseBearer(req.headers?.authorization);
    if (!apiKey) throw new HttpError(401, 'Thiếu hoặc sai API key (Authorization: Bearer pb_live_…).');
    const keyHash = hashKey(apiKey);
    if (!checkRateLimit(keyHash)) {
      res.setHeader('Retry-After', '60');
      throw new HttpError(429, `Quá ${RL_PER_MIN} yêu cầu/phút cho key này.`);
    }

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { throw new HttpError(400, 'Body JSON không hợp lệ.'); } }
    const appId = body?.app;
    if (typeof appId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(appId)) throw new HttpError(400, 'Thiếu hoặc sai `app` (id app).');

    const keyDoc = await getDocument(`apiKeys/${keyHash}`);
    if (!keyDoc || keyDoc.data.revokedAt) throw new HttpError(401, 'API key không hợp lệ hoặc đã thu hồi.');

    // Không phân biệt "không tồn tại" / "chưa bật API" / "ngoài phạm vi" — tránh dò app của người khác.
    const notFound = new HttpError(404, 'Không tìm thấy app, hoặc app chưa bật API cho key này.');
    if (!keyAllowsApp(keyDoc.data.appIds, appId)) throw notFound;
    const app = await getDocument(`sharedApps/${appId}`);
    if (!app || app.data.apiEnabled !== true || typeof app.data.promptTemplate !== 'string' || app.data.userId !== keyDoc.data.ownerId) throw notFound;

    const variables: SnapshotVariable[] = Array.isArray(app.data.variables) ? app.data.variables : [];
    const vars = validateInputs(variables, body?.inputs);
    const system = renderVars(app.data.promptTemplate, vars);

    const byokGemini = typeof req.headers?.['x-gemini-api-key'] === 'string' ? req.headers['x-gemini-api-key'] : '';
    const byokGroq = typeof req.headers?.['x-groq-api-key'] === 'string' ? req.headers['x-groq-api-key'] : '';

    if (byokGemini || byokGroq) {
      // BYOK: gọi đúng nhà cung cấp người gọi chọn, không rơi về key server, không tính quota.
      const preferred = pickModel(app.data.model);
      const useGemini = !!byokGemini;
      const model = useGemini ? (preferred.startsWith('gemini') ? preferred : DEFAULT_GEMINI) : DEFAULT_GROQ;
      let output: string;
      try {
        output = useGemini ? await callGemini(byokGemini, model, system) : await callGroq(byokGroq, model, system);
      } catch (e) {
        throw new HttpError(502, 'Gọi model bằng key của bạn thất bại.', { detail: e instanceof Error ? e.message : undefined });
      }
      res.status(200).json({ output, model, usage: null });
      return;
    }

    const cap = Math.max(1, Number(process.env.RUN_MAX_DAILY_QUOTA) || 100);
    const quota = effectiveQuota(keyDoc.data.dailyQuota, cap);
    const today = await consumeQuota(keyHash, quota); // đếm cả lượt gọi model thất bại (chặn dò lỗi tốn tiền)
    const { output, model } = await runWithServerKeys(pickModel(app.data.model), system);
    res.status(200).json({ output, model, usage: { today, quota } });
  } catch (err: any) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, ...(err.extra || {}) });
    } else {
      console.error('api/run:', err?.message);
      res.status(500).json({ error: 'Lỗi máy chủ.' });
    }
  }
}
