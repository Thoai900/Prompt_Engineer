import type { TabType } from '../types';

/**
 * Nhóm điều hướng: gom các tab theo VIỆC người dùng đang làm. Dùng chung cho sidebar
 * desktop (tiêu đề nhóm) và thanh tab đáy trên mobile (mỗi nhóm một nút).
 * 'home' (landing page) đứng riêng, không thuộc nhóm nào.
 */
export type NavGroupId = 'create' | 'library' | 'experiment' | 'learn';

export interface NavGroup {
  id: NavGroupId;
  label: string;
  tabs: TabType[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  { id: 'create', label: 'Tạo', tabs: ['studio', 'builder', 'projectchain'] },
  { id: 'library', label: 'Thư viện', tabs: ['library', 'rulesskills', 'utilitybelt'] },
  { id: 'experiment', label: 'Thử nghiệm', tabs: ['lab'] },
  { id: 'learn', label: 'Học', tabs: ['learn'] },
];

/** Nhóm chứa tab; null với 'home'. */
export function groupOfTab(tab: TabType): NavGroup | null {
  return NAV_GROUPS.find((g) => g.tabs.includes(tab)) ?? null;
}

/**
 * Tab mở ra khi bấm một nhóm: tab dùng gần nhất trong nhóm (nếu còn thuộc nhóm),
 * ngược lại là tab đầu tiên của nhóm.
 */
export function targetTabForGroup(
  groupId: NavGroupId,
  lastTabByGroup: Partial<Record<NavGroupId, TabType>>,
): TabType {
  const group = NAV_GROUPS.find((g) => g.id === groupId)!;
  const last = lastTabByGroup[groupId];
  return last && group.tabs.includes(last) ? last : group.tabs[0];
}

/**
 * Tab đã gỡ → nơi thay thế, để link/bookmark cũ không hỏng.
 * `params` là query-param tab đích đọc khi mount (vd. Studio mở chế độ nhanh).
 */
const LEGACY_TABS: Record<string, { tab: TabType; params?: Record<string, string> }> = {
  enhancer: { tab: 'studio', params: { studio: 'quick' } },
  aifuture: { tab: 'learn', params: { learn: 'news' } },
};

export function resolveLegacyTab(raw: string, search = ''): { tab: TabType; params?: Record<string, string> } | null {
  // Link chia sẻ app cũ (?app=<id>#lab) — Chain → App đã chuyển từ Lab sang Project Chain.
  if (raw === 'lab' && new URLSearchParams(search).has('app')) return { tab: 'projectchain' };
  return Object.prototype.hasOwnProperty.call(LEGACY_TABS, raw) ? LEGACY_TABS[raw] : null;
}
