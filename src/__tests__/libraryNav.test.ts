import { describe, it, expect } from 'vitest';
import { parseLibraryKind } from '../services/libraryNav';

describe('parseLibraryKind', () => {
  it('nhận 4 loại hợp lệ, còn lại → null', () => {
    expect(parseLibraryKind('templates')).toBe('templates');
    expect(parseLibraryKind('configs')).toBe('configs');
    expect(parseLibraryKind('rulesskills')).toBeNull();
    expect(parseLibraryKind('')).toBeNull();
    expect(parseLibraryKind(null)).toBeNull();
  });
});
