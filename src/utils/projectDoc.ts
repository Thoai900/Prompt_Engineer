import { PromptProject } from '../types';

// Chuyển đổi THUẦN giữa PromptProject (client, ngày dạng ISO string) và document
// Firestore `projects/{id}` (createdAt/updatedAt là Timestamp do server đặt).

/** Timestamp Firestore | ISO string | thiếu → ISO string. */
export function toIso(value: any): string {
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date().toISOString();
}

/** Document Firestore → PromptProject đầy đủ (không bỏ sót graph/versions/testCases). */
export function projectFromDoc(id: string, data: any): PromptProject {
  return {
    id,
    name: data.name,
    description: data.description || '',
    globalEvalCriteria: data.globalEvalCriteria || [],
    nodes: data.nodes || [],
    schemaVersion: data.schemaVersion ?? undefined,
    graphNodes: data.graphNodes ?? undefined,
    edges: data.edges ?? undefined,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    userId: data.userId,
    workspaceId: data.workspaceId,
    testCases: data.testCases || [],
    versions: data.versions || [],
  };
}

/**
 * PromptProject → payload ghi Firestore. Bỏ createdAt/updatedAt dạng ISO (rules
 * bắt buộc dùng serverTimestamp — nơi ghi tự thêm) và gắn userId của người ghi.
 */
export function toProjectPayload(project: PromptProject, uid: string): Record<string, unknown> {
  const { createdAt: _c, updatedAt: _u, ...rest } = project;
  return { ...rest, userId: uid };
}
