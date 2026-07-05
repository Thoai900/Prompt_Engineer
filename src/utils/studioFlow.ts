/**
 * Prompt Studio — lớp logic THUẦN (không React, không gọi mạng) để unit-test được.
 * Spec: docs/superpowers/specs/2026-07-05-prompt-studio-design.md
 *
 * Trách nhiệm: máy trạng thái 5 bước, lắp ráp prompt cuối từ draft
 * (blocks + skills + rules + persona), heuristic gợi ý Rules/Skills,
 * serialize/parse draft (localStorage).
 */
import type { AiPersona, AiRule, AiSkill, BlockType, PromptBlock, PromptTemplate } from '../types';
// Type-only import: bị xoá khi compile nên KHÔNG kéo aiService (nặng) vào bundle test.
import type { LintIssue } from '../services/aiService';

// ── Máy trạng thái bước ──────────────────────────────────────────────────────

export type StudioStepKey = 'idea' | 'draft' | 'enhance' | 'check' | 'finish';

export interface StudioStepMeta {
  key: StudioStepKey;
  title: string;
  subtitle: string;
}

export const STUDIO_STEPS: StudioStepMeta[] = [
  { key: 'idea', title: 'Ý tưởng', subtitle: 'Mô tả điều bạn muốn AI làm' },
  { key: 'draft', title: 'Bản nháp', subtitle: 'AI dựng khung prompt nhiều khối' },
  { key: 'enhance', title: 'Tăng cường', subtitle: 'Gắn Rules & Skills từ kho của bạn' },
  { key: 'check', title: 'Kiểm tra', subtitle: 'Lint tìm điểm yếu trước khi dùng' },
  { key: 'finish', title: 'Hoàn tất', subtitle: 'Lưu, copy hoặc tinh chỉnh sâu' },
];

export const STUDIO_CATEGORIES = [
  'Học sinh/Sinh viên',
  'Người đi làm',
  'Sáng tạo nội dung',
  'Phát triển cá nhân',
  'Lập trình viên',
];

export function clampStep(index: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(STUDIO_STEPS.length - 1, Math.round(index)));
}

export function stepIndexByKey(key: StudioStepKey): number {
  return STUDIO_STEPS.findIndex((s) => s.key === key);
}

// ── Draft ────────────────────────────────────────────────────────────────────

export const DRAFT_VERSION = 1 as const;

export interface StudioDraft {
  version: typeof DRAFT_VERSION;
  idea: string;
  category: string;
  personaId: string;
  template: PromptTemplate | null;
  selectedRuleIds: string[];
  appliedSkillIds: string[];
  /** Gợi ý đã bị người dùng "Bỏ qua" — không hiện lại. */
  dismissedRuleIds: string[];
  dismissedSkillIds: string[];
  lintIssues: LintIssue[];
  /** ISO time lần lint gần nhất; null = chưa chấm điểm (hoặc blocks đã đổi). */
  lintRanAt: string | null;
  currentStep: number;
  updatedAt: string;
}

export function createEmptyDraft(now: string = new Date().toISOString()): StudioDraft {
  return {
    version: DRAFT_VERSION,
    idea: '',
    category: '',
    personaId: '',
    template: null,
    selectedRuleIds: [],
    appliedSkillIds: [],
    dismissedRuleIds: [],
    dismissedSkillIds: [],
    lintIssues: [],
    lintRanAt: null,
    currentStep: 0,
    updatedAt: now,
  };
}

export function draftStorageKey(uid: string): string {
  return `studio_draft_${uid}`;
}

/** Thêm/bỏ một id trong danh sách (immutable). */
export function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** Bước đã "có đóng góp" chưa — dùng cho rail hiển thị tiến độ THẬT. */
export function stepDone(draft: StudioDraft, key: StudioStepKey): boolean {
  switch (key) {
    case 'idea': return draft.idea.trim().length > 0;
    case 'draft': return !!draft.template && draft.template.blocks.length > 0;
    case 'enhance': return draft.selectedRuleIds.length + draft.appliedSkillIds.length > 0;
    case 'check': return draft.lintRanAt !== null;
    case 'finish': return false;
  }
}

/** Tóm tắt vi mô hiển thị dưới mỗi bước trên rail (null = chưa có gì). */
export function stepSummary(draft: StudioDraft, key: StudioStepKey): string | null {
  switch (key) {
    case 'idea':
      return draft.idea.trim() ? (draft.category || 'Đã nhập ý tưởng') : null;
    case 'draft':
      return draft.template ? `${draft.template.blocks.length} khối` : null;
    case 'enhance': {
      const r = draft.selectedRuleIds.length;
      const s = draft.appliedSkillIds.length;
      if (r + s === 0) return null;
      const parts = [] as string[];
      if (r) parts.push(`${r} quy tắc`);
      if (s) parts.push(`${s} kỹ năng`);
      return parts.join(' · ');
    }
    case 'check':
      return draft.lintRanAt ? `${draft.lintIssues.length} vấn đề` : null;
    case 'finish':
      return null;
  }
}

// ── Lắp ráp prompt cuối ──────────────────────────────────────────────────────

const ENHANCE_BLOCK_TYPES: BlockType[] = ['role', 'task', 'context', 'format', 'tone', 'constraints', 'example'];

/** Ép type của block do AI trả về vào union BlockType hợp lệ. */
export function normalizeBlockType(type: unknown): BlockType {
  return ENHANCE_BLOCK_TYPES.includes(type as BlockType) ? (type as BlockType) : 'custom';
}

/**
 * Bake các Rules/Skills đã chọn vào template thành block thật — dùng khi
 * Lưu vào Library hoặc Mở trong Builder (template phải tự chứa, không phụ
 * thuộc state của Studio). Persona KHÔNG bake (là system instruction runtime).
 * Thứ tự: blocks gốc → skills (năng lực) → rules (rào chắn đặt cuối).
 */
export function draftToTemplate(
  draft: StudioDraft,
  allRules: AiRule[],
  allSkills: AiSkill[],
): PromptTemplate | null {
  if (!draft.template) return null;
  const skillBlocks: PromptBlock[] = draft.appliedSkillIds
    .map((id) => allSkills.find((s) => s.id === id))
    .filter((s): s is AiSkill => !!s)
    .map((s) => ({ id: `studio-skill-${s.id}`, type: 'custom', title: `🧰 Kỹ năng: ${s.title}`, content: s.instructions }));
  const ruleBlocks: PromptBlock[] = draft.selectedRuleIds
    .map((id) => allRules.find((r) => r.id === id))
    .filter((r): r is AiRule => !!r)
    .map((r) => ({ id: `studio-rule-${r.id}`, type: 'constraints', title: `📏 Quy tắc: ${r.title}`, content: r.content }));
  return { ...draft.template, blocks: [...draft.template.blocks, ...skillBlocks, ...ruleBlocks] };
}

/**
 * Văn bản prompt cuối cùng. Cùng định dạng "## title\ncontent" mà HomeTab dùng
 * khi copy. Persona (nếu có) đứng đầu vì là danh tính của AI thực thi.
 */
export function assembleStudioPrompt(
  draft: StudioDraft,
  allRules: AiRule[],
  allSkills: AiSkill[],
  persona: AiPersona | null,
): string {
  const merged = draftToTemplate(draft, allRules, allSkills);
  if (!merged) return '';
  const parts: string[] = [];
  if (persona?.systemInstructions?.trim()) {
    parts.push(persona.systemInstructions.trim());
  }
  for (const b of merged.blocks) {
    if (!b.content?.trim()) continue;
    parts.push(`## ${b.title}\n${b.content.trim()}`);
  }
  return parts.join('\n\n');
}

/** Input cho enhancePromptWithAi khi người dùng bấm "Đề xuất bản sửa bằng AI". */
export function buildFixRequest(promptText: string, issues: LintIssue[]): string {
  const list = issues
    .map((i) => `- (${i.severity}) ${i.message}${i.suggestion ? ` → Gợi ý: ${i.suggestion}` : ''}`)
    .join('\n');
  return `${promptText}\n\n[YÊU CẦU SỬA]\nHãy giữ nguyên ý định gốc và khắc phục triệt để các vấn đề sau:\n${list}`;
}

// ── Heuristic gợi ý Rules/Skills ─────────────────────────────────────────────

// Gồm cả các động từ/danh từ quá phổ dụng trong ngữ cảnh prompt (viết, làm,
// tạo, kỹ năng...) — trùng chúng không nói lên liên quan chủ đề.
const VI_STOPWORDS = new Set([
  'cho', 'cua', 'va', 'voi', 'mot', 'cac', 'nhung', 'bang', 'trong', 'khong',
  'duoc', 'nguoi', 'dung', 'khi', 'nay', 'the', 'and', 'for', 'with',
  'viet', 'lam', 'tao', 'giup', 'hay', 'can', 'muon', 'nen', 'biet',
  'nang', 'noi', 'dang', 'theo', 'nhat', 'nhieu', 'hon', 'chuyen', 'gia',
]);

/** Tách từ khoá: thường hoá + bỏ dấu tiếng Việt để so khớp bền vững. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !VI_STOPWORDS.has(w));
}

export interface ScoredSuggestion<T> {
  item: T;
  /** Từ khoá trùng khớp — hiển thị làm LÝ DO gợi ý (minh bạch, không bịa). */
  matched: string[];
}

function scoreAgainst(queryTokens: Set<string>, haystack: string): string[] {
  const hayTokens = new Set(tokenize(haystack));
  return [...queryTokens].filter((t) => hayTokens.has(t));
}

function draftQueryText(draft: StudioDraft): string {
  const t = draft.template;
  return [draft.idea, draft.category, t?.title, t?.description, t?.category, ...(t?.tags || [])]
    .filter(Boolean)
    .join(' ');
}

export function suggestRules(draft: StudioDraft, rules: AiRule[], max = 4): ScoredSuggestion<AiRule>[] {
  const query = new Set(tokenize(draftQueryText(draft)));
  if (query.size === 0) return [];
  const excluded = new Set([...draft.selectedRuleIds, ...draft.dismissedRuleIds]);
  return rules
    .filter((r) => !excluded.has(r.id))
    .map((r) => ({ item: r, matched: scoreAgainst(query, `${r.title} ${r.description} ${r.tags.join(' ')}`) }))
    .filter((s) => s.matched.length > 0)
    .sort((a, b) => b.matched.length - a.matched.length || a.item.title.localeCompare(b.item.title))
    .slice(0, max);
}

export function suggestSkills(draft: StudioDraft, skills: AiSkill[], max = 3): ScoredSuggestion<AiSkill>[] {
  const query = new Set(tokenize(draftQueryText(draft)));
  if (query.size === 0) return [];
  const excluded = new Set([...draft.appliedSkillIds, ...draft.dismissedSkillIds]);
  return skills
    .filter((s) => !excluded.has(s.id))
    .map((s) => ({ item: s, matched: scoreAgainst(query, `${s.title} ${s.description}`) }))
    .filter((s) => s.matched.length > 0)
    .sort((a, b) => b.matched.length - a.matched.length || a.item.title.localeCompare(b.item.title))
    .slice(0, max);
}

// ── Serialize / parse (localStorage) ─────────────────────────────────────────

export function serializeDraft(draft: StudioDraft): string {
  return JSON.stringify(draft);
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Parse + validate draft từ localStorage. Hỏng cấu trúc → null (bắt đầu mới). */
export function parseDraft(raw: string | null): StudioDraft | null {
  if (!raw) return null;
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || data.version !== DRAFT_VERSION) return null;
  if (typeof data.idea !== 'string') return null;
  const template = data.template && typeof data.template === 'object' && Array.isArray(data.template.blocks)
    ? (data.template as PromptTemplate)
    : null;
  const lintIssues: LintIssue[] = Array.isArray(data.lintIssues)
    ? data.lintIssues
        .filter((i: any) => i && typeof i.message === 'string')
        .map((i: any) => ({
          severity: ['high', 'medium', 'low'].includes(i.severity) ? i.severity : 'medium',
          category: typeof i.category === 'string' ? i.category : 'khác',
          message: String(i.message),
          suggestion: typeof i.suggestion === 'string' ? i.suggestion : '',
        }))
    : [];
  return {
    version: DRAFT_VERSION,
    idea: data.idea,
    category: typeof data.category === 'string' ? data.category : '',
    personaId: typeof data.personaId === 'string' ? data.personaId : '',
    template,
    selectedRuleIds: asStringArray(data.selectedRuleIds),
    appliedSkillIds: asStringArray(data.appliedSkillIds),
    dismissedRuleIds: asStringArray(data.dismissedRuleIds),
    dismissedSkillIds: asStringArray(data.dismissedSkillIds),
    lintIssues,
    lintRanAt: typeof data.lintRanAt === 'string' ? data.lintRanAt : null,
    currentStep: clampStep(typeof data.currentStep === 'number' ? data.currentStep : 0),
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
  };
}
