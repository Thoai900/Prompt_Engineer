import { describe, it, expect } from 'vitest';
import {
  validateExamples, buildInduceRequest, buildJudgeRequest, buildReviseRequest, parsePromptJson, parseScores,
  averageScore, runInduction, type ChatRequest,
} from '../utils/promptInduction';

const ex = [
  { input: 'Hôm nay trời đẹp', output: 'tích cực' },
  { input: 'Tôi mất ví', output: 'tiêu cực' },
];

describe('validateExamples', () => {
  it('bỏ cặp trống hẳn, báo thiếu một nửa, ít / nhiều quá', () => {
    expect(validateExamples([...ex, { input: '', output: '' }])).toEqual({ ok: true, examples: ex });
    expect(validateExamples([ex[0], { input: 'x', output: ' ' }]).ok).toBe(false);
    expect(validateExamples([ex[0]])).toMatchObject({ ok: false, error: expect.stringMatching(/ít nhất 2/) });
    expect(validateExamples(Array(6).fill(ex[0])).ok).toBe(false);
    expect(validateExamples([ex[0], { input: 'x'.repeat(4001), output: 'y' }]).ok).toBe(false);
  });
});

describe('dựng yêu cầu', () => {
  it('suy ngược: có ví dụ + gợi ý, đòi JSON prompt', () => {
    const r = buildInduceRequest(ex, 'phân loại cảm xúc');
    expect(r.systemInstruction).toContain('{"prompt"');
    expect(r.userContent).toContain('[GỢI Ý CỦA NGƯỜI DÙNG]\nphân loại cảm xúc');
    expect(r.userContent).toContain('### Ví dụ 2\n[ĐẦU VÀO]\nTôi mất ví');
    expect(buildInduceRequest(ex).userContent).not.toContain('GỢI Ý');
  });

  it('chấm: đúng số phần tử, có cả mong muốn và thực tế', () => {
    const r = buildJudgeRequest([{ input: 'a', expected: 'b', actual: 'c' }, { input: 'd', expected: 'e', actual: 'f' }]);
    expect(r.systemInstruction).toContain('đúng 2 phần tử');
    expect(r.userContent).toContain('[ĐẦU RA THỰC TẾ]\nf');
  });

  it('sửa: chỉ đưa tối đa 3 cặp yếu nhất, yếu nhất trước', () => {
    const scored = [90, 10, 50, 30].map((score, i) => ({ input: `in${i}`, expected: 'e', actual: 'a', score, reason: 'r' }));
    const u = buildReviseRequest('P', scored).userContent;
    expect(u).toContain('[PROMPT HIỆN TẠI]\nP');
    expect(u.indexOf('in1')).toBeLessThan(u.indexOf('in3'));
    expect(u).not.toContain('in0');
  });
});

describe('đọc JSON', () => {
  it('parsePromptJson', () => {
    expect(parsePromptJson('```json\n{"prompt": " Phân loại "}\n```')).toBe('Phân loại');
    expect(parsePromptJson('không phải json')).toBeNull();
    expect(parsePromptJson('{"prompt": ""}')).toBeNull();
  });

  it('parseScores: kẹp 0–100, thiếu phần tử → 0 kèm lý do', () => {
    expect(parseScores('{"scores":[{"score":120,"reason":"ok"}]}', 2)).toEqual([
      { score: 100, reason: 'ok' },
      { score: 0, reason: 'Giám khảo không trả điểm cho cặp này.' },
    ]);
    expect(averageScore([{ score: 50 }, { score: 81 }])).toBe(66);
  });
});

describe('runInduction (AI giả lập)', () => {
  const fake = (judge: number[][], prompts: string[]) => {
    const calls: ChatRequest[] = [];
    let judgeIdx = 0;
    let promptIdx = 0;
    return {
      calls,
      deps: {
        ask: async (req: ChatRequest) => {
          calls.push(req);
          if (req.systemInstruction.includes('giám khảo')) {
            return JSON.stringify({ scores: judge[judgeIdx++].map((score) => ({ score, reason: `r${score}` })) });
          }
          return JSON.stringify({ prompt: prompts[promptIdx++] });
        },
        run: async (system: string, input: string) => `${system}::${input}`,
      },
    };
  };

  it('2 vòng: dựng → chấm → sửa → chấm, chọn vòng điểm cao hơn', async () => {
    const f = fake([[40, 60], [80, 90]], ['P1', 'P2']);
    const { rounds, best } = await runInduction(ex, { rounds: 2 }, f.deps);
    expect(rounds.map((r) => [r.prompt, r.average])).toEqual([['P1', 50], ['P2', 85]]);
    expect(best.prompt).toBe('P2');
    expect(best.scored[0].actual).toBe('P2::Hôm nay trời đẹp');
    expect(f.calls).toHaveLength(4); // dựng, chấm, sửa, chấm
  });

  it('dừng sớm khi đã đủ tốt; vòng sau kém hơn thì giữ vòng trước', async () => {
    const good = fake([[95, 92]], ['P1']);
    expect((await runInduction(ex, { rounds: 2 }, good.deps)).rounds).toHaveLength(1);
    const worse = fake([[70, 70], [50, 50]], ['P1', 'P2']);
    expect((await runInduction(ex, { rounds: 2 }, worse.deps)).best.prompt).toBe('P1');
  });

  it('lỗi chạy một ví dụ → điểm 0 kèm lý do; AI không trả prompt → ném lỗi', async () => {
    const f = fake([[90, 90]], ['P1']);
    f.deps.run = async (_s: string, input: string) => { if (input === 'Tôi mất ví') throw new Error('hết hạn mức'); return 'ok'; };
    const { best } = await runInduction(ex, { rounds: 1 }, f.deps);
    expect(best.scored[1]).toMatchObject({ score: 0, error: 'hết hạn mức' });
    expect(best.average).toBe(45);
    await expect(runInduction(ex, {}, { ask: async () => 'rác', run: async () => '' })).rejects.toThrow(/không trả prompt/);
  });
});
