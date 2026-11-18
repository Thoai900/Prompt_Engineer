import { describe, it, expect } from 'vitest';
import { NAV_GROUPS, groupOfTab, targetTabForGroup } from '../utils/navGroups';
import type { TabType } from '../types';

const ALL_TABS: TabType[] = ['studio', 'home', 'builder', 'projectchain', 'rulesskills', 'utilitybelt', 'library', 'enhancer', 'learn', 'lab', 'aifuture'];

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
    expect(groupOfTab('utilitybelt')?.id).toBe('library');
    expect(groupOfTab('enhancer')?.id).toBe('experiment');
    expect(groupOfTab('aifuture')?.id).toBe('learn');
  });

  it('targetTabForGroup: mở tab gần nhất trong nhóm, nếu chưa có thì tab đầu', () => {
    expect(targetTabForGroup('create', {})).toBe('studio');
    expect(targetTabForGroup('create', { create: 'projectchain' })).toBe('projectchain');
  });

  it('targetTabForGroup bỏ qua tab ghi nhớ không thuộc nhóm', () => {
    expect(targetTabForGroup('library', { library: 'lab' })).toBe('library');
  });
});
