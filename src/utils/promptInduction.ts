import { safeJsonParse } from './jsonUtils';
import { runWithConcurrency } from './profiler';

// Suy ngược prompt từ ví dụ (Lab · "Từ ví dụ"): người dùng đưa vài cặp Đầu vào → Đầu ra mong muốn,
// AI dựng prompt nháp → chạy thử trên từng đầu vào → chấm mức khớp với đầu ra mẫu (MỘT lời gọi chấm
// cho cả lượt) → sửa theo cặp lệch, tối đa vài vòng → giữ bản điểm cao nhất.
// Phần dựng yêu cầu / đọc JSON / vòng lặp là THUẦN (vòng lặp nhận hàm gọi AI qua tham số) để test.

export interface Example { input: string; output: string }

export const MIN_EXAMPLES = 2;
export const MAX_EXAMPLES = 5;
export const MAX_EXAMPLE_CHARS = 4000;
export const MAX_ROUNDS = 2;
/** Điểm trung bình đạt mức này thì dừng sớm, không sửa thêm. */
export const GOOD_ENOUGH = 90;

/** Lọc cặp rỗng; báo lỗi đủ rõ để hiện cho người dùng. */
export function validateExamples(examples: Example[]): { ok: true; examples: Example[] } | { ok: false; error: string } {
  const filled = examples
    .map((e) => ({ input: (e.input || '').trim(), output: (e.output || '').trim() }))
    .filter((e) => e.input || e.output);
  if (filled.some((e) => !e.input || !e.output)) return { ok: false, error: 'Mỗi cặp cần đủ cả Đầu vào và Đầu ra mong muốn.' };
  if (filled.length < MIN_EXAMPLES) return { ok: false, error: `Cần ít nhất ${MIN_EXAMPLES} cặp ví dụ.` };
  if (filled.length > MAX_EXAMPLES) return { ok: false, error: `Tối đa ${MAX_EXAMPLES} cặp ví dụ.` };
  if (filled.some((e) => e.input.length > MAX_EXAMPLE_CHARS || e.output.length > MAX_EXAMPLE_CHARS)) {
    return { ok: false, error: `Mỗi ô tối đa ${MAX_EXAMPLE_CHARS.toLocaleString()} ký tự.` };
  }
  return { ok: true, examples: filled };
}

function examplesBlock(examples: Example[]): string {
  return examples.map((e, i) => `### Ví dụ ${i + 1}\n[ĐẦU VÀO]\n${e.input}\n[ĐẦU RA MONG MUỐN]\n${e.output}`).join('\n\n');
}

export interface ChatRequest { systemInstruction: string; userContent: string }

/** Yêu cầu dựng prompt nháp từ các cặp ví dụ. Trả JSON {"prompt": "..."}. */
export function buildInduceRequest(examples: Example[], hint = ''): ChatRequest {
  return {
    systemInstruction: [
      'Bạn là chuyên gia Prompt Engineering. Nhiệm vụ: SUY NGƯỢC một prompt hệ thống (system prompt) từ các cặp ví dụ.',
      'Prompt bạn viết sẽ được dùng làm chỉ dẫn hệ thống; ĐẦU VÀO của người dùng được gửi riêng như tin nhắn người dùng.',
      'Prompt phải khiến model biến mỗi đầu vào thành đúng kiểu đầu ra mong muốn: cùng nhiệm vụ, định dạng, độ dài, giọng văn, quy tắc ngầm.',
      'Mô tả quy tắc tổng quát — KHÔNG chép nguyên các ví dụ vào prompt trừ khi thật cần một ví dụ minh hoạ ngắn.',
      'Chỉ trả về JSON: {"prompt": "<prompt hệ thống hoàn chỉnh>"}',
    ].join('\n'),
    userContent: `${hint.trim() ? `[GỢI Ý CỦA NGƯỜI DÙNG]\n${hint.trim()}\n\n` : ''}${examplesBlock(examples)}`,
  };
}

export interface ScoredExample { input: string; expected: string; actual: string; score: number; reason: string; error?: string }

/** Một lời gọi chấm cho cả lượt: so đầu ra thực tế với đầu ra mong muốn từng cặp. */
export function buildJudgeRequest(results: Array<{ input: string; expected: string; actual: string }>): ChatRequest {
  return {
    systemInstruction: [
      'Bạn là giám khảo khắt khe. Với từng cặp, so ĐẦU RA THỰC TẾ với ĐẦU RA MONG MUỐN.',
      'Chấm 0–100 mức tương đương: đúng nhiệm vụ và nội dung, đúng định dạng, độ dài và giọng văn tương tự. Không cần giống từng chữ.',
      `Chỉ trả về JSON: {"scores": [{"score": <0-100>, "reason": "<ngắn gọn, nêu chỗ lệch>"}, ...]} — đúng ${results.length} phần tử theo thứ tự.`,
    ].join('\n'),
    userContent: results.map((r, i) =>
      `### Cặp ${i + 1}\n[ĐẦU VÀO]\n${r.input}\n[ĐẦU RA MONG MUỐN]\n${r.expected}\n[ĐẦU RA THỰC TẾ]\n${r.actual}`).join('\n\n'),
  };
}

/** Yêu cầu sửa prompt dựa trên các cặp còn lệch. Trả JSON {"prompt": "..."}. */
export function buildReviseRequest(prompt: string, scored: ScoredExample[], hint = ''): ChatRequest {
  const weak = [...scored].sort((a, b) => a.score - b.score).slice(0, 3);
  return {
    systemInstruction: [
      'Bạn là chuyên gia Prompt Engineering. Sửa prompt hệ thống để đầu ra khớp đầu ra mong muốn hơn.',
      'Dựa vào các cặp bị lệch và lý do; giữ những gì đang đúng; mô tả quy tắc tổng quát, không chép nguyên ví dụ.',
      'Chỉ trả về JSON: {"prompt": "<prompt hệ thống đã sửa, hoàn chỉnh>"}',
    ].join('\n'),
    userContent: [
      hint.trim() ? `[GỢI Ý CỦA NGƯỜI DÙNG]\n${hint.trim()}` : '',
      `[PROMPT HIỆN TẠI]\n${prompt}`,
      ...weak.map((s, i) => `### Cặp lệch ${i + 1} (điểm ${s.score})\n[ĐẦU VÀO]\n${s.input}\n[ĐẦU RA MONG MUỐN]\n${s.expected}\n[ĐẦU RA THỰC TẾ]\n${s.actual}\n[NHẬN XÉT]\n${s.reason}`),
    ].filter(Boolean).join('\n\n'),
  };
}

/** safeJsonParse ném lỗi với văn bản không phải JSON — ở đây coi như "không đọc được". */
function tryJson(text: string): any {
  try { return safeJsonParse(text || ''); } catch { return null; }
}

/** Đọc {"prompt": "..."}; không đọc được → null. */
export function parsePromptJson(text: string): string | null {
  const parsed = tryJson(text);
  const p = parsed && typeof parsed.prompt === 'string' ? parsed.prompt.trim() : '';
  return p || null;
}

/** Đọc {"scores": [...]} đúng n phần tử; thiếu / sai → điểm 0 kèm lý do để không âm thầm "đạt". */
export function parseScores(text: string, n: number): Array<{ score: number; reason: string }> {
  const parsed = tryJson(text);
  const arr: any[] = parsed && Array.isArray(parsed.scores) ? parsed.scores : [];
  return Array.from({ length: n }, (_, i) => {
    const s = arr[i];
    const score = s && typeof s.score === 'number' ? Math.max(0, Math.min(100, Math.round(s.score))) : 0;
    const reason = s && typeof s.reason === 'string' ? s.reason : 'Giám khảo không trả điểm cho cặp này.';
    return { score, reason };
  });
}

export function averageScore(scored: Array<{ score: number }>): number {
  return scored.length ? Math.round(scored.reduce((a, s) => a + s.score, 0) / scored.length) : 0;
}

export interface InductionRound { round: number; prompt: string; average: number; scored: ScoredExample[] }

export interface InductionDeps {
  /** Gọi AI trả văn bản (JSON) cho bước dựng / chấm / sửa. */
  ask: (req: ChatRequest) => Promise<string>;
  /** Chạy prompt ứng viên trên một đầu vào ở model đích. */
  run: (systemInstruction: string, input: string) => Promise<string>;
  onProgress?: (msg: string) => void;
}

/** Chạy prompt trên mọi ví dụ (2 lượt song song) rồi chấm một lần. */
async function evaluate(prompt: string, examples: Example[], deps: InductionDeps): Promise<ScoredExample[]> {
  const outputs = await runWithConcurrency(examples.map((e) => async () => {
    try { return { actual: await deps.run(prompt, e.input) }; } catch (err: any) { return { actual: '', error: err?.message || 'Lỗi chạy prompt' }; }
  }), 2);
  const rows = examples.map((e, i) => ({ input: e.input, expected: e.output, actual: outputs[i].actual }));
  const scores = parseScores(await deps.ask(buildJudgeRequest(rows)), rows.length);
  return rows.map((r, i) => ({
    ...r,
    score: outputs[i].error ? 0 : scores[i].score,
    reason: outputs[i].error ? `Lỗi khi chạy: ${outputs[i].error}` : scores[i].reason,
    ...(outputs[i].error ? { error: outputs[i].error } : {}),
  }));
}

/**
 * Vòng suy ngược: dựng nháp → chấm → (sửa → chấm) tối đa `rounds - 1` lần, dừng sớm khi ≥ GOOD_ENOUGH.
 * Trả mọi vòng và vòng tốt nhất (điểm TB cao nhất; hoà thì vòng sớm hơn — prompt ổn định hơn).
 */
export async function runInduction(
  examples: Example[],
  opts: { hint?: string; rounds?: number },
  deps: InductionDeps,
): Promise<{ rounds: InductionRound[]; best: InductionRound }> {
  const total = Math.max(1, Math.min(MAX_ROUNDS, opts.rounds ?? MAX_ROUNDS));
  const hint = opts.hint || '';
  deps.onProgress?.('Đang dựng prompt nháp từ ví dụ…');
  let prompt = parsePromptJson(await deps.ask(buildInduceRequest(examples, hint)));
  if (!prompt) throw new Error('AI không trả prompt hợp lệ — thử lại.');

  const rounds: InductionRound[] = [];
  for (let r = 1; r <= total; r++) {
    deps.onProgress?.(`Vòng ${r}/${total}: chạy thử ${examples.length} ví dụ và chấm…`);
    const scored = await evaluate(prompt, examples, deps);
    rounds.push({ round: r, prompt, average: averageScore(scored), scored });
    if (r === total || rounds[rounds.length - 1].average >= GOOD_ENOUGH) break;
    deps.onProgress?.(`Vòng ${r}/${total}: sửa prompt theo các cặp lệch…`);
    const revised = parsePromptJson(await deps.ask(buildReviseRequest(prompt, scored, hint)));
    if (!revised) break; // giữ kết quả đã có thay vì báo lỗi cả lượt
    prompt = revised;
  }
  const best = rounds.reduce((b, x) => (x.average > b.average ? x : b), rounds[0]);
  return { rounds, best };
}
