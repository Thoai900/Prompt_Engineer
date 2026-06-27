import { describe, it, expect } from 'vitest';
import { renderSkillPrompt } from '../services/aiService';

describe('renderSkillPrompt', () => {
  it('replaces a single {{var}} with its value', () => {
    const out = renderSkillPrompt('Xin chào {{name}}!', { name: 'An' });
    expect(out).toBe('Xin chào An!');
  });

  it('replaces multiple distinct variables', () => {
    const out = renderSkillPrompt('{{greeting}}, {{name}}.', {
      greeting: 'Chào',
      name: 'Bình',
    });
    expect(out).toBe('Chào, Bình.');
  });

  it('replaces every occurrence of a repeated variable', () => {
    const out = renderSkillPrompt('{{x}} + {{x}} = song song', { x: '1' });
    expect(out).toBe('1 + 1 = song song');
  });

  it('renders boolean values as Có/Không', () => {
    const out = renderSkillPrompt('Nâng cao: {{adv}} / Cơ bản: {{basic}}', {
      adv: true,
      basic: false,
    });
    expect(out).toBe('Nâng cao: Có / Cơ bản: Không');
  });

  it('tolerates whitespace inside the braces', () => {
    const out = renderSkillPrompt('Lớp {{  grade  }}', { grade: '10' });
    expect(out).toBe('Lớp 10');
  });

  it('leaves unknown variables untouched', () => {
    const out = renderSkillPrompt('{{known}} và {{unknown}}', { known: 'A' });
    expect(out).toBe('A và {{unknown}}');
  });

  it('does not confuse partial-name variables (grade vs grade_level)', () => {
    const out = renderSkillPrompt('{{grade}} | {{grade_level}}', {
      grade: 'Toán',
      grade_level: '12',
    });
    expect(out).toBe('Toán | 12');
  });

  it('inserts values literally, even with regex/$ special characters', () => {
    const out = renderSkillPrompt('Giá: {{price}}', { price: '$1 (giảm $0.5)' });
    expect(out).toBe('Giá: $1 (giảm $0.5)');
  });

  it('treats an explicitly empty string as a provided empty value', () => {
    const out = renderSkillPrompt('[{{note}}]', { note: '' });
    expect(out).toBe('[]');
  });

  it('returns instructions unchanged when there are no tokens', () => {
    const text = 'Không có biến nào ở đây.';
    expect(renderSkillPrompt(text, { x: 'y' })).toBe(text);
  });
});
