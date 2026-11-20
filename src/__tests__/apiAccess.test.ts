import { describe, it, expect } from 'vitest';
import {
  buildPublishSnapshot, generateApiKey, apiKeyPrefix, hashApiKey, buildCurlExample, quotaToday, SNAPSHOT_LIMITS,
} from '../utils/apiAccess';
import { hashKey, quotaDay } from '../../api/run';
import { GEMINI_FLASH } from '../config/models';
import { PromptProject } from '../types';

const graph = (content: string, variables: any[] = [], over: Partial<PromptProject> = {}): PromptProject => ({
  id: 'app1', name: 'App', description: '', globalEvalCriteria: [], nodes: [], createdAt: '', updatedAt: '',
  schemaVersion: 3,
  graphNodes: [{ id: 'root', kind: 'root', title: 'Gốc', content, position: { x: 0, y: 0 }, enabled: true, variables } as any],
  edges: [], ...over,
});

describe('buildPublishSnapshot', () => {
  it('prompt mẫu giữ {{biến}}, biến bỏ trường rỗng, model của app', () => {
    const s = buildPublishSnapshot(graph('Viết về {{chude}} cho {{lop}}.', [
      { name: 'chude', type: 'text', required: true, description: 'chủ đề', defaultValue: 'mèo' },
    ]))!;
    expect(s.promptTemplate).toContain('{{chude}}');
    expect(s.variables).toEqual([
      { name: 'chude', required: true, description: 'chủ đề', defaultValue: 'mèo' },
      { name: 'lop', required: true },
    ]);
    expect(s.model).toBe(GEMINI_FLASH);
  });

  it('legacy / trống / quá dài → null', () => {
    expect(buildPublishSnapshot(graph('x', [], { schemaVersion: undefined, graphNodes: undefined }))).toBeNull();
    expect(buildPublishSnapshot(graph(' '))).toBeNull();
    expect(buildPublishSnapshot(graph('x'.repeat(SNAPSHOT_LIMITS.template + 1)))).toBeNull();
  });
});

describe('API key', () => {
  it('định dạng pb_live_ + 43 ký tự base64url; mỗi lần khác nhau', () => {
    const k = generateApiKey();
    expect(k).toMatch(/^pb_live_[A-Za-z0-9_-]{43}$/);
    expect(generateApiKey()).not.toBe(k);
    expect(apiKeyPrefix(k)).toBe(k.slice(0, 12));
  });

  it('hash client (WebCrypto) khớp hash server (node crypto)', async () => {
    const k = generateApiKey(new Uint8Array(32).fill(7));
    const h = await hashApiKey(k);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(hashKey(k));
  });

  it('ngày quota client khớp server', () => {
    const d = new Date('2026-11-19T23:59:59Z');
    expect(quotaToday(d)).toBe(quotaDay(d));
  });
});

describe('buildCurlExample', () => {
  it('body JSON với mặc định / chỗ giữ, thoát nháy đơn', () => {
    const c = buildCurlExample('https://x/api/run', 'a1', [{ name: 'chude', required: true, defaultValue: "it's" }, { name: 'lop', required: true }]);
    expect(c).toContain('Authorization: Bearer $PB_API_KEY');
    expect(c).toContain(`-d '{"app":"a1","inputs":{"chude":"it'\\''s","lop":"<lop>"}}'`);
  });
});

import { buildMcpSetup } from '../utils/apiAccess';

describe('buildMcpSetup', () => {
  it('lệnh Claude Code đúng thứ tự tài liệu + JSON có type http', () => {
    const [cmd, cfg] = buildMcpSetup('https://x/api/mcp', 'pb_live_abc');
    expect(cmd.text).toBe('claude mcp add --transport http promptbuilder https://x/api/mcp \\\n  --header "Authorization: Bearer pb_live_abc"');
    expect(JSON.parse(cfg.text)).toEqual({
      mcpServers: { promptbuilder: { type: 'http', url: 'https://x/api/mcp', headers: { Authorization: 'Bearer pb_live_abc' } } },
    });
  });

  it('mặc định chỗ giữ $PB_API_KEY', () => {
    expect(buildMcpSetup('u')[0].text).toContain('Bearer $PB_API_KEY');
  });
});
