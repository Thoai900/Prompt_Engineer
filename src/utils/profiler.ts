import { estimateCostUSD } from '../config/models';

// Prompt Profiler (Lab · "Độ ổn định"): chạy cùng prompt N lần trên vài model, đo độ nhất quán,
// tỉ lệ đúng định dạng, dao động độ dài, độ trễ, chi phí → kết luận Ổn định / Dao động / Giòn.
// Hàm THUẦN để unit-test; ProfilerPanel gọi.

export type FormatKind = 'none' | 'json' | 'list';

export interface FormatSpec {
  kind: FormatKind;
  /** Cụm từ BẮT BUỘC có trong mọi output (không phân biệt hoa thường). */
  requiredPhrases?: string[];
}

/** Kỳ vọng về output: 'same' = nên giống nhau (trích xuất, phân loại); 'diverse' = được phép khác (sáng tác). */
export type Expectation = 'same' | 'diverse';

export interface RunSample {
  text?: string;
  latencyMs?: number;
  error?: string;
}

export type Verdict = 'stable' | 'wobbly' | 'brittle';

export interface ModelProfile {
  model: string;
  runs: number;
  errors: number;
  /** 0–100: trung bình độ giống nhau từng cặp output; null nếu < 2 output thành công. */
  consistency: number | null;
  /** 0–1: tỉ lệ output đạt định dạng; null nếu không kiểm định dạng. */
  formatPassRate: number | null;
  formatFailures: number[]; // chỉ số lần chạy sai định dạng
  lengthMean: number;
  /** Hệ số biến thiên độ dài (độ lệch chuẩn / trung bình). */
  lengthCv: number;
  latencyMean: number;
  latencyP95: number;
  costPerRun: number;
  verdict: Verdict;
  reasons: string[];
}

const WORD_RE = /[\p{L}\p{N}]+/gu;

/** Từ (chữ thường, giữ dấu tiếng Việt). */
export function tokenize(text: string): string[] {
  return (text || '').toLowerCase().match(WORD_RE) || [];
}

/** Tập cụm 2 từ liên tiếp (văn bản 1 từ → chính từ đó). */
function shingles(text: string): Set<string> {
  const w = tokenize(text);
  if (w.length < 2) return new Set(w);
  const out = new Set<string>();
  for (let i = 0; i < w.length - 1; i++) out.add(`${w[i]} ${w[i + 1]}`);
  return out;
}

/** Độ giống nhau 0–1 (Jaccard trên cụm 2 từ). Hai văn bản rỗng = 1. */
export function similarity(a: string, b: string): number {
  const A = shingles(a);
  const B = shingles(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** 0–100: trung bình độ giống nhau của mọi cặp; null nếu < 2 output. */
export function consistencyScore(outputs: string[]): number | null {
  if (outputs.length < 2) return null;
  let sum = 0;
  let pairs = 0;
  for (let i = 0; i < outputs.length; i++) {
    for (let j = i + 1; j < outputs.length; j++) {
      sum += similarity(outputs[i], outputs[j]);
      pairs++;
    }
  }
  return Math.round((sum / pairs) * 100);
}

/** Lấy phần JSON (bỏ khối ```json … ``` nếu có) rồi parse. */
function isValidJson(text: string): boolean {
  let s = (text || '').trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (fence) s = fence[1].trim();
  if (!s || !/^[[{]/.test(s)) return false;
  try { JSON.parse(s); return true; } catch { return false; }
}

/** Ít nhất 2 dòng là mục danh sách (-, *, •, 1. hoặc 1)). */
function isList(text: string): boolean {
  return (text || '').split('\n').filter((l) => /^\s*([-*•]|\d+[.)])\s+\S/.test(l)).length >= 2;
}

/** Output có đạt định dạng yêu cầu không. Không đặt yêu cầu nào → true. */
export function checkFormat(text: string, spec: FormatSpec): boolean {
  if (spec.kind === 'json' && !isValidJson(text)) return false;
  if (spec.kind === 'list' && !isList(text)) return false;
  const lower = (text || '').toLowerCase();
  return (spec.requiredPhrases || []).every((p) => !p.trim() || lower.includes(p.trim().toLowerCase()));
}

export function hasFormatCheck(spec: FormatSpec): boolean {
  return spec.kind !== 'none' || (spec.requiredPhrases || []).some((p) => p.trim());
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

/** Phân vị p (0–1) theo nearest-rank. */
export function percentile(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
}

// Ngưỡng kết luận — một chỗ để chỉnh.
export const THRESHOLDS = {
  stableConsistency: 70,   // 'same': ≥ 70 mới gọi là ổn định
  brittleConsistency: 40,  // 'same': < 40 là giòn
  stableFormat: 0.95,
  brittleFormat: 0.8,
  brittleErrorRate: 0.2,
  stableLengthCv: 0.35,
  brittleLengthCv: 0.8,
} as const;

/** Tổng hợp N lần chạy của một model thành hồ sơ + kết luận (có lý do). */
export function profileModel(
  model: string,
  samples: RunSample[],
  inputText: string,
  spec: FormatSpec,
  expectation: Expectation,
): ModelProfile {
  const ok = samples.map((s, i) => ({ ...s, i })).filter((s) => !s.error && typeof s.text === 'string');
  const texts = ok.map((s) => s.text as string);
  const errors = samples.length - ok.length;
  const lengths = texts.map((t) => t.length);
  const latencies = ok.map((s) => s.latencyMs ?? 0);

  const checking = hasFormatCheck(spec);
  const formatFailures = checking ? ok.filter((s) => !checkFormat(s.text as string, spec)).map((s) => s.i) : [];
  const formatPassRate = checking && ok.length ? (ok.length - formatFailures.length) / ok.length : null;

  const lengthMean = mean(lengths);
  const lengthCv = lengthMean > 0 ? stdev(lengths) / lengthMean : 0;
  const consistency = consistencyScore(texts);
  const costPerRun = mean(texts.map((t) => estimateCostUSD(model, inputText, t)));

  const reasons: string[] = [];
  let brittle = false;
  let wobbly = false;
  const errorRate = samples.length ? errors / samples.length : 0;

  if (ok.length === 0) {
    brittle = true;
    reasons.push('Mọi lần chạy đều lỗi.');
  } else {
    if (errorRate > THRESHOLDS.brittleErrorRate) { brittle = true; reasons.push(`${errors}/${samples.length} lần chạy lỗi.`); }
    else if (errors > 0) { wobbly = true; reasons.push(`${errors} lần chạy lỗi.`); }

    if (formatPassRate !== null) {
      const pct = Math.round(formatPassRate * 100);
      if (formatPassRate < THRESHOLDS.brittleFormat) { brittle = true; reasons.push(`Chỉ ${pct}% output đúng định dạng.`); }
      else if (formatPassRate < THRESHOLDS.stableFormat) { wobbly = true; reasons.push(`${pct}% output đúng định dạng.`); }
    }

    if (expectation === 'same' && consistency !== null) {
      if (consistency < THRESHOLDS.brittleConsistency) { brittle = true; reasons.push(`Các lần chạy rất khác nhau (nhất quán ${consistency}/100).`); }
      else if (consistency < THRESHOLDS.stableConsistency) { wobbly = true; reasons.push(`Các lần chạy khác nhau đáng kể (nhất quán ${consistency}/100).`); }
    }

    if (lengthCv > THRESHOLDS.brittleLengthCv) { brittle = true; reasons.push('Độ dài output dao động rất mạnh.'); }
    else if (lengthCv > THRESHOLDS.stableLengthCv) { wobbly = true; reasons.push('Độ dài output dao động.'); }
  }

  const verdict: Verdict = brittle ? 'brittle' : wobbly ? 'wobbly' : 'stable';
  if (verdict === 'stable') reasons.push('Kết quả đều đặn qua các lần chạy.');

  return {
    model,
    runs: samples.length,
    errors,
    consistency,
    formatPassRate,
    formatFailures,
    lengthMean: Math.round(lengthMean),
    lengthCv: Math.round(lengthCv * 100) / 100,
    latencyMean: Math.round(mean(latencies)),
    latencyP95: Math.round(percentile(latencies, 0.95)),
    costPerRun,
    verdict,
    reasons,
  };
}

/** Giới hạn tổng số lượt gọi một lần profile (tránh chạm rate-limit proxy 20/phút). */
export const MAX_TOTAL_RUNS = 24;

/** Chạy danh sách tác vụ với tối đa `limit` tác vụ đồng thời, giữ thứ tự kết quả. */
export async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, tasks.length)) }, worker));
  return results;
}
