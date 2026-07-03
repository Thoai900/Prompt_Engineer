import { doc, increment, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { toggleLikedLocally } from '../utils/likedTemplates';

// Metrics THẬT cho template public (H1). Firestore rules có nhánh riêng cho phép
// user đã đăng nhập cập nhật CHỈ field `metrics` của template public, mỗi counter
// đổi tối đa ±1/lần (usageCount không giảm) — xem firestore.rules.
// Mọi hàm đều fire-and-forget an toàn: lỗi (offline, rules cũ chưa deploy, template
// không public) chỉ log, không phá luồng chính.

/** +1 lượt dùng khi template public được mở vào Builder. */
export async function bumpTemplateUsage(templateId: string): Promise<boolean> {
  if (!auth.currentUser) return false;
  try {
    await updateDoc(doc(db, 'templates', templateId), { 'metrics.usageCount': increment(1) });
    return true;
  } catch (err: any) {
    console.warn('Không bump được usageCount (bỏ qua):', err?.message);
    return false;
  }
}

/**
 * Đảo like: cập nhật trạng thái cục bộ + tăng/giảm metrics.likes trên Firestore.
 * Trả về trạng thái like MỚI, hoặc null nếu ghi Firestore thất bại (đã hoàn tác local).
 */
export async function toggleTemplateLike(templateId: string): Promise<boolean | null> {
  if (!auth.currentUser) return null;
  const nowLiked = toggleLikedLocally(templateId);
  try {
    await updateDoc(doc(db, 'templates', templateId), { 'metrics.likes': increment(nowLiked ? 1 : -1) });
    return nowLiked;
  } catch (err: any) {
    toggleLikedLocally(templateId); // hoàn tác local cho khớp server
    console.warn('Không cập nhật được likes (đã hoàn tác):', err?.message);
    return null;
  }
}
