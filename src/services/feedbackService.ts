import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { AppFeedback } from '../types';
import { buildFeedbackPayload, type FeedbackDraft } from '../utils/feedbackUtils';

// Flywheel (Đợt 3): phản hồi người dùng Shared App → chủ app (collection `appFeedback`).
// Chỉ Firestore (cần đăng nhập) — rule: người gửi chỉ tạo, chủ app đọc/đổi status/xoá.

function toIso(v: any): string {
  try { if (v?.toDate) return v.toDate().toISOString(); if (typeof v === 'string') return v; } catch { /* no-op */ }
  return new Date().toISOString();
}

export async function submitFeedback(draft: FeedbackDraft): Promise<void> {
  const id = `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    await setDoc(doc(db, 'appFeedback', id), { ...buildFeedbackPayload(draft), createdAt: serverTimestamp() });
  } catch (err) {
    try { handleFirestoreError(err, 'create', `appFeedback/${id}`); } catch (e: any) { console.error(e.message); }
    throw err;
  }
}

/** Phản hồi của một app (chủ app), mới nhất ở đầu. Lỗi → []. */
export async function listAppFeedback(user: { uid: string }, appId: string): Promise<AppFeedback[]> {
  try {
    const snap = await getDocs(query(
      collection(db, 'appFeedback'),
      where('ownerId', '==', user.uid),
      where('appId', '==', appId),
    ));
    return snap.docs
      .map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          appId: data.appId,
          ownerId: data.ownerId,
          userId: data.userId,
          rating: data.rating,
          comment: data.comment,
          inputs: data.inputs || {},
          output: data.output || '',
          revisionHash: data.revisionHash,
          status: data.status || 'new',
          createdAt: toIso(data.createdAt),
        } as AppFeedback;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    try { handleFirestoreError(err, 'list', 'appFeedback'); } catch (e: any) { console.error(e.message); }
    return [];
  }
}

export async function setFeedbackStatus(id: string, status: AppFeedback['status']): Promise<void> {
  try {
    await updateDoc(doc(db, 'appFeedback', id), { status });
  } catch (err) {
    try { handleFirestoreError(err, 'update', `appFeedback/${id}`); } catch (e: any) { console.error(e.message); }
    throw err;
  }
}

export async function deleteFeedback(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'appFeedback', id));
  } catch (err) {
    try { handleFirestoreError(err, 'delete', `appFeedback/${id}`); } catch (e: any) { console.error(e.message); }
    throw err;
  }
}

// "Chặn người gửi": lọc phía client (rule không đếm tần suất được) — lưu theo chủ app trên máy này.
const BLOCK_KEY = (ownerId: string) => `pb_feedback_blocked_${ownerId}`;

export function loadBlockedSenders(ownerId: string): string[] {
  try { return JSON.parse(localStorage.getItem(BLOCK_KEY(ownerId)) || '[]'); } catch { return []; }
}

export function blockSender(ownerId: string, senderId: string): string[] {
  const next = [...new Set([...loadBlockedSenders(ownerId), senderId])];
  try { localStorage.setItem(BLOCK_KEY(ownerId), JSON.stringify(next)); } catch { /* quota */ }
  return next;
}
