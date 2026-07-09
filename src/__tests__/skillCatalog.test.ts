import { describe, it, expect } from 'vitest';
import { SKILL_CATALOG, CATALOG_COLLECTIONS } from '../data/skillCatalog';
import {
  isAllowedGithubRawUrl, parseFrontmatter, entryToSkill, entryToRule, entryToProfile, routeImport,
} from '../utils/skillCatalog';
import type { CatalogEntry } from '../data/skillCatalog';

describe('SKILL_CATALOG integrity', () => {
  it('id là duy nhất', () => {
    const ids = SKILL_CATALOG.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('mọi entry có trường bắt buộc + category/format hợp lệ', () => {
    const cats = new Set(['skill', 'rule', 'config', 'guide']);
    const fmts = new Set(['skill-md', 'cursorrules', 'markdown', 'system-prompt']);
    for (const e of SKILL_CATALOG) {
      expect(cats.has(e.category), `${e.id}.category`).toBe(true);
      expect(fmts.has(e.format), `${e.id}.format`).toBe(true);
      expect(e.title.trim(), `${e.id}.title`).not.toBe('');
      expect(e.description.trim(), `${e.id}.description`).not.toBe('');
      expect(Array.isArray(e.tags), `${e.id}.tags`).toBe(true);
    }
  });

  it('rawUrl là https tới host GitHub công khai', () => {
    const hosts = new Set(['raw.githubusercontent.com', 'github.com', 'api.github.com']);
    for (const e of SKILL_CATALOG) {
      const u = new URL(e.rawUrl);
      expect(u.protocol, `${e.id}`).toBe('https:');
      expect(hosts.has(u.hostname), `${e.id} host`).toBe(true);
    }
  });

  it('collection của mỗi entry tồn tại trong CATALOG_COLLECTIONS', () => {
    const known = new Set(CATALOG_COLLECTIONS.map(c => c.id));
    for (const e of SKILL_CATALOG) {
      expect(known.has(e.collection), `${e.id}.collection=${e.collection}`).toBe(true);
    }
  });
});

const mkEntry = (over: Partial<CatalogEntry>): CatalogEntry => ({
  id: 't1', category: 'skill', format: 'skill-md', title: 'T', description: 'D', tags: ['a'],
  collection: 'agent-skills', repo: 'o/r', path: 'p/SKILL.md',
  rawUrl: 'https://raw.githubusercontent.com/o/r/main/p/SKILL.md', ...over,
});

describe('isAllowedGithubRawUrl', () => {
  it('chấp nhận raw.githubusercontent.com https', () => {
    expect(isAllowedGithubRawUrl('https://raw.githubusercontent.com/o/r/main/x.md')).toBe(true);
  });
  it('từ chối host khác / http', () => {
    expect(isAllowedGithubRawUrl('https://evil.com/x')).toBe(false);
    expect(isAllowedGithubRawUrl('http://raw.githubusercontent.com/x')).toBe(false);
    expect(isAllowedGithubRawUrl('not a url')).toBe(false);
  });
});

describe('parseFrontmatter', () => {
  it('tách frontmatter YAML phẳng + body', () => {
    const md = '---\nname: PDF\ndescription: "Xử lý PDF"\n---\n# Body\nnội dung';
    const r = parseFrontmatter(md);
    expect(r.data.name).toBe('PDF');
    expect(r.data.description).toBe('Xử lý PDF');
    expect(r.body).toContain('# Body');
  });
  it('không có frontmatter → data rỗng, body = nguyên văn', () => {
    const r = parseFrontmatter('# chỉ có tiêu đề');
    expect(r.data).toEqual({});
    expect(r.body).toBe('# chỉ có tiêu đề');
  });
  it('giá trị chứa dấu ":" vẫn giữ nguyên phần sau dấu ":" đầu', () => {
    const r = parseFrontmatter('---\ntitle: A: B: C\n---\nx');
    expect(r.data.title).toBe('A: B: C');
  });
});

describe('entryToSkill', () => {
  it('tạo skill kind=document, ưu tiên name/description từ frontmatter, gắn source', () => {
    const entry = mkEntry({ category: 'skill' });
    const skill = entryToSkill(entry, '---\nname: PDF\ndescription: Xử lý PDF\n---\nHướng dẫn dùng');
    expect(skill.kind).toBe('document');
    expect(skill.title).toBe('PDF');
    expect(skill.description).toBe('Xử lý PDF');
    expect(skill.instructions).toContain('Hướng dẫn dùng');
    expect(skill.inputs).toEqual([]);
    expect(skill.steps).toEqual([]);
    expect(skill.source?.origin).toBe('github');
    expect(skill.source?.repo).toBe('o/r');
  });
  it('không có frontmatter → dùng title/description của entry', () => {
    const entry = mkEntry({ title: 'Entry Title', description: 'Entry Desc' });
    const skill = entryToSkill(entry, 'chỉ body');
    expect(skill.title).toBe('Entry Title');
    expect(skill.description).toBe('Entry Desc');
    expect(skill.instructions).toBe('chỉ body');
  });
});

describe('entryToRule', () => {
  it('category guide → markdown-guide; rule → system-rules; giữ content + tags + source', () => {
    const guide = entryToRule(mkEntry({ category: 'guide', format: 'markdown', tags: ['g'] }), '# guide');
    expect(guide.type).toBe('markdown-guide');
    expect(guide.content).toBe('# guide');
    expect(guide.tags).toEqual(['g']);
    expect(guide.source?.origin).toBe('github');
    const rule = entryToRule(mkEntry({ category: 'rule', format: 'cursorrules' }), 'rules text');
    expect(rule.type).toBe('system-rules');
  });
});

describe('entryToProfile', () => {
  it('dồn toàn bộ nội dung vào role, tên từ frontmatter nếu có', () => {
    const p = entryToProfile(mkEntry({ category: 'config', format: 'system-prompt' }), '---\nname: Tutor\n---\nBạn là gia sư.');
    expect(p.name).toBe('Tutor');
    expect(p.role).toContain('Bạn là gia sư.');
    expect(p.context).toBe('');
    expect(p.constraints).toBe('');
    expect(p.outputFormat).toBe('');
    expect(p.source?.origin).toBe('github');
  });
});

describe('routeImport', () => {
  it('route theo category', () => {
    expect(routeImport(mkEntry({ category: 'skill' }), 'x').target).toBe('skill');
    expect(routeImport(mkEntry({ category: 'rule' }), 'x').target).toBe('rule');
    expect(routeImport(mkEntry({ category: 'guide' }), 'x').target).toBe('rule');
    expect(routeImport(mkEntry({ category: 'config' }), 'x').target).toBe('config');
  });
  it('payload đúng nhánh', () => {
    const r = routeImport(mkEntry({ category: 'skill' }), 'x');
    expect(r.skill).toBeTruthy();
    expect(r.rule).toBeUndefined();
  });
});
