import { MODEL_COSTS } from '../config/models';

// Thống kê sử dụng AI cục bộ (M2): mỗi lời gọi AI ghi nhận (model, ký tự vào/ra)
// theo NGÀY vào localStorage. Chỉ ước tính tương đối (~4 ký tự/token) — mục đích
// là cho người dùng cảm nhận mức dùng & chi phí, không phải hoá đơn.
// Tách THUẦN (storage tiêm qua tham số) để unit-test được; mọi lỗi ghi đều nuốt
// im lặng — thống kê KHÔNG BAO GIỜ được làm hỏng lời gọi AI.

export const USAGE_LS_KEY = 'pb_usage_stats';
export const USAGE_RETENTION_DAYS = 30;

export interface ModelDayUsage {
  calls: number;
  inChars: number;
  outChars: number;
}

/** { 'YYYY-MM-DD': { 'model-name': {calls, inChars, outChars} } } */
export type UsageData = Record<string, Record<string, ModelDayUsage>>;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function loadUsage(storage: StorageLike | null = defaultStorage()): UsageData {
  if (!storage) return {};
  try {
    const raw = storage.getItem(USAGE_LS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as UsageData) : {};
  } catch {
    return {};
  }
}

/** Ghi nhận một lời gọi AI. Tự cắt dữ liệu cũ hơn USAGE_RETENTION_DAYS. */
export function recordUsage(
  model: string,
  inChars: number,
  outChars: number,
  storage: StorageLike | null = defaultStorage(),
  now: Date = new Date(),
): void {
  if (!storage || !model) return;
  try {
    const data = loadUsage(storage);
    const key = dayKey(now);
    const day = data[key] || (data[key] = {});
    const entry = day[model] || (day[model] = { calls: 0, inChars: 0, outChars: 0 });
    entry.calls += 1;
    entry.inChars += Math.max(0, inChars | 0);
    entry.outChars += Math.max(0, outChars | 0);

    const cutoff = dayKey(new Date(now.getTime() - USAGE_RETENTION_DAYS * 86_400_000));
    for (const k of Object.keys(data)) {
      if (k < cutoff) delete data[k];
    }
    storage.setItem(USAGE_LS_KEY, JSON.stringify(data));
  } catch {
    /* im lặng — không được làm hỏng lời gọi AI */
  }
}

/** Chi phí ước tính (USD) từ số ký tự, dựa trên bảng giá MODEL_COSTS. Model lạ → 0. */
export function estimateCostFromChars(model: string, inChars: number, outChars: number): number {
  const cost = MODEL_COSTS[model];
  if (!cost) return 0;
  const inTok = Math.ceil(inChars / 4);
  const outTok = Math.ceil(outChars / 4);
  return (inTok / 1_000_000) * cost.inputPer1M + (outTok / 1_000_000) * cost.outputPer1M;
}

export interface ModelSummary {
  model: string;
  calls: number;
  inChars: number;
  outChars: number;
  costUSD: number;
}

export interface UsageSummary {
  totalCalls: number;
  totalCostUSD: number;
  perModel: ModelSummary[];         // sắp theo số lượt giảm dần
  perDay: { date: string; calls: number }[]; // đủ `days` ngày gần nhất, cũ → mới
}

export function summarizeUsage(data: UsageData, days = 7, now: Date = new Date()): UsageSummary {
  const modelMap = new Map<string, ModelSummary>();
  let totalCalls = 0;

  for (const day of Object.values(data)) {
    for (const [model, u] of Object.entries(day)) {
      const m = modelMap.get(model) || { model, calls: 0, inChars: 0, outChars: 0, costUSD: 0 };
      m.calls += u.calls;
      m.inChars += u.inChars;
      m.outChars += u.outChars;
      modelMap.set(model, m);
      totalCalls += u.calls;
    }
  }
  let totalCostUSD = 0;
  for (const m of modelMap.values()) {
    m.costUSD = estimateCostFromChars(m.model, m.inChars, m.outChars);
    totalCostUSD += m.costUSD;
  }

  const perDay: { date: string; calls: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = dayKey(new Date(now.getTime() - i * 86_400_000));
    const day = data[date] || {};
    perDay.push({ date, calls: Object.values(day).reduce((s, u) => s + u.calls, 0) });
  }

  return {
    totalCalls,
    totalCostUSD,
    perModel: [...modelMap.values()].sort((a, b) => b.calls - a.calls),
    perDay,
  };
}
