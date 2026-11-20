import { describe, it, expect } from 'vitest';
import {
  classifyIssue, recordIssues, markPracticed, recurringMistakes, EMPTY_LOG, MAX_EVENTS,
  buildDrillRequest, buildGradeRequest, parseDrill, parseGrade,
} from '../utils/mistakeLog';

const issue = (category: string, message: string, severity: 'high' | 'medium' | 'low' = 'medium') =>
  ({ category, message, severity, suggestion: '' });
const day = (d: number) => new Date(Date.UTC(2026, 10, d, 12));

describe('classifyIssue', () => {
  it('theo từ khoá trong loại + mô tả; ưu tiên mâu thuẫn trước định dạng', () => {
    expect(classifyIssue(issue('Mơ hồ', 'Yêu cầu "viết hay" không đo lường được'))).toBe('ambiguity');
    expect(classifyIssue(issue('Thiếu ngữ cảnh', 'Không rõ đối tượng đọc'))).toBe('context');
    expect(classifyIssue(issue('Xung đột', 'Định dạng bảng mâu thuẫn với yêu cầu đoạn văn'))).toBe('conflict');
    expect(classifyIssue(issue('Định dạng', 'Chưa nêu cấu trúc đầu ra'))).toBe('format');
    expect(classifyIssue(issue('Lạ', 'Thứ gì đó'))).toBe('other');
  });
});

describe('nhật ký lỗi', () => {
  it('mỗi lần lint: mỗi nhóm tối đa 1 sự kiện, giữ mức độ cao nhất; không lỗi thì giữ nguyên', () => {
    const log = recordIssues(EMPTY_LOG, [issue('Mơ hồ', 'a', 'low'), issue('Mơ hồ', 'b', 'high'), issue('Định dạng', 'c')], day(1));
    expect(log.events).toEqual([
      { at: day(1).toISOString(), bucket: 'ambiguity', severity: 'high', message: 'b' },
      { at: day(1).toISOString(), bucket: 'format', severity: 'medium', message: 'c' },
    ]);
    expect(recordIssues(log, [])).toBe(log);
  });

  it('giới hạn số sự kiện', () => {
    let log = EMPTY_LOG;
    for (let i = 0; i < MAX_EVENTS + 10; i++) log = recordIssues(log, [issue('Mơ hồ', `m${i}`)], day(1));
    expect(log.events).toHaveLength(MAX_EVENTS);
    expect(log.events[0].message).toBe('m10');
  });

  it('lỗi lặp lại: ≥ 2 lần trong 30 ngày, sắp theo trọng số, ví dụ gần nhất trước, bỏ nhóm "khác"', () => {
    let log = EMPTY_LOG;
    log = recordIssues(log, [issue('Mơ hồ', 'cũ quá', 'high')], new Date(Date.UTC(2026, 8, 1)));    // ngoài cửa sổ
    log = recordIssues(log, [issue('Mơ hồ', 'a1'), issue('Định dạng', 'f1', 'high')], day(10));
    log = recordIssues(log, [issue('Mơ hồ', 'a2'), issue('Định dạng', 'f2', 'high')], day(12));
    log = recordIssues(log, [issue('Thiếu ngữ cảnh', 'c1'), issue('Lạ', 'x'), issue('Lạ', 'y')], day(13));
    log = recordIssues(log, [issue('Lạ', 'z')], day(14));
    const r = recurringMistakes(log, day(20));
    expect(r.map((m) => [m.bucket, m.count, m.weight])).toEqual([['format', 2, 6], ['ambiguity', 2, 4]]);
    expect(r[1].examples).toEqual(['a2', 'a1']);
  });

  it('đã luyện → chỉ đếm lỗi mắc SAU lần luyện', () => {
    let log = EMPTY_LOG;
    log = recordIssues(log, [issue('Mơ hồ', 'a1')], day(10));
    log = recordIssues(log, [issue('Mơ hồ', 'a2')], day(11));
    log = markPracticed(log, 'ambiguity', day(12));
    expect(recurringMistakes(log, day(20))).toEqual([]);
    log = recordIssues(log, [issue('Mơ hồ', 'a3')], day(13));
    log = recordIssues(log, [issue('Mơ hồ', 'a4')], day(14));
    expect(recurringMistakes(log, day(20))[0].examples).toEqual(['a4', 'a3']);
  });
});

describe('bài luyện', () => {
  it('yêu cầu tạo bài / chấm bài chứa đúng lỗi và bài làm', () => {
    expect(buildDrillRequest({ label: 'Mơ hồ, chung chung', examples: ['viết hay'] }).userContent).toContain('- viết hay');
    const g = buildGradeRequest('Mơ hồ', { flawedPrompt: 'Viết hay về mèo', task: 'Sửa', hint: '' }, 'Viết 3 đoạn...');
    expect(g.systemInstruction).toContain('"Mơ hồ"');
    expect(g.userContent).toContain('[BÀI SỬA CỦA HỌC VIÊN]\nViết 3 đoạn...');
  });

  it('đọc JSON an toàn', () => {
    expect(parseDrill('{"flawedPrompt":" Viết hay ","hint":"h"}')).toEqual({ flawedPrompt: 'Viết hay', task: 'Sửa prompt để khắc phục lỗi.', hint: 'h' });
    expect(parseDrill('rác')).toBeNull();
    expect(parseGrade('{"score": 140, "feedback": "tốt"}')).toEqual({ score: 100, feedback: 'tốt', improved: '' });
    expect(parseGrade('{"feedback": "thiếu điểm"}')).toBeNull();
  });
});
