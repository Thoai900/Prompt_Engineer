import { describe, it, expect } from 'vitest';
import {
  renderVars, compileAppTemplate, appTemplateHash, effectiveInputs, buildFeedbackPayload,
  feedbackToTest, feedbackRevisionLabel, FEEDBACK_LIMITS,
} from '../utils/feedbackUtils';
import { hashPrompt } from '../utils/promptRevisions';
import { renderVars as apiRenderVars, normalizeTests } from '../../api/optimize';
import { AppFeedback, HealthSuite, PromptProject } from '../types';

const graphProject = (content: string, variables: any[] = []): PromptProject => ({
  id: 'app1', name: 'App', description: '', globalEvalCriteria: [], nodes: [], createdAt: '', updatedAt: '',
  schemaVersion: 3,
  graphNodes: [{ id: 'root', kind: 'root', title: 'Gốc', content, position: { x: 0, y: 0 }, enabled: true, variables } as any],
  edges: [],
});

const fb = (over: Partial<AppFeedback> = {}): AppFeedback => ({
  id: 'f1', appId: 'app1', ownerId: 'o', userId: 'u', rating: 'down', inputs: { chude: 'mèo' },
  output: 'out', status: 'new', createdAt: '', ...over,
});

describe('renderVars', () => {
  it('điền biến có giá trị, giữ nguyên biến thiếu/rỗng', () => {
    expect(renderVars('A {{x}} B {{ y }} C {{z}}', { x: '1', y: '2', z: '' })).toBe('A 1 B 2 C {{z}}');
    expect(renderVars('A {{x}}')).toBe('A {{x}}');
  });

  it('bản trong api/optimize cho cùng kết quả', () => {
    const vars = { x: '1', z: '' };
    expect(apiRenderVars('{{x}}-{{z}}-{{w}}', vars)).toBe(renderVars('{{x}}-{{z}}-{{w}}', vars));
  });
});

describe('compileAppTemplate', () => {
  it('giữ chỗ {{biến}} kể cả biến có giá trị mặc định', () => {
    const p = graphProject('Viết về {{chude}} cho {{lop}}.', [{ name: 'chude', defaultValue: 'chó' }]);
    const t = compileAppTemplate(p)!;
    expect(t).toContain('{{chude}}');
    expect(t).toContain('{{lop}}');
    expect(appTemplateHash(p)).toBe(hashPrompt(t));
  });

  it('app legacy (không phải graph) → null', () => {
    const legacy = { ...graphProject('x'), schemaVersion: undefined, graphNodes: undefined };
    expect(compileAppTemplate(legacy)).toBeNull();
    expect(appTemplateHash(legacy)).toBeUndefined();
  });
});

describe('effectiveInputs', () => {
  it('ô trống → mặc định, có giá trị → trim', () => {
    expect(effectiveInputs(
      [{ name: 'a', defaultValue: 'mặc định' }, { name: 'b' }, { name: 'c' }],
      { a: '  ', b: ' x ' },
    )).toEqual({ a: 'mặc định', b: 'x', c: '' });
  });
});

describe('buildFeedbackPayload', () => {
  it('cắt độ dài theo giới hạn, status new, bỏ trường rỗng', () => {
    const inputs = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`k${i}`, 'v'.repeat(3000)]));
    const p = buildFeedbackPayload({
      appId: 'a', ownerId: 'o', userId: 'u', rating: 'up', comment: '   ', inputs, output: 'o'.repeat(9000),
    });
    expect(Object.keys(p.inputs)).toHaveLength(FEEDBACK_LIMITS.inputKeys);
    expect(p.inputs.k0).toHaveLength(FEEDBACK_LIMITS.inputValue);
    expect(p.output).toHaveLength(FEEDBACK_LIMITS.output);
    expect(p.status).toBe('new');
    expect('comment' in p).toBe(false);
    expect('revisionHash' in p).toBe(false);
  });

  it('giữ comment + revisionHash khi có', () => {
    const p = buildFeedbackPayload({ appId: 'a', ownerId: 'o', userId: 'u', rating: 'down', comment: ' quá dài ', inputs: {}, output: '', revisionHash: 'abcd1234' });
    expect(p.comment).toBe('quá dài');
    expect(p.revisionHash).toBe('abcd1234');
  });
});

describe('feedbackToTest', () => {
  it('biến → vars, góp ý + tiêu chí mặc định (bỏ trùng), input trống', () => {
    const t = feedbackToTest(fb({ comment: 'cần ví dụ' }), ['cần ví dụ', 'ngắn gọn'], 't1');
    expect(t).toEqual({ id: 't1', input: '', criteria: ['cần ví dụ', 'ngắn gọn'], vars: { chude: 'mèo' } });
  });

  it('không góp ý → chỉ tiêu chí mặc định; vars là bản sao', () => {
    const f = fb();
    const t = feedbackToTest(f);
    expect(t.criteria).toEqual([]);
    t.vars!.chude = 'x';
    expect(f.inputs.chude).toBe('mèo');
  });
});

describe('feedbackRevisionLabel', () => {
  const suite: HealthSuite = {
    id: 's', name: 's', prompt: 'B', model: 'm', testCases: [], runs: [], headRevisionId: 'b',
    revisions: [
      { id: 'b', at: '', content: 'B', hash: hashPrompt('B'), origin: 'manual' },
      { id: 'a', at: '', content: 'A', hash: hashPrompt('A'), origin: 'manual' },
    ],
  };
  it('khớp head / bản cũ / không rõ', () => {
    expect(feedbackRevisionLabel(fb({ revisionHash: hashPrompt('B') }), suite)).toBe('head');
    expect(feedbackRevisionLabel(fb({ revisionHash: hashPrompt('A') }), suite)).toBe('old');
    expect(feedbackRevisionLabel(fb({ revisionHash: 'ffffffff' }), suite)).toBe('unknown');
    expect(feedbackRevisionLabel(fb(), suite)).toBe('unknown');
  });
});

describe('api/optimize normalizeTests — vars', () => {
  it('giữ vars chuỗi, bỏ giá trị không phải chuỗi', () => {
    const out = normalizeTests([{ input: '', vars: { a: 'x', b: 3 as any } }], [])!;
    expect(out[0].vars).toEqual({ a: 'x' });
  });
});
