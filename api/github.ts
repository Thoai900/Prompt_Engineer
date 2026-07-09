import { createRemoteJWKSet, jwtVerify } from 'jose';

// ─────────────────────────────────────────────────────────────────────────────
// Vercel Serverless Function: proxy tải nội dung RAW từ GitHub cho "Thư viện
// năng lực AI" (client bị CORS + rate-limit khi gọi thẳng GitHub).
// Tự chứa (không import helper cục bộ). Auth Firebase ID token như api/ai.ts.
// Allow-list host GitHub + chống SSRF + cap dung lượng.
// action:'search' để dành cho đợt sau (live GitHub search) — chưa bật.
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT_ID = 'eduai-nexus';
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

const FETCH_TIMEOUT_MS = 10_000;
const MAX_TEXT_CHARS = 50_000;       // SKILL.md/guide dài hơn 15k của fetch-url; text thuần nên an toàn
const MAX_DOWNLOAD_BYTES = 3_000_000;
const ALLOWED_HOSTS = new Set(['raw.githubusercontent.com', 'github.com', 'api.github.com']);

const RL_PER_MIN = Math.max(1, Number(process.env.GITHUB_RATE_LIMIT_PER_MIN) || 20);
const rlBuckets = new Map<string, number[]>();

function checkRateLimit(uid: string): boolean {
  const now = Date.now();
  if (rlBuckets.size > 5000) rlBuckets.clear();
  const stamps = (rlBuckets.get(uid) || []).filter((t) => now - t < 60_000);
  if (stamps.length >= RL_PER_MIN) return false;
  stamps.push(now);
  rlBuckets.set(uid, stamps);
  return true;
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

function validateGithubUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('URL không hợp lệ.'); }
  if (url.protocol !== 'https:') throw new Error('Chỉ hỗ trợ https.');
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('Chỉ cho phép tải từ GitHub (raw.githubusercontent.com).');
  }
  return url;
}

export default async function handler(req: any, res: any) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const uid = await verifyFirebaseToken(req.headers?.authorization);
  if (!uid) return res.status(401).json({ error: 'Cần đăng nhập (Firebase ID token không hợp lệ).' });
  if (!checkRateLimit(uid)) return res.status(429).json({ error: 'Tải quá nhanh — thử lại sau một phút.' });

  const action = typeof req.body?.action === 'string' ? req.body.action : 'raw';
  if (action !== 'raw') {
    return res.status(400).json({ error: `action "${action}" chưa được hỗ trợ.` });
  }

  const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  if (!rawUrl) return res.status(400).json({ error: 'Thiếu url.' });

  let url: URL;
  try { url = validateGithubUrl(rawUrl); }
  catch (e: any) { return res.status(400).json({ error: e.message }); }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PromptBuilderBot/1.0; +ai-power-library)',
        Accept: 'text/plain, text/markdown, application/json;q=0.9, */*;q=0.5',
      },
    });
    clearTimeout(timer);

    if (!response.ok) {
      return res.status(422).json({ error: `GitHub trả về HTTP ${response.status}.` });
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_DOWNLOAD_BYTES) {
      return res.status(422).json({ error: 'Tệp quá lớn (>3MB).' });
    }
    let text = new TextDecoder('utf-8').decode(buffer).trim();
    const truncated = text.length > MAX_TEXT_CHARS;
    text = text.slice(0, MAX_TEXT_CHARS);
    if (!text) return res.status(422).json({ error: 'Tệp rỗng.' });

    return res.status(200).json({ text, truncated });
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? 'Hết thời gian chờ (10s).' : (err?.message || 'Không tải được tệp.');
    return res.status(422).json({ error: msg });
  }
}
