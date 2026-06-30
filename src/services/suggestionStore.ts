import {
  SuggestionModel, SerializedModel, SuggestContext,
  buildModelFromCorpus, createEmptyModel, addPhraseToModel, addVariableValue,
  mergeModel, capModel, serializeModel, deserializeModel, suggest, MAX_PHRASES,
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

// ── Taste model (Lab · Tầng 2 #5: cá nhân hoá) ──────────────────────────────
// Dạy mô hình từ chính prompt người dùng LƯU (không chỉ lúc gõ ghost-text), để
// gợi ý ngày càng "đúng giọng" họ. Sync hiện có sẽ tự lưu vì dirty=true.
export function learnFromTemplate(blocks: { content?: string }[] | undefined | null): void {
  if (!blocks) return;
  for (const b of blocks) { if (b?.content) learnPhrase(b.content); }
}

export interface TasteInsights {
  phraseCount: number;
  varCount: number;
  recentPhrases: string[];
  topValues: { varName: string; values: string[] }[];
  topTerms: { term: string; count: number }[];
  strength: number; // 0–100 (độ "hiểu bạn")
}

/** Trích phần đã học RIÊNG của người dùng (userModel) để hiển thị hồ sơ phong cách. */
export function getTasteInsights(): TasteInsights {
  const phraseCount = userModel.phrases.length;
  const varCount = userModel.varValues.size;
  const recentPhrases = userModel.phrases.slice(-8).reverse();

  const topValues = [...userModel.varValues.entries()]
    .map(([varName, inner]) => ({
      varName,
      total: [...inner.values()].reduce((s, c) => s + c, 0),
      values: [...inner.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map((e) => e[0]),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)
    .map(({ varName, values }) => ({ varName, values }));

  const termCounts = new Map<string, number>();
  for (const [term, inner] of userModel.bigrams) {
    if (term.length < 3) continue; // bỏ token quá ngắn
    let s = 0; for (const c of inner.values()) s += c;
    termCounts.set(term, (termCounts.get(term) || 0) + s);
  }
  const topTerms = [...termCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([term, count]) => ({ term, count }));

  const strength = Math.min(100, Math.round((phraseCount / MAX_PHRASES) * 100));
  return { phraseCount, varCount, recentPhrases, topValues, topTerms, strength };
}

/** Xoá toàn bộ phần đã học của người dùng (privacy). Sync sẽ ghi đè empty lên Firestore. */
export function resetTasteModel(): void {
  runtime = buildModelFromCorpus();
  userModel = createEmptyModel();
  dirty = true;
  clearAnonLocalStorage();
}
