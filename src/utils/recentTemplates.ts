// Template NGƯỜI DÙNG TƯƠNG TÁC gần đây (mở chi tiết / xem mẫu / remix), lưu cục bộ.
// Đây là TÍN HIỆU THẬT — thay cho khối "Kết quả của bạn" seed cứng trước đây.
// Chỉ lưu danh sách id theo thứ tự mới→cũ; template thật được resolve khi render.
// Tách thuần (storage tiêm qua tham số) để unit-test, giống likedTemplates.ts.

export const RECENT_LS_KEY = 'pb_recent_templates';
const MAX_RECENT = 12;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** Danh sách id gần đây (mới nhất ở đầu); rỗng nếu chưa có gì / lỗi đọc. */
export function loadRecentIds(storage: StorageLike | null = defaultStorage()): string[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(RECENT_LS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Ghi nhận một tương tác: đẩy id lên đầu, khử trùng lặp, giữ tối đa MAX_RECENT.
 * Trả về danh sách MỚI để component cập nhật state ngay (không cần đọc lại).
 */
export function recordRecentTemplate(id: string, storage: StorageLike | null = defaultStorage()): string[] {
  if (!id) return loadRecentIds(storage);
  const ids = loadRecentIds(storage).filter((x) => x !== id);
  ids.unshift(id);
  const next = ids.slice(0, MAX_RECENT);
  try {
    storage?.setItem(RECENT_LS_KEY, JSON.stringify(next));
  } catch {
    /* quota — bỏ qua */
  }
  return next;
}
