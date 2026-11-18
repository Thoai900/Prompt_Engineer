/**
 * Gửi một prompt từ tab khác sang Lab (Bake-off / Auto-Optimizer) và mở tab Lab.
 * Prompt có thể dài nên không đưa lên URL: lưu tạm ở sessionStorage + phát sự kiện
 * để LabTab đang mount nhận ngay; LabTab mount sau thì đọc lại khi mount.
 */
export type LabSeedMode = 'bakeoff' | 'optimizer';
export interface LabSeed { mode: LabSeedMode; prompt: string }

const KEY = 'pb_lab_seed';
export const LAB_SEED_EVENT = 'pb:lab-seed';

export function sendToLab(mode: LabSeedMode, prompt: string): void {
  const seed: LabSeed = { mode, prompt };
  sessionStorage.setItem(KEY, JSON.stringify(seed));
  window.dispatchEvent(new CustomEvent(LAB_SEED_EVENT));
  window.location.hash = '#lab';
}

/** Lấy và xoá seed đang chờ (null nếu không có). */
export function takeLabSeed(): LabSeed | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  sessionStorage.removeItem(KEY);
  try {
    const seed = JSON.parse(raw);
    return (seed?.mode === 'bakeoff' || seed?.mode === 'optimizer') && typeof seed.prompt === 'string' ? seed : null;
  } catch {
    return null;
  }
}
