import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { runInNewContext } from 'vm';
import { buildExtensionPayload, extractVariables, templateToExtensionPrompt, MAX_SYNC_PROMPTS } from '../utils/extensionBridge';
import { PromptTemplate } from '../types';

// Nạp extension/lib/core.js như trình duyệt nạp script thường (gắn globalThis.PBCore).
const sandbox: any = { URL };
runInNewContext(readFileSync(resolve(__dirname, '../../extension/lib/core.js'), 'utf8'), sandbox);
const core = sandbox.PBCore;

const tpl = (id: string, content: string, over: Partial<PromptTemplate> = {}): PromptTemplate => ({
  id, title: `T ${id}`, description: 'mô tả', category: 'Viết', blocks: [{ id: 'b', type: 'task', title: 'Nhiệm vụ', content }], ...over,
} as PromptTemplate);

describe('extensionBridge (app)', () => {
  it('extractVariables: cú pháp Builder — tên có dấu/khoảng trắng, bỏ phần lựa chọn, không trùng', () => {
    expect(extractVariables('{{b}} {{ a }} {{b}}')).toEqual(['b', 'a']);
    expect(extractVariables('Gia sư {{Môn học}} lớp {{Khối lớp: 10, 11, 12}} — {{Môn học}}')).toEqual(['Môn học', 'Khối lớp']);
  });

  it('template → prompt: ghép khối, lấy biến; khối trống → null', () => {
    const p = templateToExtensionPrompt(tpl('1', 'Viết về {{chude}}'))!;
    expect(p.text).toBe('### Nhiệm vụ\nViết về {{chude}}');
    expect(p.variables).toEqual(['chude']);
    expect(templateToExtensionPrompt({ ...tpl('2', ''), blocks: [] })).toBeNull();
  });

  it('gói: bỏ trùng id, bỏ trống, giới hạn số lượng; gói hợp lệ với tiện ích', () => {
    const many = Array.from({ length: MAX_SYNC_PROMPTS + 5 }, (_, i) => tpl(String(i), `nội dung ${i}`));
    const payload = buildExtensionPayload([tpl('x', 'a'), tpl('x', 'b'), { ...tpl('e', ''), blocks: [] }, ...many]);
    expect(payload.prompts).toHaveLength(MAX_SYNC_PROMPTS);
    expect(payload.prompts[0].id).toBe('x');
    expect(core.validatePayload(JSON.parse(JSON.stringify(payload))).ok).toBe(true);
  });
});

describe('extension/lib/core.js', () => {
  it('validatePayload: từ chối sai phiên bản / thiếu trường; bỏ trường lạ; tự tính lại biến', () => {
    expect(core.validatePayload(null).ok).toBe(false);
    expect(core.validatePayload({ version: 2, prompts: [] }).ok).toBe(false);
    expect(core.validatePayload({ version: 1, prompts: [{ id: 'a', title: 't' }] }).ok).toBe(false);
    expect(core.validatePayload({ version: 1, prompts: [{ id: 'a', title: 't', text: '   ' }] }).ok).toBe(false);
    const r = core.validatePayload({ version: 1, prompts: [{ id: 'a', title: 't', text: 'x {{y}}', variables: ['z'], evil: '<script>' }] });
    expect(r.ok).toBe(true);
    expect(r.prompts[0]).toEqual({ id: 'a', title: 't', description: '', category: '', text: 'x {{y}}', variables: [{ name: 'y', options: [] }] });
  });

  it('renderTemplate / missingVariables: biến trống giữ {{x}} và bị báo thiếu', () => {
    const text = 'Viết về {{chude}} cho {{lop}}';
    expect(core.renderTemplate(text, { chude: 'mèo', lop: ' ' })).toBe('Viết về mèo cho {{lop}}');
    expect(core.missingVariables(text, { chude: 'mèo' })).toEqual(['lop']);
    expect(core.missingVariables('không biến', {})).toEqual([]);
  });

  it('cú pháp Builder: tên có dấu, {{tên: a, b}} → lựa chọn, trống thì lấy lựa chọn đầu', () => {
    const text = 'Gia sư {{Môn học}} cho lớp {{Khối lớp: 10, 11, 12}} ({{Khối lớp: 10, 11, 12}})';
    expect(core.extractVariables(text)).toEqual([{ name: 'Môn học', options: [] }, { name: 'Khối lớp', options: ['10', '11', '12'] }]);
    expect(core.renderTemplate(text, { 'Môn học': 'Toán' })).toBe('Gia sư Toán cho lớp 10 (10)');
    expect(core.renderTemplate(text, { 'Môn học': 'Toán', 'Khối lớp': '12' })).toBe('Gia sư Toán cho lớp 12 (12)');
    expect(core.missingVariables(text, {})).toEqual(['Môn học']);
  });

  it('searchPrompts: không phân biệt dấu, mọi từ phải khớp, tiêu đề khớp xếp trước', () => {
    const ps = [
      { id: '1', title: 'Tóm tắt email', description: '', category: '', text: 'viết thư' },
      { id: '2', title: 'Viết thư xin việc', description: '', category: '', text: 'tóm tắt kinh nghiệm' },
      { id: '3', title: 'Dịch', description: '', category: '', text: 'khác' },
    ];
    expect(core.searchPrompts(ps, 'viet thu').map((p: any) => p.id)).toEqual(['2', '1']);
    expect(core.searchPrompts(ps, 'tom tat').map((p: any) => p.id)).toEqual(['1', '2']);
    expect(core.searchPrompts(ps, '').map((p: any) => p.id)).toEqual(['1', '2', '3']);
    expect(core.searchPrompts(ps, 'khong co')).toEqual([]);
  });

  it('isAllowedSyncOrigin: https hoặc localhost', () => {
    expect(core.isAllowedSyncOrigin('https://app.vercel.app')).toBe(true);
    expect(core.isAllowedSyncOrigin('http://localhost:5173')).toBe(true);
    expect(core.isAllowedSyncOrigin('http://evil.com')).toBe(false);
    expect(core.isAllowedSyncOrigin('nonsense')).toBe(false);
  });
});

describe('extension/manifest.json', () => {
  it('MV3, đủ file được tham chiếu', () => {
    const dir = resolve(__dirname, '../../extension');
    const m = JSON.parse(readFileSync(resolve(dir, 'manifest.json'), 'utf8'));
    expect(m.manifest_version).toBe(3);
    const files = [m.action.default_popup, ...m.content_scripts.flatMap((c: any) => c.js)];
    for (const f of files) expect(() => readFileSync(resolve(dir, f))).not.toThrow();
  });
});
