import React, { useState } from 'react';
import { Layers, Puzzle, PenTool, CheckCircle2, ChevronRight, Eye, BookOpen, Sparkles, Target, Zap, Users, Trophy, Dices, ArrowLeft, Bug } from 'lucide-react';

import Stage1 from './learn/Stage1';
import Stage2 from './learn/Stage2';
import Stage3 from './learn/Stage3';
import DebuggingChallenge from './learn/DebuggingChallenge';
import VersusChallenge from './learn/VersusChallenge';
import DomainLab from './learn/DomainLab';

type ViewState = 'dashboard' | 'stage1' | 'stage2' | 'stage3' | 'debugging' | 'versus' | 'lab-academic' | 'lab-creative' | 'lab-professional' | 'lab-entertainment';

export default function LearnTab() {
  const [activeView, setActiveView] = useState<ViewState>('dashboard');

  const renderView = () => {
    switch (activeView) {
      case 'stage1': return <Stage1 onNext={() => setActiveView('stage2')} onBack={() => setActiveView('dashboard')} />;
      case 'stage2': return <Stage2 onNext={() => setActiveView('stage3')} onBack={() => setActiveView('dashboard')} />;
      case 'stage3': return <Stage3 onNext={() => setActiveView('dashboard')} onBack={() => setActiveView('dashboard')} />;
      case 'debugging': return <DebuggingChallenge onBack={() => setActiveView('dashboard')} />;
      case 'versus': return <VersusChallenge onBack={() => setActiveView('dashboard')} />;
      case 'lab-academic': return <DomainLab domainId="academic" onBack={() => setActiveView('dashboard')} />;
      case 'lab-creative': return <DomainLab domainId="creative" onBack={() => setActiveView('dashboard')} />;
      case 'lab-professional': return <DomainLab domainId="professional" onBack={() => setActiveView('dashboard')} />;
      case 'lab-entertainment': return <DomainLab domainId="entertainment" onBack={() => setActiveView('dashboard')} />;
      default: return renderDashboard();
    }
  };

  const renderDashboard = () => (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8 space-y-10">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold mb-2 flex items-center gap-3"><Sparkles /> Học Viện Prompt Engineering</h2>
          <p className="text-indigo-100 max-w-2xl text-lg">Hệ thống đào tạo từ cơ bản đến "Kiến trúc sư Prompt" đa vũ trụ. Nâng tầm tư duy điều khiển AI của bạn.</p>
        </div>
        <div className="absolute right-0 top-0 w-64 h-full opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, white, transparent)'}}></div>
      </div>

      {/* Gợi ý cá nhân hóa */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="text-amber-500" />
            <h3 className="text-xl font-bold text-slate-800">Dành riêng cho bạn</h3>
          </div>
          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">Phân tích từ lịch sử</span>
        </div>
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-5 rounded-2xl shadow-sm flex items-start gap-4">
           <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0 text-amber-500 font-bold text-xl">🎓</div>
           <div>
             <h4 className="font-bold text-slate-800 text-lg">Luyện thi Khối A (Toán, Lý, Hóa)</h4>
             <p className="text-sm text-slate-600 mt-1 mb-3">Có vẻ bạn đang quan tâm đến các đề tài Khoa học Tự nhiên. Hãy thử ngay khóa học thiết kế <strong>AI Gia sư Vật Lý</strong> với cấu trúc Prompt chống "sinh ra đáp án tự động".</p>
             <button onClick={() => setActiveView('lab-academic')} className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors shadow-sm">
               Thử nghiệm ngay Phòng Lab
             </button>
           </div>
        </div>
      </section>

      {/* Hành trình cơ bản (Complexity Tiers) */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Target className="text-indigo-600" />
          <h3 className="text-xl font-bold text-slate-800">Khóa Nhập Môn (Cấu trúc cốt lõi)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <CourseCard 
             title="Bậc 1: Cấu trúc Tĩnh" 
             desc="Tìm hiểu Role, Context, Task cơ bản." 
             icon={<Eye size={24} />} 
             color="blue" 
             onClick={() => setActiveView('stage1')}
             isCompleted={true}
           />
           <CourseCard 
             title="Bậc 2: Trò chơi Nhận diện" 
             desc="Làm quen với các thẻ XML." 
             icon={<Puzzle size={24} />} 
             color="emerald" 
             onClick={() => setActiveView('stage2')}
           />
           <CourseCard 
             title="Bậc 3: Thử thách Kéo thả" 
             desc="Xây dựng AI Mentor với sự kiện ngẫu nhiên." 
             icon={<PenTool size={24} />} 
             color="indigo" 
             onClick={() => setActiveView('stage3')}
           />
        </div>
      </section>

      {/* Vũ trụ nội dung (Content Domains) */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="text-purple-600" />
          <h3 className="text-xl font-bold text-slate-800">Vũ Trụ Nội Dung (Phòng Lab)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <h3 className="text-xl font-bold text-slate-800">Phòng Khổ Luyện (Challenge Modes)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div 
             onClick={() => setActiveView('debugging')}
             className="bg-white border hover:border-rose-400 border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group"
           >
             <div className="flex items-center gap-4 mb-3">
               <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center group-hover:bg-rose-100 transition-colors">
                 <Bug size={24} />
               </div>
               <div>
                  <h4 className="font-bold text-slate-800 text-lg">Thám tử Prompt (Debugging)</h4>
                  <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded">Chữa cháy AI</span>
               </div>
             </div>
             <p className="text-sm text-slate-500">Người dùng cung cấp một Prompt bị rác. Nhiệm vụ của bạn là cứu vớt nó bằng cách thêm &lt;Constraints&gt; và &lt;Thinking&gt;.</p>
           </div>

           <div 
             onClick={() => setActiveView('versus')}
             className="bg-white border hover:border-amber-400 border-slate-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group"
           >
             <div className="flex items-center gap-4 mb-3">
               <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                 <Dices size={24} />
               </div>
               <div>
                  <h4 className="font-bold text-slate-800 text-lg">Đối Đầu (Versus)</h4>
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">Mắt Thẩm Định</span>
               </div>
             </div>
             <p className="text-sm text-slate-500">Xem 2 kết quả trả về ẩn danh. Đoán xem kết quả nào được sinh ra từ một cấu trúc Prompt chuẩn mực.</p>
           </div>
        </div>
      </section>

      {/* Cộng đồng (Social) */}
      <section className="pb-10">
        <div className="flex items-center justify-between mb-4">
           <div className="flex items-center gap-2">
             <Users className="text-emerald-600" />
             <h3 className="text-xl font-bold text-slate-800">Cộng đồng & Xếp hạng</h3>
           </div>
           <span className="text-xs font-bold bg-slate-200 text-slate-600 px-2 py-1 rounded">Sắp ra mắt</span>
        </div>
        <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-sm text-center">
           <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-4" />
           <h4 className="font-bold text-slate-800 mb-2">Bảng Xếp Hạng Kiến Trúc Sư</h4>
           <p className="text-sm text-slate-500 max-w-md mx-auto">Tham gia giải quyết các bài toán hóc búa từ cộng đồng. AI sẽ tự động chấm điểm "Độ tinh tế" và "Tư duy logic" trong Prompt của bạn.</p>
        </div>
      </section>

    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 w-full overflow-hidden">
      {renderView()}
    </div>
  );
}

function CourseCard({ title, desc, icon, color, onClick, isCompleted = false }: any) {
  const colorMap: any = {
    blue: 'bg-blue-50 text-blue-600 hover:border-blue-400 group-hover:bg-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 hover:border-emerald-400 group-hover:bg-emerald-100',
    indigo: 'bg-indigo-50 text-indigo-600 hover:border-indigo-400 group-hover:bg-indigo-100',
  };

  return (
    <div 
      onClick={onClick}
      className={`bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col relative`}
    >
      {isCompleted && (
        <div className="absolute top-4 right-4 text-emerald-500">
          <CheckCircle2 size={20} />
        </div>
      )}
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${colorMap[color].split(' hover:')[0]} ${colorMap[color].split('group-hover:')[1]}`}>
        {icon}
      </div>
      <h4 className="font-bold text-slate-800 mb-1">{title}</h4>
      <p className="text-xs text-slate-500">{desc}</p>
    </div>
  )
}

function DomainCard({ title, desc, emoji, onClick }: any) {
  return (
    <div onClick={onClick} className="bg-white border border-slate-200 p-4 rounded-2xl text-center hover:bg-slate-50 cursor-pointer transition-colors shadow-sm">
       <div className="text-3xl mb-2">{emoji}</div>
       <h4 className="font-bold text-slate-700 text-sm">{title}</h4>
       <p className="text-xs text-slate-500 mt-1">{desc}</p>
    </div>
  )
}
