import { useSyncExternalStore } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, deleteDoc, doc, getDocsFromServer, onSnapshot, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { AiRule, AiSkill } from '../types';
import {
  pickMissingFromCloud, ruleFromDoc, ruleToDoc, skillFromDoc, skillToDoc, upsertById,
} from '../utils/libraryDoc';

// ─────────────────────────────────────────────────────────────────────────────
// Kho dữ liệu MỘT NGUỒN cho các collection cá nhân (rule, skill):
//   • Khách (chưa đăng nhập): nguồn = localStorage (`lsKey`).
//   • Đã đăng nhập: nguồn = Firestore (onSnapshot realtime; cache offline IndexedDB
//     đã bật ở firebase.ts). KHÔNG chép ngược ra localStorage.
//   • Lần đăng nhập: mục cục bộ chưa có trên cloud được đẩy lên một lần rồi xoá
//     khỏi localStorage (bản cloud luôn thắng khi trùng id).
// Component đọc bằng hook `useRules()`/`useSkills()`; code ngoài React dùng
// `store.getSnapshot().items`. Chỉ chứa mục CUSTOM — preset do nơi dùng tự ghép.
// ─────────────────────────────────────────────────────────────────────────────

export type StoreStatus = 'local' | 'loading' | 'synced' | 'error';

export interface StoreSnapshot<T> {
  items: T[];
  status: StoreStatus;
}

interface StoreConfig<T> {
  collection: string;
  lsKey: string;
  fromDoc: (id: string, data: any) => T;
  toDoc: (item: T) => Record<string, unknown>;
}

export interface CollectionStore<T extends { id: string }> {
  /** Bắt đầu theo dõi đăng nhập + nguồn dữ liệu (idempotent; subscribe/getSnapshot tự gọi). */
  start: () => void;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => StoreSnapshot<T>;
  /** Tạo mới hoặc ghi đè theo id. Đăng nhập: chờ server xác nhận (lỗi → throw). */
  save: (item: T) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

function readLocal<T extends { isPreset?: boolean }>(key: string): T[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? (parsed as T[]).filter((x) => x && !x.isPreset) : [];
  } catch {
    return [];
  }
}

export function createCollectionStore<T extends { id: string; isPreset?: boolean }>(cfg: StoreConfig<T>): CollectionStore<T> {
  let snapshot: StoreSnapshot<T> = { items: [], status: 'local' };
  let uid: string | null = null;
  let started = false;
  let unsubData: (() => void) | null = null;
  const listeners = new Set<() => void>();

  const set = (patch: Partial<StoreSnapshot<T>>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((l) => l());
  };

  const docPayload = (item: T, owner: string) => ({
    ...cfg.toDoc(item),
    userId: owner,
    updatedAt: serverTimestamp(),
    authorName: (auth.currentUser?.displayName || 'User').slice(0, 100),
  });

  /** Đẩy mục khách chưa có trên cloud lên; mục ghi lỗi giữ lại localStorage để thử lần sau. */
  async function migrateLocal(owner: string) {
    const local = readLocal<T>(cfg.lsKey);
    if (local.length === 0) return;
    // Hỏi THẲNG server (không dùng cache) để không ghi đè bản cloud mới hơn.
    const snap = await getDocsFromServer(query(collection(db, cfg.collection), where('userId', '==', owner)));
    const missing = pickMissingFromCloud(local, new Set(snap.docs.map((d) => d.id)));
    const results = await Promise.allSettled(
      missing.map((item) => setDoc(doc(db, cfg.collection, item.id), docPayload(item, owner))),
    );
    const failed = missing.filter((_, i) => results[i].status === 'rejected');
    if (failed.length > 0) {
      console.warn(`[${cfg.collection}] ${failed.length} mục cục bộ chưa đẩy lên cloud được, sẽ thử lại lần đăng nhập sau.`);
      localStorage.setItem(cfg.lsKey, JSON.stringify(failed));
    } else {
      localStorage.removeItem(cfg.lsKey);
    }
  }

  function start() {
    if (started) return;
    started = true;
    snapshot = { items: readLocal<T>(cfg.lsKey), status: 'local' };
    onAuthStateChanged(auth, (user) => {
      unsubData?.();
      unsubData = null;
      uid = user?.uid ?? null;
      if (!user) {
        set({ items: readLocal<T>(cfg.lsKey), status: 'local' });
        return;
      }
      const owner = user.uid;
      set({ items: [], status: 'loading' });
      unsubData = onSnapshot(
        query(collection(db, cfg.collection), where('userId', '==', owner)),
        (snap) => set({ items: snap.docs.map((d) => cfg.fromDoc(d.id, d.data())), status: 'synced' }),
        (err) => {
          console.error(`[${cfg.collection}] onSnapshot lỗi:`, err);
          set({ status: 'error' });
        },
      );
      migrateLocal(owner).catch((err) => console.warn(`[${cfg.collection}] chưa đẩy được dữ liệu cục bộ:`, err));
    });
  }

  return {
    start,
    subscribe(listener) {
      start();
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      start();
      return snapshot;
    },
    async save(item) {
      start();
      if (uid) {
        await setDoc(doc(db, cfg.collection, item.id), docPayload(item, uid));
        return;
      }
      const next = upsertById(readLocal<T>(cfg.lsKey), item);
      localStorage.setItem(cfg.lsKey, JSON.stringify(next));
      set({ items: next });
    },
    async remove(id) {
      start();
      if (uid) {
        await deleteDoc(doc(db, cfg.collection, id));
        return;
      }
      const next = readLocal<T>(cfg.lsKey).filter((x) => x.id !== id);
      localStorage.setItem(cfg.lsKey, JSON.stringify(next));
      set({ items: next });
    },
  };
}

export const rulesStore = createCollectionStore<AiRule>({
  collection: 'rules', lsKey: 'custom_rules', fromDoc: ruleFromDoc, toDoc: ruleToDoc,
});

export const skillsStore = createCollectionStore<AiSkill>({
  collection: 'skills', lsKey: 'custom_skills', fromDoc: skillFromDoc, toDoc: skillToDoc,
});

function useStore<T extends { id: string }>(store: CollectionStore<T>): StoreSnapshot<T> {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

/** Rule CUSTOM của người dùng hiện tại (không gồm preset). */
export const useRules = () => useStore(rulesStore);
/** Skill CUSTOM của người dùng hiện tại (không gồm preset). */
export const useSkills = () => useStore(skillsStore);

/** Gọi một lần khi app khởi động để kho sẵn sàng trước khi tab nào cần. */
export function startCollectionStores(): void {
  rulesStore.start();
  skillsStore.start();
}
