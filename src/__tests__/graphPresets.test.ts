import { describe, it, expect } from 'vitest';
import { NODE_PRESETS, getPreset, defaultPresetParams, renderFewShotText } from '../utils/graphPresets';
import { compileGraph, collectGraphVariables, renderNodeText } from '../utils/graphCompile';
import { GraphEdge, GraphNode, PromptProject } from '../types';

describe('NODE_PRESETS (Modifier nodes)', () => {
  it('mọi preset: id duy nhất, có params với default, render(defaults) ra text khác rỗng', () => {
    const ids = NODE_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const preset of NODE_PRESETS) {
      expect(preset.params.length).toBeGreaterThan(0);
      const defaults = defaultPresetParams(preset);
      for (const param of preset.params) {
        expect(defaults[param.key]).toBe(param.defaultValue);
        if (param.type === 'select') {
          expect(param.options!.some((o) => o.value === param.defaultValue)).toBe(true);
        }
      }
      expect(preset.render(defaults).trim().length).toBeGreaterThan(10);
    }
  });

  it('render chịu được params rỗng/sai (fallback về default, không crash)', () => {
    for (const preset of NODE_PRESETS) {
      expect(preset.render({}).trim().length).toBeGreaterThan(10);
      expect(preset.render({ nonsense: 'xxx' }).trim().length).toBeGreaterThan(10);
    }
  });

  it('output-format chế độ json ép JSON thuần; creativity đổi text theo mức', () => {
    const fmt = getPreset('output-format')!;
    expect(fmt.render({ mode: 'json' })).toContain('JSON');
    expect(fmt.render({ mode: 'json' })).not.toBe(fmt.render({ mode: 'table' }));

    const creativity = getPreset('creativity')!;
    expect(creativity.render({ level: '1' })).not.toBe(creativity.render({ level: '5' }));
    expect(creativity.render({ level: '5' })).toContain('out-of-the-box');
  });
});

describe('renderFewShotText', () => {
  it('render các cặp theo khung chuẩn, bỏ cặp trống cả hai vế', () => {
    const text = renderFewShotText([
      { input: 'Xin chào', output: 'Chào bạn! 👋' },
      { input: '', output: '' }, // trống → bỏ
      { input: 'Tạm biệt', output: 'Hẹn gặp lại!' },
    ]);
    expect(text).toContain('── Ví dụ 1 ──');
    expect(text).toContain('── Ví dụ 2 ──');
    expect(text).not.toContain('── Ví dụ 3 ──');
    expect(text).toContain('Đầu vào:\nXin chào');
    expect(text).toContain('Đầu ra mong muốn:\nChào bạn! 👋');
  });

  it('không có cặp nào → chuỗi rỗng (node không đóng góp section)', () => {
    expect(renderFewShotText([])).toBe('');
    expect(renderFewShotText([{ input: ' ', output: '' }])).toBe('');
  });
});

// ── Tích hợp với compileGraph ────────────────────────────────────────────────

const makeProject = (graphNodes: GraphNode[], edges: GraphEdge[]): PromptProject => ({
  id: 'p', name: 'test', description: '', globalEvalCriteria: [], createdAt: '', updatedAt: '',
  nodes: [], schemaVersion: 3, graphNodes, edges,
});

const rootNode: GraphNode = {
  id: 'root', kind: 'root', attrType: 'custom', title: 'Prompt Gốc',
  content: 'Nhiệm vụ lõi.', variables: [], position: { x: 0, y: 0 }, enabled: true,
};

describe('preset & fewshot node trong compileGraph', () => {
  it('preset node compile ra text đã render (không phải content rỗng)', () => {
    const presetNode: GraphNode = {
      id: 'pre', kind: 'attribute', attrType: 'constraints', title: 'Phản biện ngược',
      content: '', variables: [], position: { x: 0, y: 0 }, enabled: true,
      nodeType: 'preset', presetId: 'socratic-critic', presetParams: { rounds: '3' },
    };
    const { finalPrompt } = compileGraph(makeProject(
      [rootNode, presetNode],
      [{ id: 'e1', source: 'pre', target: 'root', targetSlot: 'constraints' }],
    ));
    expect(finalPrompt).toContain('tự phản biện giải pháp của chính mình 3 lần');
  });

  it('fewshot node compile ra khung ví dụ; biến {{var}} trong ví dụ được gom vào form', () => {
    const fewshotNode: GraphNode = {
      id: 'few', kind: 'attribute', attrType: 'example', title: 'Ví dụ mẫu',
      content: '', variables: [], position: { x: 0, y: 0 }, enabled: true,
      nodeType: 'fewshot', examples: [{ input: 'Chủ đề: {{chu_de_mau}}', output: 'Bài viết mẫu...' }],
    };
    const project = makeProject(
      [rootNode, fewshotNode],
      [{ id: 'e1', source: 'few', target: 'root', targetSlot: 'example' }],
    );
    const { finalPrompt } = compileGraph(project);
    expect(finalPrompt).toContain('── Ví dụ 1 ──');
    expect(collectGraphVariables(project).map((v) => v.name)).toContain('chu_de_mau');
  });

  it('renderNodeText: preset mất presetId fallback về content; text node giữ nguyên content', () => {
    const broken: GraphNode = { ...rootNode, id: 'b', kind: 'attribute', nodeType: 'preset', presetId: 'khong-ton-tai', content: 'fallback text' };
    expect(renderNodeText(broken)).toBe('fallback text');
    expect(renderNodeText({ ...rootNode, id: 't' })).toBe('Nhiệm vụ lõi.');
  });
});
