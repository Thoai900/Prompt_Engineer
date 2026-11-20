import type { LintIssue } from './aiService';
import { EMPTY_LOG, markPracticed, recordIssues, type MistakeBucket, type MistakeLog } from '../utils/mistakeLog';

// Nhật ký lỗi prompt của người dùng (Gia sư cá nhân hoá) — lưu localStorage trên máy này.
// Ghi từ Prompt Inspector và Studio mỗi lần kiểm tra prompt; đọc ở Learn → "Lỗi bạn hay mắc".
const KEY = 'pb_mistake_log';
export const MISTAKE_LOG_EVENT = 'pb:mistake-log';

export function loadMistakeLog(): MistakeLog {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Array.isArray(parsed.events)) return { events: parsed.events, practiced: parsed.practiced || {} };
  } catch { /* hỏng → bắt đầu lại */ }
  return EMPTY_LOG;
}

function save(log: MistakeLog): void {
  try { localStorage.setItem(KEY, JSON.stringify(log)); } catch { /* quota */ }
  window.dispatchEvent(new CustomEvent(MISTAKE_LOG_EVENT));
}

/** Gọi sau mỗi lần lint prompt của chính người dùng. */
export function recordLintMistakes(issues: LintIssue[]): void {
  if (!issues?.length) return;
  save(recordIssues(loadMistakeLog(), issues));
}

export function markBucketPracticed(bucket: MistakeBucket): void {
  save(markPracticed(loadMistakeLog(), bucket));
}
