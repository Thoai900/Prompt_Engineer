import { describe, it, expect } from 'vitest';
import { SKILL_CATALOG, CATALOG_COLLECTIONS } from '../data/skillCatalog';

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
