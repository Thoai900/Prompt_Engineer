import type { BlockType, HealthSuite, HealthTest, PromptBlock } from '../types';

/**
 * Hàm thuần cho phần mục 7 gộp vào Prompt Git
 * (spec docs/superpowers/specs/2026-11-18-quality-loop-design.md):
 * AI soạn test cho suite, tìm suite theo template nguồn, chia lại khối để lưu về template.
 */

export const MAX_SUITE_TESTS = 10;

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

/** Suite mới nhất có nguồn là template này (null nếu chưa có). */
export function findSuiteForTemplate(suites: HealthSuite[], templateId: string | undefined): HealthSuite | null {
  if (!templateId) return null;
  const matches = suites.filter((s) => s.source?.kind === 'template' && s.source.id === templateId);
  matches.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return matches[0] || null;
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
