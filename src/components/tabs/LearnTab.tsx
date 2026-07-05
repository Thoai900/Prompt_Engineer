import React, { useEffect, useState } from 'react';
import {
  Puzzle, PenTool, CheckCircle2, Eye, BookOpen,
  Sparkles, Target, Zap, Users, Trophy, Dices, Bug, Award
} from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useWorkspace } from '../../context/WorkspaceContext';
import { toast } from '../common/Toaster';
import { PromptTemplate } from '../../types';
import {
  type LearnModuleId, type LearnProgress, type ProgressEvent,
  EMPTY_PROGRESS, applyProgress, levelFromXp, xpInLevel, XP_PER_LEVEL,
  rankName, normalizeProgress,
} from '../../utils/learnProgress';

import Stage1 from '../learn/Stage1';
import Stage2 from '../learn/Stage2';
import Stage3 from '../learn/Stage3';
import DebuggingChallenge from '../learn/DebuggingChallenge';
import VersusChallenge from '../learn/VersusChallenge';
import DomainLab from '../learn/DomainLab';
import PersonalGuide from '../learn/PersonalGuide';

type ViewState = 'dashboard' | LearnModuleId;
type LabDomainId = 'academic' | 'creative' | 'professional' | 'entertainment';

const BADGE_DEFS = [
  { id: 'badge-socratic-scholar', name: 'Hiền Triết Socratic', desc: 'Đạt >= 80 điểm trong Lab Học thuật', emoji: '🎓', color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40 border-blue-200' },
  { id: 'badge-gothic-writer', name: 'Bậc Thầy Gothic', desc: 'Đạt >= 80 điểm trong Lab Sáng tạo', emoji: '🎨', color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-200' },
  { id: 'badge-json-parser', name: 'Kiến Trúc Sư Cấu Trúc', desc: 'Đạt >= 80 điểm trong Lab Chuyên môn', emoji: '💼', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200' },
  { id: 'badge-dungeon-master', name: 'Quản Trò Vĩ Đại', desc: 'Đạt >= 80 điểm trong Lab Giải trí', emoji: '🎲', color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/40 border-purple-200' }
];

const LS_KEY = 'learn_progress';

/** Đọc tiến trình khách (chưa đăng nhập); di trú từ 2 key rời cũ nếu có. */
function readLocalProgress(): LearnProgress {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return normalizeProgress(JSON.parse(raw));
  } catch { /* dữ liệu hỏng — thử key cũ */ }
  try {
    return normalizeProgress({
      xp: parseInt(localStorage.getItem('learn_xp') || '0', 10),
      badges: JSON.parse(localStorage.getItem('learn_badges') || '[]'),
    });
  } catch {
    return EMPTY_PROGRESS;
  }
}

interface LearnTabProps {
  libraryTemplates?: PromptTemplate[];
}

export default function LearnTab({ libraryTemplates = [] }: LearnTabProps) {
  const { user, authReady } = useWorkspace();
  const [activeView, setActiveView] = useState<ViewState>('dashboard');
  const [progress, setProgress] = useState<LearnProgress>(EMPTY_PROGRESS);
  const [loaded, setLoaded] = useState(false);

  const level = levelFromXp(progress.xp);
  const currentLevelXP = xpInLevel(progress.xp);

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    (async () => {
      if (user) {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid, 'progress', 'gamification'));
          if (!cancelled) setProgress(normalizeProgress(snap.exists() ? snap.data() : undefined));
        } catch (e) {
          console.error('Lỗi tải tiến trình học từ Firestore', e);
        }
      } else if (!cancelled) {
        setProgress(readLocalProgress());
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [user, authReady]);

  const persist = async (next: LearnProgress) => {
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'progress', 'gamification'), next, { merge: true });
      } catch (e) {
        console.error('Lỗi lưu tiến trình học lên Firestore', e);
        toast.error('Không lưu được tiến trình học. Hãy kiểm tra kết nối mạng.');
      }
    } else {
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* quota — bỏ qua */ }
    }
  };

  const handleProgress = (event: ProgressEvent) => {
    const update = applyProgress(progress, event);
    if (!update.xpGained && !update.newBadge && !update.newlyCompleted) return;
    setProgress(update.progress);
    void persist(update.progress);
    if (update.newlyCompleted) toast.success(`Hoàn thành! +${update.xpGained} XP`);
    else if (update.xpGained > 0) toast.success(`+${update.xpGained} XP`);
    if (update.newBadge) toast.success('🎖️ Mở khóa huy hiệu mới!');
    if (update.leveledUp) {
      const newLevel = levelFromXp(update.progress.xp);
      toast.success(`⬆️ Thăng cấp ${newLevel} — ${rankName(newLevel)}`);
    }
  };

  const goDashboard = () => setActiveView('dashboard');
  const completeModule = (moduleId: LearnModuleId, nextView: ViewState = 'dashboard') => {
    handleProgress({ moduleId });
    setActiveView(nextView);
  };
  const isDone = (m: LearnModuleId) => progress.completed.includes(m);

  const renderLab = (domainId: LabDomainId) => (
    <DomainLab
      domainId={domainId}
      onBack={goDashboard}
      onEarnXP={(xp, badgeId) => handleProgress({ moduleId: `lab-${domainId}` as LearnModuleId, bonusXp: xp, badgeId })}
    />
  );

  const renderView = () => {
    switch (activeView) {
      case 'stage1': return <Stage1 onNext={() => completeModule('stage1', 'stage2')} onBack={goDashboard} />;
      case 'stage2': return <Stage2 onNext={() => completeModule('stage2', 'stage3')} onBack={goDashboard} />;
      case 'stage3': return <Stage3 onNext={() => completeModule('stage3')} onBack={goDashboard} />;
      case 'debugging': return <DebuggingChallenge onBack={goDashboard} onComplete={() => completeModule('debugging')} />;
      case 'versus': return <VersusChallenge onBack={goDashboard} onComplete={() => completeModule('versus')} />;
      case 'lab-academic': return renderLab('academic');
      case 'lab-creative': return renderLab('creative');
      case 'lab-professional': return renderLab('professional');
      case 'lab-entertainment': return renderLab('entertainment');
      default: return renderDashboard();
    }
  };

  const renderDashboard = () => (
    <div className="flex-1 overflow-y-auto bg-surface p-4 md:p-8 space-y-10">
      {/* Header & Gamification Bar */}
      <div className="flex flex-col gap-6">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-3"><Sparkles className="animate-pulse" /> Học Viện Prompt Engineering</h2>
              <p className="text-indigo-100 max-w-xl text-sm md:text-base leading-relaxed">Hệ thống đào tạo từ cơ bản đến "Kiến trúc sư Prompt" đa vũ trụ. Nâng tầm tư duy điều khiển AI của bạn.</p>
            </div>

            {/* XP Status Card */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 shrink-0 w-full md:w-72">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-indigo-200">CẤP ĐỘ {level}</span>
                <span className="text-[11px] font-bold bg-white/20 px-2 py-0.5 rounded-full">{rankName(level)}</span>
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-2xl font-black">{loaded ? progress.xp : '…'}</span>
                <span className="text-xs text-indigo-200">XP TỔNG</span>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden mb-1.5">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full transition-all duration-500"
                  style={{ width: `${(currentLevelXP / XP_PER_LEVEL) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-indigo-200 font-medium">
                <span>{currentLevelXP} XP</span>
                <span>Cần {XP_PER_LEVEL - currentLevelXP} XP để thăng cấp</span>
              </div>
            </div>
          </div>
          <div className="absolute right-0 top-0 w-64 h-full opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, white, transparent)'}}></div>
        </div>
      </div>

      {/* Kho Huy hiệu đạt được (Gamification Collection) */}
      <section className="rounded-3xl border border-line bg-panel p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <Award className="text-amber-500" />
          <h3 className="text-lg font-bold text-ink">Kho Huy Hiệu Thành Tích</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {BADGE_DEFS.map((badge) => {
            const isUnlocked = progress.badges.includes(badge.id);
            return (
              <div
                key={badge.id}
                className={`rounded-2xl border p-4 flex items-center gap-3.5 transition-all ${
                  isUnlocked ? 'bg-panel border-line shadow-sm' : 'bg-surface border-line opacity-40'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 border ${
                  isUnlocked ? badge.color : 'bg-surface border-line text-faint'
                }`}>
                  {badge.emoji}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className={`text-xs font-bold ${isUnlocked ? 'text-ink' : 'text-faint'}`}>{badge.name}</h4>
                    {isUnlocked && <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />}
                  </div>
                  <p className="text-[10px] text-muted mt-0.5 leading-normal">{badge.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Gợi ý cá nhân hóa từ chẩn đoán kỹ năng thật */}
      <PersonalGuide libraryTemplates={libraryTemplates} onNavigate={(view) => setActiveView(view)} />

      {/* Hành trình cơ bản (Complexity Tiers) */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Target className="text-indigo-600" />
          <h3 className="text-lg font-bold text-ink">Khóa Nhập Môn (Cấu trúc cốt lõi)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <CourseCard
             title="Bậc 1: Cấu trúc Tĩnh"
             desc="Tìm hiểu Role, Context, Task cơ bản."
             icon={<Eye size={20} />}
             color="blue"
             onClick={() => setActiveView('stage1')}
             isCompleted={isDone('stage1')}
           />
           <CourseCard
             title="Bậc 2: Trò chơi Nhận diện"
             desc="Làm quen với các thẻ XML."
             icon={<Puzzle size={20} />}
             color="emerald"
             onClick={() => setActiveView('stage2')}
             isCompleted={isDone('stage2')}
           />
           <CourseCard
             title="Bậc 3: Thử thách Kéo thả"
             desc="Xây dựng AI Mentor với sự kiện ngẫu nhiên."
             icon={<PenTool size={20} />}
             color="indigo"
             onClick={() => setActiveView('stage3')}
             isCompleted={isDone('stage3')}
           />
        </div>
      </section>

      {/* Vũ trụ nội dung (Content Domains) */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="text-purple-600" />
          <h3 className="text-lg font-bold text-ink">Vũ Trụ Nội Dung (Phòng Lab)</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
           <DomainCard title="Học thuật" desc="Lý, Hóa, Phản biện" emoji="🎓" onClick={() => setActiveView('lab-academic')} isCompleted={isDone('lab-academic')} />
           <DomainCard title="Sáng tạo" desc="Viết truyện, Kịch bản" emoji="🎨" onClick={() => setActiveView('lab-creative')} isCompleted={isDone('lab-creative')} />
           <DomainCard title="Công việc" desc="UI/UX, Code, Phân tích" emoji="💼" onClick={() => setActiveView('lab-professional')} isCompleted={isDone('lab-professional')} />
           <DomainCard title="Giải trí" desc="Game Master, RPG" emoji="🎲" onClick={() => setActiveView('lab-entertainment')} isCompleted={isDone('lab-entertainment')} />
        </div>
      </section>

      {/* Chế độ thử thách (Challenge Modes) */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="text-amber-500" />
          <h3 className="text-lg font-bold text-ink">Phòng Khổ Luyện (Challenge Modes)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <ChallengeCard
             title="Thám tử Prompt (Debugging)"
             tag="Chữa cháy AI"
             desc={<>Người dùng cung cấp một Prompt bị rác. Nhiệm vụ của bạn là cứu vớt nó bằng cách thêm &lt;Constraints&gt; và &lt;Thinking&gt;.</>}
             icon={<Bug size={20} />}
             accent="rose"
             isCompleted={isDone('debugging')}
             onClick={() => setActiveView('debugging')}
           />
           <ChallengeCard
             title="Đối Đầu (Versus)"
             tag="Mắt Thẩm Định"
             desc="Xem 2 kết quả trả về ẩn danh. Đoán xem kết quả nào được sinh ra từ một cấu trúc Prompt chuẩn mực."
             icon={<Dices size={20} />}
             accent="amber"
             isCompleted={isDone('versus')}
             onClick={() => setActiveView('versus')}
           />
        </div>
      </section>

      {/* Cộng đồng (Social) */}
      <section className="pb-10">
        <div className="flex items-center justify-between mb-4">
           <div className="flex items-center gap-2">
             <Users className="text-emerald-600" />
             <h3 className="text-lg font-bold text-ink">Cộng đồng & Xếp hạng</h3>
           </div>
           <span className="text-[10px] font-bold bg-surface text-muted px-2 py-0.5 rounded border border-line">Sắp ra mắt</span>
        </div>
        <div className="bg-panel border border-line p-8 rounded-3xl shadow-sm text-center">
           <Trophy className="w-12 h-12 text-faint mx-auto mb-4" />
           <h4 className="font-bold text-ink mb-2">Bảng Xếp Hạng Kiến Trúc Sư</h4>
           <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">Tham gia giải quyết các bài toán hóc búa từ cộng đồng. AI sẽ tự động chấm điểm "Độ tinh tế" và "Tư duy logic" trong Prompt của bạn.</p>
        </div>
      </section>

    </div>
  );

  return (
    <div className="flex flex-col h-full bg-surface w-full overflow-hidden">
      {renderView()}
    </div>
  );
}

type CourseColor = 'blue' | 'emerald' | 'indigo';

const COURSE_ICON_STYLES: Record<CourseColor, string> = {
  blue: 'bg-blue-50 text-blue-600 group-hover:bg-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:group-hover:bg-blue-900/40',
  emerald: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:group-hover:bg-emerald-900/40',
  indigo: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:group-hover:bg-indigo-900/40',
};

interface CourseCardProps {
  title: string;
  desc: string;
  icon: React.ReactNode;
  color: CourseColor;
  onClick: () => void;
  isCompleted?: boolean;
}

function CourseCard({ title, desc, icon, color, onClick, isCompleted = false }: CourseCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-panel border border-line p-5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col relative"
    >
      {isCompleted && (
        <div className="absolute top-4 right-4 text-emerald-500">
          <CheckCircle2 size={18} />
        </div>
      )}
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-colors ${COURSE_ICON_STYLES[color]}`}>
        {icon}
      </div>
      <h4 className="font-bold text-ink mb-1 text-sm">{title}</h4>
      <p className="text-[11px] text-muted leading-normal">{desc}</p>
    </div>
  );
}

interface DomainCardProps {
  title: string;
  desc: string;
  emoji: string;
  onClick: () => void;
  isCompleted?: boolean;
}

function DomainCard({ title, desc, emoji, onClick, isCompleted = false }: DomainCardProps) {
  return (
    <div onClick={onClick} className="bg-panel border border-line p-4 rounded-2xl text-center hover:bg-hover cursor-pointer transition-colors shadow-sm relative">
       {isCompleted && (
         <div className="absolute top-3 right-3 text-emerald-500">
           <CheckCircle2 size={15} />
         </div>
       )}
       <div className="text-2xl mb-2">{emoji}</div>
       <h4 className="font-bold text-ink text-xs">{title}</h4>
       <p className="text-[10px] text-muted mt-1 leading-normal">{desc}</p>
    </div>
  );
}

const CHALLENGE_STYLES = {
  rose: {
    hover: 'hover:border-rose-400 dark:hover:border-rose-900',
    icon: 'bg-rose-50 text-rose-600 group-hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400',
    tag: 'text-rose-500 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400',
  },
  amber: {
    hover: 'hover:border-amber-400 dark:hover:border-amber-900',
    icon: 'bg-amber-50 text-amber-600 group-hover:bg-amber-100 dark:bg-amber-950/20 dark:text-amber-400',
    tag: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400',
  },
} as const;

interface ChallengeCardProps {
  title: string;
  tag: string;
  desc: React.ReactNode;
  icon: React.ReactNode;
  accent: keyof typeof CHALLENGE_STYLES;
  onClick: () => void;
  isCompleted?: boolean;
}

function ChallengeCard({ title, tag, desc, icon, accent, onClick, isCompleted = false }: ChallengeCardProps) {
  const styles = CHALLENGE_STYLES[accent];
  return (
    <div
      onClick={onClick}
      className={`bg-panel border border-line p-5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group relative ${styles.hover}`}
    >
      {isCompleted && (
        <div className="absolute top-4 right-4 text-emerald-500">
          <CheckCircle2 size={18} />
        </div>
      )}
      <div className="flex items-center gap-4 mb-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${styles.icon}`}>
          {icon}
        </div>
        <div>
           <h4 className="font-bold text-ink text-base">{title}</h4>
           <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${styles.tag}`}>{tag}</span>
        </div>
      </div>
      <p className="text-xs text-muted leading-relaxed">{desc}</p>
    </div>
  );
}
