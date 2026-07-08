import { describe, it, expect } from 'vitest';
import {
  COLLECTIONS_LS_KEY,
  TemplateCollection,
  loadCollections,
  saveCollections,
  createCollection,
  renameCollection,
  deleteCollection,
  toggleTemplateInCollection,
  isTemplateInCollection,
  collectionsContaining,
} from '../utils/collections';

function makeStorage(initial?: Record<string, string>) {
  const m = new Map<string, string>(Object.entries(initial || {}));
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
    _dump: () => m,
  };
}

const col = (over: Partial<TemplateCollection>): TemplateCollection => ({
  id: 'c1',
  name: 'A',
  templateIds: [],
  createdAt: '2026-01-01',
  ...over,
});

describe('loadCollections', () => {
  it('rỗng khi chưa có gì / JSON hỏng', () => {
    expect(loadCollections(makeStorage())).toEqual([]);
    expect(loadCollections(makeStorage({ [COLLECTIONS_LS_KEY]: '{bad' }))).toEqual([]);
  });

  it('bỏ phần tử sai shape và lọc templateIds không phải chuỗi', () => {
    const raw = JSON.stringify([
      { id: 'a', name: 'A', templateIds: ['t1', 2, 't2'], createdAt: 'x' },
      { id: 'b', name: 42, templateIds: [], createdAt: 'x' }, // name sai → loại
      { nope: true },
    ]);
    const out = loadCollections(makeStorage({ [COLLECTIONS_LS_KEY]: raw }));
    expect(out.length).toBe(1);
    expect(out[0].templateIds).toEqual(['t1', 't2']);
  });
});

describe('saveCollections + round-trip', () => {
  it('ghi rồi đọc lại khớp', () => {
    const s = makeStorage();
    const list = [col({ id: 'c1', templateIds: ['t1'] })];
    saveCollections(list, s);
    expect(loadCollections(s)).toEqual(list);
  });
});

describe('createCollection', () => {
  it('thêm bộ sưu tập mới với meta cho trước', () => {
    const out = createCollection([], '  Yêu thích  ', { id: 'x1', createdAt: '2026-02-02' });
    expect(out).toEqual([{ id: 'x1', name: 'Yêu thích', templateIds: [], createdAt: '2026-02-02' }]);
  });

  it('tên rỗng → không đổi', () => {
    const list = [col({})];
    expect(createCollection(list, '   ', { id: 'x', createdAt: 'y' })).toBe(list);
  });
});

describe('renameCollection', () => {
  it('đổi tên đúng id, trim; tên rỗng bỏ qua', () => {
    const list = [col({ id: 'c1', name: 'A' }), col({ id: 'c2', name: 'B' })];
    expect(renameCollection(list, 'c1', '  Mới ')[0].name).toBe('Mới');
    expect(renameCollection(list, 'c1', '  ')).toBe(list);
  });
});

describe('deleteCollection', () => {
  it('xoá đúng id', () => {
    const list = [col({ id: 'c1' }), col({ id: 'c2' })];
    expect(deleteCollection(list, 'c1').map((c) => c.id)).toEqual(['c2']);
  });
});

describe('toggleTemplateInCollection', () => {
  it('thêm khi chưa có, bỏ khi đã có', () => {
    let list = [col({ id: 'c1', templateIds: [] })];
    list = toggleTemplateInCollection(list, 'c1', 't1');
    expect(list[0].templateIds).toEqual(['t1']);
    list = toggleTemplateInCollection(list, 'c1', 't1');
    expect(list[0].templateIds).toEqual([]);
  });

  it('không đụng bộ sưu tập khác', () => {
    const list = [col({ id: 'c1', templateIds: [] }), col({ id: 'c2', templateIds: ['t9'] })];
    const out = toggleTemplateInCollection(list, 'c1', 't1');
    expect(out[1].templateIds).toEqual(['t9']);
  });
});

describe('isTemplateInCollection & collectionsContaining', () => {
  const list = [
    col({ id: 'c1', name: 'A', templateIds: ['t1', 't2'] }),
    col({ id: 'c2', name: 'B', templateIds: ['t2'] }),
  ];

  it('isTemplateInCollection', () => {
    expect(isTemplateInCollection(list, 'c1', 't1')).toBe(true);
    expect(isTemplateInCollection(list, 'c2', 't1')).toBe(false);
  });

  it('collectionsContaining trả mọi bộ sưu tập chứa template', () => {
    expect(collectionsContaining(list, 't2').map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(collectionsContaining(list, 't1').map((c) => c.id)).toEqual(['c1']);
    expect(collectionsContaining(list, 'zzz')).toEqual([]);
  });
});
