// Logic thuần cho việc phân vùng dữ liệu theo Workspace (tách ra để unit-test được).

export const DEFAULT_WORKSPACE_ID = 'default';

/**
 * Một doc (template/project) có `workspaceId` của nó có thuộc workspace đang chọn không?
 * Workspace mặc định "nhận" cả các doc chưa gán (workspaceId rỗng) ⇒ không cần migrate.
 */
export function matchesActiveWorkspace(
  activeWorkspaceId: string,
  docWorkspaceId?: string,
  defaultWorkspaceId: string = DEFAULT_WORKSPACE_ID,
): boolean {
  if (activeWorkspaceId === defaultWorkspaceId) {
    return !docWorkspaceId || docWorkspaceId === defaultWorkspaceId;
  }
  return docWorkspaceId === activeWorkspaceId;
}
