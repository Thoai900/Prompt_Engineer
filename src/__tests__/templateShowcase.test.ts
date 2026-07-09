import { describe, it, expect } from 'vitest';
import { getShowcase, TEMPLATE_SHOWCASE } from '../data/templateShowcase';

describe('getShowcase', () => {
  it('template built-in có showcase → trả hook + input + output, hasResult=true', () => {
    const r = getShowcase({ id: 'master-video-script' });
    expect(r.hasResult).toBe(true);
    expect(r.hook).toBeTruthy();
    expect(r.input).toBeTruthy();
    expect(r.output).toBeTruthy();
    expect(r.outputType).toBe('video');
  });

  it('outputType của showcase thắng outputExample.type', () => {
    const r = getShowcase({ id: 'student-tutor', outputExample: { type: 'text' } });
    expect(r.outputType).toBe(TEMPLATE_SHOWCASE['student-tutor'].outputType);
  });

  it('không có showcase → dùng outputExample (content + input)', () => {
    const r = getShowcase({
      id: 'khong-ton-tai',
      outputExample: { type: 'code', input: 'viết hàm sort', content: 'sort() {}' },
    });
    expect(r.hasResult).toBe(true);
    expect(r.input).toBe('viết hàm sort');
    expect(r.output).toBe('sort() {}');
    expect(r.outputType).toBe('code');
  });

  it('outputExample.content rỗng nhưng có input → hasResult=true qua input, output undefined', () => {
    const r = getShowcase({ id: 'x', outputExample: { type: 'text', input: 'gì đó', content: '' } });
    expect(r.hasResult).toBe(true);
    expect(r.input).toBe('gì đó');
    expect(r.output).toBeUndefined();
  });

  it('không showcase, không outputExample → degrade (hasResult=false, outputType text, hook undefined)', () => {
    const r = getShowcase({ id: 'trong-rong' });
    expect(r.hasResult).toBe(false);
    expect(r.hook).toBeUndefined();
    expect(r.input).toBeUndefined();
    expect(r.output).toBeUndefined();
    expect(r.outputType).toBe('text');
  });

  it('mọi entry showcase có đủ hook/input/output không rỗng', () => {
    for (const [id, s] of Object.entries(TEMPLATE_SHOWCASE)) {
      expect(s.hook.trim(), `${id}.hook`).not.toBe('');
      expect(s.input.trim(), `${id}.input`).not.toBe('');
      expect(s.output.trim(), `${id}.output`).not.toBe('');
    }
  });
});
