// Sao lưu & khôi phục dữ liệu cục bộ (H6): xuất/nhập một file JSON chứa các key
// localStorage của app. Tách THUẦN (nhận storage qua tham số) để unit-test được.
//
// LƯU Ý: các key chứa API key cá nhân (mentor_ai_gemini_key…) CỐ TÌNH không nằm
// trong danh sách — file backup có thể được chia sẻ/đồng bộ, không được chứa bí mật.

export const BACKUP_FORMAT = 1;
export const BACKUP_APP = 'PromptBuilder';

/** Danh sách key localStorage được sao lưu (nguồn: các service/tab hiện có). */
export const BACKUP_KEYS: readonly string[] = [
  // Workspace & persona (WorkspaceContext)
  'pb_custom_workspaces',
  'pb_custom_personas',
  'pb_default_workspace_name',
  'mentor_ai_active_workspace',
  'mentor_ai_active_persona',
  // Rules & Skills
  'custom_rules',
  'custom_skills',
  // Project Chain + Health suites
  'mentor_ai_prompt_projects',
  'pb_health_suites',
  // LLM Config profiles + framework tự lưu ở Builder
  'llm_custom_profiles',
  'custom_frameworks',
  // Taste model (ghost-text) + tiến trình Learn
  'ghostModel:anon',
  'learn_xp',
  'learn_badges',
  // Tuỳ chọn không nhạy cảm
  'ghost_text_enabled',
];

export interface BackupFile {
  app: typeof BACKUP_APP;
  format: number;
  exportedAt: string;
  /** Giá trị localStorage GIỮ NGUYÊN dạng chuỗi (lossless, không parse lại). */
  data: Record<string, string>;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** Thu thập backup từ storage. Key không tồn tại thì bỏ qua. */
export function collectBackup(storage: StorageLike): BackupFile {
  const data: Record<string, string> = {};
  for (const key of BACKUP_KEYS) {
    const value = storage.getItem(key);
    if (value !== null) data[key] = value;
  }
  return { app: BACKUP_APP, format: BACKUP_FORMAT, exportedAt: new Date().toISOString(), data };
}

export interface BackupValidation {
  ok: boolean;
  backup?: BackupFile;
  error?: string;
}

/** Kiểm tra một object có phải file backup hợp lệ không (dùng trước khi áp). */
export function validateBackup(raw: unknown): BackupValidation {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'File không phải JSON hợp lệ.' };
  const b = raw as Partial<BackupFile>;
  if (b.app !== BACKUP_APP) return { ok: false, error: 'File không phải backup của PromptBuilder.' };
  if (typeof b.format !== 'number' || b.format > BACKUP_FORMAT) {
    return { ok: false, error: `Phiên bản backup không hỗ trợ (format ${String(b.format)}).` };
  }
  if (!b.data || typeof b.data !== 'object' || Array.isArray(b.data)) {
    return { ok: false, error: 'Backup thiếu phần dữ liệu.' };
  }
  for (const [k, v] of Object.entries(b.data)) {
    if (typeof v !== 'string') return { ok: false, error: `Giá trị của "${k}" không hợp lệ.` };
  }
  return { ok: true, backup: b as BackupFile };
}

/**
 * Áp backup vào storage. CHỈ ghi các key nằm trong BACKUP_KEYS (key lạ trong file
 * bị bỏ qua — chống file độc hại nhét key tuỳ ý). Trả về số key đã khôi phục.
 */
export function applyBackup(backup: BackupFile, storage: StorageLike): number {
  const allowed = new Set(BACKUP_KEYS);
  let restored = 0;
  for (const [key, value] of Object.entries(backup.data)) {
    if (!allowed.has(key)) continue;
    storage.setItem(key, value);
    restored++;
  }
  return restored;
}

/** Tên file gợi ý khi tải xuống. */
export function backupFileName(now = new Date()): string {
  const d = now.toISOString().slice(0, 10);
  return `promptbuilder-backup-${d}.json`;
}
