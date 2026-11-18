// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AIResponseRenderer from '../components/common/AIResponseRenderer';

const renderHtml = (content: string) => render(<AIResponseRenderer content={content} />).container;

describe('AIResponseRenderer — lọc HTML thô từ phản hồi AI', () => {
  it('loại bỏ thẻ nguy hiểm: script, iframe, form, style', () => {
    const c = renderHtml(
      'Xin chào\n\n<script>window.__x=1</script><iframe src="https://evil.example"></iframe>' +
        '<form action="https://evil.example"><input name="pw"></form><style>body{display:none}</style>',
    );
    expect(c.querySelector('script')).toBeNull();
    expect(c.querySelector('iframe')).toBeNull();
    expect(c.querySelector('form')).toBeNull();
    expect(c.querySelector('style')).toBeNull();
    expect(c.textContent).toContain('Xin chào');
  });

  it('bỏ thuộc tính sự kiện và URL javascript:', () => {
    const c = renderHtml('<img src="x.png" onerror="alert(1)"> <a href="javascript:alert(1)">bấm</a>');
    expect(c.querySelector('img')?.getAttribute('onerror')).toBeNull();
    expect(c.querySelector('a')?.getAttribute('href') ?? '').not.toMatch(/^javascript:/i);
  });

  it('vẫn giữ khối <thinking>/<response> tuỳ biến', () => {
    const c = renderHtml('<thinking>\n\nlập luận\n\n</thinking>\n\n<response>\n\nđáp án\n\n</response>');
    expect(c.textContent).toContain('Suy luận hệ thống');
    expect(c.textContent).toContain('lập luận');
    expect(c.textContent).toContain('Kết quả trả về');
    expect(c.textContent).toContain('đáp án');
  });

  it('vẫn nhận ngôn ngữ của code block (class language-*)', () => {
    const c = renderHtml('```python\nprint(1)\n```');
    expect(c.textContent).toContain('python');
    expect(c.textContent).toContain('Copy');
  });
});
