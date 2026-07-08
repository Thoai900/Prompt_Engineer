import { describe, it, expect } from 'vitest';
import {
  seededCount,
  buildShareUrl,
  parseSharedTemplateId,
  prepareRemixTemplate,
  detectFrameworkName,
  matchesQuery,
  filterAndSortTemplates,
  collectFacets,
  isOwnTemplate,
  isCommunityTemplate,
} from '../utils/libraryUtils';
import { PromptTemplate } from '../types';

function tpl(over: Partial<PromptTemplate>): PromptTemplate {
  return { id: 'x', title: '', description: '', blocks: [], ...over };
}

describe('seededCount', () => {
  it('ổn định cho cùng seed (không random)', () => {
    expect(seededCount('abc', 1000)).toBe(seededCount('abc', 1000));
  });

  it('luôn nằm trong [0, max)', () => {
    for (const seed of ['', 'x', 'template-123', 'sys-qa-tiktok-script']) {
      const v = seededCount(seed, 500);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(500);
    }
  });

  it('seed khác nhau thường cho giá trị khác nhau', () => {
    expect(seededCount('alpha', 100000)).not.toBe(seededCount('beta', 100000));
  });

  it('max <= 0 trả về 0 (không chia cho 0)', () => {
    expect(seededCount('abc', 0)).toBe(0);
  });
});

describe('buildShareUrl', () => {
  it('ghép query param + hash tab library', () => {
    expect(buildShareUrl('https://app.test', '/', 'tpl-1')).toBe('https://app.test/?t=tpl-1#library');
  });

  it('encode id có ký tự đặc biệt', () => {
    expect(buildShareUrl('https://app.test', '/app', 'a b/c')).toBe('https://app.test/app?t=a%20b%2Fc#library');
  });
});

describe('parseSharedTemplateId', () => {
  it('đọc id từ ?t=', () => {
    expect(parseSharedTemplateId('?t=tpl-9')).toBe('tpl-9');
  });

  it('null khi không có tham số t', () => {
    expect(parseSharedTemplateId('')).toBeNull();
    expect(parseSharedTemplateId('?x=1')).toBeNull();
  });

  it('giải mã giá trị đã encode (đối xứng với buildShareUrl)', () => {
    const url = buildShareUrl('https://app.test', '/', 'a b/c');
    const search = url.slice(url.indexOf('?'), url.indexOf('#'));
    expect(parseSharedTemplateId(search)).toBe('a b/c');
  });
});

describe('prepareRemixTemplate', () => {
  const other: PromptTemplate = {
    id: 'tpl-goc', title: 'Gốc', description: '', blocks: [],
    authorId: 'chu-khac', isPublic: true, status: 'Published',
    metrics: { usageCount: 99, upvotes: 5 },
    versions: [{ id: 'v1', at: '2026-01-01', blocks: [] }],
  };

  it('template của người khác → fork: id mới, forkedFrom, nháp riêng, reset metrics/versions', () => {
    const fork = prepareRemixTemplate(other, 'toi');
    expect(fork.id).not.toBe('tpl-goc');
    expect(fork.forkedFrom).toBe('tpl-goc');
    expect(fork.isPublic).toBe(false);
    expect(fork.status).toBe('Draft');
    expect(fork.metrics?.usageCount).toBe(0);
    expect(fork.versions).toEqual([]);
  });

  it('chưa đăng nhập cũng fork (không bao giờ đè bản gốc)', () => {
    expect(prepareRemixTemplate(other, undefined).forkedFrom).toBe('tpl-goc');
  });

  it('template CỦA MÌNH giữ nguyên (lưu = cập nhật bản gốc)', () => {
    const mine = { ...other, authorId: 'toi' };
    const result = prepareRemixTemplate(mine, 'toi');
    expect(result.id).toBe('tpl-goc');
    expect(result.forkedFrom).toBeUndefined();
  });
});

describe('detectFrameworkName', () => {
  it('nhận diện C.H.A.I.N qua id formula-chain và qua tiêu đề', () => {
    expect(detectFrameworkName(tpl({ id: 'formula-chain', title: 'Bất kỳ' }))).toBe('C.H.A.I.N');
    expect(detectFrameworkName(tpl({ title: 'Công thức CHAIN' }))).toBe('C.H.A.I.N');
  });

  it('nhận diện R-T-F qua tiêu đề và qua 3 khối role+task+format', () => {
    expect(detectFrameworkName(tpl({ title: 'Mẫu RTF' }))).toBe('R-T-F');
    const rtfBlocks = tpl({
      title: 'Không gợi ý gì',
      blocks: [
        { id: '1', type: 'role', title: '', content: '' },
        { id: '2', type: 'task', title: '', content: '' },
        { id: '3', type: 'format', title: '', content: '' },
      ],
    });
    expect(detectFrameworkName(rtfBlocks)).toBe('R-T-F');
  });

  it('R.O.L.E / T.A.S.K / C.R.E.A.T.E theo tiêu đề', () => {
    expect(detectFrameworkName(tpl({ title: 'Khung R.O.L.E' }))).toBe('R.O.L.E');
    expect(detectFrameworkName(tpl({ title: 'khung task chuẩn' }))).toBe('T.A.S.K');
    expect(detectFrameworkName(tpl({ title: 'Hãy create nội dung' }))).toBe('C.R.E.A.T.E');
  });

  it('trả null khi không khớp framework nào', () => {
    expect(detectFrameworkName(tpl({ id: 'abc', title: 'Viết email marketing' }))).toBeNull();
  });

  it('ưu tiên C.H.A.I.N khi tiêu đề chứa cả "chain" lẫn "role"', () => {
    expect(detectFrameworkName(tpl({ title: 'chain of role' }))).toBe('C.H.A.I.N');
  });
});

describe('matchesQuery', () => {
  const t = tpl({ title: 'Gia sư Toán', description: 'Giải bước', authorName: 'Alex', tags: ['Math', 'Education'] });

  it('từ khoá rỗng → luôn khớp', () => {
    expect(matchesQuery(t, '')).toBe(true);
    expect(matchesQuery(t, '   ')).toBe(true);
  });

  it('khớp title/description/tác giả/thẻ, không phân biệt hoa thường', () => {
    expect(matchesQuery(t, 'toán')).toBe(true);
    expect(matchesQuery(t, 'bước')).toBe(true);
    expect(matchesQuery(t, 'alex')).toBe(true);
    expect(matchesQuery(t, 'education')).toBe(true);
  });

  it('không khớp khi không có từ nào chứa', () => {
    expect(matchesQuery(t, 'javascript')).toBe(false);
  });
});

describe('filterAndSortTemplates', () => {
  const list: PromptTemplate[] = [
    tpl({ id: 'a', title: 'Code JS', category: 'Người đi làm', tags: ['JavaScript'], outputExample: { type: 'code' }, metrics: { usageCount: 5, upvotes: 0, likes: 2 }, createdAt: '2026-01-03' }),
    tpl({ id: 'b', title: 'Kịch bản CHAIN', category: 'Sáng tạo nội dung', tags: ['Content'], outputExample: { type: 'video' }, metrics: { usageCount: 1, upvotes: 0, likes: 0 }, createdAt: '2026-02-10' }),
    tpl({ id: 'c', title: 'Ghi chú', category: 'Người đi làm', tags: ['JavaScript', 'Notes'], createdAt: undefined }),
  ];

  it('lọc theo category', () => {
    const r = filterAndSortTemplates(list, { category: 'Sáng tạo nội dung' }, 'trending');
    expect(r.map((x) => x.id)).toEqual(['b']);
  });

  it('lọc theo loại kết quả (outputTypes)', () => {
    const r = filterAndSortTemplates(list, { outputTypes: ['code'] }, 'trending');
    expect(r.map((x) => x.id)).toEqual(['a']);
  });

  it('lọc theo framework', () => {
    const r = filterAndSortTemplates(list, { frameworks: ['C.H.A.I.N'] }, 'trending');
    expect(r.map((x) => x.id)).toEqual(['b']);
  });

  it('lọc theo thẻ (OR — có ít nhất một)', () => {
    const r = filterAndSortTemplates(list, { tags: ['JavaScript'] }, 'trending');
    expect(r.map((x) => x.id).sort()).toEqual(['a', 'c']);
  });

  it('onlySaved chỉ giữ id đã lưu', () => {
    const r = filterAndSortTemplates(list, { onlySaved: true, savedIds: new Set(['c']) }, 'trending');
    expect(r.map((x) => x.id)).toEqual(['c']);
  });

  it('sort trending theo usageCount + likes giảm dần', () => {
    const r = filterAndSortTemplates(list, {}, 'trending');
    expect(r[0].id).toBe('a'); // 5+2=7 cao nhất
  });

  it('sort new theo createdAt, thiếu ngày xuống cuối', () => {
    const r = filterAndSortTemplates(list, {}, 'new');
    expect(r.map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });

  it('nhiều facet kết hợp theo AND giữa các nhóm', () => {
    const r = filterAndSortTemplates(list, { category: 'Người đi làm', tags: ['Notes'] }, 'trending');
    expect(r.map((x) => x.id)).toEqual(['c']);
  });
});

describe('collectFacets', () => {
  const list: PromptTemplate[] = [
    tpl({ id: 'a', title: 'Code', outputExample: { type: 'code' }, tags: ['x', 'y'] }),
    tpl({ id: 'b', title: 'Code 2', outputExample: { type: 'code' }, tags: ['x'] }),
    tpl({ id: 'c', title: 'CHAIN mẫu', outputExample: { type: 'video' }, tags: ['z'] }),
  ];

  it('đếm loại kết quả và sắp theo count giảm dần', () => {
    const f = collectFacets(list);
    expect(f.outputTypes[0]).toMatchObject({ value: 'code', count: 2 });
    expect(f.outputTypes.find((o) => o.value === 'video')?.count).toBe(1);
  });

  it('đếm framework nhận diện được', () => {
    const f = collectFacets(list);
    expect(f.frameworks.find((o) => o.value === 'C.H.A.I.N')?.count).toBe(1);
  });

  it('đếm thẻ và cắt theo maxTags', () => {
    const f = collectFacets(list, { maxTags: 2 });
    expect(f.tags.length).toBe(2);
    expect(f.tags[0]).toMatchObject({ value: 'x', count: 2 });
  });
});

describe('isOwnTemplate & isCommunityTemplate', () => {
  it('userId khớp uid → của mình', () => {
    expect(isOwnTemplate(tpl({ userId: 'u1' }), 'u1')).toBe(true);
    expect(isOwnTemplate(tpl({ userId: 'u1' }), 'u2')).toBe(false);
  });

  it('không có userId thì xét authorId', () => {
    expect(isOwnTemplate(tpl({ authorId: 'u1' }), 'u1')).toBe(true);
    expect(isOwnTemplate(tpl({ authorId: 'u1' }), 'u2')).toBe(false);
  });

  it('không có thông tin chủ sở hữu → coi là của mình (bản dựng cục bộ)', () => {
    expect(isOwnTemplate(tpl({}), 'u1')).toBe(true);
    expect(isOwnTemplate(tpl({}), undefined)).toBe(true);
  });

  it('cộng đồng = public + không phải của mình', () => {
    expect(isCommunityTemplate(tpl({ userId: 'other', isPublic: true }), 'me')).toBe(true);
    expect(isCommunityTemplate(tpl({ userId: 'me', isPublic: true }), 'me')).toBe(false); // của mình
    expect(isCommunityTemplate(tpl({ userId: 'other', isPublic: false }), 'me')).toBe(false); // không public
  });

  it('khách chưa đăng nhập: mọi template public có chủ đều là cộng đồng', () => {
    expect(isCommunityTemplate(tpl({ userId: 'someone', isPublic: true }), undefined)).toBe(true);
  });
});
