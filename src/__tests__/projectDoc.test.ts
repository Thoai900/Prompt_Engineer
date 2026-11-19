import { describe, expect, it } from 'vitest';
import { projectFromDoc, toProjectPayload } from '../utils/projectDoc';
import type { PromptProject } from '../types';

const base: PromptProject = {
  id: 'p1', name: 'Dự án', description: 'mô tả', globalEvalCriteria: [], nodes: [],
  schemaVersion: 3, graphNodes: [], edges: [],
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z',
  workspaceId: 'ws1', testCases: [], versions: [],
};

describe('toProjectPayload', () => {
  it('bỏ createdAt/updatedAt dạng ISO và gắn userId người ghi', () => {
    const payload = toProjectPayload({ ...base, userId: 'khac' }, 'u1');
    expect(payload).not.toHaveProperty('createdAt');
    expect(payload).not.toHaveProperty('updatedAt');
    expect(payload.userId).toBe('u1');
    expect(payload.graphNodes).toEqual([]);
    expect(payload.workspaceId).toBe('ws1');
  });
});

describe('projectFromDoc', () => {
  it('đổi Timestamp sang ISO và giữ đủ graph/versions/testCases', () => {
    const ts = (iso: string) => ({ toDate: () => new Date(iso) });
    const p = projectFromDoc('p1', {
      name: 'Dự án', schemaVersion: 3, graphNodes: [{ id: 'n' }], edges: [{ id: 'e' }],
      versions: [{ id: 'v' }], testCases: [{ id: 't' }], workspaceId: 'ws1', userId: 'u1',
      createdAt: ts('2026-01-01T00:00:00.000Z'), updatedAt: ts('2026-01-02T00:00:00.000Z'),
    });
    expect(p.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(p.updatedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(p.graphNodes).toHaveLength(1);
    expect(p.edges).toHaveLength(1);
    expect(p.versions).toHaveLength(1);
    expect(p.testCases).toHaveLength(1);
    expect(p.workspaceId).toBe('ws1');
  });

  it('chấp nhận ngày dạng chuỗi (doc cũ) và null cho field graph', () => {
    const p = projectFromDoc('p2', { name: 'X', createdAt: '2025-05-05T00:00:00.000Z', graphNodes: null, edges: null });
    expect(p.createdAt).toBe('2025-05-05T00:00:00.000Z');
    expect(p.graphNodes).toBeUndefined();
    expect(p.nodes).toEqual([]);
  });
});
