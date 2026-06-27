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
