import { normalizeVietnamese } from '../services/algorithmEngine';
import { AiRule, AiSkill, CustomProfile, PromptProject, PromptTemplate, TabType } from '../types';

// Tìm kiếm toàn cục cho CommandPalette (H4) và ô tìm của tab Thư viện: gom template /
// project chain / rule / skill / LLM config về một danh sách phẳng rồi lọc không phân biệt dấu tiếng Việt.
// Tách THUẦN (không React) để unit-test được.

export type SearchKind = 'template' | 'project' | 'rule' | 'skill' | 'config';

export interface SearchEntry {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle?: string;
  /** Tab đích khi chọn mục này. */
  tab: TabType;
  /** id gốc của mục (không tiền tố) — để mở đúng mục trong tab đích. */
  itemId: string;
  /** Nhãn ngành (preset theo ngành) — lọc trong Thư viện. */
  domain?: string;
  /** Từ khoá phụ: tag, tác giả. */
  keywords?: string;
  /** Riêng template: payload đầy đủ để mở thẳng trong Builder. */
  template?: PromptTemplate;
}

export const KIND_LABELS: Record<SearchKind, string> = {
  template: 'Template',
  project: 'Chain',
  rule: 'Rule',
  skill: 'Skill',
  config: 'LLM Config',
};

export interface SearchSources {
  templates?: PromptTemplate[];
  projects?: Pick<PromptProject, 'id' | 'name' | 'description'>[];
  rules?: Pick<AiRule, 'id' | 'title' | 'description' | 'domain'>[];
  skills?: Pick<AiSkill, 'id' | 'title' | 'description' | 'domain'>[];
  configs?: Pick<CustomProfile, 'id' | 'name' | 'domain' | 'role'>[];
}

export function buildSearchEntries(sources: SearchSources): SearchEntry[] {
  const entries: SearchEntry[] = [];
  for (const t of sources.templates || []) {
    const keywords = [...(t.tags || []), t.authorName || ''].join(' ');
    entries.push({ id: `template-${t.id}`, itemId: t.id, kind: 'template', title: t.title, subtitle: t.description, tab: 'builder', template: t, keywords });
  }
  for (const p of sources.projects || []) {
    entries.push({ id: `project-${p.id}`, itemId: p.id, kind: 'project', title: p.name, subtitle: p.description, tab: 'projectchain' });
  }
  for (const r of sources.rules || []) {
    entries.push({ id: `rule-${r.id}`, itemId: r.id, kind: 'rule', title: r.title, subtitle: r.description, tab: 'library', domain: r.domain });
  }
  for (const s of sources.skills || []) {
    entries.push({ id: `skill-${s.id}`, itemId: s.id, kind: 'skill', title: s.title, subtitle: s.description, tab: 'library', domain: s.domain });
  }
  for (const c of sources.configs || []) {
    entries.push({ id: `config-${c.id}`, itemId: c.id, kind: 'config', title: c.name, subtitle: (c.role || '').slice(0, 140), tab: 'library', domain: c.domain });
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
    else if (entry.keywords && normalizeVietnamese(entry.keywords).includes(q)) score = 0;
    if (score >= 0) scored.push({ entry, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.entry);
}
