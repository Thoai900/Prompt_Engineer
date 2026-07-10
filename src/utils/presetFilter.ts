// Lọc danh sách theo nhãn ngành (domain) — hàm thuần, dùng cho sidebar 3 tab.

export const OTHER_DOMAIN = 'Khác';

/** Danh sách domain distinct (theo thứ tự xuất hiện) + "Khác" nếu có item không có domain. */
export function listDomains<T extends { domain?: string }>(items: T[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  let hasOther = false;
  for (const it of items) {
    const d = (it.domain || '').trim();
    if (!d) { hasOther = true; continue; }
    if (!seen.has(d)) { seen.add(d); out.push(d); }
  }
  if (hasOther) out.push(OTHER_DOMAIN);
  return out;
}

/** Lọc theo domain. null/'' → tất cả; 'Khác' → item không có domain. */
export function filterByDomain<T extends { domain?: string }>(items: T[], domain: string | null): T[] {
  if (!domain) return items;
  if (domain === OTHER_DOMAIN) return items.filter((i) => !(i.domain || '').trim());
  return items.filter((i) => (i.domain || '').trim() === domain);
}
