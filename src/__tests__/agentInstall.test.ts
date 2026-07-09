import { describe, it, expect } from 'vitest';
import { buildInstallCommands, slugifySkill } from '../utils/agentInstall';
import { CatalogEntry } from '../data/skillCatalog';

const skill: CatalogEntry = {
  id: 'x', category: 'skill', format: 'skill-md', title: 'PDF Toolkit', description: 'd', tags: [],
  collection: 'c', repo: 'anthropics/skills', path: 'skills/pdf/SKILL.md',
  rawUrl: 'https://raw.githubusercontent.com/anthropics/skills/main/skills/pdf/SKILL.md',
  htmlUrl: 'https://github.com/anthropics/skills/blob/main/skills/pdf/SKILL.md',
};

describe('slugifySkill', () => {
  it('kebab-case an toàn, rỗng → "skill"', () => {
    expect(slugifySkill('Weird / Name!!')).toBe('weird-name');
    expect(slugifySkill('   ')).toBe('skill');
  });
});

describe('buildInstallCommands', () => {
  it('entry không phải skill → []', () => {
    expect(buildInstallCommands({ ...skill, category: 'rule' })).toEqual([]);
  });

  it('lệnh Claude Code (user) chứa slug + rawUrl + SKILL.md', () => {
    const cc = buildInstallCommands(skill).find(c => c.agent.toLowerCase().includes('claude code (user'));
    expect(cc).toBeTruthy();
    expect(cc!.command).toContain('~/.claude/skills/pdf-toolkit');
    expect(cc!.command).toContain(skill.rawUrl);
    expect(cc!.command).toContain('SKILL.md');
  });

  it('skill trong thư mục con → có lệnh degit tải cả folder', () => {
    const degit = buildInstallCommands(skill).find(c => c.command.includes('degit'));
    expect(degit).toBeTruthy();
    expect(degit!.command).toContain('anthropics/skills/skills/pdf');
  });

  it('SKILL.md ở gốc repo → KHÔNG có lệnh degit folder', () => {
    const rootSkill = { ...skill, path: 'SKILL.md' };
    expect(buildInstallCommands(rootSkill).some(c => c.command.includes('degit'))).toBe(false);
  });

  it('có mục Antigravity (native, kèm note xác nhận)', () => {
    const agy = buildInstallCommands(skill).find(c => c.agent === 'Antigravity');
    expect(agy).toBeTruthy();
    expect(agy!.kind).toBe('native');
    expect(agy!.note).toBeTruthy();
  });
});
