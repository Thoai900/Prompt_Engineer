import { describe, expect, it } from 'vitest';
import {
  BACKUP_APP, BACKUP_FORMAT, BACKUP_KEYS,
  applyBackup, backupFileName, collectBackup, validateBackup,
} from '../utils/backupUtils';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, v); },
  };
}

describe('collectBackup', () => {
  it('chỉ thu thập key trong danh sách, bỏ qua key thiếu và key lạ', () => {
    const storage = fakeStorage({
      custom_rules: '[{"id":"r1"}]',
      mentor_ai_gemini_key: 'SECRET', // API key — không được sao lưu
      random_key: 'x',
    });
    const backup = collectBackup(storage);
    expect(backup.app).toBe(BACKUP_APP);
    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.data).toEqual({ custom_rules: '[{"id":"r1"}]' });
  });

  it('không có key API nào nằm trong BACKUP_KEYS', () => {
    expect(BACKUP_KEYS.some((k) => k.includes('key'))).toBe(false);
  });
});

describe('validateBackup', () => {
  it('chấp nhận backup hợp lệ', () => {
    const result = validateBackup(collectBackup(fakeStorage({ custom_rules: '[]' })));
    expect(result.ok).toBe(true);
  });

  it('từ chối file lạ, format tương lai và giá trị không phải chuỗi', () => {
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup({ app: 'Khac', format: 1, data: {} }).ok).toBe(false);
    expect(validateBackup({ app: BACKUP_APP, format: BACKUP_FORMAT + 1, data: {} }).ok).toBe(false);
    expect(validateBackup({ app: BACKUP_APP, format: 1, data: { custom_rules: 5 } }).ok).toBe(false);
  });
});

describe('applyBackup', () => {
  it('ghi key hợp lệ, bỏ qua key ngoài danh sách cho phép', () => {
    const storage = fakeStorage();
    const restored = applyBackup({
      app: BACKUP_APP, format: 1, exportedAt: new Date().toISOString(),
      data: { custom_rules: '[]', evil_key: 'x' },
    }, storage);
    expect(restored).toBe(1);
    expect(storage.map.get('custom_rules')).toBe('[]');
    expect(storage.map.has('evil_key')).toBe(false);
  });
});

describe('backupFileName', () => {
  it('đặt tên theo ngày ISO', () => {
    expect(backupFileName(new Date('2026-07-02T10:00:00Z'))).toBe('promptbuilder-backup-2026-07-02.json');
  });
});
