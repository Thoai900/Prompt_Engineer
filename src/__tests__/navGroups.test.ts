import { describe, it, expect } from 'vitest';
import { NAV_GROUPS, groupOfTab, targetTabForGroup, resolveLegacyTab } from '../utils/navGroups';
import type { TabType } from '../types';

const ALL_TABS: TabType[] = ['studio', 'home', 'builder', 'projectchain', 'library', 'learn', 'lab'];

describe('navGroups', () => {
  it('mỗi tab (trừ home) thuộc đúng một nhóm', () => {
    for (const tab of ALL_TABS.filter((t) => t !== 'home')) {
      const owners = NAV_GROUPS.filter((g) => g.tabs.includes(tab));
      expect(owners, tab).toHaveLength(1);
    }
  });

  it('home không thuộc nhóm nào', () => {
    expect(groupOfTab('home')).toBeNull();
  });

  it('groupOfTab trả về đúng nhóm', () => {
    expect(groupOfTab('builder')?.id).toBe('create');
    expect(groupOfTab('library')?.id).toBe('library');
    expect(groupOfTab('lab')?.id).toBe('experiment');
    expect(groupOfTab('learn')?.id).toBe('learn');
  });

  it('targetTabForGroup: mở tab gần nhất trong nhóm, nếu chưa có thì tab đầu', () => {
    expect(targetTabForGroup('create', {})).toBe('studio');
    expect(targetTabForGroup('create', { create: 'projectchain' })).toBe('projectchain');
  });

  it('targetTabForGroup bỏ qua tab ghi nhớ không thuộc nhóm', () => {
    expect(targetTabForGroup('library', { library: 'lab' })).toBe('library');
  });

  it('resolveLegacyTab: chuyển hướng tab đã gỡ, bỏ qua tab hợp lệ/lạ', () => {
    expect(resolveLegacyTab('enhancer')).toEqual({ tab: 'studio', params: { studio: 'quick' } });
    expect(resolveLegacyTab('aifuture')).toEqual({ tab: 'learn', params: { learn: 'news' } });
    expect(resolveLegacyTab('builder')).toBeNull();
    expect(resolveLegacyTab('toString')).toBeNull();
    expect(resolveLegacyTab('rulesskills')).toEqual({ tab: 'library', params: { lib: 'rules' } });
    expect(resolveLegacyTab('utilitybelt')).toEqual({ tab: 'library', params: { lib: 'configs' } });
    expect(resolveLegacyTab('lab', '?app=abc')).toEqual({ tab: 'projectchain' });
    expect(resolveLegacyTab('lab', '')).toBeNull();
  });
});
