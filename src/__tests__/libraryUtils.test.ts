import { describe, it, expect } from 'vitest';
import { seededCount, buildShareUrl, parseSharedTemplateId } from '../utils/libraryUtils';

describe('seededCount', () => {
  it('ổn định cho cùng seed (không random)', () => {
    expect(seededCount('abc', 1000)).toBe(seededCount('abc', 1000));
  });

  it('luôn nằm trong [0, max)', () => {
    for (const seed of ['', 'x', 'template-123', 'sys-qa-tiktok-script']) {
      const v = seededCount(seed, 500);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(500);
    }
  });

  it('seed khác nhau thường cho giá trị khác nhau', () => {
    expect(seededCount('alpha', 100000)).not.toBe(seededCount('beta', 100000));
  });

  it('max <= 0 trả về 0 (không chia cho 0)', () => {
    expect(seededCount('abc', 0)).toBe(0);
  });
});

describe('buildShareUrl', () => {
  it('ghép query param + hash tab library', () => {
    expect(buildShareUrl('https://app.test', '/', 'tpl-1')).toBe('https://app.test/?t=tpl-1#library');
  });

  it('encode id có ký tự đặc biệt', () => {
    expect(buildShareUrl('https://app.test', '/app', 'a b/c')).toBe('https://app.test/app?t=a%20b%2Fc#library');
  });
});

describe('parseSharedTemplateId', () => {
  it('đọc id từ ?t=', () => {
    expect(parseSharedTemplateId('?t=tpl-9')).toBe('tpl-9');
  });

  it('null khi không có tham số t', () => {
    expect(parseSharedTemplateId('')).toBeNull();
    expect(parseSharedTemplateId('?x=1')).toBeNull();
  });

  it('giải mã giá trị đã encode (đối xứng với buildShareUrl)', () => {
    const url = buildShareUrl('https://app.test', '/', 'a b/c');
    const search = url.slice(url.indexOf('?'), url.indexOf('#'));
    expect(parseSharedTemplateId(search)).toBe('a b/c');
  });
});
