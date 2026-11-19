import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { generateKeyPairSync } from 'crypto';

// Trần rate-limit đọc lúc nạp module — đặt trước import (vi.hoisted) để các test dùng chung key không chạm trần.
vi.hoisted(() => { process.env.RUN_RATE_LIMIT_PER_MIN = '50'; });
import handler, {
  parseBearer, validateInputs, nextUsage, effectiveQuota, keyAllowsApp, pickModel, renderVars, hashKey, HttpError, quotaDay,
} from '../../api/run';

describe('api/run — hàm thuần', () => {
  it('parseBearer chỉ nhận pb_live_', () => {
    expect(parseBearer('Bearer pb_live_' + 'a'.repeat(43))).toBe('pb_live_' + 'a'.repeat(43));
    expect(parseBearer('Bearer abc')).toBeNull();
    expect(parseBearer(undefined)).toBeNull();
  });

  it('validateInputs: áp mặc định, báo thiếu / biến lạ / sai kiểu / quá dài', () => {
    const vars = [{ name: 'a', required: true, defaultValue: 'mặc định' }, { name: 'b', required: true }, { name: 'c' }];
    expect(validateInputs(vars, { b: ' x ' })).toEqual({ a: 'mặc định', b: 'x', c: '' });
    const err = (fn: () => unknown) => { try { fn(); } catch (e) { return e as HttpError; } throw new Error('không ném lỗi'); };
    expect(err(() => validateInputs(vars, {})).extra).toEqual({ missing: ['b'] });
    expect(err(() => validateInputs(vars, { b: 'x', z: '1' })).extra?.unknown).toEqual(['z']);
    expect(err(() => validateInputs(vars, { b: 5 })).status).toBe(400);
    expect(err(() => validateInputs(vars, [])).status).toBe(400);
    expect(err(() => validateInputs(vars, { b: 'x'.repeat(10_001) })).message).toMatch(/quá dài/);
  });

  it('nextUsage: cộng trong ngày, reset ngày mới, báo vượt', () => {
    expect(nextUsage({ day: '2026-11-19', count: 4 }, '2026-11-19', 5)).toEqual({ day: '2026-11-19', count: 5, exceeded: false });
    expect(nextUsage({ day: '2026-11-19', count: 5 }, '2026-11-19', 5).exceeded).toBe(true);
    expect(nextUsage({ day: '2026-11-18', count: 99 }, '2026-11-19', 5).count).toBe(1);
    expect(nextUsage(undefined, '2026-11-19', 5).count).toBe(1);
  });

  it('effectiveQuota kẹp theo trần env', () => {
    expect(effectiveQuota(50, 100)).toBe(50);
    expect(effectiveQuota(500, 100)).toBe(100);
    expect(effectiveQuota(undefined, 100)).toBe(100);
  });

  it('keyAllowsApp / pickModel / renderVars', () => {
    expect(keyAllowsApp(['*'], 'x')).toBe(true);
    expect(keyAllowsApp(['a'], 'x')).toBe(false);
    expect(keyAllowsApp(undefined, 'x')).toBe(false);
    expect(pickModel('gemini-3.5-flash')).toBe('gemini-3.5-flash');
    expect(pickModel('gpt-9')).toBe('gemini-3.5-flash-lite');
    expect(renderVars('{{a}}-{{b}}', { a: '1', b: '' })).toBe('1-{{b}}');
  });
});

// ── Handler với Firestore / OAuth / Groq giả lập qua fetch ───────────────────

const KEY = 'pb_live_' + 'k'.repeat(43);
const HASH = hashKey(KEY);
const today = quotaDay();

interface Db { key: any; app: any; updateTime: number; commits: any[] }
let db: Db;
let groqBodies: any[];

function fsVal(v: any): any {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return { integerValue: String(v) };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fsVal) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fsVal(x)])) } };
}
const fsDoc = (data: any, updateTime: string) => ({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, fsVal(v)])), updateTime });
const json = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function fakeRes() {
  const r: any = { statusCode: 0, body: null, headers: {} };
  r.status = (c: number) => { r.statusCode = c; return r; };
  r.json = (b: any) => { r.body = b; return r; };
  r.setHeader = (k: string, v: string) => { r.headers[k] = v; };
  return r;
}
async function call(body: any, headers: Record<string, string> = {}) {
  const res = fakeRes();
  await handler({ method: 'POST', headers: { authorization: `Bearer ${KEY}`, ...headers }, body }, res);
  return res;
}

beforeAll(() => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
    client_email: 'sa@test.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  });
});

beforeEach(() => {
  process.env.GROQ_API_KEY = 'server-groq';
  delete process.env.GEMINI_API_KEY; // chuỗi bỏ qua Gemini → rơi về Groq (giả lập được bằng fetch)
  process.env.RUN_MAX_DAILY_QUOTA = '100';
  db = {
    key: { ownerId: 'owner', name: 'k', prefix: 'pb_live_kkkk', appIds: ['*'], dailyQuota: 2, usage: { day: '', count: 0 } },
    app: { userId: 'owner', apiEnabled: true, promptTemplate: 'Thơ về {{chude}}.', variables: [{ name: 'chude', required: true }], model: 'gemini-3.5-flash-lite' },
    updateTime: 1,
    commits: [],
  };
  groqBodies = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any = {}) => {
    if (url.startsWith('https://oauth2.googleapis.com/token')) return json({ access_token: 'tok', expires_in: 3600 });
    if (url.endsWith(`/apiKeys/${HASH}`)) return db.key ? json(fsDoc(db.key, `t${db.updateTime}`)) : json({}, 404);
    if (url.includes('/sharedApps/')) return url.endsWith('/sharedApps/app1') && db.app ? json(fsDoc(db.app, 't')) : json({}, 404);
    if (url.endsWith(':commit')) {
      const w = JSON.parse(init.body).writes[0];
      if (w.currentDocument.updateTime !== `t${db.updateTime}`) return json({ error: 'FAILED_PRECONDITION' }, 400);
      const f = w.update.fields.usage.mapValue.fields;
      db.key.usage = { day: f.day.stringValue, count: Number(f.count.integerValue) };
      db.updateTime++;
      db.commits.push(db.key.usage);
      return json({});
    }
    if (url.startsWith('https://api.groq.com/')) {
      groqBodies.push({ auth: init.headers.Authorization, body: JSON.parse(init.body) });
      return json({ choices: [{ message: { content: 'OUT' } }] });
    }
    throw new Error('URL lạ: ' + url);
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe('api/run — handler', () => {
  it('chạy app: điền biến vào system prompt, tính 1 lượt', async () => {
    const r = await call({ app: 'app1', inputs: { chude: 'mèo' } });
    expect(r.statusCode).toBe(200);
    expect(r.body).toEqual({ output: 'OUT', model: 'openai/gpt-oss-20b', usage: { today: 1, quota: 2 } });
    expect(groqBodies[0].body.messages[0]).toEqual({ role: 'system', content: 'Thơ về mèo.' });
    expect(groqBodies[0].auth).toBe('Bearer server-groq');
    expect(db.commits).toEqual([{ day: today, count: 1 }]);
  });

  it('vượt quota → 429, không gọi model', async () => {
    db.key.usage = { day: today, count: 2 };
    const r = await call({ app: 'app1', inputs: { chude: 'mèo' } });
    expect(r.statusCode).toBe(429);
    expect(groqBodies).toHaveLength(0);
  });

  it('BYOK Groq: dùng key người gọi, không tính quota', async () => {
    db.key.usage = { day: today, count: 2 }; // đã hết quota vẫn chạy được
    const r = await call({ app: 'app1', inputs: { chude: 'mèo' } }, { 'x-groq-api-key': 'user-groq' });
    expect(r.statusCode).toBe(200);
    expect(r.body.usage).toBeNull();
    expect(groqBodies[0].auth).toBe('Bearer user-groq');
    expect(db.commits).toHaveLength(0);
  });

  it('key sai / thu hồi → 401', async () => {
    db.key = null;
    expect((await call({ app: 'app1', inputs: { chude: 'x' } })).statusCode).toBe(401);
    db.key = { ownerId: 'owner', appIds: ['*'], revokedAt: '2026-11-19T00:00:00Z' };
    expect((await call({ app: 'app1', inputs: { chude: 'x' } })).statusCode).toBe(401);
    const res = fakeRes();
    await handler({ method: 'POST', headers: {}, body: {} }, res);
    expect(res.statusCode).toBe(401);
  });

  it('404 khi app chưa bật API / khác chủ / ngoài phạm vi / không tồn tại', async () => {
    db.app.apiEnabled = false;
    expect((await call({ app: 'app1', inputs: { chude: 'x' } })).statusCode).toBe(404);
    db.app.apiEnabled = true; db.app.userId = 'someone-else';
    expect((await call({ app: 'app1', inputs: { chude: 'x' } })).statusCode).toBe(404);
    db.app.userId = 'owner'; db.key.appIds = ['other'];
    expect((await call({ app: 'app1', inputs: { chude: 'x' } })).statusCode).toBe(404);
    db.key.appIds = ['*'];
    expect((await call({ app: 'nope', inputs: {} })).statusCode).toBe(404);
    expect(groqBodies).toHaveLength(0);
    expect(db.commits).toHaveLength(0);
  });

  it('400: thiếu biến bắt buộc / app id sai; 405 khi không phải POST', async () => {
    const r = await call({ app: 'app1', inputs: {} });
    expect(r.statusCode).toBe(400);
    expect(r.body.missing).toEqual(['chude']);
    expect((await call({ app: '../x' })).statusCode).toBe(400);
    const res = fakeRes();
    await handler({ method: 'GET', headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  it('rate-limit theo key: vượt trần/phút → 429 kèm Retry-After', async () => {
    const other = 'pb_live_' + 'r'.repeat(43); // key riêng để không ảnh hưởng test khác
    let last: any;
    for (let i = 0; i < 51; i++) {
      last = fakeRes();
      await handler({ method: 'POST', headers: { authorization: `Bearer ${other}` }, body: { app: 'app1' } }, last);
    }
    expect(last.statusCode).toBe(429);
    expect(last.headers['Retry-After']).toBe('60');
  });

  it('tranh chấp ghi quota → đọc lại và thử lại', async () => {
    let first = true;
    const orig = (globalThis.fetch as any).getMockImplementation();
    (globalThis.fetch as any).mockImplementation(async (url: string, init: any) => {
      if (url.endsWith(':commit') && first) { first = false; db.updateTime++; return json({ error: 'FAILED_PRECONDITION' }, 400); }
      return orig(url, init);
    });
    const r = await call({ app: 'app1', inputs: { chude: 'mèo' } });
    expect(r.statusCode).toBe(200);
    expect(db.commits).toEqual([{ day: today, count: 1 }]);
  });
});
