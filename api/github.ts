import { createRemoteJWKSet, jwtVerify } from 'jose';

// ─────────────────────────────────────────────────────────────────────────────
// Vercel Serverless Function: proxy tải nội dung RAW từ GitHub cho "Thư viện
// năng lực AI" (client bị CORS + rate-limit khi gọi thẳng GitHub).
// Tự chứa (không import helper cục bộ). Auth Firebase ID token như api/ai.ts.
// Allow-list host GitHub + chống SSRF + cap dung lượng.
// action: 'raw' (tải file) · 'search' (tìm repo) · 'tree' (liệt kê file repo).
// 'search'/'tree' cần env GITHUB_TOKEN (nâng rate-limit); thiếu token → báo 400.
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT_ID = 'eduai-nexus';
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

const FETCH_TIMEOUT_MS = 10_000;
const MAX_TEXT_CHARS = 50_000;       // SKILL.md/guide dài hơn 15k của fetch-url; text thuần nên an toàn
const MAX_DOWNLOAD_BYTES = 3_000_000;
const ALLOWED_HOSTS = new Set(['raw.githubusercontent.com', 'github.com', 'api.github.com']);
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const MAX_SEARCH_REPOS = 30;
const MAX_TREE_FILES = 400;

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
  if (action === 'raw') return handleRaw(req, res);
  if (action === 'search') return handleSearch(req, res);
  if (action === 'tree') return handleTree(req, res);
  return res.status(400).json({ error: `action "${action}" không hỗ trợ.` });
}

// ── action 'raw': tải nội dung một file GitHub ───────────────────────────────
async function handleRaw(req: any, res: any) {
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

    // Chống bypass allow-list qua redirect: host phản hồi CUỐI phải vẫn thuộc GitHub.
    let finalHost = '';
    try { finalHost = new URL(response.url).hostname.toLowerCase(); } catch { /* bỏ qua */ }
    if (finalHost && !ALLOWED_HOSTS.has(finalHost)) {
      clearTimeout(timer);
      return res.status(422).json({ error: 'Redirect dẫn ra ngoài GitHub — từ chối.' });
    }

    if (!response.ok) {
      clearTimeout(timer);
      return res.status(422).json({ error: `GitHub trả về HTTP ${response.status}.` });
    }

    // Giữ timer sống tới hết khi đọc body → deadline 10s phủ cả giai đoạn tải.
    const buffer = await response.arrayBuffer();
    clearTimeout(timer);
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

// ── Gọi GitHub REST API (JSON) với token + timeout + tái kiểm host ────────────
async function githubApiGet(apiUrl: string): Promise<any> {
  const url = validateGithubUrl(apiUrl); // đảm bảo host api.github.com + https
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (compatible; PromptBuilderBot/1.0; +ai-power-library)',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
    const response = await fetch(url.toString(), { signal: controller.signal, redirect: 'follow', headers });

    let finalHost = '';
    try { finalHost = new URL(response.url).hostname.toLowerCase(); } catch { /* bỏ qua */ }
    if (finalHost && !ALLOWED_HOSTS.has(finalHost)) throw new Error('Redirect ra ngoài GitHub — từ chối.');

    if (!response.ok) {
      throw new Error(
        response.status === 403 || response.status === 429
          ? 'GitHub rate-limit (403/429) — thử lại sau ít phút.'
          : `GitHub API trả về HTTP ${response.status}.`
      );
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_DOWNLOAD_BYTES) throw new Error('Phản hồi API quá lớn.');
    return JSON.parse(new TextDecoder('utf-8').decode(buffer));
  } finally {
    clearTimeout(timer);
  }
}

// ── action 'search': tìm repo theo từ khoá, xếp theo sao ─────────────────────
async function handleSearch(req: any, res: any) {
  if (!GITHUB_TOKEN) return res.status(400).json({ error: 'Tìm GitHub cần cấu hình GITHUB_TOKEN trên server.' });
  const q = typeof req.body?.q === 'string' ? req.body.q.trim() : '';
  if (!q) return res.status(400).json({ error: 'Thiếu từ khoá tìm.' });
  if (q.length > 256) return res.status(400).json({ error: 'Từ khoá quá dài.' });

  const apiUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${MAX_SEARCH_REPOS}`;
  try {
    const data = await githubApiGet(apiUrl);
    const repos = Array.isArray(data?.items)
      ? data.items.slice(0, MAX_SEARCH_REPOS).map((it: any) => ({
          fullName: it.full_name,
          description: it.description || '',
          stars: it.stargazers_count || 0,
          htmlUrl: it.html_url,
          defaultBranch: it.default_branch || 'main',
          license: it.license?.spdx_id || undefined,
        }))
      : [];
    return res.status(200).json({ repos });
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? 'Hết thời gian chờ (10s).' : (err?.message || 'Tìm GitHub thất bại.');
    return res.status(422).json({ error: msg });
  }
}

// ── action 'tree': liệt kê đường dẫn file (blob) trong một repo/branch ────────
async function handleTree(req: any, res: any) {
  if (!GITHUB_TOKEN) return res.status(400).json({ error: 'Duyệt repo cần cấu hình GITHUB_TOKEN trên server.' });
  const fullName = typeof req.body?.repo === 'string' ? req.body.repo.trim() : '';
  const branch = typeof req.body?.branch === 'string' ? req.body.branch.trim() : '';
  if (!/^[\w.-]+\/[\w.-]+$/.test(fullName)) return res.status(400).json({ error: 'repo không hợp lệ (định dạng owner/name).' });
  if (!branch || !/^[\w./-]+$/.test(branch)) return res.status(400).json({ error: 'branch không hợp lệ.' });

  const apiUrl = `https://api.github.com/repos/${fullName}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  try {
    const data = await githubApiGet(apiUrl);
    const paths = Array.isArray(data?.tree)
      ? data.tree
          .filter((t: any) => t?.type === 'blob' && typeof t.path === 'string')
          .map((t: any) => t.path as string)
          .slice(0, MAX_TREE_FILES)
      : [];
    return res.status(200).json({ paths, truncated: !!data?.truncated });
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? 'Hết thời gian chờ (10s).' : (err?.message || 'Duyệt repo thất bại.');
    return res.status(422).json({ error: msg });
  }
}
