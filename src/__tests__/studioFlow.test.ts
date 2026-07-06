import { describe, expect, it } from 'vitest';
import type { AiPersona, AiRule, AiSkill, PromptTemplate } from '../types';
import {
  STUDIO_STEPS, assembleStudioPrompt, buildCopilotContext, buildFixRequest, clampStep,
  computeQualityScore, createEmptyDraft, draftStorageKey, draftToTemplate,
  normalizeBlockType, parseDraft, serializeDraft, stepDone, stepSummary,
  suggestNextAction, suggestRules, suggestSkills, toggleId, tokenize,
} from '../utils/studioFlow';

const NOW = '2026-07-05T00:00:00.000Z';

const template: PromptTemplate = {
  id: 't1',
  title: 'Kịch bản TikTok học tiếng Anh',
  description: 'Video ngắn cho học sinh',
  category: 'Sáng tạo nội dung',
  tags: ['tiktok', 'video'],
  blocks: [
    { id: 'b1', type: 'role', title: '🎭 Vai trò', content: 'Bạn là biên kịch.' },
    { id: 'b2', type: 'task', title: '🎯 Nhiệm vụ', content: 'Viết kịch bản 60 giây.' },
    { id: 'b3', type: 'format', title: '📋 Định dạng', content: '' }, // rỗng → bỏ qua khi lắp ráp
  ],
} as PromptTemplate;

const rules: AiRule[] = [
  { id: 'r1', title: 'Chuẩn video ngắn TikTok', description: 'Quy tắc cho kịch bản video', content: 'Hook trong 3 giây đầu.', type: 'system-rules', tags: ['tiktok', 'video'], updatedAt: NOW },
  { id: 'r2', title: 'Chuẩn SQL', description: 'Quy tắc truy vấn database', content: 'Luôn dùng tham số.', type: 'system-rules', tags: ['sql'], updatedAt: NOW },
];

const skills: AiSkill[] = [
  { id: 's1', title: 'Viết hook video', description: 'Kỹ năng mở đầu video thu hút', inputs: [], steps: [], instructions: 'Mở đầu bằng câu hỏi gây tò mò.', updatedAt: NOW },
  { id: 's2', title: 'Tối ưu SQL', description: 'Kỹ năng viết truy vấn nhanh', inputs: [], steps: [], instructions: 'Dùng EXPLAIN trước.', updatedAt: NOW },
];

const persona: AiPersona = { id: 'p1', name: 'Giáo viên', systemInstructions: 'Bạn là giáo viên tận tâm.' };

function draftWithTemplate() {
  const d = createEmptyDraft(NOW);
  d.idea = 'Viết kịch bản video TikTok học tiếng Anh';
  d.template = template;
  return d;
}

describe('máy trạng thái bước', () => {
  it('clampStep giữ index trong [0, số bước - 1]', () => {
    expect(clampStep(-3)).toBe(0);
    expect(clampStep(2)).toBe(2);
    expect(clampStep(99)).toBe(STUDIO_STEPS.length - 1);
    expect(clampStep(NaN)).toBe(0);
  });

  it('stepDone phản ánh đóng góp thật của từng bước', () => {
    const d = createEmptyDraft(NOW);
    expect(stepDone(d, 'idea')).toBe(false);
    expect(stepDone(d, 'draft')).toBe(false);

    d.idea = 'Viết kịch bản';
    expect(stepDone(d, 'idea')).toBe(true);

    d.template = template;
    expect(stepDone(d, 'draft')).toBe(true);

    expect(stepDone(d, 'enhance')).toBe(false);
    d.selectedRuleIds = ['r1'];
    expect(stepDone(d, 'enhance')).toBe(true);

    expect(stepDone(d, 'check')).toBe(false);
    d.lintRanAt = NOW;
    expect(stepDone(d, 'check')).toBe(true);

    expect(stepDone(d, 'finish')).toBe(false); // bước cuối không bao giờ "done"
  });

  it('stepSummary tóm tắt vi mô đúng số liệu', () => {
    const d = draftWithTemplate();
    d.selectedRuleIds = ['r1'];
    d.appliedSkillIds = ['s1', 's2'];
    d.lintIssues = [{ severity: 'high', category: 'mơ hồ', message: 'x', suggestion: '' }];
    d.lintRanAt = NOW;
    expect(stepSummary(d, 'draft')).toBe('3 khối');
    expect(stepSummary(d, 'enhance')).toBe('1 quy tắc · 2 kỹ năng');
    expect(stepSummary(d, 'check')).toBe('1 vấn đề');
    expect(stepSummary(createEmptyDraft(NOW), 'draft')).toBeNull();
  });
});

describe('toggleId', () => {
  it('thêm khi chưa có, gỡ khi đã có (immutable)', () => {
    const list = ['a'];
    expect(toggleId(list, 'b')).toEqual(['a', 'b']);
    expect(toggleId(list, 'a')).toEqual([]);
    expect(list).toEqual(['a']);
  });
});

describe('lắp ráp prompt', () => {
  it('draftToTemplate trả null khi chưa có template', () => {
    expect(draftToTemplate(createEmptyDraft(NOW), rules, skills)).toBeNull();
  });

  it('draftToTemplate bake skills rồi rules thành block sau blocks gốc', () => {
    const d = draftWithTemplate();
    d.selectedRuleIds = ['r1'];
    d.appliedSkillIds = ['s1'];
    const merged = draftToTemplate(d, rules, skills)!;
    const titles = merged.blocks.map((b) => b.title);
    expect(titles).toEqual([
      '🎭 Vai trò', '🎯 Nhiệm vụ', '📋 Định dạng',
      '🧰 Kỹ năng: Viết hook video',
      '📏 Quy tắc: Chuẩn video ngắn TikTok',
    ]);
    expect(merged.blocks[4].type).toBe('constraints');
    // Id không tồn tại trong kho → bỏ qua êm.
    d.selectedRuleIds = ['missing'];
    expect(draftToTemplate(d, rules, skills)!.blocks).toHaveLength(4);
  });

  it('assembleStudioPrompt: persona đứng đầu, khối rỗng bị bỏ, định dạng "## title"', () => {
    const d = draftWithTemplate();
    d.selectedRuleIds = ['r1'];
    const text = assembleStudioPrompt(d, rules, skills, persona);
    expect(text.startsWith('Bạn là giáo viên tận tâm.')).toBe(true);
    expect(text).toContain('## 🎭 Vai trò\nBạn là biên kịch.');
    expect(text).toContain('## 📏 Quy tắc: Chuẩn video ngắn TikTok\nHook trong 3 giây đầu.');
    expect(text).not.toContain('📋 Định dạng'); // content rỗng
    expect(assembleStudioPrompt(createEmptyDraft(NOW), rules, skills, persona)).toBe('');
  });

  it('buildFixRequest liệt kê đủ vấn đề kèm gợi ý', () => {
    const out = buildFixRequest('PROMPT GỐC', [
      { severity: 'high', category: 'mơ hồ', message: 'Thiếu đối tượng', suggestion: 'Nêu rõ đối tượng' },
      { severity: 'low', category: 'khác', message: 'Dài dòng', suggestion: '' },
    ]);
    expect(out).toContain('PROMPT GỐC');
    expect(out).toContain('- (high) Thiếu đối tượng → Gợi ý: Nêu rõ đối tượng');
    expect(out).toContain('- (low) Dài dòng');
  });

  it('normalizeBlockType ép type lạ về custom', () => {
    expect(normalizeBlockType('role')).toBe('role');
    expect(normalizeBlockType('weird')).toBe('custom');
    expect(normalizeBlockType(undefined)).toBe('custom');
  });
});

describe('heuristic gợi ý', () => {
  it('tokenize bỏ dấu tiếng Việt và stopword', () => {
    expect(tokenize('Kịch Bản Video')).toEqual(['kich', 'ban', 'video']);
    expect(tokenize('cho của và')).toEqual([]);
  });

  it('suggestRules xếp hạng theo từ khoá trùng, kèm lý do minh bạch', () => {
    const d = draftWithTemplate();
    const out = suggestRules(d, rules);
    expect(out.map((s) => s.item.id)).toEqual(['r1']); // r2 (SQL) không khớp
    expect(out[0].matched).toContain('tiktok');
  });

  it('suggestRules loại gợi ý đã chọn hoặc đã bỏ qua; draft rỗng → []', () => {
    const d = draftWithTemplate();
    d.selectedRuleIds = ['r1'];
    expect(suggestRules(d, rules)).toEqual([]);
    d.selectedRuleIds = [];
    d.dismissedRuleIds = ['r1'];
    expect(suggestRules(d, rules)).toEqual([]);
    expect(suggestRules(createEmptyDraft(NOW), rules)).toEqual([]);
  });

  it('suggestSkills khớp theo tiêu đề/mô tả', () => {
    const d = draftWithTemplate();
    const out = suggestSkills(d, skills);
    expect(out.map((s) => s.item.id)).toEqual(['s1']);
  });
});

describe('serialize / parse draft', () => {
  it('round-trip giữ nguyên dữ liệu', () => {
    const d = draftWithTemplate();
    d.selectedRuleIds = ['r1'];
    d.currentStep = 3;
    expect(parseDraft(serializeDraft(d))).toEqual(d);
  });

  it('parseDraft chống dữ liệu hỏng', () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft('not json')).toBeNull();
    expect(parseDraft('{"version":99}')).toBeNull();
    expect(parseDraft(JSON.stringify({ version: 1 }))).toBeNull(); // thiếu idea
  });

  it('parseDraft chuẩn hoá field lệch kiểu và clamp bước', () => {
    const raw = JSON.stringify({
      version: 1,
      idea: 'x',
      currentStep: 42,
      selectedRuleIds: ['ok', 5, null],
      lintIssues: [{ severity: 'bogus', message: 'm' }, { nope: true }],
      template: { id: 't', title: 'T', description: '', blocks: [] },
    });
    const d = parseDraft(raw)!;
    expect(d.currentStep).toBe(STUDIO_STEPS.length - 1);
    expect(d.selectedRuleIds).toEqual(['ok']);
    expect(d.lintIssues).toEqual([{ severity: 'medium', category: 'khác', message: 'm', suggestion: '' }]);
    expect(d.personaId).toBe('');
  });

  it('draftStorageKey tách theo uid', () => {
    expect(draftStorageKey('u1')).toBe('studio_draft_u1');
  });
});

// ── Đợt 2 + 3: bước Nâng cấp, điểm tổng hợp, copilot ─────────────────────────

describe('draft v2 (đợt 2)', () => {
  it('STUDIO_STEPS có 6 bước, Nâng cấp đứng trước Hoàn tất', () => {
    expect(STUDIO_STEPS.map((s) => s.key)).toEqual(['idea', 'draft', 'enhance', 'check', 'polish', 'finish']);
  });

  it('parseDraft nâng cấp draft v1 (thiếu field mới) lên v2 với mặc định null', () => {
    const v1 = JSON.stringify({
      version: 1,
      idea: 'x',
      currentStep: 2,
      selectedRuleIds: ['r1'],
      template: { id: 't', title: 'T', description: '', blocks: [] },
    });
    const d = parseDraft(v1)!;
    expect(d.version).toBe(2);
    expect(d.runOutput).toBeNull();
    expect(d.runScore).toBeNull();
    expect(d.optimizeEval).toBeNull();
    expect(d.selectedRuleIds).toEqual(['r1']);
  });

  it('parseDraft round-trip v2 giữ nguyên kết quả Nâng cấp, lọc suggestion hỏng', () => {
    const d = draftWithTemplate();
    d.runOutput = 'đầu ra thử';
    d.runScore = { score: 85, perCriterion: [], feedback: 'ổn' };
    d.optimizeEval = { score: 70, weaknesses: ['mơ hồ'], suggestions: [{ title: 'Vá', description: '', content: '\n\n[RÀNG BUỘC]' }] };
    expect(parseDraft(serializeDraft(d))).toEqual(d);

    const dirty = JSON.parse(serializeDraft(d));
    dirty.optimizeEval.suggestions.push({ title: 'hỏng' }); // thiếu content
    expect(parseDraft(JSON.stringify(dirty))!.optimizeEval!.suggestions).toHaveLength(1);
  });

  it('stepDone/stepSummary cho bước Nâng cấp', () => {
    const d = draftWithTemplate();
    expect(stepDone(d, 'polish')).toBe(false);
    expect(stepSummary(d, 'polish')).toBeNull();
    d.runScore = { score: 85, perCriterion: [], feedback: '' };
    expect(stepDone(d, 'polish')).toBe(true);
    expect(stepSummary(d, 'polish')).toBe('chạy thử 85/100');
  });
});

describe('computeQualityScore', () => {
  it('null khi chưa có phép đo nào (không bịa điểm)', () => {
    expect(computeQualityScore(draftWithTemplate())).toBeNull();
  });

  it('chỉ lint: 100 trừ theo mức độ, không âm', () => {
    const d = draftWithTemplate();
    d.lintRanAt = NOW;
    d.lintIssues = [
      { severity: 'high', category: 'x', message: 'a', suggestion: '' },
      { severity: 'medium', category: 'x', message: 'b', suggestion: '' },
      { severity: 'low', category: 'x', message: 'c', suggestion: '' },
    ];
    const q = computeQualityScore(d)!;
    expect(q.score).toBe(100 - 18 - 10 - 4);
    expect(q.parts.find((p) => p.key === 'run')!.value).toBeNull();
  });

  it('trung bình các phép đo đã chạy', () => {
    const d = draftWithTemplate();
    d.lintRanAt = NOW; // 0 vấn đề → lint = 100
    d.runScore = { score: 80, perCriterion: [], feedback: '' };
    d.optimizeEval = { score: 60, weaknesses: [], suggestions: [] };
    expect(computeQualityScore(d)!.score).toBe(80); // (100+80+60)/3
  });
});

describe('suggestNextAction (copilot, đợt 3)', () => {
  it('leo thang đúng thứ tự: ý tưởng → nháp → tăng cường → lint → sửa lint → chạy thử → hoàn tất', () => {
    const d = createEmptyDraft(NOW);
    expect(suggestNextAction(d).step).toBe('idea');

    d.idea = 'Viết kịch bản';
    expect(suggestNextAction(d).step).toBe('draft');

    d.template = { ...template };
    expect(suggestNextAction(d).step).toBe('enhance');

    d.selectedRuleIds = ['r1'];
    expect(suggestNextAction(d).step).toBe('check');

    d.lintRanAt = NOW;
    d.lintIssues = [{ severity: 'high', category: 'x', message: 'a', suggestion: '' }];
    expect(suggestNextAction(d).step).toBe('check');
    expect(suggestNextAction(d).reason).toContain('1 vấn đề');

    d.lintIssues = [];
    expect(suggestNextAction(d).step).toBe('polish');

    d.runScore = { score: 90, perCriterion: [], feedback: '' };
    expect(suggestNextAction(d).step).toBe('finish');
  });

  it('buildCopilotContext nén đúng trạng thái draft', () => {
    const d = draftWithTemplate();
    d.selectedRuleIds = ['r1'];
    const ctx = buildCopilotContext(d, { score: 77, parts: [] });
    expect(ctx).toContain('Kịch bản TikTok học tiếng Anh');
    expect(ctx).toContain('1 quy tắc');
    expect(ctx).toContain('77/100');
    expect(ctx).toContain('chưa chạy'); // linter chưa chạy
  });
});
