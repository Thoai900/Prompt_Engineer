import React, { useState } from 'react';
import { ChevronRight, RefreshCcw, Check, X, ArrowLeft } from 'lucide-react';

type Question = {
  content: string;
  correctTag: string;
  options: string[];
};

const questions: Question[] = [
  {
    content: "Bạn là một AI chuyên phân tích dữ liệu rủi ro tín dụng. Bạn giỏi thống kê và Python.",
    correctTag: "Role",
    options: ["Role", "Context", "Task", "Constraints"]
  },
  {
    content: "Đừng đưa ra lời khuyên cá nhân. Không sử dụng HTML, chỉ được dùng Markdown.",
    correctTag: "Constraints",
    options: ["Context", "Constraints", "Thinking", "Format"]
  },
  {
    content: "Đọc file CSV đính kèm, tóm tắt diễn biến doanh thu và lưu thành JSON.",
    correctTag: "Task",
    options: ["Input", "Task", "Tone", "Self_Correction"]
  },
  {
    content: "Input: 'Xin chào' -> Output: 'Hello'\nInput: 'Tạm biệt' -> Output: 'Goodbye'",
    correctTag: "Example",
    options: ["Process", "Example", "Context", "Format"]
  },
  {
    content: "- Bước 1: Trích xuất các thực thể.\n- Bước 2: Nhóm các thực thể lại theo danh mục.\n- Bước 3: Đếm số lượng.",
    correctTag: "Process",
    options: ["Thinking", "Constraints", "Process", "Task"]
  },
  {
    content: "Trước khi trả về kết quả, hãy tự đánh giá xem câu trả lời có vi phạm nguyên tắc thân thiện không. Nếu có, hãy viết lại.",
    correctTag: "Self_Correction",
    options: ["Thinking", "Self_Correction", "Example", "Constraints"]
  },
  {
    content: "1. Đọc yêu cầu: Khách muốn làm thơ.\n2. Phân tích: Thơ lục bát, chủ đề mùa xuân.\n3. Thử gieo vần: xuân - bâng khuâng...",
    correctTag: "Thinking",
    options: ["Thinking", "Process", "Example", "Role"]
  },
  {
    content: "Trích xuất dạng JSON thuần túy, tuyệt đối không bọc trong ký tự markdown ```json",
    correctTag: "Format",
    options: ["Format", "Constraints", "Task", "Tone"]
  }
];

export default function Stage2({ onNext, onBack }: { onNext: () => void, onBack?: () => void }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  
  const question = questions[currentIdx];

  const handleSelect = (tag: string) => {
    if (showResult) return;
    setSelectedTag(tag);
    setShowResult(true);
    if (tag === question.correctTag) {
      setScore(s => s + 1);
    }
  };

  const handleNextQuestion = () => {
    setSelectedTag(null);
    setShowResult(false);
    setCurrentIdx(i => i + 1);
  };

  const isCompleted = currentIdx >= questions.length;

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <div className="p-4 md:p-6 border-b border-slate-200 bg-white flex justify-between items-center shrink-0">
         <div className="flex items-center gap-4">
           {onBack && (
             <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
               <ArrowLeft size={20} />
             </button>
           )}
           <div>
              <h2 className="text-xl font-bold text-slate-800">Bậc 2: Trò chơi Đoán Thẻ</h2>
              <p className="text-sm text-slate-500 mt-1">Đọc nội dung mốc và chọn thẻ XML tương ứng.</p>
           </div>
         </div>
         <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold px-4 py-2 rounded-lg shadow-sm">
            Điểm: {score}/{questions.length}
         </div>
      </div>

      <div className="p-6 flex-1 overflow-y-auto bg-slate-50 flex items-center justify-center">
         {isCompleted ? (
           <div className="text-center space-y-6 bg-white p-10 rounded-3xl shadow-sm border border-slate-200 max-w-sm w-full">
              <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-500 mb-6">
                 <Check size={48} strokeWidth={3} />
              </div>
              <h3 className="text-3xl font-bold text-slate-800">Thành công!</h3>
              <p className="text-slate-600">Bạn đã nắm bắt rất tốt cách nhận diện các cấu trúc cơ bản.</p>
              <button 
                onClick={onNext} 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 mt-4"
              >
                Tới Thử Thách Kéo-Thả <ChevronRight size={20} />
              </button>
           </div>
         ) : (
           <div className="w-full max-w-2xl space-y-8">
              <div className="flex items-center justify-between text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
                <span>Câu {currentIdx + 1}/{questions.length}</span>
              </div>
              <div className="bg-white p-8 rounded-2xl border-2 border-slate-200 font-mono text-slate-800 text-lg shadow-sm">
                <span className="text-6xl text-slate-200 absolute -top-4 -left-4">"</span>
                {question.content}
                <span className="text-6xl text-slate-200 absolute -bottom-8 -right-4 line-through">"</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                {question.options.map((opt) => {
                  const isSelected = selectedTag === opt;
                  const isCorrect = opt === question.correctTag;
                  
                  let btnClass = "py-4 px-6 rounded-xl font-bold border-2 text-left transition-all relative text-lg flex items-center justify-between ";
                  if (!showResult) {
                    btnClass += "bg-white border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 shadow-sm";
                  } else {
                    if (isCorrect) {
                      btnClass += "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm";
                    } else if (isSelected && !isCorrect) {
                      btnClass += "bg-rose-50 border-rose-500 text-rose-700";
                    } else {
                      btnClass += "bg-slate-50 border-slate-200 text-slate-400 opacity-50";
                    }
                  }

                  return (
                    <button 
                      key={opt} 
                      onClick={() => handleSelect(opt)}
                      disabled={showResult}
                      className={btnClass}
                    >
                      <span className="font-mono">&lt;{opt}&gt;</span>
                      {showResult && isCorrect && <Check className="text-emerald-500" size={24} strokeWidth={3} />}
                      {showResult && isSelected && !isCorrect && <X className="text-rose-500" size={24} strokeWidth={3} />}
                    </button>
                  )
                })}
              </div>

              {showResult && (
                <div className="flex justify-center pt-8 animate-in fade-in slide-in-from-bottom-4">
                  <button onClick={handleNextQuestion} className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg flex items-center gap-2">
                    Tiếp tục <ChevronRight size={20} />
                  </button>
                </div>
              )}
           </div>
         )}
      </div>
    </div>
  )
}
