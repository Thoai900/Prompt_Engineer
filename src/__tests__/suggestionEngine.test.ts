import { describe, it, expect } from 'vitest';
import {
  createEmptyModel,
  tokenize,
  addPhraseToModel,
  addVariableValue,
  buildModelFromCorpus,
  suggest,
  mergeModel,
  capModel,
  serializeModel,
  deserializeModel,
  MAX_PHRASES,
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

describe('suggestionEngine suggest()', () => {
  it('prose prefix mode completes the rest of a matching phrase on partial line', () => {
    const m = createEmptyModel();
    addPhraseToModel(m, 'Bạn là một Mentor AI thân thiện', 5);
    const ghost = suggest(m, { mode: 'prose', textBeforeCursor: 'Bạn là một Men' });
    expect(ghost).toBe('tor AI thân thiện');
  });

  it('prose ngram mode extends mid-sentence using n-grams, confidence-gated', () => {
    const m = createEmptyModel();
    addPhraseToModel(m, 'hãy giải thích từng bước', 3);
    addPhraseToModel(m, 'hãy giải thích từng bước', 3);
    const ghost = suggest(m, { mode: 'prose', textBeforeCursor: 'Mở đầu rồi hãy giải ' });
    expect(ghost.trim().startsWith('thích')).toBe(true);
  });

  it('prose returns empty when next-word count below MIN_NGRAM_COUNT', () => {
    const m = createEmptyModel();
    addPhraseToModel(m, 'qqq zzz', 1);
    const ghost = suggest(m, { mode: 'prose', textBeforeCursor: 'foo qqq ' });
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
