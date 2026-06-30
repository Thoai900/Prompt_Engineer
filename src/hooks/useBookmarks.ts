import { useCallback, useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { PromptTemplate } from '../types';

// Lưu/bookmark template ở mức CÁ NHÂN (mô hình an toàn, không cần backend):
// - Đăng nhập: mỗi bookmark là doc `bookmarks/{uid}_{templateId}` do user sở hữu.
// - Chưa đăng nhập: lưu danh sách id trong localStorage.
// Đây là "đã lưu của riêng bạn", KHÔNG phải bộ đếm toàn cục.

const LS_KEY = 'pb_bookmarks';

function readLocal(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(ids: string[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(ids)); } catch { /* no-op */ }
}

export function useBookmarks(user: { uid: string } | null | undefined) {
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set(readLocal()));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        setSavedIds(new Set(readLocal()));
        return;
      }
      try {
        const snap = await getDocs(query(collection(db, 'bookmarks'), where('userId', '==', user.uid)));
        if (cancelled) return;
        setSavedIds(new Set(snap.docs.map((d) => (d.data() as any).templateId).filter(Boolean)));
      } catch (err) {
        try { handleFirestoreError(err, 'list'); } catch (e: any) { console.error('Load bookmarks failed:', e.message); }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user]);

  const isSaved = useCallback((templateId: string) => savedIds.has(templateId), [savedIds]);

  const toggleSave = useCallback(async (template: PromptTemplate) => {
    const id = template.id;
    const currentlySaved = savedIds.has(id);

    // Cập nhật lạc quan trước.
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (currentlySaved) next.delete(id); else next.add(id);
      if (!user) writeLocal([...next]);
      return next;
    });

    if (!user) return;

    const ref = doc(db, 'bookmarks', `${user.uid}_${id}`);
    try {
      if (currentlySaved) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, { userId: user.uid, templateId: id, createdAt: serverTimestamp() });
      }
    } catch (err) {
      // Hoàn tác nếu ghi thất bại.
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (currentlySaved) next.add(id); else next.delete(id);
        return next;
      });
      try { handleFirestoreError(err, currentlySaved ? 'delete' : 'create', `bookmarks/${user.uid}_${id}`); } catch (e: any) { console.error(e.message); }
    }
  }, [user, savedIds]);

  return { savedIds, isSaved, toggleSave };
}
