import { AiRule, AiSkill } from '../types';
import { toIso } from './projectDoc';

// Chuyển đổi THUẦN giữa AiRule/AiSkill (client) và document Firestore `rules/{id}`,
// `skills/{id}`. userId/updatedAt/authorName do collectionStore gắn khi ghi.

export function ruleFromDoc(id: string, data: any): AiRule {
  return {
    id,
    title: data.title,
    description: data.description || '',
    content: data.content || '',
    type: data.type === 'markdown-guide' ? 'markdown-guide' : 'system-rules',
    tags: data.tags || [],
    source: data.source || undefined,
    updatedAt: toIso(data.updatedAt),
  };
}

export function ruleToDoc(rule: AiRule): Record<string, unknown> {
  return {
    title: rule.title,
    description: rule.description || '',
    content: rule.content || '',
    type: rule.type || 'system-rules',
    tags: rule.tags || [],
    source: rule.source ?? null,
  };
}

export function skillFromDoc(id: string, data: any): AiSkill {
  return {
    id,
    title: data.title,
    description: data.description || '',
    kind: data.kind === 'document' ? 'document' : 'structured',
    inputs: data.inputs || [],
    steps: data.steps || [],
    instructions: data.instructions || '',
    source: data.source || undefined,
    updatedAt: toIso(data.updatedAt),
  };
}

export function skillToDoc(skill: AiSkill): Record<string, unknown> {
  return {
    title: skill.title,
    description: skill.description || '',
    kind: skill.kind ?? 'structured',
    inputs: skill.inputs || [],
    steps: skill.steps || [],
    instructions: skill.instructions || '',
    source: skill.source ?? null,
  };
}

/** Mục cục bộ (khách) chưa có trên cloud — cần đẩy lên khi đăng nhập. Bản cloud luôn thắng. */
export function pickMissingFromCloud<T extends { id: string; isPreset?: boolean }>(local: T[], cloudIds: Set<string>): T[] {
  return local.filter((x) => !x.isPreset && !cloudIds.has(x.id));
}

/** Thêm mới hoặc thay thế theo id (giữ vị trí cũ). */
export function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const next = list.slice();
  next[i] = item;
  return next;
}
