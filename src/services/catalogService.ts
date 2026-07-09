import { auth } from '../firebase';
import { SKILL_CATALOG, CatalogEntry, CatalogCategory } from '../data/skillCatalog';
import { isAllowedGithubRawUrl } from '../utils/skillCatalog';

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

/** Tải nội dung raw của một entry qua proxy /api/github (mirror webFetchService). */
export async function fetchCatalogContent(entry: CatalogEntry): Promise<string> {
  if (!isAllowedGithubRawUrl(entry.rawUrl)) {
    throw new Error('URL nguồn không thuộc GitHub hợp lệ.');
  }
  const user = auth.currentUser;
  if (!user) throw new Error('Bạn cần đăng nhập để tải nội dung từ GitHub.');
  const token = await user.getIdToken();

  const res = await fetch('/api/github', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'raw', url: entry.rawUrl }),
  });

  let data: any = null;
  try { data = await res.json(); } catch { /* body không phải JSON */ }
  if (!res.ok) throw new Error(data?.error || `Lỗi tải nội dung (HTTP ${res.status}).`);
  if (!data?.text) throw new Error('Không nhận được nội dung từ GitHub.');
  return data.text as string;
}

export const staticCatalogSource: CatalogSource = {
  id: 'static',
  label: 'Tuyển chọn (GitHub)',
  async list(query) { return filterCatalog(SKILL_CATALOG, query); },
  fetchContent(entry) { return fetchCatalogContent(entry); },
};
