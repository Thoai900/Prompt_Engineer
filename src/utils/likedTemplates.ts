// Trạng thái "đã thích" template của NGƯỜI DÙNG HIỆN TẠI, lưu cục bộ (H1).
// Firestore chỉ giữ tổng đếm (metrics.likes); còn "tôi đã thích cái nào" giữ ở
// localStorage — đủ tốt để chống double-like trên một thiết bị mà không cần thêm
// collection/rules mới. Tách thuần (storage tiêm qua tham số) để unit-test.

export const LIKED_LS_KEY = 'pb_liked_templates';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadLikedIds(storage: StorageLike | null = defaultStorage()): Set<string> {
  if (!storage) return new Set();
  try {
    const parsed = JSON.parse(storage.getItem(LIKED_LS_KEY) || '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function isLikedLocally(templateId: string, storage: StorageLike | null = defaultStorage()): boolean {
  return loadLikedIds(storage).has(templateId);
}

/** Đảo trạng thái thích cục bộ; trả về trạng thái MỚI (true = vừa thích). */
export function toggleLikedLocally(templateId: string, storage: StorageLike | null = defaultStorage()): boolean {
  const ids = loadLikedIds(storage);
  const nowLiked = !ids.has(templateId);
  if (nowLiked) ids.add(templateId);
  else ids.delete(templateId);
  try {
    storage?.setItem(LIKED_LS_KEY, JSON.stringify([...ids]));
  } catch { /* quota — bỏ qua */ }
  return nowLiked;
}
