import React, { useState, useEffect } from 'react';
import { 
  Layers, Puzzle, PenTool, CheckCircle2, ChevronRight, Eye, BookOpen, 
  Sparkles, Target, Zap, Users, Trophy, Dices, ArrowLeft, Bug, Award, Star
} from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../../firebase';

import Stage1 from '../learn/Stage1';
import Stage2 from '../learn/Stage2';
import Stage3 from '../learn/Stage3';
import DebuggingChallenge from '../learn/DebuggingChallenge';
import VersusChallenge from '../learn/VersusChallenge';
import DomainLab from '../learn/DomainLab';

type ViewState = 'dashboard' | 'stage1' | 'stage2' | 'stage3' | 'debugging' | 'versus' | 'lab-academic' | 'lab-creative' | 'lab-professional' | 'lab-entertainment';

const BADGE_DEFS = [
  { id: 'badge-socratic-scholar', name: 'Hiền Triết Socratic', desc: 'Đạt >= 80 điểm trong Lab Học thuật', emoji: '🎓', color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40 border-blue-200' },
  { id: 'badge-gothic-writer', name: 'Bậc Thầy Gothic', desc: 'Đạt >= 80 điểm trong Lab Sáng tạo', emoji: '🎨', color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-200' },
  { id: 'badge-json-parser', name: 'Kiến Trúc Sư Cấu Trúc', desc: 'Đạt >= 80 điểm trong Lab Chuyên môn', emoji: '💼', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200' },
  { id: 'badge-dungeon-master', name: 'Quản Trò Vĩ Đại', desc: 'Đạt >= 80 điểm trong Lab Giải trí', emoji: '🎲', color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/40 border-purple-200' }
];

export default function LearnTab() {
  const [activeView, setActiveView] = useState<ViewState>('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [xp, setXp] = useState<number>(0);
  const [badges, setBadges] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Tính cấp độ và danh hiệu
  const level = Math.floor(xp / 100) + 1;
  const currentLevelXP = xp % 100;
  const xpNeededForNextLevel = 100;

  const getRankName = (lvl: number) => {
    if (lvl === 1) return 'Học viên Tập sự';
    if (lvl === 2) return 'Kỹ sư Prompt Tập sự';
    if (lvl === 3) return 'Kỹ sư Prompt Cấp cao';
    if (lvl === 4) return 'Nhà Thiết Kế Prompt';
    return 'Kiến Trúc Sư Prompt Engineering';
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Tải tiến trình từ Firestore
        try {
          const docRef = doc(db, 'users', currentUser.uid, 'progress', 'gamification');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setXp(data.xp || 0);
            setBadges(data.badges || []);
          } else {
            // Khởi tạo
            await setDoc(docRef, { xp: 0, badges: [] });
            setXp(0);
            setBadges([]);
          }
        } catch (e) {
          console.error("Lỗi tải tiến trình từ Firestore", e);
        }
      } else {
        // Tải từ localStorage
        const localXp = localStorage.getItem('learn_xp');
        const localBadges = localStorage.getItem('learn_badges');
        setXp(localXp ? parseInt(localXp, 10) : 0);
        setBadges(localBadges ? JSON.parse(localBadges) : []);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleEarnXP = async (earnedXp: number, badgeId?: string) => {
    const newXp = xp + earnedXp;
    let newBadges = [...badges];
    if (badgeId && !badges.includes(badgeId)) {
      newBadges.push(badgeId);
    }

    setXp(newXp);
    setBadges(newBadges);

    // Lưu tiến trình
    if (user) {
      try {
        const docRef = doc(db, 'users', user.uid, 'progress', 'gamification');
        await setDoc(docRef, { xp: newXp, badges: newBadges }, { merge: true });
      } catch (e) {
        console.error("Lỗi lưu tiến trình lên Firestore", e);
      }
    } else {
      localStorage.setItem('learn_xp', newXp.toString());
      localStorage.setItem('learn_badges', JSON.stringify(newBadges));
    }
  };

  const renderView = () => {
    switch (activeView) {
      case 'stage1': return <Stage1 onNext={() => setActiveView('stage2')} onBack={() => setActiveView('dashboard')} />;
      case 'stage2': return <Stage2 onNext={() => setActiveView('stage3')} onBack={() => setActiveView('dashboard')} />;
      case 'stage3': return <Stage3 onNext={() => setActiveView('dashboard')} onBack={() => setActiveView('dashboard')} />;
      case 'debugging': return <DebuggingChallenge onBack={() => setActiveView('dashboard')} />;
      case 'versus': return <VersusChallenge onBack={() => setActiveView('dashboard')} />;
      case 'lab-academic': return <DomainLab domainId="academic" onBack={() => setActiveView('dashboard')} onEarnXP={handleEarnXP} />;
      case 'lab-creative': return <DomainLab domainId="creative" onBack={() => setActiveView('dashboard')} onEarnXP={handleEarnXP} />;
      case 'lab-professional': return <DomainLab domainId="professional" onBack={() => setActiveView('dashboard')} onEarnXP={handleEarnXP} />;
      case 'lab-entertainment': return <DomainLab domainId="entertainment" onBack={() => setActiveView('dashboard')} onEarnXP={handleEarnXP} />;
      default: return renderDashboard();
    }
  };

  const renderDashboard = () => (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8 space-y-10 dark:bg-slate-950">
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
                <span className="text-[11px] font-bold bg-white/20 px-2 py-0.5 rounded-full">{getRankName(level)}</span>
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-2xl font-black">{xp}</span>
                <span className="text-xs text-indigo-200">XP TỔNG</span>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden mb-1.5">
                <div 
                  className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full transition-all duration-500" 
                  style={{ width: `${(currentLevelXP / xpNeededForNextLevel) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-indigo-200 font-medium">
                <span>{currentLevelXP} XP</span>
                <span>Cần {xpNeededForNextLevel - currentLevelXP} XP để thăng cấp</span>
              </div>
            </div>
          </div>
          <div className="absolute right-0 top-0 w-64 h-full opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, white, transparent)'}}></div>
        </div>
      </div>

      {/* Kho Huy hiệu đạt được (Gamification Collection) */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-850 dark:bg-slate-900">
        <div className="flex items-center gap-2 mb-5">
          <Award className="text-amber-500" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Kho Huy Hiệu Thành Tích</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {BADGE_DEFS.map((badge) => {
            const isUnlocked = badges.includes(badge.id);
            return (
              <div 
                key={badge.id}
                className={`rounded-2xl border p-4 flex items-center gap-3.5 transition-all ${
                  isUnlocked 
                    ? `bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm` 
                    : 'bg-slate-50/50 border-slate-200/50 dark:bg-slate-900/30 dark:border-slate-850 opacity-40'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 border ${
                  isUnlocked ? badge.color : 'bg-slate-100 border-slate-200 text-slate-400'
                }`}>
                  {badge.emoji}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className={`text-xs font-bold ${isUnlocked ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}`}>{badge.name}</h4>
                    {isUnlocked && <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">{badge.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Gợi ý cá nhân hóa */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="text-amber-500" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Dành riêng cho bạn</h3>
          </div>
          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full dark:bg-indigo-950/40 dark:text-indigo-400">Phân tích từ lịch sử</span>
        </div>
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-5 rounded-2xl shadow-sm flex items-start gap-4 dark:from-amber-950/20 dark:to-orange-950/10 dark:border-amber-900/50">
           <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0 text-amber-500 font-bold text-xl dark:bg-slate-900">🎓</div>
           <div className="flex-1">
             <h4 className="font-bold text-slate-800 text-base dark:text-slate-200">Luyện thi Khối A (Toán, Lý, Hóa)</h4>
             <p className="text-xs text-slate-600 mt-1 mb-3 dark:text-slate-400 leading-relaxed">Có vẻ bạn đang quan tâm đến các đề tài Khoa học Tự nhiên. Hãy thử ngay khóa học thiết kế <strong>AI Gia sư Vật Lý</strong> với cấu trúc Prompt chống "sinh ra đáp án tự động".</p>
             <button onClick={() => setActiveView('lab-academic')} className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-lg text-xs transition-all shadow-sm hover:scale-105 active:scale-95 cursor-pointer">
               Thử nghiệm ngay Phòng Lab
             </button>
           </div>
        </div>
      </section>

      {/* Hành trình cơ bản (Complexity Tiers) */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Target className="text-indigo-600" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Khóa Nhập Môn (Cấu trúc cốt lõi)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <CourseCard 
             title="Bậc 1: Cấu trúc Tĩnh" 
             desc="Tìm hiểu Role, Context, Task cơ bản." 
             icon={<Eye size={20} />} 
             color="blue" 
             onClick={() => setActiveView('stage1')}
             isCompleted={true}
           />
           <CourseCard 
             title="Bậc 2: Trò chơi Nhận diện" 
             desc="Làm quen với các thẻ XML." 
             icon={<Puzzle size={20} />} 
             color="emerald" 
             onClick={() => setActiveView('stage2')}
           />
           <CourseCard 
             title="Bậc 3: Thử thách Kéo thả" 
             desc="Xây dựng AI Mentor với sự kiện ngẫu nhiên." 
             icon={<PenTool size={20} />} 
             color="indigo" 
             onClick={() => setActiveView('stage3')}
           />
        </div>
      </section>

      {/* Vũ trụ nội dung (Content Domains) */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="text-purple-600" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Vũ Trụ Nội Dung (Phòng Lab)</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
           <DomainCard title="Học thuật" desc="Lý, Hóa, Phản biện" emoji="🎓" onClick={() => setActiveView('lab-academic')} />
           <DomainCard title="Sáng tạo" desc="Viết truyện, Kịch bản" emoji="🎨" onClick={() => setActiveView('lab-creative')} />
           <DomainCard title="Công việc" desc="UI/UX, Code, Phân tích" emoji="💼" onClick={() => setActiveView('lab-professional')} />
           <DomainCard title="Giải trí" desc="Game Master, RPG" emoji="🎲" onClick={() => setActiveView('lab-entertainment')} />
        </div>
      </section>

      {/* Chế độ thử thách (Challenge Modes) */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="text-amber-500" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Phòng Khổ Luyện (Challenge Modes)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div 
             onClick={() => setActiveView('debugging')}
             className="bg-white border hover:border-rose-400 border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group dark:bg-slate-900 dark:border-slate-800 dark:hover:border-rose-900"
           >
             <div className="flex items-center gap-4 mb-3">
               <div className="w-11 h-11 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center group-hover:bg-rose-100 transition-colors dark:bg-rose-950/20 dark:text-rose-400">
                 <Bug size={20} />
               </div>
               <div>
                  <h4 className="font-bold text-slate-850 text-base dark:text-slate-200">Thám tử Prompt (Debugging)</h4>
                  <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded dark:bg-rose-950/40 dark:text-rose-400">Chữa cháy AI</span>
               </div>
             </div>
             <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Người dùng cung cấp một Prompt bị rác. Nhiệm vụ của bạn là cứu vớt nó bằng cách thêm &lt;Constraints&gt; và &lt;Thinking&gt;.</p>
           </div>

           <div 
             onClick={() => setActiveView('versus')}
             className="bg-white border hover:border-amber-400 border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group dark:bg-slate-900 dark:border-slate-800 dark:hover:border-amber-900"
           >
             <div className="flex items-center gap-4 mb-3">
               <div className="w-11 h-11 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center group-hover:bg-amber-100 transition-colors dark:bg-amber-950/20 dark:text-amber-400">
                 <Dices size={20} />
               </div>
               <div>
                  <h4 className="font-bold text-slate-850 text-base dark:text-slate-200">Đối Đầu (Versus)</h4>
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded dark:bg-amber-950/40 dark:text-amber-400">Mắt Thẩm Định</span>
               </div>
             </div>
             <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Xem 2 kết quả trả về ẩn danh. Đoán xem kết quả nào được sinh ra từ một cấu trúc Prompt chuẩn mực.</p>
           </div>
        </div>
      </section>

      {/* Cộng đồng (Social) */}
      <section className="pb-10">
        <div className="flex items-center justify-between mb-4">
           <div className="flex items-center gap-2">
             <Users className="text-emerald-600" />
             <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Cộng đồng & Xếp hạng</h3>
           </div>
           <span className="text-[10px] font-bold bg-slate-200 text-slate-650 px-2 py-0.5 rounded dark:bg-slate-850 dark:text-slate-400">Sắp ra mắt</span>
        </div>
        <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm text-center dark:bg-slate-900 dark:border-slate-800">
           <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-4 dark:text-slate-700" />
           <h4 className="font-bold text-slate-800 mb-2 dark:text-slate-200">Bảng Xếp Hạng Kiến Trúc Sư</h4>
           <p className="text-xs text-slate-500 max-w-md mx-auto dark:text-slate-400 leading-relaxed">Tham gia giải quyết các bài toán hóc búa từ cộng đồng. AI sẽ tự động chấm điểm "Độ tinh tế" và "Tư duy logic" trong Prompt của bạn.</p>
        </div>
      </section>

    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 w-full overflow-hidden dark:bg-slate-950">
      {renderView()}
    </div>
  );
}

function CourseCard({ title, desc, icon, color, onClick, isCompleted = false }: any) {
  const colorMap: any = {
    blue: 'bg-blue-50 text-blue-600 hover:border-blue-400 group-hover:bg-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:group-hover:bg-blue-900/40',
    emerald: 'bg-emerald-50 text-emerald-600 hover:border-emerald-400 group-hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:group-hover:bg-emerald-900/40',
    indigo: 'bg-indigo-50 text-indigo-600 hover:border-indigo-400 group-hover:bg-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:group-hover:bg-indigo-900/40',
  };

  return (
    <div 
      onClick={onClick}
      className={`bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col relative dark:bg-slate-900 dark:border-slate-800`}
    >
      {isCompleted && (
        <div className="absolute top-4 right-4 text-emerald-500">
          <CheckCircle2 size={18} />
        </div>
      )}
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-colors ${colorMap[color].split(' hover:')[0]} ${colorMap[color].split('group-hover:')[1]}`}>
        {icon}
      </div>
      <h4 className="font-bold text-slate-800 mb-1 text-sm dark:text-slate-200">{title}</h4>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">{desc}</p>
    </div>
  )
}

function DomainCard({ title, desc, emoji, onClick }: any) {
  return (
    <div onClick={onClick} className="bg-white border border-slate-200 p-4 rounded-2xl text-center hover:bg-slate-50 dark:hover:bg-slate-900/60 cursor-pointer transition-colors shadow-sm dark:bg-slate-900 dark:border-slate-800">
       <div className="text-2xl mb-2">{emoji}</div>
       <h4 className="font-bold text-slate-700 text-xs dark:text-slate-200">{title}</h4>
       <p className="text-[10px] text-slate-550 mt-1 dark:text-slate-400 leading-normal">{desc}</p>
    </div>
  )
}
