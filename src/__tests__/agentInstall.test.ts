import { describe, it, expect } from 'vitest';
import { buildInstallCommands, slugifySkill, buildRepoCommands, repoFolderName } from '../utils/agentInstall';
import { CatalogEntry } from '../data/skillCatalog';
import { RepoHit } from '../utils/repoInference';

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

const repo: RepoHit = {
  fullName: 'anthropics/skills',
  description: 'Agent skills',
  stars: 1234,
  htmlUrl: 'https://github.com/anthropics/skills',
  defaultBranch: 'main',
  license: 'MIT',
};

describe('repoFolderName', () => {
  it('lấy phần sau "/" và làm sạch', () => {
    expect(repoFolderName('anthropics/skills')).toBe('skills');
    expect(repoFolderName('owner/My.Cool_Repo')).toBe('My.Cool_Repo');
    expect(repoFolderName('owner/weird name!!')).toBe('weird-name');
  });
});

describe('buildRepoCommands', () => {
  it('universal có git clone URL .git + degit owner/repo', () => {
    const { universal } = buildRepoCommands(repo);
    const clone = universal.find(u => u.command.startsWith('git clone'));
    const degit = universal.find(u => u.command.includes('degit'));
    expect(clone!.command).toBe('git clone https://github.com/anthropics/skills.git');
    expect(degit!.command).toBe('npx degit anthropics/skills skills');
  });

  it('agents: Claude Code clone vào ~/.claude/skills + prompt nêu repo & kích hoạt', () => {
    const { agents } = buildRepoCommands(repo);
    const cc = agents.find(a => a.agent === 'Claude Code');
    expect(cc!.command).toContain('git clone https://github.com/anthropics/skills.git ~/.claude/skills/skills');
    expect(cc!.prompt).toContain('anthropics/skills');
    expect(cc!.prompt.toLowerCase()).toContain('kích hoạt');
  });

  it('agents: Codex có note xác nhận đường dẫn; Antigravity dùng agy plugin install', () => {
    const { agents } = buildRepoCommands(repo);
    const codex = agents.find(a => a.agent === 'Codex');
    const agy = agents.find(a => a.agent === 'Antigravity');
    expect(codex!.note).toBeTruthy();
    expect(agy!.command).toBe('agy plugin install anthropics/skills');
    expect(agy!.prompt).toContain('anthropics/skills');
  });
});
