import { PromptProject } from '../types';
import { GEMINI_FLASH } from '../config/models';
import { collectGraphVariables } from './graphCompile';
import { compileAppTemplate } from './feedbackUtils';

// API cho Prompt Graph (Đợt 2 — spec 2026-11-19-graph-export-api-mcp-skill-design.md).
// Hàm THUẦN (trừ hashApiKey dùng WebCrypto) để unit-test; chainAppService / apiKeyService / UI gọi.

/** Quota mặc định mỗi API key / ngày (server còn kẹp thêm bằng env RUN_MAX_DAILY_QUOTA). */
export const DEFAULT_DAILY_QUOTA = 100;
/** Giới hạn khớp rule `isValidSharedApp` — đổi một bên phải đổi bên kia. */
export const SNAPSHOT_LIMITS = { template: 50_000, variables: 30 } as const;

export interface SnapshotVariable {
  name: string;
  required: boolean;
  description?: string;
  defaultValue?: string;
}

export interface PublishSnapshot {
  promptTemplate: string;
  variables: SnapshotVariable[];
  model: string;
}

/**
 * Phần snapshot server cần để chạy app mà KHÔNG compile graph (api/ tự chứa):
 * prompt mẫu giữ `{{biến}}` + biến + model app dùng khi chạy (`runChainApp` dùng GEMINI_FLASH).
 * null nếu app legacy / prompt trống / vượt giới hạn.
 */
export function buildPublishSnapshot(project: PromptProject): PublishSnapshot | null {
  const template = compileAppTemplate(project);
  if (!template || !template.trim() || template.length > SNAPSHOT_LIMITS.template) return null;
  const vars = collectGraphVariables(project);
  if (vars.length > SNAPSHOT_LIMITS.variables) return null;
  return {
    promptTemplate: template,
    // Bỏ trường rỗng — Firestore từ chối undefined.
    variables: vars.map((v) => ({
      name: v.name,
      required: !!v.required,
      ...(v.description ? { description: v.description.slice(0, 500) } : {}),
      ...(v.defaultValue ? { defaultValue: v.defaultValue.slice(0, 2000) } : {}),
    })),
    model: GEMINI_FLASH,
  };
}

const KEY_PREFIX = 'pb_live_';

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** API key mới: `pb_live_` + 32 byte ngẫu nhiên (base64url, 43 ký tự). Truyền `bytes` để test. */
export function generateApiKey(bytes?: Uint8Array): string {
  const b = bytes || crypto.getRandomValues(new Uint8Array(32));
  return KEY_PREFIX + base64url(b);
}

/** Đoạn đầu để nhận diện key trong UI (không đủ để dùng). */
export function apiKeyPrefix(key: string): string {
  return key.slice(0, KEY_PREFIX.length + 4);
}

/** SHA-256 hex của key — id doc `apiKeys/{hash}`; server tính y hệt (api/run.ts). */
export async function hashApiKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Ví dụ gọi API cho UI (curl). Key thật chỉ hiện một lần lúc tạo — mặc định dùng chỗ giữ. */
export function buildCurlExample(
  apiUrl: string,
  appId: string,
  variables: SnapshotVariable[],
  key = '$PB_API_KEY',
): string {
  const inputs = Object.fromEntries(variables.map((v) => [v.name, v.defaultValue || `<${v.name}>`]));
  const body = JSON.stringify({ app: appId, inputs });
  return `curl -X POST ${apiUrl} \\\n  -H "Authorization: Bearer ${key}" \\\n  -H "Content-Type: application/json" \\\n  -d '${body.replace(/'/g, "'\\''")}'`;
}

/** Ngày quota theo UTC ('YYYY-MM-DD') — khớp quotaDay trong api/run.ts. */
export function quotaToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
