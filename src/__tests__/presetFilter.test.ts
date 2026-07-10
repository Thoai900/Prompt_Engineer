import { describe, it, expect } from 'vitest';
import { listDomains, filterByDomain } from '../utils/presetFilter';

const items = [{ domain: 'Dev' }, { domain: 'Marketing' }, { domain: 'Dev' }, {}];

describe('listDomains', () => {
  it('distinct theo thứ tự xuất hiện + "Khác" nếu có item không domain', () => {
    expect(listDomains(items)).toEqual(['Dev', 'Marketing', 'Khác']);
  });
  it('không có item trống → không có "Khác"', () => {
    expect(listDomains([{ domain: 'A' }, { domain: 'A' }])).toEqual(['A']);
  });
});

describe('filterByDomain', () => {
  it('null → trả tất cả', () => {
    expect(filterByDomain(items, null).length).toBe(4);
  });
  it('domain cụ thể → chỉ item khớp', () => {
    expect(filterByDomain(items, 'Dev').length).toBe(2);
  });
  it('"Khác" → item không có domain', () => {
    expect(filterByDomain(items, 'Khác').length).toBe(1);
  });
});
