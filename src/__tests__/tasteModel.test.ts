// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetStoreForTest, learnFromTemplate, learnPhrase, getTasteInsights, resetTasteModel,
} from '../services/suggestionStore';

beforeEach(() => { resetStoreForTest(); localStorage.clear(); });

describe('taste model (Lab #5)', () => {
  it('khởi đầu rỗng (chỉ tính phần học của user, không tính corpus)', () => {
    const t = getTasteInsights();
    expect(t.phraseCount).toBe(0);
    expect(t.varCount).toBe(0);
    expect(t.strength).toBe(0);
  });

  it('học từ template làm tăng phraseCount + recentPhrases + strength', () => {
    learnFromTemplate([
      { content: 'Viết email chuyên nghiệp cho khách hàng doanh nghiệp.' },
      { content: 'Giọng văn thân thiện nhưng vẫn rõ ràng và súc tích.' },
    ]);
    const t = getTasteInsights();
    expect(t.phraseCount).toBeGreaterThan(0);
    expect(t.recentPhrases.length).toBeGreaterThan(0);
    expect(t.strength).toBeGreaterThan(0);
    expect(t.topTerms.length).toBeGreaterThan(0);
  });

  it('bỏ qua block rỗng / null an toàn', () => {
    learnFromTemplate(null);
    learnFromTemplate([{ content: '' }, {}]);
    expect(getTasteInsights().phraseCount).toBe(0);
  });

  it('reset xoá sạch phần đã học của user', () => {
    learnPhrase('Một câu đủ dài để mô hình học phong cách người dùng.');
    expect(getTasteInsights().phraseCount).toBeGreaterThan(0);
    resetTasteModel();
    expect(getTasteInsights().phraseCount).toBe(0);
  });
});
