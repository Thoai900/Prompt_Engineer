import { describe, it, expect } from 'vitest';
import {
  migrateProjectToGraph, isGraphProject, stripLegacyRefs, createEmptyGraphProject,
  addTemplateAsAttributeNode, blockTypeToSlot,
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
