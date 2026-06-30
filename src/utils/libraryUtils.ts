// Helper thuần cho Library/Marketplace (tách ra để unit-test được).

/**
 * Số liệu demo ổn định (seed theo chuỗi) — KHÔNG random mỗi lần render, nên không
 * nhảy số khi người dùng gõ tìm kiếm. Trả về số nguyên trong [0, max).
 */
export function seededCount(seed: string, max: number): number {
  if (max <= 0) return 0;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % max;
}

/** Dựng URL chia sẻ deep-link tới 1 template: `<origin><pathname>?t=<id>#library`. */
export function buildShareUrl(origin: string, pathname: string, templateId: string): string {
  return `${origin}${pathname}?t=${encodeURIComponent(templateId)}#library`;
}

/** Đọc id template được chia sẻ từ query-string (`?t=<id>`); null nếu không có. */
export function parseSharedTemplateId(search: string): string | null {
  return new URLSearchParams(search).get('t');
}
