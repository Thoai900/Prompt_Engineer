import React, { useState } from 'react';
import { ChevronRight, ExternalLink, ArrowLeft } from 'lucide-react';

export default function Stage1({ onNext, onBack }: { onNext: () => void, onBack?: () => void }) {
  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <div className="p-4 md:p-6 border-b border-slate-200 bg-white flex items-center gap-4 shrink-0">
         {onBack && (
           <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
             <ArrowLeft size={20} />
           </button>
         )}
         <div>
           <h2 className="text-xl font-bold text-slate-800">Bậc 1: Cấu trúc Tĩnh (Giải phẫu Prompt)</h2>
           <p className="text-sm text-slate-500 mt-1">
             Di chuột (hoặc chạm) vào các thẻ XML bên dưới để xem vai trò của chúng.
           </p>
         </div>
      </div>

      <div className="p-6 flex-1 overflow-y-auto bg-slate-50">
         <div className="w-full max-w-3xl mx-auto space-y-4 font-mono text-sm bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <InteractiveTag 
               tagName="Role" 
               content="Bạn là chuyên gia thiết kế phần mềm với 15 năm kinh nghiệm." 
               explanation="Định nghĩa nhân dạng, chuyên môn và tư duy của AI. Giúp định hình cách AI tiếp cận vấn đề."
            />
            <InteractiveTag 
               tagName="Context" 
               content="Người dùng cần xây dựng hệ thống quản lý kho dựa trên React." 
               explanation="Cung cấp bối cảnh, thông tin nền tảng, giúp AI hiểu được mục tiêu tổng thể."
            />
            <InteractiveTag 
               tagName="Task" 
               content="Vẽ sơ đồ kiến trúc và liệt kê các tính năng chính." 
               explanation="Nhiệm vụ cụ thể mà AI cần thực hiện. Càng rõ ràng càng tốt."
            />
            <InteractiveTag 
               tagName="Constraints" 
               content="- Không viết code.\n- Dùng Markdown table." 
               explanation="Thiết lập các ranh giới để ngăn AI ảo giác hoặc trả lời rườm rà. 'AI không được làm gì'."
            />
            <InteractiveTag 
               tagName="Thinking" 
               content="- Nhận diện yêu cầu: Quản lý kho, dùng React.\n- Cần cung cấp: sơ đồ kiến trúc, tính năng chính.\n- Ràng buộc: không code, dùng markdown." 
               explanation="Nơi AI thực hiện vòng lặp suy luận (Chain of Thought) và tự sửa lỗi trước khi đưa ra câu trả lời chính thức."
            />
         </div>
      </div>

      <div className="p-4 border-t border-slate-200 bg-white flex justify-end shrink-0">
         <button onClick={onNext} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 rounded-lg flex items-center gap-2 transition-all shadow-md">
            Đã hiểu, Tiếp tục <ChevronRight size={18} />
         </button>
      </div>
    </div>
  )
}

function InteractiveTag({ tagName, content, explanation }: { tagName: string, content: string, explanation: string }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="relative group border border-slate-200 rounded-lg p-4 transition-all hover:border-indigo-400 hover:bg-indigo-50/50 hover:shadow-sm cursor-help bg-slate-50/50"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
       <div className="text-indigo-600 font-bold mb-1 tracking-wider">&lt;{tagName}&gt;</div>
       <div className="pl-4 py-2 whitespace-pre-line text-slate-700 border-l-2 border-indigo-200">{content}</div>
       <div className="text-indigo-600 font-bold mt-1 tracking-wider">&lt;/{tagName}&gt;</div>

       <div className={`absolute left-full top-1/2 -translate-y-1/2 ml-4 w-72 bg-slate-900 border border-slate-700 text-white p-4 rounded-xl shadow-xl z-20 transition-all duration-200 ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'}`}>
          <div className="absolute left-[-6px] top-1/2 -translate-y-1/2 w-4 h-4 bg-slate-900 border-b border-l border-slate-700 transform rotate-45"></div>
          <div className="font-bold text-indigo-300 text-xs uppercase mb-2 tracking-wider">Mục đích thẻ <span className="lowercase">&lt;{tagName}&gt;</span></div>
          <div className="text-sm font-sans text-slate-200 leading-relaxed">{explanation}</div>
       </div>
    </div>
  )
}
