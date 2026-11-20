import { describe, it, expect } from 'vitest';
import {
  templateContentHash, qualityStatus, qualityFromSuite, featuredScore, publicCommunityTemplates, rankTemplates,
} from '../utils/leaderboard';
import { commitRevision } from '../utils/promptRevisions';
import { blocksToText } from '../utils/templateVersionUtils';
import { HealthSuite, PromptTemplate } from '../types';

const tpl = (id: string, over: Partial<PromptTemplate> = {}): PromptTemplate => ({
  id, title: id, description: '', blocks: [{ id: 'b', type: 'task', title: 'Nhiệm vụ', content: `nội dung ${id}` }],
  isPublic: true, userId: 'u', ...over,
} as PromptTemplate);

const quality = (t: PromptTemplate, score: number) => ({ score, model: 'm', tests: 3, at: '2026-11-20T00:00:00Z', contentHash: templateContentHash(t) });

describe('qualityStatus', () => {
  it('none / current / outdated khi nội dung đổi sau lúc công bố', () => {
    const t = tpl('a');
    expect(qualityStatus(t)).toBe('none');
    const withQ = { ...t, quality: quality(t, 80) };
    expect(qualityStatus(withQ)).toBe('current');
    expect(qualityStatus({ ...withQ, blocks: [{ ...t.blocks[0], content: 'đã sửa' }] })).toBe('outdated');
  });
});

describe('qualityFromSuite', () => {
  const t = tpl('a');
  const base: HealthSuite = { id: 's', name: 's', prompt: '', model: 'm', testCases: [], runs: [] };

  it('lấy lần chạy gần nhất của phiên bản hiện hành, cùng model, trùng nội dung template', () => {
    const s = commitRevision(base, blocksToText(t.blocks), 'source-sync');
    const runs = [
      { at: '2026-11-20T02:00:00Z', model: 'khac', avgScore: 99, revisionId: s.headRevisionId, results: [{ testId: 'x', score: 99 }] },
      { at: '2026-11-20T01:00:00Z', model: 'm', avgScore: 82, revisionId: s.headRevisionId, results: [{ testId: 'x', score: 80 }, { testId: 'y', score: 84 }] },
    ];
    const r = qualityFromSuite({ ...s, runs }, t);
    expect(r.quality).toEqual({ score: 82, model: 'm', tests: 2, at: '2026-11-20T01:00:00Z', contentHash: templateContentHash(t) });
  });

  it('từ chối kèm lý do: chưa có phiên bản / nội dung khác template / chưa chạy', () => {
    expect(qualityFromSuite(base, t)).toMatchObject({ quality: null, reason: expect.stringMatching(/chưa có phiên bản/i) });
    const other = commitRevision(base, 'nội dung khác', 'manual');
    expect(qualityFromSuite(other, t)).toMatchObject({ quality: null, reason: expect.stringMatching(/khác nội dung/) });
    const same = commitRevision(base, blocksToText(t.blocks), 'source-sync');
    expect(qualityFromSuite(same, t)).toMatchObject({ quality: null, reason: expect.stringMatching(/Chưa chạy/) });
  });
});

describe('xếp hạng', () => {
  it('chỉ template công khai của người dùng', () => {
    const list = [tpl('a'), tpl('b', { isPublic: false }), tpl('c', { userId: undefined })];
    expect(publicCommunityTemplates(list).map((t) => t.id)).toEqual(['a']);
  });

  it('featuredScore: log độ phổ biến + điểm chất lượng còn hiệu lực', () => {
    const t = tpl('a', { metrics: { likes: 3, usageCount: 7, upvotes: 0 } });
    expect(featuredScore(t)).toBe(12); // 3*log2(4) + 2*log2(8)
    expect(featuredScore({ ...t, quality: quality(t, 100) })).toBe(17);
    const outdated = { ...t, quality: { ...quality(t, 100), contentHash: 'khac' } };
    expect(featuredScore(outdated)).toBe(12);
  });

  it('sắp theo tiêu chí, lọc danh mục, điểm cũ / không có xếp cuối khi sort chất lượng', () => {
    const a = tpl('a', { category: 'Viết', metrics: { likes: 10, usageCount: 1, upvotes: 0 } });
    const b = tpl('b', { category: 'Code', metrics: { likes: 1, usageCount: 50, upvotes: 0 } });
    const c = tpl('c', { category: 'Viết', metrics: { likes: 0, usageCount: 0, upvotes: 0 } });
    const cq = { ...c, quality: quality(c, 70) };
    expect(rankTemplates([a, b, cq], 'likes').map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(rankTemplates([a, b, cq], 'usage').map((t) => t.id)).toEqual(['b', 'a', 'c']);
    expect(rankTemplates([a, b, cq], 'quality').map((t) => t.id)[0]).toBe('c');
    expect(rankTemplates([a, b, cq], 'top', 'Viết').map((t) => t.id)).toEqual(['a', 'c']);
    expect(rankTemplates([a, b], 'top', 'Tất cả')).toHaveLength(2);
  });
});
