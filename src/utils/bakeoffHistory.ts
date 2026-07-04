// Lịch sử Bake-off (Phase 4): lưu các lần so tài model vào localStorage (cap 20)
// và xuất CSV. Tách THUẦN (storage tiêm qua tham số) để unit-test được.

export const BAKEOFF_LS_KEY = 'pb_bakeoff_history';
export const MAX_BAKEOFF_ENTRIES = 20;

export interface BakeoffModelResult {
  model: string;
  score?: number;
  latencyMs?: number;
  costUSD?: number;
  error?: string;
}

export interface BakeoffEntry {
  id: string;
  at: string;               // ISO date string
  prompt: string;           // cắt ngắn để localStorage không phình
  input: string;
  criteria: string[];
  results: BakeoffModelResult[];
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadBakeoffHistory(storage: StorageLike | null = defaultStorage()): BakeoffEntry[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(BAKEOFF_LS_KEY) || '[]');
    return Array.isArray(parsed) ? (parsed as BakeoffEntry[]) : [];
  } catch {
    return [];
  }
}

/** Thêm một entry vào ĐẦU lịch sử (mới nhất trước), giữ tối đa cap. Trả về danh sách mới. */
export function pushBakeoffEntry(
  entry: BakeoffEntry,
  storage: StorageLike | null = defaultStorage(),
  cap: number = MAX_BAKEOFF_ENTRIES,
): BakeoffEntry[] {
  const next = [
    { ...entry, prompt: entry.prompt.slice(0, 2000), input: entry.input.slice(0, 1000) },
    ...loadBakeoffHistory(storage),
  ].slice(0, cap);
  try { storage?.setItem(BAKEOFF_LS_KEY, JSON.stringify(next)); } catch { /* quota — bỏ qua */ }
  return next;
}

export function clearBakeoffHistory(storage: StorageLike | null = defaultStorage()): void {
  try { storage?.setItem(BAKEOFF_LS_KEY, '[]'); } catch { /* bỏ qua */ }
}

function csvCell(v: string | number | undefined): string {
  if (v === undefined || v === null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Xuất một entry thành CSV (header + mỗi model một dòng). */
export function entryToCsv(entry: BakeoffEntry): string {
  const lines = ['model,score,latency_ms,cost_usd_per_run,error'];
  for (const r of entry.results) {
    lines.push([
      csvCell(r.model),
      csvCell(r.score),
      csvCell(r.latencyMs !== undefined ? Math.round(r.latencyMs) : undefined),
      csvCell(r.costUSD !== undefined ? r.costUSD.toFixed(6) : undefined),
      csvCell(r.error),
    ].join(','));
  }
  return lines.join('\n');
}

/** Tên file CSV gợi ý theo thời điểm chạy. */
export function bakeoffCsvFileName(entry: BakeoffEntry): string {
  const d = entry.at.slice(0, 16).replace(/[:T]/g, '-');
  return `bakeoff-${d}.csv`;
}
