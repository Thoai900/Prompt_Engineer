import { collection, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { DEFAULT_DAILY_QUOTA, apiKeyPrefix, generateApiKey, hashApiKey } from '../utils/apiAccess';

// API key cho Prompt Graph (Đợt 2): collection `apiKeys/{sha256(key)}`. Chỉ lưu HASH — key gốc hiện
// một lần lúc tạo. `usage` do server (api/run.ts, service account) ghi; rule cấm client sửa.

export interface ApiKeyInfo {
  id: string;            // = hash
  name: string;
  prefix: string;
  appIds: string[];      // ['*'] = mọi app đã bật API
  dailyQuota: number;
  usage: { day: string; count: number };
  createdAt: string;
  revoked: boolean;
}

function toIso(v: any): string {
  try { if (v?.toDate) return v.toDate().toISOString(); if (typeof v === 'string') return v; } catch { /* no-op */ }
  return '';
}

export async function listApiKeys(user: { uid: string }): Promise<ApiKeyInfo[]> {
  try {
    const snap = await getDocs(query(collection(db, 'apiKeys'), where('ownerId', '==', user.uid)));
    return snap.docs
      .map((d) => {
        const x = d.data() as any;
        return {
          id: d.id,
          name: x.name || '',
          prefix: x.prefix || '',
          appIds: Array.isArray(x.appIds) ? x.appIds : [],
          dailyQuota: Number(x.dailyQuota) || DEFAULT_DAILY_QUOTA,
          usage: { day: x.usage?.day || '', count: Number(x.usage?.count) || 0 },
          createdAt: toIso(x.createdAt),
          revoked: !!x.revokedAt,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    try { handleFirestoreError(err, 'list', 'apiKeys'); } catch (e: any) { console.error(e.message); }
    return [];
  }
}

/** Tạo key mới; trả key GỐC (chỉ có lúc này). */
export async function createApiKey(user: { uid: string }, name: string, appIds: string[]): Promise<string> {
  const key = generateApiKey();
  const id = await hashApiKey(key);
  try {
    await setDoc(doc(db, 'apiKeys', id), {
      ownerId: user.uid,
      name: name.trim().slice(0, 100) || 'API key',
      prefix: apiKeyPrefix(key),
      appIds: appIds.length ? appIds : ['*'],
      dailyQuota: DEFAULT_DAILY_QUOTA,
      usage: { day: '', count: 0 },
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    try { handleFirestoreError(err, 'create', `apiKeys/${id}`); } catch (e: any) { console.error(e.message); }
    throw err;
  }
  return key;
}

export async function revokeApiKey(id: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'apiKeys', id), { revokedAt: serverTimestamp() });
  } catch (err) {
    try { handleFirestoreError(err, 'update', `apiKeys/${id}`); } catch (e: any) { console.error(e.message); }
    throw err;
  }
}
