// @vitest-environment jsdom
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
