import { describe, expect, it } from 'vitest';
import { pickMissingFromCloud, ruleFromDoc, ruleToDoc, skillFromDoc, skillToDoc, upsertById } from '../utils/libraryDoc';

describe('libraryDoc', () => {
  it('ruleFromDoc đổi Timestamp sang ISO và chuẩn hoá type', () => {
    const r = ruleFromDoc('r1', { title: 'T', type: 'lạ', updatedAt: { toDate: () => new Date('2026-01-01T00:00:00.000Z') } });
    expect(r).toMatchObject({ id: 'r1', type: 'system-rules', tags: [], content: '', updatedAt: '2026-01-01T00:00:00.000Z' });
  });

  it('ruleToDoc / skillToDoc không chứa id/updatedAt/isPreset và source mặc định null', () => {
    const d = ruleToDoc({ id: 'x', title: 'T', description: '', content: 'c', type: 'markdown-guide', tags: ['a'], updatedAt: 'iso' });
    expect(d).toEqual({ title: 'T', description: '', content: 'c', type: 'markdown-guide', tags: ['a'], source: null });
    const s = skillToDoc({ id: 'y', title: 'S', description: '', inputs: [], steps: [], instructions: 'i', updatedAt: 'iso' });
    expect(s).toMatchObject({ kind: 'structured', source: null });
    expect(s).not.toHaveProperty('id');
  });

  it('skillFromDoc giữ kind document', () => {
    expect(skillFromDoc('s', { title: 'S', kind: 'document' }).kind).toBe('document');
  });

  it('pickMissingFromCloud bỏ mục đã có trên cloud và preset', () => {
    const local = [{ id: 'a' }, { id: 'b' }, { id: 'c', isPreset: true }];
    expect(pickMissingFromCloud(local, new Set(['b']))).toEqual([{ id: 'a' }]);
  });

  it('upsertById thay đúng vị trí hoặc thêm cuối', () => {
    expect(upsertById([{ id: 'a', v: 1 }, { id: 'b', v: 1 }], { id: 'a', v: 2 })).toEqual([{ id: 'a', v: 2 }, { id: 'b', v: 1 }]);
    expect(upsertById([{ id: 'a' }], { id: 'z' })).toEqual([{ id: 'a' }, { id: 'z' }]);
  });
});
