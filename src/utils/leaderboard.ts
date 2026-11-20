import { HealthSuite, PromptTemplate, TemplateQuality } from '../types';
import { blocksToText } from './templateVersionUtils';
import { hashPrompt, headRevision } from './promptRevisions';

// Bảng xếp hạng template công khai (Thư viện · "Xếp hạng"). Hàm THUẦN để unit-test.
// Điểm chất lượng do TÁC GIẢ công bố từ Prompt Health (tự báo cáo) — UI ghi rõ nguồn, model, số test,
// và đánh dấu "bản cũ" khi nội dung template đã đổi sau lúc chạy.

export function templateContentHash(t: Pick<PromptTemplate, 'blocks'>): string {
  return hashPrompt(blocksToText(t.blocks));
}

export type QualityStatus = 'none' | 'current' | 'outdated';

export function qualityStatus(t: Pick<PromptTemplate, 'blocks' | 'quality'>): QualityStatus {
  if (!t.quality) return 'none';
  return t.quality.contentHash === templateContentHash(t) ? 'current' : 'outdated';
}

/**
 * Điểm công bố được từ một Health suite gắn template: lần chạy gần nhất của phiên bản hiện hành,
 * cùng model của suite, và phiên bản đó TRÙNG nội dung template hiện tại. Không thoả → null kèm lý do.
 */
export function qualityFromSuite(
  suite: HealthSuite,
  template: Pick<PromptTemplate, 'blocks'>,
): { quality: TemplateQuality | null; reason?: string } {
  const head = headRevision(suite);
  if (!head) return { quality: null, reason: 'Suite chưa có phiên bản nào.' };
  const contentHash = templateContentHash(template);
  if (head.hash !== contentHash) return { quality: null, reason: 'Phiên bản hiện hành khác nội dung template — đồng bộ từ nguồn hoặc lưu về template trước.' };
  const run = (suite.runs || []).find((r) => r.revisionId === head.id && r.model === suite.model);
  if (!run) return { quality: null, reason: 'Chưa chạy kiểm tra phiên bản hiện hành với model của suite.' };
  if (!run.results.length) return { quality: null, reason: 'Lần chạy không có test nào.' };
  return { quality: { score: run.avgScore, model: run.model, tests: run.results.length, at: run.at, contentHash } };
}

export type LeaderboardSort = 'top' | 'likes' | 'usage' | 'quality';

/**
 * Điểm "Nổi bật": độ phổ biến (log để vài template rất nhiều lượt không áp đảo) + điểm chất lượng
 * còn hiệu lực (tối đa +5). Điểm của bản cũ không được cộng.
 */
export function featuredScore(t: PromptTemplate): number {
  const likes = Math.max(0, t.metrics?.likes ?? 0);
  const usage = Math.max(0, t.metrics?.usageCount ?? 0);
  const quality = qualityStatus(t) === 'current' ? (t.quality as TemplateQuality).score / 20 : 0;
  return Math.round((3 * Math.log2(1 + likes) + 2 * Math.log2(1 + usage) + quality) * 100) / 100;
}

/** Template công khai do người dùng đăng (không gồm mẫu có sẵn của app). */
export function publicCommunityTemplates(all: PromptTemplate[]): PromptTemplate[] {
  return all.filter((t) => t.isPublic === true && !!t.userId);
}

/** Lọc theo danh mục ('Tất cả' / rỗng = không lọc) rồi xếp; hoà thì mới cập nhật hơn đứng trước. */
export function rankTemplates(list: PromptTemplate[], sort: LeaderboardSort, category?: string): PromptTemplate[] {
  const filtered = !category || category === 'Tất cả' ? list : list.filter((t) => t.category === category);
  const key = (t: PromptTemplate): number => {
    if (sort === 'likes') return t.metrics?.likes ?? 0;
    if (sort === 'usage') return t.metrics?.usageCount ?? 0;
    if (sort === 'quality') return qualityStatus(t) === 'current' ? (t.quality as TemplateQuality).score : -1;
    return featuredScore(t);
  };
  return [...filtered].sort((a, b) => key(b) - key(a) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}
