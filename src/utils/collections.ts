// Bộ sưu tập cá nhân (Đợt 2 — Tổ chức thư viện): gom template vào các "thư mục"
// có tên. Lưu CỤC BỘ (localStorage) như custom_rules/liked/recent — không cần
// collection Firestore / rules mới. Một template có thể thuộc nhiều bộ sưu tập.
// Tách thuần (mọi thao tác nhận + trả mảng mới) để unit-test; lớp storage tách riêng.

export interface TemplateCollection {
  id: string;
  name: string;
  templateIds: string[];
  createdAt: string;
}

export const COLLECTIONS_LS_KEY = 'pb_collections';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function isCollection(x: any): x is TemplateCollection {
  return (
    x &&
    typeof x.id === 'string' &&
    typeof x.name === 'string' &&
    Array.isArray(x.templateIds) &&
    typeof x.createdAt === 'string'
  );
}

export function loadCollections(storage: StorageLike | null = defaultStorage()): TemplateCollection[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(COLLECTIONS_LS_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCollection).map((c) => ({
      ...c,
      templateIds: c.templateIds.filter((t) => typeof t === 'string'),
    }));
  } catch {
    return [];
  }
}

export function saveCollections(list: TemplateCollection[], storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(COLLECTIONS_LS_KEY, JSON.stringify(list));
  } catch {
    /* quota — bỏ qua */
  }
}

/** Id ngẫu nhiên (chỉ gọi ở ranh giới không thuần — hook/UI). */
export function newCollectionId(): string {
  return `col_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Thao tác THUẦN trên mảng (trả về mảng MỚI) ───────────────────────────────
export function createCollection(
  list: TemplateCollection[],
  name: string,
  meta: { id: string; createdAt: string },
): TemplateCollection[] {
  const trimmed = name.trim();
  if (!trimmed) return list;
  return [...list, { id: meta.id, name: trimmed, templateIds: [], createdAt: meta.createdAt }];
}

export function renameCollection(list: TemplateCollection[], id: string, name: string): TemplateCollection[] {
  const trimmed = name.trim();
  if (!trimmed) return list;
  return list.map((c) => (c.id === id ? { ...c, name: trimmed } : c));
}

export function deleteCollection(list: TemplateCollection[], id: string): TemplateCollection[] {
  return list.filter((c) => c.id !== id);
}

/** Có template → bỏ ra; chưa có → thêm vào. Trả mảng mới. */
export function toggleTemplateInCollection(
  list: TemplateCollection[],
  id: string,
  templateId: string,
): TemplateCollection[] {
  return list.map((c) => {
    if (c.id !== id) return c;
    const has = c.templateIds.includes(templateId);
    return {
      ...c,
      templateIds: has ? c.templateIds.filter((t) => t !== templateId) : [...c.templateIds, templateId],
    };
  });
}

export function isTemplateInCollection(list: TemplateCollection[], id: string, templateId: string): boolean {
  return !!list.find((c) => c.id === id)?.templateIds.includes(templateId);
}

/** Các bộ sưu tập ĐANG chứa template — dùng để đánh dấu trạng thái trên card/modal. */
export function collectionsContaining(list: TemplateCollection[], templateId: string): TemplateCollection[] {
  return list.filter((c) => c.templateIds.includes(templateId));
}
