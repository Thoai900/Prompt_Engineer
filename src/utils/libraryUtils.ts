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

// ── Fork/Remix (Phase 4) ─────────────────────────────────────────────────────
import type { PromptTemplate } from '../types';

/**
 * Chuẩn bị template để MỞ TRONG BUILDER khi remix:
 * - Template CỦA MÌNH → giữ nguyên (lưu là cập nhật bản gốc).
 * - Template của người khác / built-in → BẢN FORK: id mới + `forkedFrom` trỏ về gốc,
 *   isPublic false (nháp riêng), reset metrics/versions — lưu sẽ tạo doc MỚI,
 *   không bao giờ đè lên template gốc.
 */
export function prepareRemixTemplate(template: PromptTemplate, currentUserId?: string | null): PromptTemplate {
  const isOwn = !!currentUserId && (template as any).userId === currentUserId
    || (!!currentUserId && template.authorId === currentUserId);
  if (isOwn) return template;
  return {
    ...template,
    id: `fork_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    forkedFrom: template.id,
    isPublic: false,
    status: 'Draft',
    authorId: undefined,
    authorName: undefined,
    metrics: { usageCount: 0, upvotes: 0, likes: 0, saves: 0 },
    versions: [],
    createdAt: undefined,
  };
}
