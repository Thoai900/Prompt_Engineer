# Ghost-Text Inline Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm gợi ý gõ nhanh ghost-text (tab-to-complete) cho mọi ô nhập prompt, dùng thuật toán cục bộ (corpus + n-gram) cá nhân hóa qua Firebase, đặc biệt điền nhanh ô biến số.

**Architecture:** Một engine thuần (`suggestionEngine.ts`) giữ model n-gram/phrase/varValue trong RAM và trả gợi ý đồng bộ. Một store (`suggestionStore.ts`) dựng model từ corpus, học từ người dùng (tách riêng "user model" để persist), cache localStorage và đồng bộ 1 doc Firestore/uid. Một hook (`useGhostText.ts`) + 2 component wrapper (`GhostTextArea`, `GhostTextInput`) lo render overlay "soi gương" và phím tắt; mỗi ô input chỉ đổi tag.

**Tech Stack:** React 19, TypeScript ~5.8, Vitest 4 + @testing-library/react + jsdom, Firebase 12 (Firestore + Auth), Tailwind 4.

## Global Constraints

- Không gọi AI/API trong luồng gợi ý — chỉ thuật toán cục bộ.
- Truy vấn gợi ý phải **đồng bộ** (gọi trong `onChange`), không async.
- Tái dùng `normalizeVietnamese` từ `src/services/algorithmEngine.ts` cho mọi so khớp (không phân biệt dấu/hoa-thường).
- Màu/ghost **không** dùng utility `slate-*`/`white` trần (lớp `!important` trong `src/index.css` remap chúng theo theme) — dùng `text-[var(--color-...)]`, class riêng, hoặc hex.
- Hằng số: `MIN_NGRAM_COUNT = 2`, `MAX_EXPAND_WORDS = 12`, `MAX_PHRASES = 200`, `MAX_CANDIDATES_PER_KEY = 50`, `MAX_KEYS = 2000`, debounce tính gợi ý `70ms`, debounce ghi Firebase `10000ms`.
- Test: `npm test` (vitest run) phải xanh. Test mới đặt trong `src/__tests__/`, import kiểu `import { describe, it, expect } from 'vitest'` (theo `src/__tests__/helpers.test.ts`).
- Firestore collection mới: `suggestionModels/{uid}`, document id == uid, field `userId == uid`.
- Commit thường xuyên, mỗi task ≥ 1 commit. Kết message commit bằng:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

### Task 1: Engine — model, tokenize, dựng từ corpus

**Files:**
- Create: `src/services/suggestionEngine.ts`
- Test: `src/__tests__/suggestionEngine.test.ts`

**Interfaces:**
- Consumes: `normalizeVietnamese` từ `src/services/algorithmEngine.ts`; `TEMPLATES, DAILY_PACKS, BLOCK_SUGGESTIONS` từ `src/data.ts`.
- Produces:
  - `interface SuggestionModel { phrases: string[]; bigrams: Map<string, Map<string,number>>; trigrams: Map<string, Map<string,number>>; varValues: Map<string, Map<string,number>>; }`
  - `function createEmptyModel(): SuggestionModel`
  - `function tokenize(text: string): string[]`
  - `function addPhraseToModel(model: SuggestionModel, phrase: string, weight?: number): void`
  - `function addVariableValue(model: SuggestionModel, varName: string, value: string, weight?: number): void`
  - `function buildModelFromCorpus(): SuggestionModel`
  - `const MIN_NGRAM_COUNT = 2; const MAX_EXPAND_WORDS = 12;`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/suggestionEngine.test.ts
import { describe, it, expect } from 'vitest';
import {
  createEmptyModel,
  tokenize,
  addPhraseToModel,
  addVariableValue,
  buildModelFromCorpus,
} from '../services/suggestionEngine';

describe('suggestionEngine model building', () => {
  it('tokenize splits and lowercases words, dropping empties', () => {
    expect(tokenize('Bạn là  một Mentor!')).toEqual(['bạn', 'là', 'một', 'mentor']);
  });

  it('addPhraseToModel records phrase, bigrams and trigrams', () => {
    const m = createEmptyModel();
    addPhraseToModel(m, 'bạn là một mentor');
    expect(m.phrases).toContain('bạn là một mentor');
    expect(m.bigrams.get('bạn')?.get('là')).toBe(1);
    expect(m.trigrams.get('bạn là')?.get('một')).toBe(1);
  });

  it('addPhraseToModel accumulates counts with weight', () => {
    const m = createEmptyModel();
    addPhraseToModel(m, 'bạn là', 1);
    addPhraseToModel(m, 'bạn là', 2);
    expect(m.bigrams.get('bạn')?.get('là')).toBe(3);
  });

  it('addVariableValue keys by normalized variable name', () => {
    const m = createEmptyModel();
    addVariableValue(m, 'Grade', '11');
    addVariableValue(m, 'grade', '11');
    expect(m.varValues.get('grade')?.get('11')).toBe(2);
  });

  it('buildModelFromCorpus produces a non-empty model', () => {
    const m = buildModelFromCorpus();
    expect(m.phrases.length).toBeGreaterThan(0);
    expect(m.bigrams.size).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/suggestionEngine.test.ts`
Expected: FAIL — `Cannot find module '../services/suggestionEngine'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/services/suggestionEngine.ts
import { normalizeVietnamese } from './algorithmEngine';
import { TEMPLATES, DAILY_PACKS, BLOCK_SUGGESTIONS } from '../data';

export const MIN_NGRAM_COUNT = 2;
export const MAX_EXPAND_WORDS = 12;

export interface SuggestionModel {
  phrases: string[];
  bigrams: Map<string, Map<string, number>>;
  trigrams: Map<string, Map<string, number>>;
  varValues: Map<string, Map<string, number>>;
}

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/suggestionEngine.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/suggestionEngine.ts src/__tests__/suggestionEngine.test.ts
git commit -m "feat(suggest): add suggestion engine model + corpus builder"
```

---

### Task 2: Engine — `suggest()` cho 3 chế độ

**Files:**
- Modify: `src/services/suggestionEngine.ts`
- Test: `src/__tests__/suggestionEngine.test.ts`

**Interfaces:**
- Consumes: tất cả từ Task 1.
- Produces:
  - `interface ProseContext { mode: 'prose'; textBeforeCursor: string; }`
  - `interface VariableContext { mode: 'variable'; varName: string; textBeforeCursor: string; defaultValue?: string; corpusValues?: string[]; }`
  - `type SuggestContext = ProseContext | VariableContext;`
  - `function suggest(model: SuggestionModel, ctx: SuggestContext): string` — trả **đuôi ghost** ('' nếu không có).

- [ ] **Step 1: Write the failing test**

```ts
// append to src/__tests__/suggestionEngine.test.ts
import {
  createEmptyModel as emptyModel2, // alias unused-safe; or reuse existing imports
} from '../services/suggestionEngine';
import { suggest, addPhraseToModel as addPhrase2 } from '../services/suggestionEngine';

describe('suggestionEngine suggest()', () => {
  it('prose prefix mode completes the rest of a matching phrase on empty/partial line', () => {
    const m = createEmptyModel();
    addPhraseToModel(m, 'Bạn là một Mentor AI thân thiện', 5);
    const ghost = suggest(m, { mode: 'prose', textBeforeCursor: 'Bạn là một Men' });
    expect(ghost).toBe('tor AI thân thiện');
  });

  it('prose ngram mode extends mid-sentence using n-grams, capped and confidence-gated', () => {
    const m = createEmptyModel();
    addPhraseToModel(m, 'hãy giải thích từng bước', 3);
    addPhraseToModel(m, 'hãy giải thích từng bước', 3); // ensure count >= 2
    const ghost = suggest(m, { mode: 'prose', textBeforeCursor: 'Mở đầu rồi hãy giải ' });
    expect(ghost.startsWith('thích')).toBe(true);
  });

  it('prose returns empty when next-word count below MIN_NGRAM_COUNT', () => {
    const m = createEmptyModel();
    addPhraseToModel(m, 'xyz abc', 1); // count 1 only
    const ghost = suggest(m, { mode: 'prose', textBeforeCursor: 'foo xyz ' });
    expect(ghost).toBe('');
  });

  it('variable mode suggests most frequent value matching the prefix', () => {
    const m = createEmptyModel();
    addVariableValue(m, 'grade', '11', 5);
    addVariableValue(m, 'grade', '12', 1);
    const ghost = suggest(m, { mode: 'variable', varName: 'grade', textBeforeCursor: '1' });
    expect(ghost).toBe('1'); // "11" minus typed "1"
  });

  it('variable mode falls back to defaultValue / corpusValues when no history', () => {
    const m = createEmptyModel();
    const ghost = suggest(m, {
      mode: 'variable', varName: 'subject', textBeforeCursor: '',
      defaultValue: 'Quang hợp', corpusValues: ['Hàm số'],
    });
    expect(ghost.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/suggestionEngine.test.ts`
Expected: FAIL — `suggest is not exported / is not a function`.

- [ ] **Step 3: Write minimal implementation**

```ts
// append to src/services/suggestionEngine.ts

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
  } else {
    return ''; // empty line prose handled by caller via blockType corpus (kept minimal here)
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
  // Re-join preserving a leading space if the user already typed a trailing space.
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
    counts.set(value, (counts.get(value) || 0) + weight);
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/suggestionEngine.test.ts`
Expected: PASS (all tests Task 1 + Task 2).

- [ ] **Step 5: Commit**

```bash
git add src/services/suggestionEngine.ts src/__tests__/suggestionEngine.test.ts
git commit -m "feat(suggest): add suggest() for prefix/ngram/variable modes"
```

---

### Task 3: Engine — merge, cap, serialize/deserialize

**Files:**
- Modify: `src/services/suggestionEngine.ts`
- Test: `src/__tests__/suggestionEngine.test.ts`

**Interfaces:**
- Consumes: Task 1 + 2.
- Produces:
  - `interface SerializedModel { phrases: string[]; bigrams: Record<string, Record<string, number>>; trigrams: Record<string, Record<string, number>>; varValues: Record<string, Record<string, number>>; }`
  - `function mergeModel(target: SuggestionModel, source: SuggestionModel): void`
  - `function capModel(model: SuggestionModel): void`
  - `function serializeModel(model: SuggestionModel): SerializedModel`
  - `function deserializeModel(data: Partial<SerializedModel> | null | undefined): SuggestionModel`
  - `const MAX_PHRASES = 200; const MAX_CANDIDATES_PER_KEY = 50; const MAX_KEYS = 2000;`

- [ ] **Step 1: Write the failing test**

```ts
// append to src/__tests__/suggestionEngine.test.ts
import {
  mergeModel, capModel, serializeModel, deserializeModel, MAX_PHRASES,
} from '../services/suggestionEngine';

describe('suggestionEngine merge/cap/serialize', () => {
  it('mergeModel adds source counts onto target', () => {
    const a = createEmptyModel();
    const b = createEmptyModel();
    addPhraseToModel(a, 'bạn là', 1);
    addPhraseToModel(b, 'bạn là', 4);
    mergeModel(a, b);
    expect(a.bigrams.get('bạn')?.get('là')).toBe(5);
  });

  it('capModel limits phrases to MAX_PHRASES keeping the most recent', () => {
    const m = createEmptyModel();
    for (let i = 0; i < MAX_PHRASES + 50; i++) addPhraseToModel(m, `phrase number ${i}`);
    capModel(m);
    expect(m.phrases.length).toBe(MAX_PHRASES);
    expect(m.phrases[m.phrases.length - 1]).toBe(`phrase number ${MAX_PHRASES + 49}`);
  });

  it('serialize then deserialize round-trips counts', () => {
    const m = createEmptyModel();
    addPhraseToModel(m, 'bạn là một mentor', 2);
    addVariableValue(m, 'grade', '11', 3);
    const back = deserializeModel(serializeModel(m));
    expect(back.bigrams.get('bạn')?.get('là')).toBe(2);
    expect(back.varValues.get('grade')?.get('11')).toBe(3);
    expect(back.phrases).toContain('bạn là một mentor');
  });

  it('deserializeModel handles null/undefined safely', () => {
    const m = deserializeModel(null);
    expect(m.phrases).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/suggestionEngine.test.ts`
Expected: FAIL — `mergeModel is not a function`.

- [ ] **Step 3: Write minimal implementation**

```ts
// append to src/services/suggestionEngine.ts

export const MAX_PHRASES = 200;
export const MAX_CANDIDATES_PER_KEY = 50;
export const MAX_KEYS = 2000;

export interface SerializedModel {
  phrases: string[];
  bigrams: Record<string, Record<string, number>>;
  trigrams: Record<string, Record<string, number>>;
  varValues: Record<string, Record<string, number>>;
}

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

function capNested(map: Map<string, Map<string, number>>) {
  if (map.size > MAX_KEYS) {
    const keys = [...map.entries()]
      .sort((a, b) => totalCount(b[1]) - totalCount(a[1]))
      .slice(0, MAX_KEYS)
      .map(e => e[0]);
    const keep = new Set(keys);
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

function totalCount(inner: Map<string, number>): number {
  let s = 0;
  for (const c of inner.values()) s += c;
  return s;
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/suggestionEngine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/suggestionEngine.ts src/__tests__/suggestionEngine.test.ts
git commit -m "feat(suggest): add merge/cap/serialize helpers for engine model"
```

---

### Task 4: Store — runtime + user model, localStorage, learn API

**Files:**
- Create: `src/services/suggestionStore.ts`
- Test: `src/__tests__/suggestionStore.test.ts`

**Interfaces:**
- Consumes: tất cả engine exports từ Task 1–3.
- Produces (module singleton, không React):
  - `function getRuntimeModel(): SuggestionModel`
  - `function querySuggestion(ctx: SuggestContext): string`
  - `function learnPhrase(text: string): void` (tách câu, học vào runtime + userModel, đánh dấu dirty)
  - `function learnVariableValue(varName: string, value: string): void`
  - `function loadUserModelFromData(data: Partial<SerializedModel> | null): void` (merge vào runtime + userModel)
  - `function exportUserModel(): SerializedModel` (cap rồi serialize userModel)
  - `function isDirty(): boolean; function clearDirty(): void`
  - `function resetStoreForTest(): void`
  - `const ANON_LS_KEY = 'ghostModel:anon';`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/suggestionStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  querySuggestion, learnPhrase, learnVariableValue,
  exportUserModel, loadUserModelFromData, isDirty, clearDirty, resetStoreForTest,
} from '../services/suggestionStore';

beforeEach(() => {
  localStorage.clear();
  resetStoreForTest();
});

describe('suggestionStore', () => {
  it('learnVariableValue makes the value suggestable and marks dirty', () => {
    learnVariableValue('grade', '11');
    learnVariableValue('grade', '11');
    const ghost = querySuggestion({ mode: 'variable', varName: 'grade', textBeforeCursor: '1' });
    expect(ghost).toBe('1');
    expect(isDirty()).toBe(true);
  });

  it('exportUserModel only contains user-learned data, not the whole corpus', () => {
    learnVariableValue('subject', 'Quang hợp ở thực vật');
    const exported = exportUserModel();
    expect(exported.varValues['subject']['Quang hợp ở thực vật']).toBe(1);
    expect(exported.phrases.length).toBeLessThan(50); // corpus excluded
  });

  it('loadUserModelFromData merges persisted history into runtime', () => {
    loadUserModelFromData({ varValues: { grade: { '12': 9 } } } as any);
    const ghost = querySuggestion({ mode: 'variable', varName: 'grade', textBeforeCursor: '1' });
    expect(ghost).toBe('2');
  });

  it('clearDirty resets the dirty flag', () => {
    learnPhrase('Bạn là một mentor.');
    clearDirty();
    expect(isDirty()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/suggestionStore.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/services/suggestionStore.ts
import {
  SuggestionModel, SerializedModel, SuggestContext,
  buildModelFromCorpus, createEmptyModel, addPhraseToModel, addVariableValue,
  mergeModel, capModel, serializeModel, deserializeModel, suggest,
} from './suggestionEngine';

export const ANON_LS_KEY = 'ghostModel:anon';

let runtime: SuggestionModel = buildModelFromCorpus();
let userModel: SuggestionModel = createEmptyModel();
let dirty = false;

export function resetStoreForTest(): void {
  runtime = buildModelFromCorpus();
  userModel = createEmptyModel();
  dirty = false;
}

export function getRuntimeModel(): SuggestionModel {
  return runtime;
}

export function querySuggestion(ctx: SuggestContext): string {
  return suggest(runtime, ctx);
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?\n])\s+/).map(s => s.trim()).filter(Boolean);
}

export function learnPhrase(text: string): void {
  let changed = false;
  for (const s of splitSentences(text)) {
    if (s.split(/\s+/).length < 2) continue; // ignore trivial single words
    addPhraseToModel(runtime, s, 1);
    addPhraseToModel(userModel, s, 1);
    changed = true;
  }
  if (changed) dirty = true;
}

export function learnVariableValue(varName: string, value: string): void {
  const v = value.trim();
  if (!v) return;
  addVariableValue(runtime, varName, v, 1);
  addVariableValue(userModel, varName, v, 1);
  dirty = true;
}

export function loadUserModelFromData(data: Partial<SerializedModel> | null): void {
  const loaded = deserializeModel(data);
  mergeModel(runtime, loaded);
  mergeModel(userModel, loaded);
}

export function exportUserModel(): SerializedModel {
  capModel(userModel);
  return serializeModel(userModel);
}

export function isDirty(): boolean { return dirty; }
export function clearDirty(): void { dirty = false; }

// localStorage persistence for anonymous / offline use.
export function loadAnonFromLocalStorage(): void {
  try {
    const raw = localStorage.getItem(ANON_LS_KEY);
    if (raw) loadUserModelFromData(JSON.parse(raw));
  } catch { /* ignore corrupt cache */ }
}

export function saveAnonToLocalStorage(): void {
  try {
    localStorage.setItem(ANON_LS_KEY, JSON.stringify(exportUserModel()));
  } catch { /* quota / serialization errors are non-fatal */ }
}

export function clearAnonLocalStorage(): void {
  try { localStorage.removeItem(ANON_LS_KEY); } catch { /* ignore */ }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/suggestionStore.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/suggestionStore.ts src/__tests__/suggestionStore.test.ts
git commit -m "feat(suggest): add suggestion store with learn API + local cache"
```

---

### Task 5: Hook `useGhostText` + phím tắt

**Files:**
- Create: `src/hooks/useGhostText.ts`
- Test: `src/__tests__/useGhostText.test.tsx`

**Interfaces:**
- Consumes: `querySuggestion`, `learnPhrase`, `learnVariableValue` từ `suggestionStore`; `SuggestContext` từ engine.
- Produces:
  - ```ts
    interface GhostTextOptions {
      mode: 'prose' | 'variable';
      enabled?: boolean;
      varName?: string;
      defaultValue?: string;
      corpusValues?: string[];
    }
    interface GhostTextApi {
      ghost: string;
      onChange: (value: string, selectionStart: number, selectionEnd: number) => void;
      onKeyDown: (e: React.KeyboardEvent) => void; // handles Tab / Ctrl+ArrowRight / Escape
      onCompositionStart: () => void;
      onCompositionEnd: () => void;
      acceptAll: () => void;
      clear: () => void;
    }
    function useGhostText(
      value: string,
      setValue: (next: string) => void,
      opts: GhostTextOptions,
    ): GhostTextApi
    ```
  - Quy tắc: chỉ tính ghost khi không IME-composing, không selection, con trỏ ở cuối `value`. Tab chấp nhận toàn bộ; Ctrl+→ chấp nhận 1 từ; Esc ẩn. Khi chấp nhận → gọi learn*.

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/useGhostText.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGhostText } from '../hooks/useGhostText';
import { learnVariableValue, resetStoreForTest } from '../services/suggestionStore';

beforeEach(() => resetStoreForTest());

function keyEvent(key: string, ctrlKey = false) {
  let prevented = false;
  return {
    key, ctrlKey, metaKey: false,
    preventDefault: () => { prevented = true; },
    get prevented() { return prevented; },
  } as any;
}

describe('useGhostText', () => {
  it('computes a ghost for a variable when cursor is at end', () => {
    learnVariableValue('grade', '11');
    learnVariableValue('grade', '11');
    const { result } = renderHook(() => {
      const [v, setV] = require('react').useState('1');
      const api = useGhostText(v, setV, { mode: 'variable', varName: 'grade' });
      return { v, api };
    });
    act(() => result.current.api.onChange('1', 1, 1));
    expect(result.current.api.ghost).toBe('1');
  });

  it('Tab accepts the whole ghost and prevents default', () => {
    learnVariableValue('grade', '11');
    learnVariableValue('grade', '11');
    let current = '1';
    const { result, rerender } = renderHook(() => {
      const api = useGhostText(current, (n) => { current = n; }, { mode: 'variable', varName: 'grade' });
      return api;
    });
    act(() => result.current.onChange('1', 1, 1));
    const ev = keyEvent('Tab');
    act(() => result.current.onKeyDown(ev));
    expect(ev.prevented).toBe(true);
    expect(current).toBe('11');
    rerender();
  });

  it('does not suggest when disabled', () => {
    learnVariableValue('grade', '11');
    const { result } = renderHook(() =>
      useGhostText('1', () => {}, { mode: 'variable', varName: 'grade', enabled: false }));
    act(() => result.current.onChange('1', 1, 1));
    expect(result.current.ghost).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/useGhostText.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/hooks/useGhostText.ts
import { useCallback, useRef, useState } from 'react';
import { querySuggestion, learnPhrase, learnVariableValue } from '../services/suggestionStore';

export interface GhostTextOptions {
  mode: 'prose' | 'variable';
  enabled?: boolean;
  varName?: string;
  defaultValue?: string;
  corpusValues?: string[];
}

export interface GhostTextApi {
  ghost: string;
  onChange: (value: string, selectionStart: number, selectionEnd: number) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onCompositionStart: () => void;
  onCompositionEnd: () => void;
  acceptAll: () => void;
  clear: () => void;
}

export function useGhostText(
  value: string,
  setValue: (next: string) => void,
  opts: GhostTextOptions,
): GhostTextApi {
  const [ghost, setGhost] = useState('');
  const composing = useRef(false);
  const enabled = opts.enabled !== false;

  const compute = useCallback((val: string, selStart: number, selEnd: number) => {
    if (!enabled || composing.current || selStart !== selEnd || selStart !== val.length) {
      setGhost('');
      return;
    }
    const g = opts.mode === 'variable'
      ? querySuggestion({ mode: 'variable', varName: opts.varName || '', textBeforeCursor: val, defaultValue: opts.defaultValue, corpusValues: opts.corpusValues })
      : querySuggestion({ mode: 'prose', textBeforeCursor: val });
    setGhost(g);
  }, [enabled, opts.mode, opts.varName, opts.defaultValue, opts.corpusValues]);

  const onChange = useCallback((val: string, selStart: number, selEnd: number) => {
    compute(val, selStart, selEnd);
  }, [compute]);

  const learn = useCallback((finalValue: string) => {
    if (opts.mode === 'variable') learnVariableValue(opts.varName || '', finalValue);
    else learnPhrase(finalValue);
  }, [opts.mode, opts.varName]);

  const acceptAll = useCallback(() => {
    if (!ghost) return;
    const next = value + ghost;
    setValue(next);
    setGhost('');
    learn(next);
  }, [ghost, value, setValue, learn]);

  const acceptWord = useCallback(() => {
    if (!ghost) return;
    const m = ghost.match(/^\s*\S+/);
    const chunk = m ? m[0] : ghost;
    const next = value + chunk;
    setValue(next);
    setGhost(ghost.slice(chunk.length));
  }, [ghost, value, setValue]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!ghost) return;
    if (e.key === 'Tab') { e.preventDefault(); acceptAll(); }
    else if (e.key === 'ArrowRight' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); acceptWord(); }
    else if (e.key === 'Escape') { setGhost(''); }
  }, [ghost, acceptAll, acceptWord]);

  const onCompositionStart = useCallback(() => { composing.current = true; setGhost(''); }, []);
  const onCompositionEnd = useCallback(() => { composing.current = false; }, []);
  const clear = useCallback(() => setGhost(''), []);

  return { ghost, onChange, onKeyDown, onCompositionStart, onCompositionEnd, acceptAll, clear };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/useGhostText.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useGhostText.ts src/__tests__/useGhostText.test.tsx
git commit -m "feat(suggest): add useGhostText hook with keyboard handling"
```

---

### Task 6: Component `GhostTextInput` (ô 1 dòng, dùng cho biến số)

**Files:**
- Create: `src/components/common/GhostTextInput.tsx`

**Interfaces:**
- Consumes: `useGhostText` từ Task 5.
- Produces:
  - ```ts
    interface GhostTextInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
      value: string;
      onValueChange: (next: string) => void;
      ghostMode: 'prose' | 'variable';
      ghostEnabled?: boolean;
      varName?: string;
      defaultGhostValue?: string;
      corpusValues?: string[];
    }
    const GhostTextInput: React.FC<GhostTextInputProps>
    ```
- Render: container `relative`; overlay `absolute inset-0 pointer-events-none` cùng padding/font với input, hiển thị `value` (trong suốt) + `ghost` (mờ); input nền trong suốt phía trên. Overlay text color cho ghost: `text-[var(--color-muted,#94a3b8)]` opacity ~50% (KHÔNG dùng `text-slate-*`).

- [ ] **Step 1: Implement the component**

```tsx
// src/components/common/GhostTextInput.tsx
import React, { useRef } from 'react';
import { useGhostText } from '../../hooks/useGhostText';

interface GhostTextInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onValueChange: (next: string) => void;
  ghostMode: 'prose' | 'variable';
  ghostEnabled?: boolean;
  varName?: string;
  defaultGhostValue?: string;
  corpusValues?: string[];
}

export const GhostTextInput: React.FC<GhostTextInputProps> = ({
  value, onValueChange, ghostMode, ghostEnabled, varName,
  defaultGhostValue, corpusValues, className, style, ...rest
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { ghost, onChange, onKeyDown, onCompositionStart, onCompositionEnd, clear } = useGhostText(
    value, onValueChange,
    { mode: ghostMode, enabled: ghostEnabled, varName, defaultValue: defaultGhostValue, corpusValues },
  );

  const sharedText = 'whitespace-pre-wrap break-words';

  return (
    <div className="relative w-full">
      {/* Mirror overlay */}
      <div
        aria-hidden
        className={`absolute inset-0 pointer-events-none overflow-hidden ${sharedText} ${className || ''}`}
        style={{ ...style, color: 'transparent' }}
      >
        <span>{value}</span>
        {ghost && <span style={{ color: 'var(--color-muted, #94a3b8)', opacity: 0.5 }}>{ghost}</span>}
      </div>
      <input
        {...rest}
        ref={inputRef}
        value={value}
        className={`relative bg-transparent ${className || ''}`}
        style={style}
        onChange={(e) => { onValueChange(e.target.value); onChange(e.target.value, e.target.selectionStart || 0, e.target.selectionEnd || 0); }}
        onKeyDown={(e) => { onKeyDown(e); rest.onKeyDown?.(e); }}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
        onBlur={(e) => { clear(); rest.onBlur?.(e); }}
      />
    </div>
  );
};
```

- [ ] **Step 2: Verify build compiles**

Run: `npm run lint`
Expected: No new TypeScript errors referencing `GhostTextInput`.

- [ ] **Step 3: Commit**

```bash
git add src/components/common/GhostTextInput.tsx
git commit -m "feat(suggest): add GhostTextInput overlay component"
```

---

### Task 7: Component `GhostTextArea` (nhiều dòng) + scroll sync

**Files:**
- Create: `src/components/common/GhostTextArea.tsx`

**Interfaces:**
- Consumes: `useGhostText`.
- Produces:
  - ```ts
    interface GhostTextAreaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
      value: string;
      onValueChange: (next: string) => void;
      ghostEnabled?: boolean;
    }
    const GhostTextArea: React.FC<GhostTextAreaProps>
    ```
- Render: như `GhostTextInput` nhưng mirror là `<div>` nhiều dòng; đồng bộ `scrollTop` từ textarea sang overlay trong `onScroll`. Ghost mode luôn `'prose'`.

- [ ] **Step 1: Implement the component**

```tsx
// src/components/common/GhostTextArea.tsx
import React, { useRef } from 'react';
import { useGhostText } from '../../hooks/useGhostText';

interface GhostTextAreaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value: string;
  onValueChange: (next: string) => void;
  ghostEnabled?: boolean;
}

export const GhostTextArea: React.FC<GhostTextAreaProps> = ({
  value, onValueChange, ghostEnabled, className, style, ...rest
}) => {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const { ghost, onChange, onKeyDown, onCompositionStart, onCompositionEnd, clear } = useGhostText(
    value, onValueChange, { mode: 'prose', enabled: ghostEnabled },
  );

  const syncScroll = () => {
    if (taRef.current && mirrorRef.current) {
      mirrorRef.current.scrollTop = taRef.current.scrollTop;
      mirrorRef.current.scrollLeft = taRef.current.scrollLeft;
    }
  };

  return (
    <div className="relative w-full">
      <div
        ref={mirrorRef}
        aria-hidden
        className={`absolute inset-0 pointer-events-none overflow-hidden whitespace-pre-wrap break-words ${className || ''}`}
        style={{ ...style, color: 'transparent' }}
      >
        <span>{value}</span>
        {ghost && <span style={{ color: 'var(--color-muted, #94a3b8)', opacity: 0.5 }}>{ghost}</span>}
      </div>
      <textarea
        {...rest}
        ref={taRef}
        value={value}
        className={`relative bg-transparent ${className || ''}`}
        style={style}
        onChange={(e) => { onValueChange(e.target.value); onChange(e.target.value, e.target.selectionStart || 0, e.target.selectionEnd || 0); }}
        onKeyDown={(e) => { onKeyDown(e); rest.onKeyDown?.(e); }}
        onScroll={(e) => { syncScroll(); rest.onScroll?.(e); }}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
        onBlur={(e) => { clear(); rest.onBlur?.(e); }}
      />
    </div>
  );
};
```

- [ ] **Step 2: Verify build compiles**

Run: `npm run lint`
Expected: No new TypeScript errors referencing `GhostTextArea`.

- [ ] **Step 3: Commit**

```bash
git add src/components/common/GhostTextArea.tsx
git commit -m "feat(suggest): add GhostTextArea overlay component with scroll sync"
```

---

### Task 8: Gắn vào ô biến số (trọng tâm) — PromptBlockCard

**Files:**
- Modify: `src/components/builder/PromptBlockCard.tsx:427-433` (ô `<input>` biến số text trong khối "Điền nhanh biến số")

**Interfaces:**
- Consumes: `GhostTextInput` (Task 6). Biến `v` có `v.name`, có thể có `v.options` (select → giữ nguyên), `defaultValue` lấy từ định nghĩa nếu có.

- [ ] **Step 1: Replace the text variable input with GhostTextInput**

Tại nhánh `v.options ? (<select>...) : (<input .../>)`, thay phần `<input>` (dòng ~427–433) bằng:

```tsx
<GhostTextInput
  ghostMode="variable"
  varName={v.name}
  value={variableValues[v.name] || ''}
  onValueChange={(next) => setVariableValues(prev => ({ ...prev, [v.name]: next }))}
  className="w-full text-xs px-2.5 py-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600"
  placeholder={`Thông tin cho ${v.name}...`}
/>
```

Thêm import ở đầu file:

```tsx
import { GhostTextInput } from '../common/GhostTextInput';
```

- [ ] **Step 2: Verify build compiles**

Run: `npm run lint`
Expected: No new TypeScript errors.

- [ ] **Step 3: Manual smoke check (preview)**

Khởi động dev server, vào BuilderTab, mở 1 khối có biến `{{...}}`. Gõ 1 giá trị rồi blur (để học), tạo khối/biến cùng tên lần nữa, gõ ký tự đầu → thấy ghost mờ, nhấn Tab điền nhanh.

- [ ] **Step 4: Commit**

```bash
git add src/components/builder/PromptBlockCard.tsx
git commit -m "feat(suggest): wire ghost-text autofill into block variable inputs"
```

---

### Task 9: Gắn vào ô nội dung khối + Topic + Enhancer + chỉ thị riêng + ProjectChain

**Files:**
- Modify: `src/components/builder/PromptBlockCard.tsx:390-405` (textarea nội dung khối → `GhostTextArea`)
- Modify: `src/components/tabs/HomeTab.tsx` (ô Topic → `GhostTextInput` hoặc `GhostTextArea`, `ghostMode="prose"`)
- Modify: `src/components/tabs/EnhancerTab.tsx` (ô prompt thô → `GhostTextArea`)
- Modify: `src/components/builder/PromptBlockCard.tsx:255-270` (ô "Yêu cầu chỉnh sửa riêng" → `GhostTextInput` `ghostMode="prose"`)
- Modify: `src/components/project-chain/NodeDetailSidebar.tsx`, `src/components/project-chain/SimulatorPanel.tsx`, `src/components/project-chain/TestCasesPanel.tsx` (ô nhập biến node → `GhostTextInput` `ghostMode="variable"` `varName={...}`; ô soạn block trong node → `GhostTextArea`)

**Interfaces:**
- Consumes: `GhostTextArea` (Task 7), `GhostTextInput` (Task 6).

- [ ] **Step 1: Replace block content textarea**

Trong `PromptBlockCard.tsx`, thay `<textarea ... value={block.content} onChange=... />` (dòng ~390) bằng:

```tsx
<GhostTextArea
  value={block.content}
  onValueChange={(next) => updateBlockContent(block.id, next)}
  onFocus={() => { focusContentsRef.current[block.id] = block.content; }}
  onBlur={() => {
    const initialVal = focusContentsRef.current[block.id];
    if (initialVal !== undefined && initialVal !== block.content) {
      saveBlockVersion(block.id, initialVal, 'Chỉnh sửa thủ công');
    }
  }}
  placeholder={isGenerating ? 'AI đang tự động soạn thảo...' : 'Nhập nội dung khối ở đây...'}
  disabled={isGenerating}
  className="w-full text-sm font-medium focus:outline-none resize-y min-h-[90px] leading-relaxed p-3 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 rounded-2xl border border-slate-200 dark:border-slate-800/80"
/>
```

(Đảm bảo import `GhostTextArea` đã có; thêm nếu thiếu.)

- [ ] **Step 2: Replace the remaining inputs**

Áp cùng mẫu cho: ô "Yêu cầu chỉnh sửa riêng" (`GhostTextInput ghostMode="prose"`), ô Topic ở HomeTab, ô prompt ở EnhancerTab, và các ô trong ProjectChain (biến node → `ghostMode="variable" varName={...}`; soạn block node → `GhostTextArea`). Giữ nguyên className gốc của từng ô để không đổi giao diện.

- [ ] **Step 3: Verify build compiles**

Run: `npm run lint`
Expected: No new TypeScript errors.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: PASS (toàn bộ).

- [ ] **Step 5: Commit**

```bash
git add src/components/builder/PromptBlockCard.tsx src/components/tabs/HomeTab.tsx src/components/tabs/EnhancerTab.tsx src/components/project-chain/NodeDetailSidebar.tsx src/components/project-chain/SimulatorPanel.tsx src/components/project-chain/TestCasesPanel.tsx
git commit -m "feat(suggest): wire ghost-text into block content, topic, enhancer, project-chain"
```

---

### Task 10: Firebase — rules + sync (load on login, debounce write, anon merge)

**Files:**
- Modify: `firestore.rules` (thêm khối `suggestionModels/{uid}`)
- Create: `src/services/suggestionSync.ts`
- Modify: `src/App.tsx` (gọi khởi tạo sync khi `authReady`)

**Interfaces:**
- Consumes: `db, auth, handleFirestoreError` từ `src/firebase.ts`; `exportUserModel, loadUserModelFromData, isDirty, clearDirty, loadAnonFromLocalStorage, saveAnonToLocalStorage, clearAnonLocalStorage` từ `suggestionStore`.
- Produces:
  - `function initSuggestionSync(): () => void` — đăng ký `onAuthStateChanged`; trả hàm cleanup.
  - Hành vi: chưa đăng nhập → `loadAnonFromLocalStorage()`; có `uid` → `getDoc(suggestionModels/{uid})` merge; nếu có anon data, merge lên doc rồi `clearAnonLocalStorage()`. Đăng ký flush debounce 10s khi `isDirty()` + flush trên `beforeunload`.

- [ ] **Step 1: Add the Firestore rule**

Trong `firestore.rules`, thêm trước dấu `}` đóng `match /databases/...`:

```
    match /suggestionModels/{uid} {
      allow get:    if isOwner(uid);
      allow create: if isOwner(uid)
                    && incoming().userId == uid
                    && incoming().createdAt == request.time
                    && incoming().updatedAt == request.time;
      allow update: if isOwner(uid)
                    && incoming().userId == uid
                    && incoming().createdAt == existing().createdAt
                    && incoming().updatedAt == request.time;
      allow delete: if isOwner(uid);
    }
```

- [ ] **Step 2: Implement the sync service**

```ts
// src/services/suggestionSync.ts
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, handleFirestoreError } from '../firebase';
import {
  exportUserModel, loadUserModelFromData, isDirty, clearDirty,
  loadAnonFromLocalStorage, saveAnonToLocalStorage, clearAnonLocalStorage,
} from './suggestionStore';

const FLUSH_MS = 10000;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let currentUid: string | null = null;

async function flush() {
  if (!isDirty()) return;
  if (currentUid) {
    try {
      const ref = doc(db, 'suggestionModels', currentUid);
      const data = exportUserModel();
      const snap = await getDoc(ref);
      await setDoc(ref, {
        ...data,
        userId: currentUid,
        updatedAt: serverTimestamp(),
        ...(snap.exists() ? {} : { createdAt: serverTimestamp() }),
      }, { merge: true });
      clearDirty();
    } catch (e) {
      try { handleFirestoreError(e, 'write', `suggestionModels/${currentUid}`); } catch { /* swallow */ }
    }
  } else {
    saveAnonToLocalStorage();
    clearDirty();
  }
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, FLUSH_MS);
}

export function initSuggestionSync(): () => void {
  loadAnonFromLocalStorage();

  const interval = setInterval(() => { if (isDirty()) scheduleFlush(); }, 3000);
  const onUnload = () => { flush(); };
  window.addEventListener('beforeunload', onUnload);

  const unsubAuth = onAuthStateChanged(auth, async (user) => {
    currentUid = user?.uid || null;
    if (currentUid) {
      try {
        const ref = doc(db, 'suggestionModels', currentUid);
        const snap = await getDoc(ref);
        if (snap.exists()) loadUserModelFromData(snap.data() as any);
        // If anon data existed, it is already merged into runtime; push it up.
        if (isDirty()) await flush();
        clearAnonLocalStorage();
      } catch (e) {
        try { handleFirestoreError(e, 'get', `suggestionModels/${currentUid}`); } catch { /* swallow */ }
      }
    }
  });

  return () => {
    clearInterval(interval);
    window.removeEventListener('beforeunload', onUnload);
    unsubAuth();
    if (flushTimer) clearTimeout(flushTimer);
  };
}
```

- [ ] **Step 3: Initialize from App**

Trong `src/App.tsx`, thêm import và một `useEffect` chạy 1 lần:

```tsx
import { initSuggestionSync } from './services/suggestionSync';
// ...
useEffect(() => {
  const cleanup = initSuggestionSync();
  return cleanup;
}, []);
```

- [ ] **Step 4: Verify build + tests**

Run: `npm run lint && npm test`
Expected: No new TS errors; all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules src/services/suggestionSync.ts src/App.tsx
git commit -m "feat(suggest): sync personalization model to Firestore with debounce"
```

---

### Task 11: Toggle bật/tắt trong UtilityBeltTab

**Files:**
- Modify: `src/context/WorkspaceContext.tsx` (thêm `ghostTextEnabled` + setter, lưu localStorage key `ghost_text_enabled`)
- Modify: `src/components/tabs/UtilityBeltTab.tsx` (thêm toggle UI)
- Modify: `src/components/common/GhostTextArea.tsx`, `src/components/common/GhostTextInput.tsx` (đọc toggle qua `useWorkspace()` nếu `ghostEnabled` không truyền)

**Interfaces:**
- Consumes: `useWorkspace()`.
- Produces: `ghostTextEnabled: boolean; setGhostTextEnabled: (v: boolean) => void` trong context.

- [ ] **Step 1: Extend WorkspaceContext**

Trong `WorkspaceContext.tsx`, thêm vào interface + provider (theo đúng mẫu `useSystemGeminiKey`):

```tsx
// interface
ghostTextEnabled: boolean;
setGhostTextEnabled: (v: boolean) => void;
// state
const [ghostTextEnabled, setGhostTextEnabledState] = useState(() => localStorage.getItem('ghost_text_enabled') !== 'false');
// setter
const setGhostTextEnabled = (v: boolean) => { setGhostTextEnabledState(v); localStorage.setItem('ghost_text_enabled', String(v)); };
// add ghostTextEnabled, setGhostTextEnabled to provider value
```

- [ ] **Step 2: Make components respect the global toggle**

Trong cả 2 component, đổi tính `enabled` truyền vào hook:

```tsx
import { useWorkspace } from '../../context/WorkspaceContext';
// ...
const { ghostTextEnabled } = useWorkspace();
const effectiveEnabled = ghostEnabled !== false && ghostTextEnabled;
// dùng effectiveEnabled cho hook: { ..., enabled: effectiveEnabled }
```

- [ ] **Step 3: Add the toggle UI in UtilityBeltTab**

Thêm 1 hàng toggle "Gợi ý gõ nhanh (Ghost-text)" gọi `setGhostTextEnabled(!ghostTextEnabled)`, theo mẫu các toggle cấu hình sẵn có trong tab.

- [ ] **Step 4: Verify build + tests**

Run: `npm run lint && npm test`
Expected: No new TS errors; all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/context/WorkspaceContext.tsx src/components/tabs/UtilityBeltTab.tsx src/components/common/GhostTextArea.tsx src/components/common/GhostTextInput.tsx
git commit -m "feat(suggest): add global toggle for ghost-text suggestions"
```

---

## Self-Review

**Spec coverage:**
- §1 quyết định cốt lõi → Task 1–11 (local-only, context-aware length, all inputs, Firebase). ✔
- §2 module/luồng → Task 1–7 module, Task 10 luồng login/debounce. ✔
- §3 ba chế độ + xây model → Task 1 (build), Task 2 (suggest 3 modes). ✔
- §4 data model + rules + cap + lifecycle → Task 3 (cap/serialize), Task 4 (user/anon), Task 10 (rules + sync). ✔
- §5 render + phím tắt → Task 5 (keys), Task 6/7 (overlay). ✔
- §6 edge cases: con trỏ cuối/selection (Task 5 compute guard), IME (Task 5 composition), offline/permission (Task 4/10 try-catch). ✔
- §7 testing → Task 1–5 có test. ✔
- §8 thứ tự triển khai → Task 1→11 theo đúng thứ tự spec. ✔
- §9 YAGNI: select reorder để optional (Task 8 giữ `<select>` nguyên), không AI. ✔

**Placeholder scan:** không có TBD/“handle edge cases” trống — mọi step có code/command cụ thể. Một số bước UI (Task 9 Step 2, Task 11 Step 3) mô tả “áp cùng mẫu/đúng mẫu sẵn có” — chấp nhận được vì mẫu code đã cho đầy đủ ngay phía trên và component sẵn có trong file đích.

**Type consistency:** `SuggestContext`/`ProseContext`/`VariableContext`, `querySuggestion`, `learnPhrase`, `learnVariableValue`, `exportUserModel`, `loadUserModelFromData`, `serializeModel/deserializeModel`, `GhostTextInput`/`GhostTextArea` props — tên & chữ ký dùng nhất quán giữa các task.

---

## Lưu ý kiểm thử thủ công (sau Task 9 & 11)
Dùng preview tools: gõ vào ô biến số đã có lịch sử → thấy ghost mờ; Tab điền hết; Ctrl+→ điền 1 từ; Esc ẩn; tắt toggle → không còn ghost. Kiểm tra console không lỗi và overlay khớp vị trí chữ (font/padding).
