import { describe, it, expect } from 'vitest';
import { computeUnifiedDiff } from '../utils/chainUtils';

describe('computeUnifiedDiff', () => {
  it('marks identical text as fully unchanged', () => {
    const result = computeUnifiedDiff('a\nb\nc', 'a\nb\nc');
    expect(result).toEqual([
      { type: 'unchanged', text: 'a' },
      { type: 'unchanged', text: 'b' },
      { type: 'unchanged', text: 'c' },
    ]);
  });

  it('detects a single added line in the middle', () => {
    const result = computeUnifiedDiff('a\nc', 'a\nb\nc');
    expect(result).toEqual([
      { type: 'unchanged', text: 'a' },
      { type: 'added', text: 'b' },
      { type: 'unchanged', text: 'c' },
    ]);
  });

  it('detects a single removed line in the middle', () => {
    const result = computeUnifiedDiff('a\nb\nc', 'a\nc');
    expect(result).toEqual([
      { type: 'unchanged', text: 'a' },
      { type: 'removed', text: 'b' },
      { type: 'unchanged', text: 'c' },
    ]);
  });

  it('treats a fully changed line as removed + added pair', () => {
    const result = computeUnifiedDiff('hello', 'world');
    expect(result).toEqual([
      { type: 'removed', text: 'hello' },
      { type: 'added', text: 'world' },
    ]);
  });

  it('classifies real lines as added when old text is empty', () => {
    // Quirk đã biết: '' split thành [''] nên có 1 dòng rỗng bị tính 'removed';
    // các dòng nội dung thật ('x', 'y') đều là 'added'.
    const result = computeUnifiedDiff('', 'x\ny');
    expect(result.filter((l) => l.type === 'added').map((l) => l.text)).toEqual(['x', 'y']);
    expect(result.filter((l) => l.type === 'removed').map((l) => l.text)).toEqual(['']);
  });

  it('classifies real lines as removed when new text is empty', () => {
    const result = computeUnifiedDiff('x\ny', '');
    expect(result.filter((l) => l.type === 'removed').map((l) => l.text)).toEqual(['x', 'y']);
    expect(result.filter((l) => l.type === 'added').map((l) => l.text)).toEqual(['']);
  });
});
