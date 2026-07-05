import { describe, it, expect } from 'vitest';
import {
  EMPTY_PROGRESS,
  MODULE_XP,
  XP_PER_LEVEL,
  applyProgress,
  levelFromXp,
  normalizeProgress,
  pickFocusSkill,
  rankName,
  suggestModuleForSkill,
  xpInLevel,
  type LearnProgress,
} from '../utils/learnProgress';

describe('levelFromXp / xpInLevel', () => {
  it('cấp 1 khi 0 XP, thăng cấp mỗi XP_PER_LEVEL', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(XP_PER_LEVEL - 1)).toBe(1);
    expect(levelFromXp(XP_PER_LEVEL)).toBe(2);
    expect(levelFromXp(XP_PER_LEVEL * 2 + 50)).toBe(3);
  });

  it('không âm và tính đúng XP trong cấp', () => {
    expect(levelFromXp(-10)).toBe(1);
    expect(xpInLevel(-10)).toBe(0);
    expect(xpInLevel(250)).toBe(50);
  });
});

describe('rankName', () => {
  it('trả về danh hiệu theo cấp, chặn biên', () => {
    expect(rankName(0)).toBe('Học viên Tập sự');
    expect(rankName(1)).toBe('Học viên Tập sự');
    expect(rankName(4)).toBe('Nhà Thiết Kế Prompt');
    expect(rankName(99)).toBe('Kiến Trúc Sư Prompt Engineering');
  });
});

describe('normalizeProgress', () => {
  it('trả về EMPTY_PROGRESS với dữ liệu rỗng/hỏng', () => {
    expect(normalizeProgress(undefined)).toEqual(EMPTY_PROGRESS);
    expect(normalizeProgress(null)).toEqual(EMPTY_PROGRESS);
    expect(normalizeProgress({ xp: 'abc', badges: 'x', completed: 42 })).toEqual(EMPTY_PROGRESS);
  });

  it('đọc được doc cũ chỉ có xp + badges (chưa có completed)', () => {
    expect(normalizeProgress({ xp: 120, badges: ['badge-gothic-writer'] })).toEqual({
      xp: 120,
      badges: ['badge-gothic-writer'],
      completed: [],
    });
  });

  it('lọc phần tử rác, module lạ và khử trùng lặp', () => {
    const raw = {
      xp: 33.9,
      badges: ['a', 'a', 7, null],
      completed: ['stage1', 'stage1', 'khong-ton-tai', 'lab-academic'],
    };
    expect(normalizeProgress(raw)).toEqual({
      xp: 33,
      badges: ['a'],
      completed: ['stage1', 'lab-academic'],
    });
  });
});

describe('applyProgress', () => {
  it('thưởng XP hoàn thành module đúng MỘT lần', () => {
    const first = applyProgress(EMPTY_PROGRESS, { moduleId: 'stage1' });
    expect(first.xpGained).toBe(MODULE_XP.stage1);
    expect(first.newlyCompleted).toBe(true);
    expect(first.progress.completed).toEqual(['stage1']);

    const again = applyProgress(first.progress, { moduleId: 'stage1' });
    expect(again.xpGained).toBe(0);
    expect(again.newlyCompleted).toBe(false);
    expect(again.progress.completed).toEqual(['stage1']);
  });

  it('bonusXp (điểm chấm Lab) cộng lặp lại được, kể cả khi module đã hoàn thành', () => {
    const base: LearnProgress = { xp: 10, badges: [], completed: ['lab-academic'] };
    const update = applyProgress(base, { moduleId: 'lab-academic', bonusXp: 15 });
    expect(update.xpGained).toBe(15);
    expect(update.progress.xp).toBe(25);
  });

  it('huy hiệu chỉ mở khóa một lần', () => {
    const first = applyProgress(EMPTY_PROGRESS, { badgeId: 'badge-json-parser', bonusXp: 5 });
    expect(first.newBadge).toBe(true);
    const again = applyProgress(first.progress, { badgeId: 'badge-json-parser' });
    expect(again.newBadge).toBe(false);
    expect(again.progress.badges).toEqual(['badge-json-parser']);
  });

  it('báo leveledUp khi vượt mốc cấp', () => {
    const base: LearnProgress = { xp: XP_PER_LEVEL - 10, badges: [], completed: [] };
    const update = applyProgress(base, { moduleId: 'stage1' });
    expect(update.leveledUp).toBe(true);
    expect(applyProgress(EMPTY_PROGRESS, { bonusXp: 5 }).leveledUp).toBe(false);
  });

  it('bỏ qua bonusXp âm', () => {
    expect(applyProgress(EMPTY_PROGRESS, { bonusXp: -50 }).xpGained).toBe(0);
  });
});

describe('pickFocusSkill', () => {
  it('ưu tiên kỹ năng yếu, rồi trung bình, null nếu tất cả tốt', () => {
    const skills = [
      { skill: 'A', level: 'tốt', evidence: '' },
      { skill: 'B', level: 'trung bình', evidence: '' },
      { skill: 'C', level: 'yếu', evidence: '' },
    ] as const;
    expect(pickFocusSkill([...skills])?.skill).toBe('C');
    expect(pickFocusSkill(skills.filter((s) => s.level !== 'yếu').map((s) => ({ ...s })))?.skill).toBe('B');
    expect(pickFocusSkill([{ skill: 'A', level: 'tốt', evidence: '' }])).toBeNull();
    expect(pickFocusSkill([])).toBeNull();
  });
});

describe('suggestModuleForSkill', () => {
  it('map các kỹ năng cốt lõi về đúng module', () => {
    expect(suggestModuleForSkill('Quy định định dạng đầu ra').view).toBe('lab-professional');
    expect(suggestModuleForSkill('Đặt ràng buộc đo lường được').view).toBe('debugging');
    expect(suggestModuleForSkill('Xác định vai trò').view).toBe('lab-creative');
    expect(suggestModuleForSkill('Dùng ví dụ/few-shot').view).toBe('stage2');
    expect(suggestModuleForSkill('Cung cấp ngữ cảnh').view).toBe('stage1');
    expect(suggestModuleForSkill('Mô tả nhiệm vụ rõ ràng').view).toBe('stage3');
  });

  it('không phân biệt hoa thường và có fallback', () => {
    expect(suggestModuleForSkill('FORMAT đầu ra JSON').view).toBe('lab-professional');
    expect(suggestModuleForSkill('kỹ năng bí ẩn nào đó').view).toBe('lab-academic');
  });
});
