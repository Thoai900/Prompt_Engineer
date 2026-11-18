/**
 * Gửi một prompt từ tab khác sang Lab (Bake-off / Auto-Optimizer / Prompt Health) và mở tab Lab.
 * Prompt có thể dài nên không đưa lên URL: lưu tạm ở sessionStorage + phát sự kiện
 * để LabTab đang mount nhận ngay; LabTab mount sau thì đọc lại khi mount.
 *
 * Các trường tuỳ chọn phục vụ vòng chất lượng (spec 2026-11-18-quality-loop-design):
 * template gốc → Health suite → Optimizer → lưu phiên bản mới của CÙNG template.
 */
export type LabSeedMode = 'bakeoff' | 'optimizer' | 'health';

export interface LabSeedExtras {
  /** Template gốc (đã lưu) mà prompt này thuộc về. */
  templateId?: string;
  templateTitle?: string;
  /** Health suite đã sinh ra seed này (để Optimizer chạy lại Health sau khi lưu). */
  suiteId?: string;
  /** Đầu vào thử (Optimizer hiện dùng phần tử đầu). */
  testInputs?: string[];
  /** Tiêu chí "thế nào là tốt". */
  criteria?: string[];
}

export interface LabSeed extends LabSeedExtras {
  mode: LabSeedMode;
  prompt: string;
}

const KEY = 'pb_lab_seed';
export const LAB_SEED_EVENT = 'pb:lab-seed';
const MODES: LabSeedMode[] = ['bakeoff', 'optimizer', 'health'];

export function sendToLab(mode: LabSeedMode, prompt: string, extras: LabSeedExtras = {}): void {
  const seed: LabSeed = { ...extras, mode, prompt };
  sessionStorage.setItem(KEY, JSON.stringify(seed));
  window.dispatchEvent(new CustomEvent(LAB_SEED_EVENT));
  window.location.hash = '#lab';
}

const strList = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : undefined;
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

/** Đọc seed từ chuỗi JSON (thuần, có test). Sai định dạng → null; trường lạ bị bỏ. */
export function parseLabSeed(raw: string | null): LabSeed | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (!MODES.includes(s?.mode) || typeof s.prompt !== 'string') return null;
    const seed: LabSeed = { mode: s.mode, prompt: s.prompt };
    const extras: LabSeedExtras = {
      templateId: str(s.templateId),
      templateTitle: str(s.templateTitle),
      suiteId: str(s.suiteId),
      testInputs: strList(s.testInputs),
      criteria: strList(s.criteria),
    };
    for (const [k, v] of Object.entries(extras)) if (v !== undefined) (seed as any)[k] = v;
    return seed;
  } catch {
    return null;
  }
}

/** Lấy và xoá seed đang chờ (null nếu không có). */
export function takeLabSeed(): LabSeed | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  sessionStorage.removeItem(KEY);
  return parseLabSeed(raw);
}
