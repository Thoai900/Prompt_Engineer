// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { collectChainInputs } from '../services/chainAppService';
import { PromptProject } from '../types';

function makeProject(): PromptProject {
  return {
    id: 'p', name: 'test', description: '', globalEvalCriteria: [], createdAt: '', updatedAt: '',
    nodes: [
      {
        id: 'root', parentId: null, title: 'Bước 1', description: '', status: 'idle', position: { x: 0, y: 0 },
        blocks: [{ id: 'b1', type: 'task', title: 'Task', content: 'Viết về {{chude}} cho lớp {{lop}}.' }],
        variables: [
          { name: 'chude', type: 'text', required: true, defaultValue: 'Quang hợp' },
          { name: 'lop', type: 'text', required: true, defaultValue: '11' },
        ],
      },
      {
        id: 'child', parentId: 'root', title: 'Bước 2', description: '', status: 'idle', position: { x: 0, y: 0 },
        blocks: [{ id: 'b2', type: 'task', title: 'Task', content: 'Tóm tắt: {{Bước1.output}} theo giọng {{tone}}.' }],
        variables: [{ name: 'tone', type: 'text', required: false, defaultValue: 'thân thiện' }],
      },
    ],
  };
}

describe('collectChainInputs (Chain → App)', () => {
  it('gom biến đầu vào ngoài, LOẠI tham chiếu output tổ tiên', () => {
    const inputs = collectChainInputs(makeProject());
    const names = inputs.map((f) => f.name).sort();
    expect(names).toEqual(['chude', 'lop', 'tone']);
    expect(names).not.toContain('Bước1.output');
  });

  it('mang theo mô tả/default/required từ định nghĩa biến', () => {
    const inputs = collectChainInputs(makeProject());
    const chude = inputs.find((f) => f.name === 'chude')!;
    expect(chude.defaultValue).toBe('Quang hợp');
    expect(chude.required).toBe(true);
    const tone = inputs.find((f) => f.name === 'tone')!;
    expect(tone.required).toBe(false);
  });

  it('không trùng lặp biến dùng ở nhiều node', () => {
    const p = makeProject();
    p.nodes[1].blocks[0].content = 'Dùng lại {{chude}} và {{tone}}.';
    const names = collectChainInputs(p).map((f) => f.name);
    expect(names.filter((n) => n === 'chude').length).toBe(1);
  });
});
