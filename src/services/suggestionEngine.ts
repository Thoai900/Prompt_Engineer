import { normalizeVietnamese } from './algorithmEngine';
import { TEMPLATES, DAILY_PACKS, BLOCK_SUGGESTIONS } from '../data';

export const MIN_NGRAM_COUNT = 2;
export const MAX_EXPAND_WORDS = 12;
export const MAX_PHRASES = 200;
export const MAX_CANDIDATES_PER_KEY = 50;
export const MAX_KEYS = 2000;

export interface SuggestionModel {
  phrases: string[];
  bigrams: Map<string, Map<string, number>>;
  trigrams: Map<string, Map<string, number>>;
  varValues: Map<string, Map<string, number>>;
}

export interface ProseContext {
  mode: 'prose';
  textBeforeCursor: string;
}

export interface VariableContext {
  mode: 'variable';
  varName: string;
  textBeforeCursor: string;
  defaultValue?: string;
  corpusValues?: string[];
}

export type SuggestContext = ProseContext | VariableContext;

export interface SerializedModel {
  phrases: string[];
  bigrams: Record<string, Record<string, number>>;
  trigrams: Record<string, Record<string, number>>;
  varValues: Record<string, Record<string, number>>;
}

// ─── Model construction ───

export function createEmptyModel(): SuggestionModel {
  return {
    phrases: [],
    bigrams: new Map(),
    trigrams: new Map(),
    varValues: new Map(),
  };
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function bump(map: Map<string, Map<string, number>>, key: string, next: string, weight: number) {
  let inner = map.get(key);
  if (!inner) {
    inner = new Map();
    map.set(key, inner);
  }
  inner.set(next, (inner.get(next) || 0) + weight);
}

export function addPhraseToModel(model: SuggestionModel, phrase: string, weight = 1): void {
  const clean = phrase.trim();
  if (!clean) return;
  if (!model.phrases.includes(clean)) model.phrases.push(clean);
  const tokens = tokenize(clean);
  for (let i = 0; i < tokens.length - 1; i++) {
    bump(model.bigrams, tokens[i], tokens[i + 1], weight);
    if (i < tokens.length - 2) {
      bump(model.trigrams, `${tokens[i]} ${tokens[i + 1]}`, tokens[i + 2], weight);
    }
  }
}

export function addVariableValue(model: SuggestionModel, varName: string, value: string, weight = 1): void {
  const key = normalizeVietnamese(varName).trim();
  const val = value.trim();
  if (!key || !val) return;
  let inner = model.varValues.get(key);
  if (!inner) {
    inner = new Map();
    model.varValues.set(key, inner);
  }
  inner.set(val, (inner.get(val) || 0) + weight);
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?\n])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

export function buildModelFromCorpus(): SuggestionModel {
  const model = createEmptyModel();
  const allTemplates = [...TEMPLATES, ...DAILY_PACKS];
  for (const t of allTemplates) {
    for (const b of t.blocks || []) {
      for (const sentence of splitSentences(b.content || '')) {
        addPhraseToModel(model, sentence, 1);
      }
    }
  }
  for (const themeMap of Object.values(BLOCK_SUGGESTIONS)) {
    for (const text of Object.values(themeMap)) {
      for (const sentence of splitSentences(text)) {
        addPhraseToModel(model, sentence, 1);
      }
    }
  }
  return model;
}

// ─── Suggestion ───

function topEntry(inner: Map<string, number> | undefined, min = 1): { word: string; count: number } | null {
  if (!inner) return null;
  let best: string | null = null;
  let bestCount = 0;
  for (const [w, c] of inner) {
    if (c > bestCount) { bestCount = c; best = w; }
  }
  if (best === null || bestCount < min) return null;
  return { word: best, count: bestCount };
}

function currentLine(text: string): string {
  const idx = text.lastIndexOf('\n');
  return idx === -1 ? text : text.slice(idx + 1);
}

function suggestProse(model: SuggestionModel, text: string): string {
  const line = currentLine(text);
  const normLine = normalizeVietnamese(line);

  // Prefix mode: complete a full corpus/history phrase from the start of the line.
  if (normLine.length >= 1) {
    let best: string | null = null;
    let bestLen = -1;
    for (const phrase of model.phrases) {
      const normPhrase = normalizeVietnamese(phrase);
      if (normPhrase.startsWith(normLine) && normPhrase.length > normLine.length) {
        if (phrase.length > bestLen) { best = phrase; bestLen = phrase.length; }
      }
    }
    if (best) return best.slice(line.length);
  }

  // N-gram mode: extend from the last 1-2 tokens.
  const tokens = tokenize(text);
  if (tokens.length === 0) return '';
  const out: string[] = [];
  let w1 = tokens[tokens.length - 2];
  let w2 = tokens[tokens.length - 1];
  for (let i = 0; i < MAX_EXPAND_WORDS; i++) {
    let next = w1 ? topEntry(model.trigrams.get(`${w1} ${w2}`), MIN_NGRAM_COUNT) : null;
    if (!next) next = topEntry(model.bigrams.get(w2), MIN_NGRAM_COUNT);
    if (!next) break;
    out.push(next.word);
    w1 = w2;
    w2 = next.word;
    if (/[.!?]$/.test(next.word)) break;
  }
  if (out.length === 0) return '';
  // Preserve a leading space only if the user has not already typed a trailing space.
  const lead = /\s$/.test(text) ? '' : ' ';
  return lead + out.join(' ');
}

function suggestVariable(model: SuggestionModel, ctx: VariableContext): string {
  const key = normalizeVietnamese(ctx.varName).trim();
  const prefix = ctx.textBeforeCursor;
  const normPrefix = normalizeVietnamese(prefix);

  const counts = new Map<string, number>();
  const seed = (value: string | undefined, weight: number) => {
    if (!value) return;
    const v = value.trim();
    if (!v) return;
    counts.set(v, (counts.get(v) || 0) + weight);
  };
  const hist = model.varValues.get(key);
  if (hist) for (const [v, c] of hist) seed(v, c);
  seed(ctx.defaultValue, 1);
  (ctx.corpusValues || []).forEach(v => seed(v, 1));

  let best: string | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (value.length <= prefix.length) continue;
    if (!normalizeVietnamese(value).startsWith(normPrefix)) continue;
    if (count > bestCount) { bestCount = count; best = value; }
  }
  return best ? best.slice(prefix.length) : '';
}

export function suggest(model: SuggestionModel, ctx: SuggestContext): string {
  if (ctx.mode === 'variable') return suggestVariable(model, ctx);
  return suggestProse(model, ctx.textBeforeCursor);
}

// ─── Merge / cap / serialize ───

function mergeNested(target: Map<string, Map<string, number>>, source: Map<string, Map<string, number>>) {
  for (const [key, inner] of source) {
    let t = target.get(key);
    if (!t) { t = new Map(); target.set(key, t); }
    for (const [w, c] of inner) t.set(w, (t.get(w) || 0) + c);
  }
}

export function mergeModel(target: SuggestionModel, source: SuggestionModel): void {
  for (const p of source.phrases) if (!target.phrases.includes(p)) target.phrases.push(p);
  mergeNested(target.bigrams, source.bigrams);
  mergeNested(target.trigrams, source.trigrams);
  mergeNested(target.varValues, source.varValues);
}

function totalCount(inner: Map<string, number>): number {
  let s = 0;
  for (const c of inner.values()) s += c;
  return s;
}

function capNested(map: Map<string, Map<string, number>>) {
  if (map.size > MAX_KEYS) {
    const keep = new Set(
      [...map.entries()]
        .sort((a, b) => totalCount(b[1]) - totalCount(a[1]))
        .slice(0, MAX_KEYS)
        .map(e => e[0])
    );
    for (const k of [...map.keys()]) if (!keep.has(k)) map.delete(k);
  }
  for (const inner of map.values()) {
    if (inner.size > MAX_CANDIDATES_PER_KEY) {
      const top = [...inner.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_CANDIDATES_PER_KEY);
      inner.clear();
      for (const [w, c] of top) inner.set(w, c);
    }
  }
}

export function capModel(model: SuggestionModel): void {
  if (model.phrases.length > MAX_PHRASES) {
    model.phrases = model.phrases.slice(model.phrases.length - MAX_PHRASES);
  }
  capNested(model.bigrams);
  capNested(model.trigrams);
  capNested(model.varValues);
}

function nestedToObj(map: Map<string, Map<string, number>>): Record<string, Record<string, number>> {
  const obj: Record<string, Record<string, number>> = {};
  for (const [k, inner] of map) {
    obj[k] = {};
    for (const [w, c] of inner) obj[k][w] = c;
  }
  return obj;
}

function objToNested(obj: Record<string, Record<string, number>> | undefined): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>();
  if (!obj) return map;
  for (const k of Object.keys(obj)) {
    const inner = new Map<string, number>();
    for (const w of Object.keys(obj[k])) inner.set(w, obj[k][w]);
    map.set(k, inner);
  }
  return map;
}

export function serializeModel(model: SuggestionModel): SerializedModel {
  return {
    phrases: [...model.phrases],
    bigrams: nestedToObj(model.bigrams),
    trigrams: nestedToObj(model.trigrams),
    varValues: nestedToObj(model.varValues),
  };
}

export function deserializeModel(data: Partial<SerializedModel> | null | undefined): SuggestionModel {
  return {
    phrases: Array.isArray(data?.phrases) ? [...data!.phrases] : [],
    bigrams: objToNested(data?.bigrams),
    trigrams: objToNested(data?.trigrams),
    varValues: objToNested(data?.varValues),
  };
}
