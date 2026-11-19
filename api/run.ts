import { createHash } from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { SignJWT, importPKCS8 } from 'jose';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// ─────────────────────────────────────────────────────────────────────────────
// HTTP API + MCP server cho Prompt Graph (Đợt 2–3 — spec 2026-11-19-graph-export-api-mcp-skill-design.md).
// MCP: /api/mcp được rewrite về /api/run?mode=mcp (vercel.json) — dùng chung xác thực/quota/chạy app.
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

export interface SnapshotVariable { name: string; required?: boolean; description?: string; defaultValue?: string }

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

// ── Lõi dùng chung cho HTTP API và MCP ───────────────────────────────────────

interface KeyCtx { keyHash: string; key: Record<string, any> }
interface AppDoc { id: string; data: Record<string, any> }

/** Bearer → key hợp lệ (chưa thu hồi) + rate-limit theo key. Ném HttpError 401/429. */
async function authenticate(req: any, res: any): Promise<KeyCtx> {
  const apiKey = parseBearer(req.headers?.authorization);
  if (!apiKey) throw new HttpError(401, 'Thiếu hoặc sai API key (Authorization: Bearer pb_live_…).');
  const keyHash = hashKey(apiKey);
  if (!checkRateLimit(keyHash)) {
    res.setHeader('Retry-After', '60');
    throw new HttpError(429, `Quá ${RL_PER_MIN} yêu cầu/phút cho key này.`);
  }
  const keyDoc = await getDocument(`apiKeys/${keyHash}`);
  if (!keyDoc || keyDoc.data.revokedAt) throw new HttpError(401, 'API key không hợp lệ hoặc đã thu hồi.');
  return { keyHash, key: keyDoc.data };
}

/** App gọi được bằng key: đã bật API, có snapshot, cùng chủ với key. */
function isCallableApp(data: Record<string, any> | undefined, ownerId: unknown): boolean {
  return !!data && data.apiEnabled === true && typeof data.promptTemplate === 'string' && data.userId === ownerId;
}

// Không phân biệt "không tồn tại" / "chưa bật API" / "ngoài phạm vi" — tránh dò app của người khác.
const NOT_FOUND_MSG = 'Không tìm thấy app, hoặc app chưa bật API cho key này.';

async function loadCallableApp(ctx: KeyCtx, appId: string): Promise<AppDoc> {
  if (!keyAllowsApp(ctx.key.appIds, appId)) throw new HttpError(404, NOT_FOUND_MSG);
  const app = await getDocument(`sharedApps/${appId}`);
  if (!app || !isCallableApp(app.data, ctx.key.ownerId)) throw new HttpError(404, NOT_FOUND_MSG);
  return { id: appId, data: app.data };
}

/** Kiểm inputs → điền biến → gọi model (BYOK hoặc key server + quota). */
async function runApp(ctx: KeyCtx, app: AppDoc, rawInputs: unknown, headers: any): Promise<{ output: string; model: string; usage: { today: number; quota: number } | null }> {
  const variables: SnapshotVariable[] = Array.isArray(app.data.variables) ? app.data.variables : [];
  const vars = validateInputs(variables, rawInputs);
  const system = renderVars(app.data.promptTemplate, vars);

  const byokGemini = typeof headers?.['x-gemini-api-key'] === 'string' ? headers['x-gemini-api-key'] : '';
  const byokGroq = typeof headers?.['x-groq-api-key'] === 'string' ? headers['x-groq-api-key'] : '';
  if (byokGemini || byokGroq) {
    // BYOK: gọi đúng nhà cung cấp người gọi chọn, không rơi về key server, không tính quota.
    const preferred = pickModel(app.data.model);
    const useGemini = !!byokGemini;
    const model = useGemini ? (preferred.startsWith('gemini') ? preferred : DEFAULT_GEMINI) : DEFAULT_GROQ;
    try {
      const output = useGemini ? await callGemini(byokGemini, model, system) : await callGroq(byokGroq, model, system);
      return { output, model, usage: null };
    } catch (e) {
      throw new HttpError(502, 'Gọi model bằng key của bạn thất bại.', { detail: e instanceof Error ? e.message : undefined });
    }
  }

  const cap = Math.max(1, Number(process.env.RUN_MAX_DAILY_QUOTA) || 100);
  const quota = effectiveQuota(ctx.key.dailyQuota, cap);
  const today = await consumeQuota(ctx.keyHash, quota); // đếm cả lượt gọi model thất bại (chặn dò lỗi tốn tiền)
  const { output, model } = await runWithServerKeys(pickModel(app.data.model), system);
  return { output, model, usage: { today, quota } };
}

// ── MCP (Đợt 3): /api/mcp → rewrite /api/run?mode=mcp (vercel.json) ─────────────

/** Tên tool MCP từ tên app: bỏ dấu, kebab-case, ≤ 48 ký tự (chừa chỗ hậu tố chống trùng). */
export function slugifyToolName(name: string): string {
  return String(name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 48).replace(/-+$/, '') || 'app';
}

/** JSON Schema cho inputSchema của tool từ biến của app. */
export function variablesToJsonSchema(variables: SnapshotVariable[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const v of variables) {
    properties[v.name] = {
      type: 'string',
      ...(v.description ? { description: v.description } : {}),
      ...(v.defaultValue ? { default: v.defaultValue } : {}),
    };
  }
  const required = variables.filter((v) => v.required && !v.defaultValue).map((v) => v.name);
  return { type: 'object', properties, ...(required.length ? { required } : {}) };
}

export interface McpTool { name: string; appId: string; description: string; inputSchema: Record<string, unknown> }

/**
 * App → danh sách tool. Sắp theo appId để tên ổn định giữa các lần gọi (server stateless: tools/call
 * dựng lại danh sách để tìm app theo tên). Trùng tên → thêm hậu tố 6 ký tự đầu của appId.
 */
export function buildToolList(apps: AppDoc[]): McpTool[] {
  const sorted = [...apps].sort((a, b) => a.id.localeCompare(b.id));
  const used = new Set<string>();
  return sorted.map((a) => {
    let name = slugifyToolName(a.data.name);
    if (used.has(name)) name = `${name}-${a.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toLowerCase()}`;
    used.add(name);
    const desc = [a.data.name, a.data.description].filter((x) => typeof x === 'string' && x.trim()).join(' — ');
    return {
      name,
      appId: a.id,
      description: `${desc || 'App PromptBuilder'}. Trả về văn bản do prompt của app sinh ra.`,
      inputSchema: variablesToJsonSchema(Array.isArray(a.data.variables) ? a.data.variables : []),
    };
  });
}

/** Các app key gọi được: phạm vi '*' → query app đã bật API của chủ; ngược lại đọc từng app. */
async function listCallableApps(ctx: KeyCtx): Promise<AppDoc[]> {
  const appIds: unknown = ctx.key.appIds;
  if (Array.isArray(appIds) && appIds.includes('*')) {
    const token = await getAccessToken();
    const r = await fetch(`${FIRESTORE}/${DOCS}:runQuery`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'sharedApps' }],
          where: { compositeFilter: { op: 'AND', filters: [
            { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: String(ctx.key.ownerId) } } },
            { fieldFilter: { field: { fieldPath: 'apiEnabled' }, op: 'EQUAL', value: { booleanValue: true } } },
          ] } },
          limit: 50,
        },
      }),
    });
    if (!r.ok) throw new Error(`Firestore query ${r.status}`);
    const rows: any[] = await r.json();
    return rows
      .filter((x) => x.document)
      .map((x) => ({ id: String(x.document.name).split('/').pop() as string, data: fromFsFields(x.document.fields || {}) }))
      .filter((a) => isCallableApp(a.data, ctx.key.ownerId));
  }
  const ids = (Array.isArray(appIds) ? appIds : []).filter((id): id is string => typeof id === 'string').slice(0, 50);
  const docs = await Promise.all(ids.map(async (id) => ({ id, doc: await getDocument(`sharedApps/${id}`) })));
  return docs.filter((d) => d.doc && isCallableApp(d.doc.data, ctx.key.ownerId)).map((d) => ({ id: d.id, data: d.doc!.data }));
}

async function handleMcp(req: any, res: any, ctx: KeyCtx): Promise<void> {
  const server = new Server({ name: 'promptbuilder', version: '1.0.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: buildToolList(await listCallableApps(ctx)).map(({ name, description, inputSchema }) => ({ name, description, inputSchema: inputSchema as any })),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = buildToolList(await listCallableApps(ctx)).find((t) => t.name === request.params.name);
    try {
      if (!tool) throw new HttpError(404, `Không có tool "${request.params.name}".`);
      const app = await loadCallableApp(ctx, tool.appId);
      const result = await runApp(ctx, app, request.params.arguments ?? {}, req.headers);
      const usage = result.usage ? `\n\n— ${result.usage.today}/${result.usage.quota} lượt hôm nay` : '';
      return { content: [{ type: 'text' as const, text: result.output + usage }] };
    } catch (e) {
      // Lỗi nghiệp vụ (thiếu biến, hết quota…) trả cho agent đọc được, không phải lỗi giao thức.
      const msg = e instanceof HttpError
        ? `${e.message}${e.extra ? ' ' + JSON.stringify(e.extra) : ''}`
        : 'Lỗi máy chủ.';
      if (!(e instanceof HttpError)) console.error('api/run mcp:', (e as Error)?.message);
      return { content: [{ type: 'text' as const, text: msg }], isError: true };
    }
  });

  // Stateless + trả JSON (không SSE): hợp serverless, mỗi POST một phiên ngắn.
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on?.('close', () => { transport.close(); server.close(); });
  await server.connect(transport);
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = undefined; } }
  await transport.handleRequest(req, res, body);
}

function isMcpRequest(req: any): boolean {
  if (req.query?.mode === 'mcp') return true;
  try { return new URL(req.url || '', 'http://x').searchParams.get('mode') === 'mcp'; } catch { return false; }
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  try {
    if (isMcpRequest(req)) {
      const ctx = await authenticate(req, res);
      await handleMcp(req, res, ctx);
      return;
    }

    if (req.method !== 'POST') throw new HttpError(405, 'Chỉ hỗ trợ POST.');
    const ctx = await authenticate(req, res);

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { throw new HttpError(400, 'Body JSON không hợp lệ.'); } }
    const appId = body?.app;
    if (typeof appId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(appId)) throw new HttpError(400, 'Thiếu hoặc sai `app` (id app).');

    const app = await loadCallableApp(ctx, appId);
    res.status(200).json(await runApp(ctx, app, body?.inputs, req.headers));
  } catch (err: any) {
    if (res.headersSent) return;
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, ...(err.extra || {}) });
    } else {
      console.error('api/run:', err?.message);
      res.status(500).json({ error: 'Lỗi máy chủ.' });
    }
  }
}
