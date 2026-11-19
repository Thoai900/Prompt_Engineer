import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createServer, type Server as HttpServer } from 'http';
import { generateKeyPairSync } from 'crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

vi.hoisted(() => { process.env.RUN_RATE_LIMIT_PER_MIN = '500'; });

import handler, { buildToolList, slugifyToolName, variablesToJsonSchema, hashKey, quotaDay } from '../../api/run';

describe('api/run MCP — hàm thuần', () => {
  it('slugifyToolName bỏ dấu, kebab-case, ≤ 48', () => {
    expect(slugifyToolName('Viết thơ Đường luật!')).toBe('viet-tho-duong-luat');
    expect(slugifyToolName('')).toBe('app');
    expect(slugifyToolName('a'.repeat(80))).toHaveLength(48);
  });

  it('variablesToJsonSchema: biến có mặc định không bắt buộc', () => {
    expect(variablesToJsonSchema([
      { name: 'chude', required: true, description: 'chủ đề' },
      { name: 'lop', required: true, defaultValue: '5' },
      { name: 'ghichu' },
    ])).toEqual({
      type: 'object',
      properties: { chude: { type: 'string', description: 'chủ đề' }, lop: { type: 'string', default: '5' }, ghichu: { type: 'string' } },
      required: ['chude'],
    });
    expect(variablesToJsonSchema([])).toEqual({ type: 'object', properties: {} });
  });

  it('buildToolList: sắp theo appId, trùng tên thêm hậu tố', () => {
    const tools = buildToolList([
      { id: 'bbb222', data: { name: 'Viết thơ', variables: [] } },
      { id: 'aaa111', data: { name: 'Viết thơ', description: 'lục bát', variables: [] } },
    ]);
    expect(tools.map((t) => [t.name, t.appId])).toEqual([['viet-tho', 'aaa111'], ['viet-tho-bbb222', 'bbb222']]);
    expect(tools[0].description).toContain('Viết thơ — lục bát');
  });
});

// ── MCP thật qua HTTP: server Node giống Vercel (body đã parse, req.query, res.status/json) + client SDK ──

const KEY = 'pb_live_' + 'm'.repeat(43);
const HASH = hashKey(KEY);
const realFetch = globalThis.fetch;
let http: HttpServer;
let base = '';
let db: { key: any; apps: Record<string, any>; commits: any[]; updateTime: number };
let groqSystems: string[];

function fsVal(v: any): any {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return { integerValue: String(v) };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fsVal) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fsVal(x)])) } };
}
const fields = (d: any) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, fsVal(v)]));
const json = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeAll(async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ client_email: 'sa@test', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
  http = createServer(async (req: any, res: any) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const raw = Buffer.concat(chunks).toString('utf8');
    req.body = raw ? JSON.parse(raw) : undefined;
    req.query = Object.fromEntries(new URL(req.url, 'http://x').searchParams);
    res.status = (c: number) => { res.statusCode = c; return res; };
    res.json = (b: any) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(b)); return res; };
    await handler(req, res);
  });
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', () => r()));
  base = `http://127.0.0.1:${(http.address() as any).port}/api/run?mode=mcp`;
});
afterAll(() => new Promise<void>((r) => http.close(() => r())));

beforeEach(() => {
  process.env.GROQ_API_KEY = 'server-groq';
  delete process.env.GEMINI_API_KEY;
  db = {
    key: { ownerId: 'owner', appIds: ['*'], dailyQuota: 5, usage: { day: '', count: 0 } },
    apps: {
      app1: { userId: 'owner', name: 'Viết thơ', apiEnabled: true, promptTemplate: 'Thơ về {{chude}}.', variables: [{ name: 'chude', required: true, description: 'chủ đề' }], model: 'gemini-3.5-flash-lite' },
      app2: { userId: 'owner', name: 'Tắt API', apiEnabled: false, promptTemplate: 'x', variables: [] },
      app3: { userId: 'other', name: 'Của người khác', apiEnabled: true, promptTemplate: 'x', variables: [] },
    },
    commits: [],
    updateTime: 1,
  };
  groqSystems = [];
  vi.stubGlobal('fetch', vi.fn(async (input: any, init: any = {}) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith('http://127.0.0.1')) return realFetch(input, init); // client MCP → server test
    if (url.startsWith('https://oauth2.googleapis.com/token')) return json({ access_token: 'tok', expires_in: 3600 });
    if (url.endsWith(`/apiKeys/${HASH}`)) return db.key ? json({ fields: fields(db.key), updateTime: `t${db.updateTime}` }) : json({}, 404);
    if (url.includes('/apiKeys/')) return json({}, 404); // key lạ
    const m = url.match(/\/sharedApps\/([^/]+)$/);
    if (m) return db.apps[m[1]] ? json({ fields: fields(db.apps[m[1]]), updateTime: 't' }) : json({}, 404);
    if (url.endsWith(':runQuery')) {
      // Mô phỏng truy vấn userId == owner AND apiEnabled == true.
      const f = JSON.parse(init.body).structuredQuery.where.compositeFilter.filters;
      const owner = f[0].fieldFilter.value.stringValue;
      return json(Object.entries(db.apps)
        .filter(([, a]) => a.userId === owner && a.apiEnabled === true)
        .map(([id, a]) => ({ document: { name: `projects/p/databases/(default)/documents/sharedApps/${id}`, fields: fields(a) } })));
    }
    if (url.endsWith(':commit')) {
      const w = JSON.parse(init.body).writes[0];
      if (w.currentDocument.updateTime !== `t${db.updateTime}`) return json({}, 400);
      const u = w.update.fields.usage.mapValue.fields;
      db.key.usage = { day: u.day.stringValue, count: Number(u.count.integerValue) };
      db.updateTime++;
      db.commits.push(db.key.usage);
      return json({});
    }
    if (url.startsWith('https://api.groq.com/')) {
      groqSystems.push(JSON.parse(init.body).messages[0].content);
      return json({ choices: [{ message: { content: 'BÀI THƠ' } }] });
    }
    throw new Error('URL lạ: ' + url);
  }));
});
afterEach(() => vi.unstubAllGlobals());

async function connect(key = KEY) {
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(base), { requestInit: { headers: { Authorization: `Bearer ${key}` } } }));
  return client;
}

describe('api/run MCP — qua client SDK', () => {
  it('tools/list: chỉ app đã bật API của chủ key, inputSchema từ biến', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(['viet-tho']);
    expect(tools[0].inputSchema).toEqual({ type: 'object', properties: { chude: { type: 'string', description: 'chủ đề' } }, required: ['chude'] });
    await client.close();
  });

  it('tools/call: chạy app, điền biến, tính quota', async () => {
    const client = await connect();
    const r: any = await client.callTool({ name: 'viet-tho', arguments: { chude: 'mèo' } });
    expect(r.isError).toBeFalsy();
    expect(r.content[0].text).toBe('BÀI THƠ\n\n— 1/5 lượt hôm nay');
    expect(groqSystems).toEqual(['Thơ về mèo.']);
    expect(db.commits).toEqual([{ day: quotaDay(), count: 1 }]);
    await client.close();
  });

  it('lỗi nghiệp vụ trả isError (thiếu biến / tool lạ / hết quota), không gọi model', async () => {
    const client = await connect();
    const missing: any = await client.callTool({ name: 'viet-tho', arguments: {} });
    expect(missing.isError).toBe(true);
    expect(missing.content[0].text).toContain('chude');
    const unknown: any = await client.callTool({ name: 'khong-co', arguments: {} });
    expect(unknown.isError).toBe(true);
    db.key.usage = { day: quotaDay(), count: 5 };
    const quota: any = await client.callTool({ name: 'viet-tho', arguments: { chude: 'x' } });
    expect(quota.isError).toBe(true);
    expect(quota.content[0].text).toMatch(/hết 5 lượt/);
    expect(groqSystems).toHaveLength(0);
    await client.close();
  });

  it('phạm vi key một app: chỉ thấy app đó (nếu cùng chủ + bật API)', async () => {
    db.key.appIds = ['app3', 'app1'];
    const client = await connect();
    expect((await client.listTools()).tools.map((t) => t.name)).toEqual(['viet-tho']);
    await client.close();
  });

  it('key sai → HTTP 401 trước khi vào MCP', async () => {
    const r = await realFetch(base, {
      method: 'POST',
      headers: { Authorization: 'Bearer pb_live_' + 'x'.repeat(43), 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(r.status).toBe(401);
    await expect(connect('khong-hop-le')).rejects.toThrow();
  });
});
