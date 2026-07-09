import { auth } from '../firebase';
import { SKILL_CATALOG, CatalogEntry, CatalogCategory } from '../data/skillCatalog';
import { isAllowedGithubRawUrl } from '../utils/skillCatalog';
import { RepoHit, inferEntryFromPath } from '../utils/repoInference';

export type { RepoHit };

export interface CatalogQuery {
  category?: CatalogCategory;
  collection?: string;
  text?: string;
}

/** Nguồn catalog trừu tượng — đợt 1 dùng static; đợt sau cắm GitHub live cùng interface. */
export interface CatalogSource {
  id: string;
  label: string;
  list(query: CatalogQuery): Promise<CatalogEntry[]>;
  fetchContent(entry: CatalogEntry): Promise<string>;
}

/** Lọc thuần — tách để unit-test. */
export function filterCatalog(entries: CatalogEntry[], query: CatalogQuery): CatalogEntry[] {
  const text = (query.text || '').trim().toLowerCase();
  return entries.filter((e) => {
    if (query.category && e.category !== query.category) return false;
    if (query.collection && e.collection !== query.collection) return false;
    if (text) {
      const hay = `${e.title} ${e.description} ${e.tags.join(' ')}`.toLowerCase();
      if (!hay.includes(text)) return false;
    }
    return true;
  });
}

/** Gọi proxy /api/github (auth Firebase). Trả JSON đã parse; ném lỗi nếu !ok. */
async function callGithubProxy(payload: Record<string, unknown>): Promise<any> {
  const user = auth.currentUser;
  if (!user) throw new Error('Bạn cần đăng nhập để dùng GitHub.');
  const token = await user.getIdToken();
  const res = await fetch('/api/github', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* body không phải JSON */ }
  if (!res.ok) throw new Error(data?.error || `Lỗi GitHub (HTTP ${res.status}).`);
  return data;
}

/** Tải nội dung raw của một entry qua proxy /api/github. */
export async function fetchCatalogContent(entry: CatalogEntry): Promise<string> {
  if (!isAllowedGithubRawUrl(entry.rawUrl)) {
    throw new Error('URL nguồn không thuộc GitHub hợp lệ.');
  }
  const data = await callGithubProxy({ action: 'raw', url: entry.rawUrl });
  if (!data?.text) throw new Error('Không nhận được nội dung từ GitHub.');
  return data.text as string;
}

/** Tìm repo trên GitHub theo từ khoá (cần GITHUB_TOKEN server). */
export async function searchRepos(q: string): Promise<RepoHit[]> {
  const data = await callGithubProxy({ action: 'search', q });
  return Array.isArray(data?.repos) ? (data.repos as RepoHit[]) : [];
}

/** Liệt kê file skill/rule/guide trong một repo (đã suy loại thành CatalogEntry). */
export async function listRepoFiles(repo: RepoHit): Promise<CatalogEntry[]> {
  const data = await callGithubProxy({ action: 'tree', repo: repo.fullName, branch: repo.defaultBranch });
  const paths: string[] = Array.isArray(data?.paths) ? data.paths : [];
  const entries: CatalogEntry[] = [];
  for (const p of paths) {
    const e = inferEntryFromPath(repo, p);
    if (e) entries.push(e);
  }
  return entries;
}

export const staticCatalogSource: CatalogSource = {
  id: 'static',
  label: 'Tuyển chọn (GitHub)',
  async list(query) { return filterCatalog(SKILL_CATALOG, query); },
  fetchContent(entry) { return fetchCatalogContent(entry); },
};
