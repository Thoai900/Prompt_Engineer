// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Firebase: điều khiển trạng thái đăng nhập, dữ liệu cloud và lỗi ghi.
const h = vi.hoisted(() => ({
  authCb: null as null | ((u: any) => void),
  snapCb: null as null | ((snap: any) => void),
  cloudIds: [] as string[],
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
}));

vi.mock('../firebase', () => ({ auth: { currentUser: { displayName: 'Tester' } }, db: {} }));
vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_a: any, cb: any) => { h.authCb = cb; return () => {}; } }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: any, name: string) => name,
  doc: (_db: any, coll: string, id: string) => `${coll}/${id}`,
  where: () => null,
  query: (c: any) => c,
  serverTimestamp: () => 'TS',
  getDocsFromServer: async () => ({ docs: h.cloudIds.map((id) => ({ id })) }),
  onSnapshot: (_q: any, cb: any) => { h.snapCb = cb; return () => {}; },
  setDoc: (...a: any[]) => h.setDoc(...a),
  deleteDoc: (...a: any[]) => h.deleteDoc(...a),
}));

const rule = (id: string, title = id) => ({ id, title, description: '', content: 'c', type: 'system-rules' as const, tags: [], updatedAt: '' });
const flush = () => new Promise((r) => setTimeout(r, 0));

async function freshStore() {
  vi.resetModules();
  const mod = await import('../services/collectionStore');
  mod.rulesStore.start();
  return mod.rulesStore;
}

beforeEach(() => {
  localStorage.clear();
  h.authCb = null; h.snapCb = null; h.cloudIds = [];
  h.setDoc.mockReset().mockResolvedValue(undefined);
  h.deleteDoc.mockReset().mockResolvedValue(undefined);
});

describe('collectionStore — khách (chưa đăng nhập)', () => {
  it('lưu/xoá vào localStorage và cập nhật snapshot, không gọi Firestore', async () => {
    const store = await freshStore();
    h.authCb!(null);
    await store.save(rule('r1'));
    await store.save(rule('r1', 'đã sửa'));
    expect(store.getSnapshot().items.map((r) => r.title)).toEqual(['đã sửa']);
    expect(JSON.parse(localStorage.getItem('custom_rules')!)).toHaveLength(1);
    await store.remove('r1');
    expect(store.getSnapshot().items).toEqual([]);
    expect(h.setDoc).not.toHaveBeenCalled();
    expect(store.getSnapshot().status).toBe('local');
  });
});

describe('collectionStore — đăng nhập', () => {
  it('chỉ đẩy mục cục bộ CHƯA có trên cloud rồi xoá localStorage; danh sách lấy từ onSnapshot', async () => {
    localStorage.setItem('custom_rules', JSON.stringify([rule('local-only'), rule('da-co')]));
    h.cloudIds = ['da-co'];
    const store = await freshStore();
    h.authCb!({ uid: 'u1' });
    expect(store.getSnapshot().status).toBe('loading');
    await flush(); await flush();

    expect(h.setDoc).toHaveBeenCalledTimes(1);
    const [ref, payload] = h.setDoc.mock.calls[0];
    expect(ref).toBe('rules/local-only');
    expect(payload).toMatchObject({ userId: 'u1', updatedAt: 'TS', title: 'local-only', authorName: 'Tester' });
    expect(localStorage.getItem('custom_rules')).toBeNull();

    h.snapCb!({ docs: [{ id: 'da-co', data: () => ({ title: 'Bản cloud', content: 'x' }) }] });
    expect(store.getSnapshot()).toMatchObject({ status: 'synced', items: [{ id: 'da-co', title: 'Bản cloud' }] });
  });

  it('mục ghi lỗi được giữ lại localStorage để thử lần sau', async () => {
    localStorage.setItem('custom_rules', JSON.stringify([rule('ok'), rule('loi')]));
    h.setDoc.mockImplementation(async (ref: string) => { if (ref === 'rules/loi') throw new Error('denied'); });
    await freshStore();
    h.authCb!({ uid: 'u1' });
    await flush(); await flush();
    expect(JSON.parse(localStorage.getItem('custom_rules')!).map((r: any) => r.id)).toEqual(['loi']);
  });

  it('save/remove khi đăng nhập ghi thẳng Firestore, không đụng localStorage', async () => {
    const store = await freshStore();
    h.authCb!({ uid: 'u1' });
    await store.save(rule('r9'));
    await store.remove('r9');
    expect(h.setDoc).toHaveBeenCalledWith('rules/r9', expect.objectContaining({ userId: 'u1' }));
    expect(h.deleteDoc).toHaveBeenCalledWith('rules/r9');
    expect(localStorage.getItem('custom_rules')).toBeNull();
  });

  it('đăng xuất → quay về dữ liệu localStorage của khách', async () => {
    const store = await freshStore();
    h.authCb!({ uid: 'u1' });
    h.snapCb!({ docs: [{ id: 'cloud', data: () => ({ title: 'cloud' }) }] });
    localStorage.setItem('custom_rules', JSON.stringify([rule('khach')]));
    h.authCb!(null);
    expect(store.getSnapshot()).toMatchObject({ status: 'local', items: [{ id: 'khach' }] });
  });
});
