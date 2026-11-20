import { describe, it, expect } from 'vitest';
import {
  buildAiTransformRequest, cleanAiOutput, aiInputHash, aiNodeStatus, lostVariables, getAiOp, AI_OPS,
} from '../utils/graphAi';
import { compileGraph, compileAiNodeInput, collectGraphVariables } from '../utils/graphCompile';
import { GraphNode, PromptProject } from '../types';

const node = (over: Partial<GraphNode>): GraphNode => ({
  id: 'n', kind: 'attribute', attrType: 'task', title: 't', content: '', variables: [],
  position: { x: 0, y: 0 }, enabled: true, ...over,
});

// root ← ai (cổng task) ← src1, src2 (cổng Ghép thêm của ai)
const project = (ai: Partial<GraphNode>, extra: Partial<PromptProject> = {}): PromptProject => ({
  id: 'p', name: 'P', description: '', globalEvalCriteria: [], nodes: [], createdAt: '', updatedAt: '',
  schemaVersion: 3,
  graphNodes: [
    node({ id: 'root', kind: 'root', attrType: 'custom', content: '' }),
    node({ id: 'ai', nodeType: 'ai', aiOp: 'rewrite', ...ai }),
    node({ id: 'src1', attrType: 'custom', content: 'Viết bài về {{chude}}.', position: { x: 0, y: 0 } }),
    node({ id: 'src2', attrType: 'custom', content: 'Giọng vui vẻ.', position: { x: 0, y: 100 } }),
  ],
  edges: [
    { id: 'e1', source: 'ai', target: 'root', targetSlot: 'task' },
    { id: 'e2', source: 'src1', target: 'ai', targetSlot: 'append' },
    { id: 'e3', source: 'src2', target: 'ai', targetSlot: 'append' },
  ],
  ...extra,
});

describe('graphAi — hàm thuần', () => {
  it('yêu cầu gửi model: giữ biến, thao tác + yêu cầu của người dùng, đầu vào ở user', () => {
    const r = buildAiTransformRequest('translate', 'tiếng Anh', 'Xin chào {{ten}}');
    expect(r.systemInstruction).toContain('Dịch');
    expect(r.systemInstruction).toContain('Yêu cầu của người dùng: tiếng Anh');
    expect(r.systemInstruction).toContain('{{ten_bien}}');
    expect(r.userContent).toContain('Xin chào {{ten}}');
    expect(buildAiTransformRequest(undefined, '', 'x').systemInstruction).not.toContain('Yêu cầu của người dùng');
  });

  it('getAiOp: thao tác lạ → mặc định; translate/custom cần yêu cầu', () => {
    expect(getAiOp(undefined).id).toBe('rewrite');
    expect(AI_OPS.filter((o) => o.needsInstruction).map((o) => o.id)).toEqual(['translate', 'custom']);
  });

  it('cleanAiOutput bỏ khối ```', () => {
    expect(cleanAiOutput('```markdown\nNội dung\n```')).toBe('Nội dung');
    expect(cleanAiOutput('  Nội dung  ')).toBe('Nội dung');
  });

  it('trạng thái: không đầu vào / thiếu yêu cầu / chưa chạy / mới / cũ', () => {
    const n = node({ nodeType: 'ai', aiOp: 'rewrite' });
    expect(aiNodeStatus(n, '  ')).toBe('no-input');
    expect(aiNodeStatus({ ...n, aiOp: 'translate' }, 'x')).toBe('needs-instruction');
    expect(aiNodeStatus(n, 'x')).toBe('never-run');
    const ran = { ...n, content: 'kết quả', aiInputHash: aiInputHash(n, 'x') };
    expect(aiNodeStatus(ran, 'x')).toBe('fresh');
    expect(aiNodeStatus(ran, 'y')).toBe('stale');
    expect(aiNodeStatus({ ...ran, aiInstruction: 'ngắn hơn' }, 'x')).toBe('stale'); // đổi yêu cầu cũng là cũ
  });

  it('lostVariables', () => {
    expect(lostVariables('A {{a}} {{b}}', 'B {{a}}')).toEqual(['b']);
    expect(lostVariables('không biến', 'x')).toEqual([]);
  });
});

describe('compile với node AI', () => {
  it('chưa chạy → đầu vào đi thẳng qua', () => {
    const { finalPrompt } = compileGraph(project({}), { chude: 'mèo' });
    expect(finalPrompt).toBe('[Nhiệm vụ]\nViết bài về mèo.\n\nGiọng vui vẻ.');
  });

  it('đã chạy → kết quả THAY đầu vào, biến trong kết quả vẫn được điền', () => {
    const { finalPrompt, participatingNodeIds } = compileGraph(project({ content: 'Hãy viết một bài vui về {{chude}}.' }), { chude: 'mèo' });
    expect(finalPrompt).toBe('[Nhiệm vụ]\nHãy viết một bài vui về mèo.');
    expect(participatingNodeIds).toEqual(expect.arrayContaining(['ai', 'src1', 'src2']));
  });

  it('node AI tắt → không đóng góp; node đầu vào tắt → không vào đầu vào', () => {
    const off = project({ content: 'X' });
    off.graphNodes![1].enabled = false;
    expect(compileGraph(off, {}).finalPrompt).toBe('');
    const srcOff = project({});
    srcOff.graphNodes![3].enabled = false;
    expect(compileAiNodeInput(srcOff, 'ai')).toBe('Viết bài về {{chude}}.');
  });

  it('compileAiNodeInput giữ nguyên {{biến}} (không điền mặc định), theo thứ tự Y', () => {
    expect(compileAiNodeInput(project({}), 'ai')).toBe('Viết bài về {{chude}}.\n\nGiọng vui vẻ.');
    expect(compileAiNodeInput(project({}), 'khong-co')).toBe('');
  });

  it('biến trong đầu vào vẫn được thu thập', () => {
    expect(collectGraphVariables(project({ content: 'Kết quả {{chude}}' })).map((v) => v.name)).toContain('chude');
  });
});
