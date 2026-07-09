import { AiSkill, AiRule, CustomProfile, ContentSource } from '../types';
import { CatalogEntry } from '../data/skillCatalog';

const ALLOWED_HOSTS = ['raw.githubusercontent.com', 'github.com', 'api.github.com'];

/** Chỉ cho phép URL https tới host GitHub công khai (chống SSRF phía client trước khi gọi proxy). */
export function isAllowedGithubRawUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && ALLOWED_HOSTS.includes(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export interface Frontmatter { data: Record<string, string>; body: string; }

/** Parser YAML-frontmatter tối giản: chỉ cặp key: value phẳng của SKILL.md. */
export function parseFrontmatter(md: string): Frontmatter {
  const m = md.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: md };
  const data: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) data[key] = val;
  }
  return { data, body: m[2] };
}

function makeSource(entry: CatalogEntry): ContentSource {
  return {
    origin: 'github',
    repo: entry.repo,
    path: entry.path,
    htmlUrl: entry.htmlUrl,
    license: entry.license,
    author: entry.author,
    importedAt: new Date().toISOString(),
  };
}

export function entryToSkill(entry: CatalogEntry, rawText: string): AiSkill {
  const { data, body } = parseFrontmatter(rawText);
  return {
    id: `skill-gh-${entry.id}-${Date.now()}`,
    title: data.name || data.title || entry.title,
    description: (data.description || entry.description).slice(0, 2000),
    kind: 'document',
    inputs: [],
    steps: [],
    instructions: body,
    source: makeSource(entry),
    updatedAt: new Date().toISOString(),
  };
}

export function entryToRule(entry: CatalogEntry, rawText: string): AiRule {
  return {
    id: `rule-gh-${entry.id}-${Date.now()}`,
    title: entry.title,
    description: entry.description,
    content: rawText,
    type: entry.category === 'guide' ? 'markdown-guide' : 'system-rules',
    tags: entry.tags,
    source: makeSource(entry),
    updatedAt: new Date().toISOString(),
  };
}

export function entryToProfile(entry: CatalogEntry, rawText: string): CustomProfile {
  const { data, body } = parseFrontmatter(rawText);
  return {
    id: `profile-gh-${entry.id}-${Date.now()}`,
    name: data.name || data.title || entry.title,
    role: body.trim(),
    context: '',
    constraints: '',
    outputFormat: '',
    source: makeSource(entry),
  };
}

export type ImportTarget = 'skill' | 'rule' | 'config';
export interface RoutedImport {
  target: ImportTarget;
  skill?: AiSkill;
  rule?: AiRule;
  profile?: CustomProfile;
}

/** Chọn kho đích + dựng payload theo category của entry. */
export function routeImport(entry: CatalogEntry, rawText: string): RoutedImport {
  switch (entry.category) {
    case 'skill':  return { target: 'skill',  skill: entryToSkill(entry, rawText) };
    case 'config': return { target: 'config', profile: entryToProfile(entry, rawText) };
    case 'rule':
    case 'guide':
    default:       return { target: 'rule',   rule: entryToRule(entry, rawText) };
  }
}

/**
 * Dùng file repo làm NỀN cho LLM Config: nội dung đổ vào ô `context` (bối cảnh dự án),
 * khác `entryToProfile` (đổ vào `role`). Phục vụ luồng "trích repo làm nền config".
 */
export function entryToProfileContext(entry: CatalogEntry, rawText: string): CustomProfile {
  const { data, body } = parseFrontmatter(rawText);
  return {
    id: `profile-gh-${entry.id}-${Date.now()}`,
    name: data.name || data.title || entry.title,
    role: '',
    context: (body || rawText).trim(),
    constraints: '',
    outputFormat: '',
    source: makeSource(entry),
  };
}

/** Như routeImport nhưng ÉP target do người dùng chọn (config → dùng context làm nền). */
export function routeImportAs(entry: CatalogEntry, rawText: string, target: ImportTarget): RoutedImport {
  if (target === 'skill') return { target: 'skill', skill: entryToSkill(entry, rawText) };
  if (target === 'config') return { target: 'config', profile: entryToProfileContext(entry, rawText) };
  return { target: 'rule', rule: entryToRule(entry, rawText) };
}
