import { describe, it, expect } from 'vitest';
import {
  migrateProjectToGraph, isGraphProject, stripLegacyRefs, createEmptyGraphProject,
  addTemplateAsAttributeNode, blockTypeToSlot, templateToGraphProject, parseRawPromptToGraph,
} from '../utils/graphMigration';
import { compileGraph } from '../utils/graphCompile';
import { PromptProject } from '../types';

const legacyProject = (): PromptProject => ({
  id: 'p-legacy', name: 'Dự án cũ', description: '', globalEvalCriteria: [], createdAt: '', updatedAt: '',
  nodes: [
    {
      id: 'node-root', parentId: null, title: '1. Phân tích', description: '', status: 'idle',
      position: { x: 100, y: 220 },
      blocks: [
        { id: 'b1', type: 'role', title: 'Vai trò (Role)', content: 'Bạn là Mentor AI.' },
        { id: 'b2', type: 'task', title: 'Nhiệm vụ (Task)', content: 'Phân tích chủ đề {{subject}}.' },
      ],
      variables: [{ name: 'subject', type: 'text', required: true, defaultValue: 'Quang hợp' }],
    },
    {
      id: 'node-child', parentId: 'node-root', title: '2. Soạn bài', description: '', status: 'idle',
      position: { x: 450, y: 100 }, branchType: 'failure',
      blocks: [
        { id: 'b3', type: 'context', title: 'Ngữ cảnh', content: 'Kết quả trước: {{1.PhântíchChủđề.output}}' },
        { id: 'b4', type: 'task', title: 'Nhiệm vụ', content: 'Soạn bài giảng chi tiết.' },
      ],
      variables: [],
    },
  ],
  versions: [{ id: 'v1', timestamp: '', content: 'x', description: 'y' }],
});

describe('migrateProjectToGraph', () => {
  it('block task của root cũ thành nội dung lõi, block còn lại thành node thuộc tính đã nối dây', () => {
    const migrated = migrateProjectToGraph(legacyProject());
    expect(isGraphProject(migrated)).toBe(true);

    const root = migrated.graphNodes!.find((n) => n.kind === 'root')!;
    expect(root.content).toContain('Phân tích chủ đề {{subject}}');
    expect(root.variables.map((v) => v.name)).toContain('subject');

    const roleNode = migrated.graphNodes!.find((n) => n.attrType === 'role')!;
    expect(roleNode.content).toContain('Bạn là Mentor AI');
    expect(roleNode.enabled).toBe(true);
    const edge = migrated.edges!.find((e) => e.source === roleNode.id)!;
    expect(edge.target).toBe(root.id);
    expect(edge.targetSlot).toBe('role');
  });

  it('node con cũ thành node fix/custom TẮT, chưa nối dây, gộp blocks + thay tham chiếu cũ', () => {
    const migrated = migrateProjectToGraph(legacyProject());
    const child = migrated.graphNodes!.find((n) => n.id === 'node-child')!;
    expect(child.attrType).toBe('fix'); // branchType failure → fix
    expect(child.enabled).toBe(false);
    expect(migrated.edges!.some((e) => e.source === child.id)).toBe(false);
    expect(child.content).toContain('[Tham chiếu cũ: 1.PhântíchChủđề.output]');
    expect(child.content).toContain('Soạn bài giảng chi tiết');
  });

  it('prompt compile được ngay sau migration (root + role tham gia, node tắt thì không)', () => {
    const migrated = migrateProjectToGraph(legacyProject());
    const { finalPrompt } = compileGraph(migrated, { subject: 'Điện từ' });
    expect(finalPrompt).toContain('Bạn là Mentor AI');
    expect(finalPrompt).toContain('Điện từ');
    expect(finalPrompt).not.toContain('Soạn bài giảng');
  });

  it('idempotent: project v3 trả về nguyên vẹn; giữ versions/testCases', () => {
    const once = migrateProjectToGraph(legacyProject());
    expect(migrateProjectToGraph(once)).toBe(once);
    expect(once.versions?.length).toBe(1);
    expect(once.nodes).toEqual([]);
  });

  it('project không có node nào vẫn tạo được root rỗng', () => {
    const empty = migrateProjectToGraph({ ...legacyProject(), nodes: [] });
    expect(empty.graphNodes!.some((n) => n.kind === 'root')).toBe(true);
  });
});

describe('stripLegacyRefs', () => {
  it('thay cả 3 cú pháp cũ, giữ nguyên biến thường', () => {
    const input = 'A {{output_1}} B {{parent.output}} C {{Tên.output}} D {{bien_thuong}}';
    const out = stripLegacyRefs(input);
    expect(out).toContain('[Tham chiếu cũ: output_1]');
    expect(out).toContain('[Tham chiếu cũ: parent.output]');
    expect(out).toContain('[Tham chiếu cũ: Tên.output]');
    expect(out).toContain('{{bien_thuong}}');
  });
});

describe('helpers', () => {
  it('createEmptyGraphProject tạo project v3 với 1 root', () => {
    const p = createEmptyGraphProject('Mới', 'mô tả', 'ws1');
    expect(isGraphProject(p)).toBe(true);
    expect(p.graphNodes!.filter((n) => n.kind === 'root').length).toBe(1);
    expect(p.workspaceId).toBe('ws1');
  });

  it('addTemplateAsAttributeNode thêm node chưa nối dây, tự migrate project cũ', () => {
    const p = addTemplateAsAttributeNode(legacyProject(), {
      title: 'Mẫu giọng điệu',
      blocks: [{ id: 't1', type: 'tone', title: 'Giọng', content: 'Giọng trang trọng.' }],
    });
    expect(isGraphProject(p)).toBe(true);
    const added = p.graphNodes!.find((n) => n.title === 'Mẫu giọng điệu')!;
    expect(added.attrType).toBe('tone');
    expect(p.edges!.some((e) => e.source === added.id)).toBe(false);
  });

  it('blockTypeToSlot map các loại lạ về custom', () => {
    expect(blockTypeToSlot('thinking')).toBe('custom');
    expect(blockTypeToSlot('role')).toBe('role');
  });
});

describe('templateToGraphProject (Studio → Prompt Graph, đợt 2)', () => {
  const template = {
    title: 'Kịch bản TikTok',
    description: 'Video ngắn',
    blocks: [
      { id: 'b1', type: 'role' as const, title: '🎭 Vai trò', content: 'Bạn là biên kịch.' },
      { id: 'b2', type: 'task' as const, title: '🎯 Nhiệm vụ', content: 'Viết kịch bản {{chu_de}}.' },
      { id: 'b3', type: 'constraints' as const, title: '📏 Quy tắc', content: 'Hook 3 giây đầu.' },
      { id: 'b4', type: 'format' as const, title: '📋 Định dạng', content: '' }, // rỗng → bỏ
    ],
    variables: [{ name: 'chu_de', type: 'text' as const, required: true }],
  };

  it('task → lõi Prompt Gốc, block khác → node thuộc tính đã nối dây đúng cổng', () => {
    const proj = templateToGraphProject(template, 'ws-1');
    expect(isGraphProject(proj)).toBe(true);
    expect(proj.name).toBe('Kịch bản TikTok');
    expect(proj.workspaceId).toBe('ws-1');

    const root = proj.graphNodes!.find((n) => n.kind === 'root')!;
    expect(root.content).toBe('Viết kịch bản {{chu_de}}.');
    expect(root.variables.map((v) => v.name)).toEqual(['chu_de']);

    // 2 node thuộc tính (block rỗng bị loại), tất cả BẬT và nối dây vào root.
    const attrs = proj.graphNodes!.filter((n) => n.kind === 'attribute');
    expect(attrs).toHaveLength(2);
    expect(attrs.every((a) => a.enabled)).toBe(true);
    for (const a of attrs) {
      const edge = proj.edges!.find((e) => e.source === a.id)!;
      expect(edge.target).toBe(root.id);
      expect(edge.targetSlot).toBe(a.attrType);
    }
    expect(attrs.map((a) => a.attrType).sort()).toEqual(['constraints', 'role']);
  });

  it('compile được ngay: prompt cuối chứa đủ nội dung các khối', () => {
    const proj = templateToGraphProject(template);
    const { finalPrompt } = compileGraph(proj);
    expect(finalPrompt).toContain('Bạn là biên kịch.');
    expect(finalPrompt).toContain('Viết kịch bản {{chu_de}}.');
    expect(finalPrompt).toContain('Hook 3 giây đầu.');
  });

  it('template không có block task → lõi rỗng nhưng vẫn là project v3 hợp lệ', () => {
    const proj = templateToGraphProject({ title: 'X', blocks: [
      { id: 'b1', type: 'role' as const, title: 'Vai trò', content: 'Bạn là chuyên gia.' },
    ] });
    const root = proj.graphNodes!.find((n) => n.kind === 'root')!;
    expect(root.content).toBe('');
    expect(proj.graphNodes!.filter((n) => n.kind === 'attribute')).toHaveLength(1);
  });
});

describe('parseRawPromptToGraph (dán prompt thô từ bất kỳ đâu)', () => {
  it('tách section [X] thành node đúng cổng, phần mở đầu vào lõi Prompt Gốc', () => {
    const raw = [
      'Đây là phần mở đầu tự do.',
      '',
      '[Vai trò]',
      'Bạn là chuyên gia SEO.',
      '',
      '[Ràng buộc]',
      'Không dùng từ sáo rỗng.',
      '',
      '[Nhiệm vụ]',
      'Viết bài về {{chu_de}}.',
    ].join('\n');
    const proj = parseRawPromptToGraph('Test', 'mô tả', raw, 'ws-1');
    expect(isGraphProject(proj)).toBe(true);
    expect(proj.workspaceId).toBe('ws-1');

    const root = proj.graphNodes!.find((n) => n.kind === 'root')!;
    expect(root.content).toBe('Đây là phần mở đầu tự do.');

    const attrs = proj.graphNodes!.filter((n) => n.kind === 'attribute');
    expect(attrs.map((a) => a.attrType).sort()).toEqual(['constraints', 'role', 'task']);
    // Section Nhiệm vụ → Task Node cắm cổng task
    const taskNode = attrs.find((a) => a.attrType === 'task')!;
    expect(taskNode.content).toContain('{{chu_de}}');
    // Tất cả nối dây vào root, đúng cổng
    for (const a of attrs) {
      const edge = proj.edges!.find((e) => e.source === a.id)!;
      expect(edge.target).toBe(root.id);
      expect(edge.targetSlot).toBe(a.attrType);
    }
    // Compile được ngay
    const { finalPrompt } = compileGraph(proj);
    expect(finalPrompt).toContain('Bạn là chuyên gia SEO.');
    expect(finalPrompt).toContain('Viết bài về {{chu_de}}.');
  });

  it('hỗ trợ heading Markdown (## Vai trò / ### Ví dụ), tiêu đề lạ → custom', () => {
    const raw = '## Vai trò\nBạn là nhà thơ.\n\n### Ví dụ\nThơ mẫu...\n\n## Phần Bí Ẩn XYZ\nNội dung lạ.';
    const proj = parseRawPromptToGraph('MD', '', raw);
    const attrs = proj.graphNodes!.filter((n) => n.kind === 'attribute');
    expect(attrs.map((a) => a.attrType).sort()).toEqual(['custom', 'example', 'role']);
    expect(attrs.find((a) => a.attrType === 'custom')!.title).toBe('Phần Bí Ẩn XYZ');
  });

  it('không có marker nào → toàn bộ text vào lõi Prompt Gốc, không node thuộc tính', () => {
    const raw = 'Viết cho tôi một email xin nghỉ phép chuyên nghiệp, giọng lịch sự.';
    const proj = parseRawPromptToGraph('Email', '', raw);
    const root = proj.graphNodes!.find((n) => n.kind === 'root')!;
    expect(root.content).toBe(raw);
    expect(proj.graphNodes!.filter((n) => n.kind === 'attribute')).toHaveLength(0);
    expect(proj.edges).toHaveLength(0);
  });

  it('section rỗng bị bỏ, cú pháp tham chiếu cũ bị thay bằng ghi chú', () => {
    const raw = '[Vai trò]\n\n[Ngữ cảnh]\nDựa trên {{output_1}} phía trước.';
    const proj = parseRawPromptToGraph('X', '', raw);
    const attrs = proj.graphNodes!.filter((n) => n.kind === 'attribute');
    expect(attrs).toHaveLength(1); // Vai trò rỗng → bỏ
    expect(attrs[0].content).toContain('[Tham chiếu cũ: output_1]');
  });
});
