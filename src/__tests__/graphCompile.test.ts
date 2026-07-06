import { describe, it, expect } from 'vitest';
import {
  compileGraph, collectGraphVariables, wouldCreateCycle, computeGraphLayout, LAYOUT,
} from '../utils/graphCompile';
import { GraphEdge, GraphNode, PromptProject } from '../types';

const attr = (id: string, over: Partial<GraphNode> = {}): GraphNode => ({
  id,
  kind: 'attribute',
  attrType: 'custom',
  title: id,
  content: `Nội dung ${id}`,
  variables: [],
  position: { x: 0, y: 0 },
  enabled: true,
  ...over,
});

const makeProject = (graphNodes: GraphNode[], edges: GraphEdge[]): PromptProject => ({
  id: 'p', name: 'test', description: '', globalEvalCriteria: [], createdAt: '', updatedAt: '',
  nodes: [], schemaVersion: 3, graphNodes, edges,
});

const root = (content = 'Nhiệm vụ chính về {{chu_de}}.'): GraphNode =>
  attr('root', {
    kind: 'root',
    title: 'Prompt Gốc',
    content,
    variables: [{ name: 'chu_de', type: 'text', required: true, defaultValue: 'mặc định' }],
  });

describe('compileGraph', () => {
  it('ghép section theo thứ tự cổng cố định, nội dung lõi nằm sau Ngữ cảnh', () => {
    const nodes = [
      root(),
      attr('c1', { attrType: 'constraints', content: 'Ràng buộc A' }),
      attr('r1', { attrType: 'role', content: 'Bạn là chuyên gia.' }),
    ];
    const edges: GraphEdge[] = [
      { id: 'e1', source: 'c1', target: 'root', targetSlot: 'constraints' },
      { id: 'e2', source: 'r1', target: 'root', targetSlot: 'role' },
    ];
    const { finalPrompt, sections } = compileGraph(makeProject(nodes, edges));
    expect(sections.map((s) => s.slot)).toEqual(['role', 'task', 'constraints']);
    expect(finalPrompt.indexOf('[Vai trò]')).toBeLessThan(finalPrompt.indexOf('[Nhiệm vụ]'));
    expect(finalPrompt.indexOf('[Nhiệm vụ]')).toBeLessThan(finalPrompt.indexOf('[Ràng buộc]'));
  });

  it('nhiều node cùng cổng: sort theo Y, chỉ node đầu in tiêu đề section', () => {
    const nodes = [
      root(),
      attr('c-duoi', { attrType: 'constraints', content: 'Ràng buộc dưới', position: { x: 0, y: 300 } }),
      attr('c-tren', { attrType: 'constraints', content: 'Ràng buộc trên', position: { x: 0, y: 10 } }),
    ];
    const edges: GraphEdge[] = [
      { id: 'e1', source: 'c-duoi', target: 'root', targetSlot: 'constraints' },
      { id: 'e2', source: 'c-tren', target: 'root', targetSlot: 'constraints' },
    ];
    const { finalPrompt, sections } = compileGraph(makeProject(nodes, edges));
    const cons = sections.filter((s) => s.slot === 'constraints');
    expect(cons.map((s) => s.nodeId)).toEqual(['c-tren', 'c-duoi']);
    expect(cons[0].showHeader).toBe(true);
    expect(cons[1].showHeader).toBe(false);
    expect(finalPrompt.match(/\[Ràng buộc\]/g)?.length).toBe(1);
    expect(finalPrompt.indexOf('Ràng buộc trên')).toBeLessThan(finalPrompt.indexOf('Ràng buộc dưới'));
  });

  it('node tắt (mute) bị loại cùng toàn bộ nhánh upstream của nó', () => {
    const nodes = [
      root(),
      attr('t1', { attrType: 'tone', content: 'Giọng thân thiện', enabled: false }),
      attr('t2', { attrType: 'tone', content: 'Chi tiết giọng', position: { x: -100, y: 0 } }),
    ];
    const edges: GraphEdge[] = [
      { id: 'e1', source: 't1', target: 'root', targetSlot: 'tone' },
      { id: 'e2', source: 't2', target: 't1', targetSlot: 'append' },
    ];
    const { finalPrompt, participatingNodeIds } = compileGraph(makeProject(nodes, edges));
    expect(finalPrompt).not.toContain('Giọng thân thiện');
    expect(finalPrompt).not.toContain('Chi tiết giọng');
    expect(participatingNodeIds).not.toContain('t1');
    expect(participatingNodeIds).not.toContain('t2');
  });

  it('cổng Ghép thêm nối tiếp nội dung node con vào node cha (đệ quy)', () => {
    const nodes = [
      root(),
      attr('c1', { attrType: 'constraints', content: 'Ràng buộc chính' }),
      attr('c2', { attrType: 'constraints', content: 'Ràng buộc phụ' }),
    ];
    const edges: GraphEdge[] = [
      { id: 'e1', source: 'c1', target: 'root', targetSlot: 'constraints' },
      { id: 'e2', source: 'c2', target: 'c1', targetSlot: 'append' },
    ];
    const { sections } = compileGraph(makeProject(nodes, edges));
    const cons = sections.find((s) => s.nodeId === 'c1')!;
    expect(cons.text).toContain('Ràng buộc chính');
    expect(cons.text).toContain('Ràng buộc phụ');
  });

  it('thay biến: inputs ưu tiên hơn defaultValue, thiếu thì giữ placeholder', () => {
    const nodes = [root('Chủ đề: {{chu_de}}. Khác: {{chua_khai_bao}}.')];
    const p = makeProject(nodes, []);
    expect(compileGraph(p, { chu_de: 'AI' }).finalPrompt).toContain('Chủ đề: AI.');
    expect(compileGraph(p, {}).finalPrompt).toContain('Chủ đề: mặc định.');
    expect(compileGraph(p, {}).finalPrompt).toContain('{{chua_khai_bao}}');
  });

  it('cổng Nhiệm vụ (v3.2): nội dung lõi đứng trước các Task Node, tiêu đề [Nhiệm vụ] in 1 lần', () => {
    const nodes = [
      root('Lõi của root.'),
      attr('t-duoi', { attrType: 'task', content: 'Task phụ', position: { x: 0, y: 300 } }),
      attr('t-tren', { attrType: 'task', content: 'Task chính', position: { x: 0, y: 10 } }),
    ];
    const edges: GraphEdge[] = [
      { id: 'e1', source: 't-duoi', target: 'root', targetSlot: 'task' },
      { id: 'e2', source: 't-tren', target: 'root', targetSlot: 'task' },
    ];
    const { finalPrompt, sections } = compileGraph(makeProject(nodes, edges));
    const tasks = sections.filter((s) => s.slot === 'task');
    expect(tasks.map((s) => s.nodeId)).toEqual(['root', 't-tren', 't-duoi']);
    expect(tasks.map((s) => s.showHeader)).toEqual([true, false, false]);
    expect(finalPrompt.match(/\[Nhiệm vụ\]/g)?.length).toBe(1);
  });

  it('root TRỐNG + Task Node cắm vào: task node nhận tiêu đề section (mô hình compiler thuần)', () => {
    const nodes = [
      root(''),
      attr('t1', { attrType: 'task', content: 'Toàn bộ nhiệm vụ nằm ở node này.' }),
    ];
    const edges: GraphEdge[] = [{ id: 'e1', source: 't1', target: 'root', targetSlot: 'task' }];
    const { finalPrompt, sections } = compileGraph(makeProject(nodes, edges));
    const tasks = sections.filter((s) => s.slot === 'task');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].nodeId).toBe('t1');
    expect(tasks[0].showHeader).toBe(true);
    expect(finalPrompt).toContain('[Nhiệm vụ]\nToàn bộ nhiệm vụ nằm ở node này.');
  });

  it('node không nối dây không tham gia prompt', () => {
    const nodes = [root(), attr('moco', { attrType: 'role', content: 'Không được xuất hiện' })];
    const { finalPrompt } = compileGraph(makeProject(nodes, []));
    expect(finalPrompt).not.toContain('Không được xuất hiện');
  });

  it('không có root → trả rỗng, không crash', () => {
    const { finalPrompt, sections } = compileGraph(makeProject([attr('a')], []));
    expect(finalPrompt).toBe('');
    expect(sections).toEqual([]);
  });
});

describe('collectGraphVariables', () => {
  it('gom biến khai báo + biến chưa khai báo trong content của node tham gia', () => {
    const nodes = [
      root('Lõi {{chu_de}} và {{an_danh}}.'),
      attr('r1', { attrType: 'role', content: 'Vai {{vai}}' }),
      attr('moco', { attrType: 'role', content: 'Mồ côi {{bien_mo_coi}}' }),
    ];
    const edges: GraphEdge[] = [{ id: 'e1', source: 'r1', target: 'root', targetSlot: 'role' }];
    const names = collectGraphVariables(makeProject(nodes, edges)).map((v) => v.name);
    expect(names).toContain('chu_de');
    expect(names).toContain('an_danh');
    expect(names).toContain('vai');
    expect(names).not.toContain('bien_mo_coi'); // node mồ côi không tham gia
    expect(names.filter((n) => n === 'chu_de').length).toBe(1);
  });
});

describe('wouldCreateCycle', () => {
  const edges: GraphEdge[] = [
    { id: 'e1', source: 'a', target: 'b', targetSlot: 'append' },
    { id: 'e2', source: 'b', target: 'root', targetSlot: 'role' },
  ];
  it('phát hiện chu trình khi nối ngược', () => {
    expect(wouldCreateCycle(edges, 'root', 'a')).toBe(true); // root → a nhưng a đã chảy về root
    expect(wouldCreateCycle(edges, 'b', 'a')).toBe(true);
    expect(wouldCreateCycle(edges, 'a', 'a')).toBe(true);
  });
  it('cho phép nối hợp lệ', () => {
    expect(wouldCreateCycle(edges, 'a', 'root')).toBe(false);
  });
});

describe('computeGraphLayout', () => {
  it('root ở cột phải cùng, upstream lùi dần sang trái, không node nào trùng chỗ', () => {
    const nodes = [
      root(),
      attr('r1', { attrType: 'role' }),
      attr('c1', { attrType: 'constraints' }),
      attr('c2', { attrType: 'constraints' }),
      attr('moco', { attrType: 'custom' }),
    ];
    const edges: GraphEdge[] = [
      { id: 'e1', source: 'r1', target: 'root', targetSlot: 'role' },
      { id: 'e2', source: 'c1', target: 'root', targetSlot: 'constraints' },
      { id: 'e3', source: 'c2', target: 'c1', targetSlot: 'append' },
    ];
    const pos = computeGraphLayout(nodes, edges);
    expect(pos.get('root')!.x).toBe(LAYOUT.rootX);
    expect(pos.get('r1')!.x).toBe(LAYOUT.rootX - LAYOUT.colWidth);
    expect(pos.get('c2')!.x).toBe(LAYOUT.rootX - 2 * LAYOUT.colWidth);
    // node mồ côi có chỗ riêng
    expect(pos.get('moco')).toBeDefined();
    const all = [...pos.values()].map((p) => `${p.x},${p.y}`);
    expect(new Set(all).size).toBe(all.length);
  });
});
