import { createRemoteJWKSet, jwtVerify } from 'jose';

// ─────────────────────────────────────────────────────────────────────────────
// Vercel Serverless Function: cào nội dung TEXT từ một URL công khai cho
// Web Node của Prompt Graph (client bị CORS nên không tự fetch được).
// Tự chứa (không import helper cục bộ — Vercel không bundle). Auth bằng
// Firebase ID token như api/ai.ts. Có chống SSRF + giới hạn dung lượng.
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT_ID = 'eduai-nexus';
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

const FETCH_TIMEOUT_MS = 10_000;
const MAX_TEXT_CHARS = 15_000;     // Firestore giới hạn 1MB/doc — cap chắc tay
const MAX_DOWNLOAD_BYTES = 2_000_000;

// Rate-limit theo uid (best-effort trong bộ nhớ instance, như api/ai.ts).
const RL_PER_MIN = Math.max(1, Number(process.env.FETCH_URL_RATE_LIMIT_PER_MIN) || 10);
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

// ── Chống SSRF: chỉ http/https tới host công khai ────────────────────────────
function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  // IPv6 literal
  if (h.includes(':')) return true;
  // IPv4 literal — chặn dải private/loopback/link-local/metadata
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 0 || a === 10 || a === 127 || a === 169) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false; // IP công khai dạng literal: cho phép
  }
  return false;
}

function validateUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('URL không hợp lệ.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Chỉ hỗ trợ http/https.');
  }
  if (isPrivateHostname(url.hostname)) {
    throw new Error('Không được phép truy cập địa chỉ nội bộ.');
  }
  return url;
}

// ── HTML → text (đơn giản, không dependency) ─────────────────────────────────
function htmlToText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1].trim()).slice(0, 200) : '';

  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<(?:head|nav|footer|iframe|svg)[\s\S]*?<\/(?:head|nav|footer|iframe|svg)>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // Giữ cấu trúc đọc được: block tag → xuống dòng
    .replace(/<\/(?:p|div|h[1-6]|li|tr|section|article|blockquote|pre)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  s = decodeEntities(s)
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { title, text: s };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return n > 0 && n < 1_114_112 ? String.fromCodePoint(n) : '';
    });
}

export default async function handler(req: any, res: any) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const uid = await verifyFirebaseToken(req.headers?.authorization);
  if (!uid) return res.status(401).json({ error: 'Cần đăng nhập (Firebase ID token không hợp lệ).' });
  if (!checkRateLimit(uid)) return res.status(429).json({ error: 'Cào dữ liệu quá nhanh — thử lại sau một phút.' });

  const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  if (!rawUrl) return res.status(400).json({ error: 'Thiếu url.' });

  let url: URL;
  try {
    url = validateUrl(rawUrl);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PromptBuilderBot/1.0; +prompt-graph-web-node)',
        Accept: 'text/html,text/plain,application/json;q=0.9,*/*;q=0.5',
      },
    });
    clearTimeout(timer);

    if (!response.ok) {
      return res.status(422).json({ error: `Trang trả về HTTP ${response.status}.` });
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!/text\/|application\/(json|xml|xhtml)/.test(contentType)) {
      return res.status(422).json({ error: `Không hỗ trợ loại nội dung "${contentType || 'không rõ'}" — chỉ cào được trang text/HTML/JSON.` });
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_DOWNLOAD_BYTES) {
      return res.status(422).json({ error: 'Trang quá lớn (>2MB).' });
    }
    const rawBody = new TextDecoder('utf-8').decode(buffer);

    let title = '';
    let text = rawBody;
    if (contentType.includes('html')) {
      const parsed = htmlToText(rawBody);
      title = parsed.title;
      text = parsed.text;
    }
    text = text.trim().slice(0, MAX_TEXT_CHARS);
    if (!text) return res.status(422).json({ error: 'Không trích xuất được nội dung text từ trang này.' });

    return res.status(200).json({ title, text, truncated: rawBody.length > MAX_TEXT_CHARS });
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? 'Hết thời gian chờ (10s).' : (err?.message || 'Không cào được trang.');
    return res.status(422).json({ error: msg });
  }
}
