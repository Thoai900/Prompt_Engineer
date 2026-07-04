import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError } from '../firebase';

// M5: báo cáo template vi phạm + hành động moderation của admin.
// Rules: `reports` — user đã đăng nhập tạo, chỉ admin đọc/xoá; admin (custom claim
// `admin: true`, đặt bằng Admin SDK — xem DEPLOY.md) được gỡ template public.

/** Lý do báo cáo chuẩn hoá hiển thị trong UI. */
export const REPORT_REASONS = [
  'Spam / quảng cáo',
  'Nội dung độc hại hoặc lừa đảo',
  'Vi phạm bản quyền',
] as const;

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Gửi một báo cáo. Trả về true nếu ghi thành công. */
export async function reportTemplate(templateId: string, reason: string): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  const id = genId('report');
  try {
    await setDoc(doc(db, 'reports', id), {
      userId: user.uid,
      templateId,
      reason: reason.slice(0, 500),
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    try { handleFirestoreError(err, 'create', `reports/${id}`); } catch (e: any) { console.error('Báo cáo thất bại:', e.message); }
    return false;
  }
}

/** Người dùng hiện tại có claim admin không (đọc từ ID token, có cache phía SDK). */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  try {
    const token = await user.getIdTokenResult();
    return token.claims.admin === true;
  } catch {
    return false;
  }
}

/** ADMIN: gỡ một template public khỏi cộng đồng. Trả về true nếu xoá thành công. */
export async function adminRemoveTemplate(templateId: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'templates', templateId));
    return true;
  } catch (err) {
    try { handleFirestoreError(err, 'delete', `templates/${templateId}`); } catch (e: any) { console.error('Gỡ template thất bại:', e.message); }
    return false;
  }
}
