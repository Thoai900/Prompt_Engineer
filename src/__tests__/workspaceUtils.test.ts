import { describe, it, expect } from 'vitest';
import { matchesActiveWorkspace, DEFAULT_WORKSPACE_ID } from '../utils/workspaceUtils';

describe('matchesActiveWorkspace', () => {
  it('default workspace nhận doc chưa gán (workspaceId rỗng)', () => {
    expect(matchesActiveWorkspace(DEFAULT_WORKSPACE_ID, undefined)).toBe(true);
    expect(matchesActiveWorkspace(DEFAULT_WORKSPACE_ID, '')).toBe(true);
  });

  it('default workspace nhận doc gán đúng id default', () => {
    expect(matchesActiveWorkspace(DEFAULT_WORKSPACE_ID, DEFAULT_WORKSPACE_ID)).toBe(true);
  });

  it('default workspace KHÔNG nhận doc thuộc workspace khác', () => {
    expect(matchesActiveWorkspace(DEFAULT_WORKSPACE_ID, 'ws_123')).toBe(false);
  });

  it('workspace tuỳ chỉnh chỉ nhận doc trùng id', () => {
    expect(matchesActiveWorkspace('ws_123', 'ws_123')).toBe(true);
    expect(matchesActiveWorkspace('ws_123', 'ws_999')).toBe(false);
  });

  it('workspace tuỳ chỉnh KHÔNG nhận doc chưa gán', () => {
    expect(matchesActiveWorkspace('ws_123', undefined)).toBe(false);
    expect(matchesActiveWorkspace('ws_123', '')).toBe(false);
  });
});
