import type { SkillGap } from '../services/aiService';

/**
 * Logic thuần cho tiến trình học tab Learn: XP / cấp độ / huy hiệu /
 * trạng thái hoàn thành module, và gợi ý module luyện tập từ chẩn đoán kỹ năng.
 * Tách khỏi UI để unit-test được.
 */

export type LearnModuleId =
  | 'stage1'
  | 'stage2'
  | 'stage3'
  | 'debugging'
  | 'versus'
  | 'lab-academic'
  | 'lab-creative'
  | 'lab-professional'
  | 'lab-entertainment';

const MODULE_IDS: LearnModuleId[] = [
  'stage1', 'stage2', 'stage3', 'debugging', 'versus',
  'lab-academic', 'lab-creative', 'lab-professional', 'lab-entertainment',
];

export interface LearnProgress {
  xp: number;
  badges: string[];
  completed: LearnModuleId[];
}

export const EMPTY_PROGRESS: LearnProgress = { xp: 0, badges: [], completed: [] };

/** XP thưởng MỘT LẦN khi hoàn thành module lần đầu (Lab còn có thêm XP theo điểm chấm, lặp lại được). */
export const MODULE_XP: Record<LearnModuleId, number> = {
  stage1: 20,
  stage2: 30,
  stage3: 50,
  debugging: 45,
  versus: 40,
  'lab-academic': 25,
  'lab-creative': 25,
  'lab-professional': 25,
  'lab-entertainment': 25,
};

export const XP_PER_LEVEL = 100;

export function levelFromXp(xp: number): number {
  return Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;
}

/** XP đã tích trong cấp hiện tại (0..XP_PER_LEVEL-1). */
export function xpInLevel(xp: number): number {
  return Math.max(0, xp) % XP_PER_LEVEL;
}

export function rankName(level: number): string {
  if (level <= 1) return 'Học viên Tập sự';
  if (level === 2) return 'Kỹ sư Prompt Tập sự';
  if (level === 3) return 'Kỹ sư Prompt Cấp cao';
  if (level === 4) return 'Nhà Thiết Kế Prompt';
  return 'Kiến Trúc Sư Prompt Engineering';
}

/** Chuẩn hoá dữ liệu thô từ Firestore/localStorage (doc cũ chỉ có xp + badges, chưa có completed). */
export function normalizeProgress(raw: unknown): LearnProgress {
  const r = (raw ?? {}) as Record<string, unknown>;
  const xp = typeof r.xp === 'number' && Number.isFinite(r.xp) ? Math.max(0, Math.floor(r.xp)) : 0;
  const badges = Array.isArray(r.badges)
    ? [...new Set(r.badges.filter((b): b is string => typeof b === 'string'))]
    : [];
  const completed = Array.isArray(r.completed)
    ? [...new Set(r.completed.filter((m): m is LearnModuleId => MODULE_IDS.includes(m as LearnModuleId)))]
    : [];
  return { xp, badges, completed };
}

export interface ProgressEvent {
  /** Module vừa hoàn thành — thưởng MODULE_XP một lần duy nhất. */
  moduleId?: LearnModuleId;
  /** XP cộng thêm lặp lại được (ví dụ điểm chấm của Phòng Lab). */
  bonusXp?: number;
  /** Huy hiệu mở khóa (bỏ qua nếu đã có). */
  badgeId?: string;
}

export interface ProgressUpdate {
  progress: LearnProgress;
  xpGained: number;
  newlyCompleted: boolean;
  newBadge: boolean;
  leveledUp: boolean;
}

export function applyProgress(prev: LearnProgress, event: ProgressEvent): ProgressUpdate {
  const newlyCompleted = !!event.moduleId && !prev.completed.includes(event.moduleId);
  const xpGained =
    (newlyCompleted && event.moduleId ? MODULE_XP[event.moduleId] : 0) +
    Math.max(0, Math.floor(event.bonusXp ?? 0));
  const newBadge = !!event.badgeId && !prev.badges.includes(event.badgeId);
  const progress: LearnProgress = {
    xp: prev.xp + xpGained,
    badges: newBadge && event.badgeId ? [...prev.badges, event.badgeId] : prev.badges,
    completed: newlyCompleted && event.moduleId ? [...prev.completed, event.moduleId] : prev.completed,
  };
  return {
    progress,
    xpGained,
    newlyCompleted,
    newBadge,
    leveledUp: levelFromXp(progress.xp) > levelFromXp(prev.xp),
  };
}

/** Kỹ năng đáng luyện nhất: ưu tiên 'yếu', rồi 'trung bình'; null nếu tất cả đều tốt. */
export function pickFocusSkill(skills: SkillGap[]): SkillGap | null {
  return skills.find((s) => s.level === 'yếu') ?? skills.find((s) => s.level === 'trung bình') ?? null;
}

export interface ModuleSuggestion {
  view: LearnModuleId;
  title: string;
  reason: string;
}

/** Map tên kỹ năng (văn bản tự do từ AI chẩn đoán) → module luyện tập phù hợp trong tab Learn. */
export function suggestModuleForSkill(skill: string): ModuleSuggestion {
  const s = skill.toLowerCase();
  if (/định dạng|format|json|đầu ra|output/.test(s)) {
    return {
      view: 'lab-professional',
      title: 'Lab Trích xuất JSON',
      reason: 'Luyện khóa chặt định dạng đầu ra bằng <Format> — ép AI chỉ trả về đúng cấu trúc bạn cần.',
    };
  }
  if (/ràng buộc|constraint|giới hạn/.test(s)) {
    return {
      view: 'debugging',
      title: 'Thám tử Prompt',
      reason: 'Luyện dùng <Constraints> để chặn hành vi sai lệch của AI qua các ca "chữa cháy" thực tế.',
    };
  }
  if (/vai trò|role|persona|nhân vật/.test(s)) {
    return {
      view: 'lab-creative',
      title: 'Lab Sáng tạo',
      reason: 'Luyện thiết kế vai trò và giữ giọng văn nhất quán qua bài đồng sáng tác Gothic.',
    };
  }
  if (/ví dụ|few.?shot|example|mẫu/.test(s)) {
    return {
      view: 'stage2',
      title: 'Trò chơi Nhận diện thẻ',
      reason: 'Ôn lại thẻ <Example> và các cấu trúc few-shot qua trò chơi đoán thẻ.',
    };
  }
  if (/ngữ cảnh|context|bối cảnh/.test(s)) {
    return {
      view: 'stage1',
      title: 'Bậc 1: Cấu trúc Tĩnh',
      reason: 'Ôn lại vai trò của <Context> trong giải phẫu một prompt chuẩn.',
    };
  }
  if (/nhiệm vụ|task|yêu cầu/.test(s)) {
    return {
      view: 'stage3',
      title: 'Thử thách Kéo-Thả',
      reason: 'Luyện mô tả nhiệm vụ rõ ràng bằng cách tự lắp ráp một prompt hoàn chỉnh từ các khối.',
    };
  }
  return {
    view: 'lab-academic',
    title: 'Lab Học thuật',
    reason: 'Luyện tư duy thiết kế prompt tổng hợp với bài AI Gia sư Socratic.',
  };
}
