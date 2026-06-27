// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getGroqApiKey, isGroqConfigured, GROQ_API_KEY_STORAGE } from '../services/aiService';

describe('Groq (Llama-3-8B) key resolution', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty when no key is configured anywhere', () => {
    expect(getGroqApiKey()).toBe('');
    expect(isGroqConfigured()).toBe(false);
  });

  it('reads the user key stored in localStorage', () => {
    localStorage.setItem(GROQ_API_KEY_STORAGE, 'gsk_local');
    expect(getGroqApiKey()).toBe('gsk_local');
    expect(isGroqConfigured()).toBe(true);
  });

  it('prefers an explicit key over the stored one', () => {
    localStorage.setItem(GROQ_API_KEY_STORAGE, 'gsk_local');
    expect(getGroqApiKey('gsk_explicit')).toBe('gsk_explicit');
  });

  it('trims whitespace and treats blank values as unconfigured', () => {
    localStorage.setItem(GROQ_API_KEY_STORAGE, '   ');
    expect(getGroqApiKey()).toBe('');
    expect(getGroqApiKey('  gsk_padded  ')).toBe('gsk_padded');
  });
});
