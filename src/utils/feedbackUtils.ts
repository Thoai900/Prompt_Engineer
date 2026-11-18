import { AppFeedback, HealthSuite, HealthTest, PromptProject } from '../types';
import { collectGraphVariables, compileGraph } from './graphCompile';
import { isGraphProject } from './graphMigration';
import { hashPrompt } from './promptRevisions';

// Flywheel (Đợt 3 — spec 2026-11-18-prompt-flywheel-versioning-design.md): phản hồi từ
// Shared App → test Health. Hàm THUẦN để unit-test; feedbackService/AppPanel/FeedbackInbox gọi.

/** Giới hạn khớp rule `appFeedback` trong firestore.rules — đổi một bên phải đổi bên kia. */
export const FEEDBACK_LIMITS = {
  comment: 1000,
  output: 8000,
  inputValue: 2000,
  inputKeys: 20,
} as const;

/** Số test tối đa của một suite (rule `isValidHealthSuite`: testCases ≤ 50). */
export const MAX_SUITE_TESTS = 50;

const VAR_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Thay {{ten_bien}} bằng giá trị trong `vars`; biến không có giá trị → giữ nguyên. */
export function renderVars(text: string, vars?: Record<string, string>): string {
  if (!vars) return text;
  return text.replace(VAR_REGEX, (match, name) => (vars[name] !== undefined && vars[name] !== '' ? vars[name] : match));
}

/**
 * Prompt MẪU của một app Prompt Graph: compile nhưng GIỮ chỗ {{ten_bien}} (không điền mặc định)
 * để Health suite điền theo từng test. App legacy (cây v2, nhiều bước) → null: không quy về 1 prompt.
 */
export function compileAppTemplate(project: PromptProject): string | null {
  if (!isGraphProject(project)) return null;
  const keep: Record<string, string> = {};
  for (const v of collectGraphVariables(project)) keep[v.name] = `{{${v.name}}}`;
  return compileGraph(project, keep).finalPrompt;
}

/** Hash prompt mẫu của app — gắn vào phản hồi để biết nó thuộc revision nào. */
export function appTemplateHash(project: PromptProject): string | undefined {
  const t = compileAppTemplate(project);
  return t ? hashPrompt(t) : undefined;
}

/** Giá trị biến THỰC TẾ của lần chạy: ô bỏ trống → giá trị mặc định (giống compileGraph). */
export function effectiveInputs(
  fields: Array<{ name: string; defaultValue?: string }>,
  values: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = (values[f.name] ?? '').trim();
    out[f.name] = v || f.defaultValue || '';
  }
  return out;
}

export type FeedbackDraft = Pick<AppFeedback, 'appId' | 'ownerId' | 'userId' | 'rating' | 'comment' | 'inputs' | 'output' | 'revisionHash'>;

/** Chuẩn hoá phản hồi trước khi ghi: cắt độ dài theo FEEDBACK_LIMITS, bỏ trường rỗng (Firestore từ chối undefined). */
export function buildFeedbackPayload(d: FeedbackDraft): Omit<AppFeedback, 'id' | 'createdAt'> {
  const inputs: Record<string, string> = {};
  for (const [k, v] of Object.entries(d.inputs || {}).slice(0, FEEDBACK_LIMITS.inputKeys)) {
    inputs[k] = String(v ?? '').slice(0, FEEDBACK_LIMITS.inputValue);
  }
  const payload: Omit<AppFeedback, 'id' | 'createdAt'> = {
    appId: d.appId,
    ownerId: d.ownerId,
    userId: d.userId,
    rating: d.rating,
    inputs,
    output: (d.output || '').slice(0, FEEDBACK_LIMITS.output),
    status: 'new',
  };
  const comment = (d.comment || '').trim().slice(0, FEEDBACK_LIMITS.comment);
  if (comment) payload.comment = comment;
  if (d.revisionHash) payload.revisionHash = d.revisionHash;
  return payload;
}

/**
 * Phản hồi → test Health. Biến của lần chạy đi vào `vars` (Health điền vào prompt mẫu, giống app);
 * input để trống (app chạy với câu kích hoạt cố định). Tiêu chí = góp ý của người dùng + tiêu chí mặc định.
 */
export function feedbackToTest(fb: AppFeedback, defaultCriteria: string[] = [], id?: string): HealthTest {
  const criteria = [...(fb.comment ? [fb.comment] : []), ...defaultCriteria]
    .map((c) => c.trim())
    .filter(Boolean);
  return {
    id: id || `t_fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    input: '',
    criteria: [...new Set(criteria)],
    vars: { ...fb.inputs },
  };
}

/** Phản hồi thuộc bản nào của suite: 'head' | 'old' | 'unknown'. */
export function feedbackRevisionLabel(fb: AppFeedback, suite: HealthSuite): 'head' | 'old' | 'unknown' {
  if (!fb.revisionHash) return 'unknown';
  const revs = suite.revisions || [];
  const match = revs.find((r) => r.hash === fb.revisionHash);
  if (!match) return 'unknown';
  return match.id === suite.headRevisionId ? 'head' : 'old';
}
