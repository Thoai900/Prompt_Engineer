import { describe, it, expect } from 'vitest';
import { inferEntryFromPath, RepoHit } from '../utils/repoInference';

const repo: RepoHit = {
  fullName: 'owner/repo',
  description: 'A repo',
  stars: 100,
  htmlUrl: 'https://github.com/owner/repo',
  defaultBranch: 'main',
  license: 'MIT',
};

describe('inferEntryFromPath', () => {
  it('SKILL.md → skill/skill-md, rawUrl+htmlUrl đúng, title = thư mục cha', () => {
    const e = inferEntryFromPath(repo, 'skills/pdf/SKILL.md');
    expect(e).not.toBeNull();
    expect(e!.category).toBe('skill');
    expect(e!.format).toBe('skill-md');
    expect(e!.rawUrl).toBe('https://raw.githubusercontent.com/owner/repo/main/skills/pdf/SKILL.md');
    expect(e!.htmlUrl).toBe('https://github.com/owner/repo/blob/main/skills/pdf/SKILL.md');
    expect(e!.repo).toBe('owner/repo');
    expect(e!.license).toBe('MIT');
    expect(e!.author).toBe('owner');
    expect(e!.title).toBe('pdf');
  });

  it('.cursorrules và *.mdc → rule/cursorrules', () => {
    expect(inferEntryFromPath(repo, '.cursorrules')!.format).toBe('cursorrules');
    expect(inferEntryFromPath(repo, '.cursorrules')!.category).toBe('rule');
    expect(inferEntryFromPath(repo, '.cursor/rules/react.mdc')!.format).toBe('cursorrules');
  });

  it('AGENTS.md / CLAUDE.md → rule/markdown', () => {
    expect(inferEntryFromPath(repo, 'AGENTS.md')!.category).toBe('rule');
    expect(inferEntryFromPath(repo, 'AGENTS.md')!.format).toBe('markdown');
    expect(inferEntryFromPath(repo, 'CLAUDE.md')!.category).toBe('rule');
  });

  it('README và .md trong docs/prompts → guide', () => {
    expect(inferEntryFromPath(repo, 'README.md')!.category).toBe('guide');
    expect(inferEntryFromPath(repo, 'docs/prompting.md')!.category).toBe('guide');
    expect(inferEntryFromPath(repo, 'prompts/socratic.md')!.category).toBe('guide');
  });

  it('file lạ hoặc .md thường không thuộc docs/prompt → null', () => {
    expect(inferEntryFromPath(repo, 'src/index.ts')).toBeNull();
    expect(inferEntryFromPath(repo, 'logo.png')).toBeNull();
    expect(inferEntryFromPath(repo, 'CHANGELOG.md')).toBeNull();
  });

  it('id an toàn (chỉ [a-z0-9._-])', () => {
    const e = inferEntryFromPath(repo, 'skills/pdf/SKILL.md');
    expect(e!.id).toMatch(/^[a-z0-9._-]+$/);
  });
});
