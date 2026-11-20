import type { LintIssue } from '../services/aiService';
import { safeJsonParse } from './jsonUtils';

// Gia sư cá nhân hoá (Learn): ghi lại lỗi prompt người dùng hay mắc (từ kết quả lint ở Prompt
// Inspector / Studio), gom thành nhóm, tìm nhóm lặp lại → bài luyện riêng (AI tạo prompt mắc đúng lỗi
// đó, người dùng sửa, AI chấm). Luyện đạt → nhóm đó chỉ tính lại lỗi mắc SAU lần luyện.
// Hàm THUẦN để unit-test; mistakeLogService lo localStorage.

export type MistakeBucket = 'ambiguity' | 'conflict' | 'context' | 'format' | 'constraints' | 'other';

export const MISTAKE_BUCKETS: Array<{ id: MistakeBucket; label: string; keywords: string[]; advice: string }> = [
  { id: 'conflict', label: 'Yêu cầu mâu thuẫn', keywords: ['mâu thuẫn', 'xung đột', 'trái ngược', 'conflict', 'contradict'], advice: 'Đọc lại toàn bộ prompt, gộp các yêu cầu chồng chéo và nói rõ ưu tiên khi chúng va nhau.' },
  { id: 'format', label: 'Định dạng đầu ra chưa rõ', keywords: ['định dạng', 'format', 'cấu trúc', 'đầu ra', 'output'], advice: 'Nêu cụ thể hình dạng kết quả: JSON / bảng / gạch đầu dòng, độ dài, các mục bắt buộc.' },
  { id: 'context', label: 'Thiếu ngữ cảnh', keywords: ['ngữ cảnh', 'bối cảnh', 'thiếu thông tin', 'context', 'đối tượng', 'mục đích'], advice: 'Cho AI biết ai đọc kết quả, mục đích dùng, và dữ liệu đầu vào trông thế nào.' },
  { id: 'constraints', label: 'Ràng buộc thừa / thiếu', keywords: ['ràng buộc', 'giới hạn', 'constraint', 'quy tắc'], advice: 'Giữ ràng buộc đo kiểm được (số từ, phạm vi, điều cấm), bỏ ràng buộc trùng lặp.' },
  { id: 'ambiguity', label: 'Mơ hồ, chung chung', keywords: ['mơ hồ', 'đa nghĩa', 'chung chung', 'không rõ', 'đo lường', 'ambiguous', 'vague'], advice: 'Thay từ cảm tính ("hay", "tốt", "ngắn gọn") bằng tiêu chí cụ thể có thể kiểm tra.' },
  { id: 'other', label: 'Khác', keywords: [], advice: 'Xem lại gợi ý sửa trong Prompt Inspector.' },
];

export function bucketInfo(id: MistakeBucket) {
  return MISTAKE_BUCKETS.find((b) => b.id === id) || MISTAKE_BUCKETS[MISTAKE_BUCKETS.length - 1];
}

/** Xếp một lỗi lint vào nhóm theo từ khoá trong loại + mô tả (theo thứ tự ưu tiên của MISTAKE_BUCKETS). */
export function classifyIssue(issue: Pick<LintIssue, 'category' | 'message'>): MistakeBucket {
  const text = `${issue.category || ''} ${issue.message || ''}`.toLowerCase();
  for (const b of MISTAKE_BUCKETS) {
    if (b.keywords.some((k) => text.includes(k))) return b.id;
  }
  return 'other';
}

export interface MistakeEvent { at: string; bucket: MistakeBucket; severity: LintIssue['severity']; message: string }
export interface MistakeLog { events: MistakeEvent[]; practiced: Partial<Record<MistakeBucket, string>> }

export const MAX_EVENTS = 300;
export const EMPTY_LOG: MistakeLog = { events: [], practiced: {} };

/** Thêm các lỗi của MỘT lần lint (mỗi nhóm tối đa 1 sự kiện/lần — tránh 1 prompt dài thổi phồng số đếm). */
export function recordIssues(log: MistakeLog, issues: LintIssue[], now: Date = new Date()): MistakeLog {
  const sevRank = { high: 3, medium: 2, low: 1 } as const;
  const perBucket = new Map<MistakeBucket, LintIssue>();
  for (const issue of issues) {
    const b = classifyIssue(issue);
    const prev = perBucket.get(b);
    if (!prev || sevRank[issue.severity] > sevRank[prev.severity]) perBucket.set(b, issue);
  }
  if (!perBucket.size) return log;
  const at = now.toISOString();
  const added: MistakeEvent[] = [...perBucket].map(([bucket, i]) => ({ at, bucket, severity: i.severity, message: (i.message || '').slice(0, 300) }));
  return { ...log, events: [...log.events, ...added].slice(-MAX_EVENTS) };
}

export function markPracticed(log: MistakeLog, bucket: MistakeBucket, now: Date = new Date()): MistakeLog {
  return { ...log, practiced: { ...log.practiced, [bucket]: now.toISOString() } };
}

export interface RecurringMistake {
  bucket: MistakeBucket;
  label: string;
  advice: string;
  count: number;
  weight: number;       // tổng theo mức độ (cao 3, vừa 2, nhẹ 1)
  examples: string[];   // tối đa 3 mô tả gần nhất
  lastAt: string;
}

/**
 * Nhóm lỗi lặp lại: sự kiện trong `windowDays` ngày và SAU lần luyện gần nhất của nhóm, có ít nhất
 * `minCount` lần. Bỏ nhóm 'other' (không luyện có chủ đích được). Sắp theo trọng số giảm dần.
 */
export function recurringMistakes(log: MistakeLog, now: Date = new Date(), windowDays = 30, minCount = 2): RecurringMistake[] {
  const since = now.getTime() - windowDays * 86_400_000;
  const w = { high: 3, medium: 2, low: 1 } as const;
  const groups = new Map<MistakeBucket, MistakeEvent[]>();
  for (const e of log.events) {
    if (e.bucket === 'other') continue;
    const t = Date.parse(e.at);
    const practiced = log.practiced[e.bucket] ? Date.parse(log.practiced[e.bucket] as string) : -Infinity;
    if (t < since || t <= practiced) continue;
    groups.set(e.bucket, [...(groups.get(e.bucket) || []), e]);
  }
  return [...groups]
    .filter(([, es]) => es.length >= minCount)
    .map(([bucket, es]) => {
      const info = bucketInfo(bucket);
      const recent = [...es].sort((a, b) => b.at.localeCompare(a.at));
      return {
        bucket,
        label: info.label,
        advice: info.advice,
        count: es.length,
        weight: es.reduce((s, e) => s + w[e.severity], 0),
        examples: [...new Set(recent.map((e) => e.message).filter(Boolean))].slice(0, 3),
        lastAt: recent[0].at,
      };
    })
    .sort((a, b) => b.weight - a.weight || b.lastAt.localeCompare(a.lastAt));
}

// ── Bài luyện riêng ──────────────────────────────────────────────────────────

export interface Drill { flawedPrompt: string; task: string; hint: string }
export interface DrillGrade { score: number; feedback: string; improved: string }

export const PASS_SCORE = 70;

export function buildDrillRequest(m: Pick<RecurringMistake, 'label' | 'examples'>): { systemInstruction: string; userContent: string } {
  return {
    systemInstruction: [
      'Bạn là gia sư Prompt Engineering. Tạo MỘT bài luyện ngắn nhắm đúng lỗi học viên hay mắc.',
      'Viết một prompt thực tế (3–6 câu, tiếng Việt) mắc RÕ lỗi đó — chỉ lỗi đó, còn lại ổn — để học viên sửa.',
      'Chỉ trả về JSON: {"flawedPrompt": "...", "task": "<yêu cầu sửa, 1 câu>", "hint": "<gợi ý ngắn, không lộ đáp án>"}',
    ].join('\n'),
    userContent: `[LỖI CẦN LUYỆN]\n${m.label}\n[VÍ DỤ LỖI HỌC VIÊN ĐÃ MẮC]\n${m.examples.map((e) => `- ${e}`).join('\n') || '- (không có)'}`,
  };
}

export function buildGradeRequest(label: string, drill: Drill, answer: string): { systemInstruction: string; userContent: string } {
  return {
    systemInstruction: [
      'Bạn là gia sư Prompt Engineering, chấm bài sửa prompt của học viên — công bằng, khích lệ, cụ thể.',
      `Chấm 0–100 chủ yếu theo: đã khắc phục lỗi "${label}" chưa; phụ: không làm hỏng ý định gốc, prompt rõ ràng dùng được.`,
      'Chỉ trả về JSON: {"score": <0-100>, "feedback": "<2–3 câu: làm tốt gì, còn thiếu gì>", "improved": "<một bản sửa tham khảo>"}',
    ].join('\n'),
    userContent: `[PROMPT GỐC CÓ LỖI]\n${drill.flawedPrompt}\n[YÊU CẦU]\n${drill.task}\n[BÀI SỬA CỦA HỌC VIÊN]\n${answer}`,
  };
}

function tryJson(text: string): any {
  try { return safeJsonParse(text || ''); } catch { return null; }
}

export function parseDrill(text: string): Drill | null {
  const j = tryJson(text);
  if (!j || typeof j.flawedPrompt !== 'string' || !j.flawedPrompt.trim()) return null;
  return {
    flawedPrompt: j.flawedPrompt.trim(),
    task: typeof j.task === 'string' && j.task.trim() ? j.task.trim() : 'Sửa prompt để khắc phục lỗi.',
    hint: typeof j.hint === 'string' ? j.hint.trim() : '',
  };
}

export function parseGrade(text: string): DrillGrade | null {
  const j = tryJson(text);
  if (!j || typeof j.score !== 'number') return null;
  return {
    score: Math.max(0, Math.min(100, Math.round(j.score))),
    feedback: typeof j.feedback === 'string' ? j.feedback : '',
    improved: typeof j.improved === 'string' ? j.improved : '',
  };
}
