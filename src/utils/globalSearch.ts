import { normalizeVietnamese } from '../services/algorithmEngine';
import { AiRule, AiSkill, PromptProject, PromptTemplate, TabType } from '../types';

// Tìm kiếm toàn cục cho CommandPalette (H4): gom template / project chain / rule /
// skill về một danh sách phẳng rồi lọc không phân biệt dấu tiếng Việt.
// Tách THUẦN (không React) để unit-test được.

export type SearchKind = 'template' | 'project' | 'rule' | 'skill';

export interface SearchEntry {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle?: string;
  /** Tab đích khi chọn mục này. */
  tab: TabType;
  /** Riêng template: payload đầy đủ để mở thẳng trong Builder. */
  template?: PromptTemplate;
}

export const KIND_LABELS: Record<SearchKind, string> = {
  template: 'Template',
  project: 'Chain',
  rule: 'Rule',
  skill: 'Skill',
};

export interface SearchSources {
  templates?: PromptTemplate[];
  projects?: Pick<PromptProject, 'id' | 'name' | 'description'>[];
  rules?: Pick<AiRule, 'id' | 'title' | 'description'>[];
  skills?: Pick<AiSkill, 'id' | 'title' | 'description'>[];
}

export function buildSearchEntries(sources: SearchSources): SearchEntry[] {
  const entries: SearchEntry[] = [];
  for (const t of sources.templates || []) {
    entries.push({ id: `template-${t.id}`, kind: 'template', title: t.title, subtitle: t.description, tab: 'builder', template: t });
  }
  for (const p of sources.projects || []) {
    entries.push({ id: `project-${p.id}`, kind: 'project', title: p.name, subtitle: p.description, tab: 'projectchain' });
  }
  for (const r of sources.rules || []) {
    entries.push({ id: `rule-${r.id}`, kind: 'rule', title: r.title, subtitle: r.description, tab: 'rulesskills' });
  }
  for (const s of sources.skills || []) {
    entries.push({ id: `skill-${s.id}`, kind: 'skill', title: s.title, subtitle: s.description, tab: 'rulesskills' });
  }
  return entries;
}

/**
 * Lọc + xếp hạng: khớp tiêu đề đứng trước khớp mô tả; trong cùng nhóm thì
 * "bắt đầu bằng" đứng trước "chứa". So khớp bỏ dấu (vd "toi uu" khớp "Tối ưu").
 */
export function filterSearchEntries(entries: SearchEntry[], query: string, limit = 10): SearchEntry[] {
  const q = normalizeVietnamese(query);
  if (!q) return [];

  const scored: { entry: SearchEntry; score: number }[] = [];
  for (const entry of entries) {
    const title = normalizeVietnamese(entry.title || '');
    const subtitle = normalizeVietnamese(entry.subtitle || '');
    let score = -1;
    if (title.startsWith(q)) score = 3;
    else if (title.includes(q)) score = 2;
    else if (subtitle.includes(q)) score = 1;
    if (score >= 0) scored.push({ entry, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.entry);
}
