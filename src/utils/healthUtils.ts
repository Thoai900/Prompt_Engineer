import type { BlockType, HealthRun, HealthSuite, HealthTest, PromptBlock } from '../types';
import type { LabSeedExtras } from '../services/labSeed';

/**
 * Hàm thuần cho vòng chất lượng Viết → Đo → Tối ưu → Lưu
 * (spec docs/superpowers/specs/2026-11-18-quality-loop-design.md).
 */

export const MAX_SUITE_TESTS = 10;
/** Ngưỡng gợi ý tối ưu: điểm trung bình dưới mức này… */
export const OPTIMIZE_AVG_THRESHOLD = 70;
/** …hoặc có ít nhất một test dưới mức này. */
export const OPTIMIZE_TEST_THRESHOLD = 60;

const genTestId = () => `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

/** Chuẩn hoá test do AI soạn: bỏ test rỗng/trùng, criteria là chuỗi không rỗng (tối đa 5), tối đa 10 test. */
export function normalizeDraftTests(raw: unknown, genId: () => string = genTestId): HealthTest[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: HealthTest[] = [];
  for (const item of raw) {
    const input = typeof item?.input === 'string' ? item.input.trim() : '';
    if (!input || seen.has(input)) continue;
    seen.add(input);
    const criteria = Array.isArray(item?.criteria)
      ? item.criteria.filter((c: unknown): c is string => typeof c === 'string' && c.trim() !== '').map((c: string) => c.trim()).slice(0, 5)
      : [];
    out.push({ id: genId(), input, criteria });
    if (out.length >= MAX_SUITE_TESTS) break;
  }
  return out;
}

/** Lần chạy có đủ yếu để gợi ý tối ưu không. */
export function needsOptimization(run: HealthRun | undefined): boolean {
  if (!run || run.results.length === 0) return false;
  return run.avgScore < OPTIMIZE_AVG_THRESHOLD || run.results.some((r) => r.score < OPTIMIZE_TEST_THRESHOLD);
}

/**
 * Seed cho Auto-Optimizer từ một lần chạy Health: các test điểm thấp nhất (tối đa 3,
 * tệ nhất trước) làm đầu vào thử, hợp nhất tiêu chí của chúng (bỏ trùng, giữ thứ tự).
 */
export function pickOptimizerSeedFromRun(suite: HealthSuite, run: HealthRun): LabSeedExtras & { prompt: string } {
  const byId = new Map(suite.testCases.map((t) => [t.id, t]));
  const worst = [...run.results]
    .filter((r) => byId.has(r.testId))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((r) => byId.get(r.testId)!);

  const criteria: string[] = [];
  for (const t of worst) for (const c of t.criteria) if (!criteria.includes(c)) criteria.push(c);

  return {
    prompt: suite.prompt,
    suiteId: suite.id,
    templateId: suite.templateId,
    templateTitle: suite.name,
    testInputs: worst.map((t) => t.input).filter((i) => i.trim() !== ''),
    criteria,
  };
}

/** Suite mới nhất gắn với template (null nếu chưa có). */
export function findSuiteForTemplate(suites: HealthSuite[], templateId: string | undefined): HealthSuite | null {
  if (!templateId) return null;
  const matches = suites.filter((s) => s.templateId === templateId);
  matches.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return matches[0] || null;
}

/** Các trường ghi lên Firestore (không gồm timestamp). Liệt kê tường minh — thêm trường mới phải thêm ở đây. */
export function suiteWriteFields(uid: string, suite: HealthSuite, maxRuns: number): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    userId: uid,
    name: suite.name,
    prompt: suite.prompt,
    model: suite.model,
    testCases: suite.testCases,
    runs: suite.runs.slice(0, maxRuns),
    cronEnabled: suite.cronEnabled === true, // H3: cờ cho Vercel Cron quét
  };
  if (suite.workspaceId) fields.workspaceId = suite.workspaceId;
  if (suite.templateId) fields.templateId = suite.templateId;
  return fields;
}

const VALID_BLOCK_TYPES: BlockType[] = ['role', 'task', 'context', 'format', 'tone', 'constraints', 'example', 'thinking', 'anchor', 'self_correction', 'input_data', 'custom', 'objective', 'audience', 'experience', 'challenge', 'steps'];

/**
 * Chuẩn hoá các khối AI chia lại từ prompt phẳng. Không có khối hợp lệ nào → một khối
 * `task` chứa nguyên văn (fallback), cờ `fellBack` để UI báo người dùng.
 */
export function normalizeSplitBlocks(raw: unknown, fallbackText: string, stamp = Date.now()): { blocks: PromptBlock[]; fellBack: boolean } {
  const blocks: PromptBlock[] = (Array.isArray(raw) ? raw : [])
    .filter((b: any) => b && typeof b.content === 'string' && b.content.trim() !== '')
    .map((b: any, i: number) => ({
      id: `opt-${stamp}-${i}`,
      type: VALID_BLOCK_TYPES.includes(b.type) ? b.type : 'custom',
      title: typeof b.title === 'string' && b.title.trim() ? b.title.trim() : 'Khối',
      content: b.content.trim(),
    }));
  if (blocks.length > 0) return { blocks, fellBack: false };
  return { blocks: [{ id: `opt-${stamp}-0`, type: 'task', title: 'Prompt', content: fallbackText.trim() }], fellBack: true };
}
