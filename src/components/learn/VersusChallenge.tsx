import React, { useState } from 'react';
import { Swords, ArrowLeft, CheckCircle2, XCircle, FastForward } from 'lucide-react';

const rounds = [
  {
    id: 1,
    title: 'Vòng 1: Viết quảng cáo Marketing',
    challenge: 'Mục tiêu: Đạt được bài đăng có bố cục cảm xúc, không bị rập khuôn.',
    promptA: `<Role>Bạn là thực tập sinh.</Role>\nViết quảng cáo giày mùa hè.`,
    promptB: `<Role>Bạn là Giám đốc Sáng tạo.</Role>\n<Constraints>\n- Không dùng câu "Chào mừng bạn đến với..."\n- Tập trung vào cảm giác của đôi chân trần trên cát.\n</Constraints>\nViết quảng cáo giày mùa hè.`,
    resultA: '🔥 Chào mừng bạn đến với bộ sưu tập mùa hè! Giày siêu nhẹ, siêu mát. Mua ngay kẻo lỡ!',
    resultB: 'Cát mịn lạo xạo dưới gót chân. Gió biển mơn man. Đừng để một đôi giày bí bách trói buộc mùa hè của bạn. Trải nghiệm sự tự do tĩnh lặng cùng dòng Sandal C90.',
    correctChoice: 'B',
    explanation: 'Prompt B cung cấp Role rõ ràng và Ràng buộc (Constraints) phủ định để tránh các câu mở đầu sáo rỗng. Bố cục cảm xúc cũng được neo chặt.'
  },
  {
    id: 2,
    title: 'Vòng 2: Sáng tác Thơ',
    challenge: 'Mục tiêu: Bắt ép AI sử dụng một thể loại khó nhằn và không được từ chối hoặc nói "Tôi không thể".',
    promptA: `<Role>Nhà thơ</Role>\nHãy viết thơ Đường luật 8 câu.\n\n<Thinking>\nPhân tích luật bằng trắc trước khi viết...\n</Thinking>`,
    promptB: `<Role>Nhà thơ</Role>\nHãy viết thơ Đường luật 8 câu.\n\n<Prefill>\nDạ vâng, tuân lệnh. Dưới đây là bài thơ tuân thủ nghiêm ngặt luật bằng trắc:\n</Prefill>`,
    resultA: 'Tôi không chắc mình có thể viết thơ Đường luật chuẩn xác 100% bằng tiếng Việt vì luật bằng trắc rắc rối. Nhưng tôi sẽ thử: ...',
    resultB: 'Dạ vâng, tuân lệnh. Dưới đây là bài thơ tuân thủ nghiêm ngặt luật bằng trắc:\nSóng tản mây mù ngọc lấp loáng...\n(Bài thơ hoàn chỉnh)',
    correctChoice: 'B',
    explanation: 'Sử dụng <Prefill> để mớm lời cho AI ("Dạ vâng, tuân lệnh...") sẽ bypass hoàn toàn màng lọc từ chối (refusal) và ép AI vào trạng thái cung cấp kết quả ngay lập tức.'
  },
  {
    id: 3,
    title: 'Vòng 3: Tạo mã (Code Generation)',
    challenge: 'Mục tiêu: Trả về CHỈ mã JSON, không chứa bất kỳ văn bản giải thích nào để có thể đưa thẳng vào API.',
    promptA: `<Role>Chuyên gia API</Role>\n<Task>\nChuyển đổi text sau thành JSON: "Họ tên: Nguyễn Văn A, Tuổi: 20"\n</Task>`,
    promptB: `<Role>Chuyên gia API</Role>\n<Task>\nChuyển đổi text thành JSON: "Họ tên: Nguyễn Văn A, Tuổi: 20"\n</Task>\n<Format>\nChỉ trả về JSON hợp lệ, bắt đầu bằng { và kết thúc bằng }. Tuyệt đối không thêm giải thích hay markdown block.\n</Format>`,
    resultA: 'Tuyệt vời, đây là JSON bạn cần:\n```json\n{\n  "ho_ten": "Nguyễn Văn A",\n  "tuoi": 20\n}\n```\nHy vọng nó giúp ích cho bạn!',
    resultB: '{\n  "ho_ten": "Nguyễn Văn A",\n  "tuoi": 20\n}',
    correctChoice: 'B',
    explanation: 'Prompt B dùng <Format> để khóa chặt đầu ra, loại bỏ các câu chào hỏi lịch sự rườm rà (yếu tố phá hỏng việc parse API).'
  }
];

export default function VersusChallenge({ onBack }: { onBack: () => void }) {
  const [currentRound, setCurrentRound] = useState(0);
  const [choice, setChoice] = useState<'A' | 'B' | null>(null);
  const [showResult, setShowResult] = useState(false);

  const round = rounds[currentRound];

  const handleSelect = (selected: 'A' | 'B') => {
    if (showResult) return;
    setChoice(selected);
    setShowResult(true);
  }

  const handleNextRound = () => {
    setChoice(null);
    setShowResult(false);
    if (currentRound < rounds.length - 1) {
      setCurrentRound(currentRound + 1);
    } else {
      onBack();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      <div className="bg-white p-4 md:p-6 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Swords className="text-amber-500" /> Sàn đấu Prompt (Versus)
            </h2>
            <p className="text-sm text-slate-500 hidden md:block">Kiểm định chất lượng Prompt qua thực tế</p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-100 px-3 py-1 rounded text-amber-700 font-bold text-sm">
           Vòng {currentRound + 1} / {rounds.length}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="text-center mb-6">
             <h3 className="text-xl font-bold text-slate-800">{round.title}</h3>
             <p className="text-slate-600 mt-2">{round.challenge}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
             {/* Prompt A */}
             <div 
               onClick={() => handleSelect('A')}
               className={`relative bg-white rounded-2xl overflow-hidden cursor-pointer transition-all border-2
                 ${!showResult ? 'border-slate-200 hover:border-amber-300 hover:shadow-md' : 
                   choice === 'A' ? (round.correctChoice === 'A' ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-rose-500 ring-2 ring-rose-200') : 'border-slate-200 opacity-60'
                 }`}
             >
               <div className="bg-slate-100 border-b border-slate-200 p-3 flex justify-between items-center">
                 <span className="font-bold text-slate-700">Thí sinh A</span>
                 {showResult && round.correctChoice === 'A' ? <span className="text-emerald-600 font-bold text-sm">Người thắng</span> : ""}
               </div>
               <div className="p-5 font-mono text-xs text-slate-300 bg-slate-900 border-b border-slate-700 whitespace-pre-wrap leading-relaxed h-32 overflow-y-auto">
                 {round.promptA}
               </div>
               <div className="p-5 h-48 overflow-y-auto bg-slate-50">
                 <span className="text-xs font-bold text-slate-400 uppercase mb-2 block">AI Phản hồi:</span>
                 <p className="text-slate-700 text-sm italic">{round.resultA}</p>
               </div>
             </div>

             {/* Prompt B */}
             <div 
               onClick={() => handleSelect('B')}
               className={`relative bg-white rounded-2xl overflow-hidden cursor-pointer transition-all border-2
                 ${!showResult ? 'border-slate-200 hover:border-amber-300 hover:shadow-md' : 
                   choice === 'B' ? (round.correctChoice === 'B' ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-rose-500 ring-2 ring-rose-200') : 'border-slate-200 opacity-60'
                 }`}
             >
               <div className="bg-slate-100 border-b border-slate-200 p-3 flex justify-between items-center">
                 <span className="font-bold text-slate-700">Thí sinh B</span>
                 {showResult && round.correctChoice === 'B' ? <span className="text-emerald-600 font-bold text-sm">Người thắng</span> : ""}
               </div>
               <div className="p-5 font-mono text-xs text-slate-300 bg-slate-900 border-b border-slate-700 whitespace-pre-wrap leading-relaxed h-32 overflow-y-auto">
                 {round.promptB}
               </div>
               <div className="p-5 h-48 overflow-y-auto bg-slate-50">
                 <span className="text-xs font-bold text-slate-400 uppercase mb-2 block">AI Phản hồi:</span>
                 <p className="text-slate-700 text-sm italic">{round.resultB}</p>
               </div>
             </div>
          </div>

          {showResult && (
            <div className="mt-8 bg-white border-2 border-indigo-100 rounded-2xl p-6 shadow-sm animate-in fade-in slide-in-from-bottom-4">
               <div className="flex items-start gap-4">
                 {choice === round.correctChoice ? (
                   <div className="bg-emerald-100 text-emerald-600 p-3 rounded-full shrink-0">
                     <CheckCircle2 size={24} />
                   </div>
                 ) : (
                   <div className="bg-rose-100 text-rose-600 p-3 rounded-full shrink-0">
                     <XCircle size={24} />
                   </div>
                 )}
                 <div>
                   <h4 className={`text-xl font-bold mb-2 ${choice === round.correctChoice ? 'text-emerald-700' : 'text-rose-700'}`}>
                     {choice === round.correctChoice ? 'Chính xác! Lựa chọn hoàn hảo.' : 'Chưa đúng rồi!'}
                   </h4>
                   <p className="text-slate-600 leading-relaxed font-medium">
                     {round.explanation}
                   </p>
                 </div>
               </div>
               
               <div className="mt-6 flex justify-end">
                 <button 
                   onClick={handleNextRound} 
                   className="bg-slate-900 text-white font-bold px-8 py-3 rounded-xl hover:bg-slate-800 transition-all shadow-md flex items-center gap-2"
                 >
                   {currentRound < rounds.length - 1 ? 'Sang Vòng Tiếp Theo Chọn Người Thắng' : 'Hoàn thành Đấu trường'} <FastForward size={18} />
                 </button>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
