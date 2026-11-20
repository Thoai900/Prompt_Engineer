import { AiTransformOp, GraphNode } from '../types';
import { hashPrompt } from './promptRevisions';

// Node AI biến đổi (Prompt Graph v3.1 — mục 11 spec 2026-07-04-project-chain-v3-prompt-graph-design.md).
// Đầu vào = văn bản các node cắm vào cổng "Ghép thêm" của node AI (graphCompile.compileAiNodeInput).
// Kết quả AI được CACHE vào node.content (như node web) → compile vẫn thuần, KHÔNG gọi AI.
// Hàm THUẦN để unit-test; NodeInspector gọi aiService.transformPromptSegment để chạy.

export interface AiOpInfo {
  id: AiTransformOp;
  label: string;
  hint: string;
  /** Có cần ô "yêu cầu" (bắt buộc với translate/custom). */
  needsInstruction: boolean;
  instructionPlaceholder: string;
}

export const AI_OPS: AiOpInfo[] = [
  { id: 'rewrite', label: 'Viết lại rõ ràng', hint: 'Diễn đạt lại mạch lạc, chính xác hơn, giữ nguyên ý.', needsInstruction: false, instructionPlaceholder: 'Yêu cầu thêm (tuỳ chọn), vd: giọng trang trọng' },
  { id: 'shorten', label: 'Rút gọn', hint: 'Cắt bớt chữ thừa, giữ ý và ràng buộc quan trọng.', needsInstruction: false, instructionPlaceholder: 'Yêu cầu thêm (tuỳ chọn), vd: tối đa 5 câu' },
  { id: 'expand', label: 'Chi tiết hơn', hint: 'Bổ sung chi tiết, bước làm, tiêu chí cụ thể.', needsInstruction: false, instructionPlaceholder: 'Yêu cầu thêm (tuỳ chọn), vd: thêm ví dụ minh hoạ' },
  { id: 'constraints', label: 'Bổ sung ràng buộc còn thiếu', hint: 'Tìm chỗ mơ hồ, thêm ràng buộc về định dạng, phạm vi, độ dài, cách xử lý ngoại lệ.', needsInstruction: false, instructionPlaceholder: 'Yêu cầu thêm (tuỳ chọn)' },
  { id: 'translate', label: 'Dịch', hint: 'Dịch sang ngôn ngữ khác, giữ cấu trúc.', needsInstruction: true, instructionPlaceholder: 'Ngôn ngữ đích, vd: tiếng Anh' },
  { id: 'custom', label: 'Tuỳ chỉnh', hint: 'Biến đổi theo yêu cầu của bạn.', needsInstruction: true, instructionPlaceholder: 'Mô tả cách biến đổi, vd: chuyển thành danh sách các bước' },
];

export function getAiOp(op: AiTransformOp | undefined): AiOpInfo {
  return AI_OPS.find((o) => o.id === op) || AI_OPS[0];
}

const OP_TASK: Record<AiTransformOp, string> = {
  rewrite: 'Viết lại đoạn prompt cho rõ ràng, mạch lạc, chính xác hơn. Giữ nguyên ý định và mọi ràng buộc.',
  shorten: 'Rút gọn đoạn prompt: bỏ chữ thừa và lặp, giữ nguyên ý định và mọi ràng buộc quan trọng.',
  expand: 'Làm đoạn prompt chi tiết hơn: thêm bước thực hiện, tiêu chí cụ thể, chi tiết còn thiếu — không đổi ý định.',
  constraints: 'Đọc đoạn prompt, tìm chỗ mơ hồ, rồi trả về PHIÊN BẢN ĐÃ BỔ SUNG các ràng buộc còn thiếu (định dạng đầu ra, phạm vi, độ dài, cách xử lý trường hợp thiếu thông tin). Giữ toàn bộ nội dung gốc.',
  translate: 'Dịch đoạn prompt sang ngôn ngữ được yêu cầu, giữ nguyên cấu trúc và định dạng.',
  custom: 'Biến đổi đoạn prompt theo yêu cầu của người dùng.',
};

/** Yêu cầu gửi model: giữ `{{biến}}`, chỉ trả đoạn kết quả (dùng thẳng trong prompt). */
export function buildAiTransformRequest(
  op: AiTransformOp | undefined,
  instruction: string | undefined,
  input: string,
): { systemInstruction: string; userContent: string } {
  const info = getAiOp(op);
  const extra = (instruction || '').trim();
  const systemInstruction = [
    'Bạn là chuyên gia Prompt Engineering, biến đổi MỘT ĐOẠN của một prompt lớn hơn.',
    `Nhiệm vụ: ${OP_TASK[info.id]}`,
    extra ? `Yêu cầu của người dùng: ${extra}` : '',
    'Quy tắc bắt buộc:',
    '- Giữ NGUYÊN mọi chỗ biến dạng {{ten_bien}} (không điền giá trị, không đổi tên, không dịch tên biến).',
    '- Chỉ trả về đoạn kết quả để chèn thẳng vào prompt — không lời dẫn, không giải thích, không bọc trong ```.',
  ].filter(Boolean).join('\n');
  return { systemInstruction, userContent: `[ĐOẠN PROMPT CẦN BIẾN ĐỔI]\n${input}` };
}

/** Bỏ lời dẫn / khối ``` model hay thêm dù đã dặn. */
export function cleanAiOutput(text: string): string {
  let s = (text || '').trim();
  const fence = s.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  if (fence) s = fence[1].trim();
  return s;
}

/** Dấu vân tay của (đầu vào + thao tác + yêu cầu) — đổi bất kỳ thứ gì thì kết quả cũ thành "cũ". */
export function aiInputHash(node: Pick<GraphNode, 'aiOp' | 'aiInstruction'>, input: string): string {
  return hashPrompt(`${node.aiOp || 'rewrite'}\u0000${(node.aiInstruction || '').trim()}\u0000${input.trim()}`);
}

export type AiNodeStatus = 'no-input' | 'needs-instruction' | 'never-run' | 'stale' | 'fresh';

export function aiNodeStatus(node: GraphNode, input: string): AiNodeStatus {
  if (!input.trim()) return 'no-input';
  if (getAiOp(node.aiOp).needsInstruction && !(node.aiInstruction || '').trim()) return 'needs-instruction';
  if (!(node.content || '').trim() || !node.aiInputHash) return 'never-run';
  return node.aiInputHash === aiInputHash(node, input) ? 'fresh' : 'stale';
}

const VAR_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Biến `{{x}}` có ở đầu vào nhưng mất ở kết quả (model lỡ điền / đổi tên). */
export function lostVariables(input: string, output: string): string[] {
  const names = (t: string) => new Set([...t.matchAll(VAR_RE)].map((m) => m[1]));
  const out = names(output);
  return [...names(input)].filter((n) => !out.has(n));
}
