import React, { useState } from 'react';
import { Bug, ArrowLeft, CheckCircle2, ChevronRight, AlertTriangle, Play, FastForward } from 'lucide-react';

const levels = [
  {
    id: 1,
    title: 'Lỗi "Bắn súng ngẫu nhiên"',
    description: 'Prompt quá ngắn dẫn đến AI tự "bịa" ra hàng loạt code hoặc giải pháp không có căn cứ.',
    faultyPrompt: `Bạn là chuyên gia.\nGiúp tôi code React form.`,
    options: [
      { id: 'opt1', type: 'Constraints', label: 'Thêm <Constraints> (Ràng buộc hành vi)', content: `<Constraints>\n- Không viết code ngay lập tức.\n- Yêu cầu người dùng cung cấp thêm thông tin trước.\n</Constraints>`, isCorrect: true },
      { id: 'opt2', type: 'Thinking', label: 'Thêm <Thinking> (Tư duy luồng)', content: `<Thinking>\n1. Cần xin thêm thông tin từ User vì yêu cầu quá chung chung.\n2. Không tự ý sinh code.\n</Thinking>`, isCorrect: true }
    ],
    requiredFixes: 2,
    failureMessage: 'AI vẫn sẽ sinh ra code bừa bãi. Bạn cần ngăn chặn nó ngay lập tức (Constraints) và thiết lập tư duy tĩnh rẽ (Thinking) trước.',
    successResult: 'Để giúp bạn viết React Form tốt nhất, bạn vui lòng cung cấp thêm thông tin:\n1. Form dùng để làm gì?\n2. Có bao nhiêu trường thông tin?\n3. Bạn có muốn dùng thư viện như shadcn không?'
  },
  {
    id: 2,
    title: 'Lỗi "Sai phong cách / Rớt vai"',
    description: 'AI quên mất giọng văn và trở nên quá máy móc khi giải thích chuyện thần thoại.',
    faultyPrompt: `Hãy tóm tắt sự kiện Ragnarok trong thần thoại Bắc Âu.\nBạn là người kể chuyện cổ xưa.`,
    options: [
      { id: 'opt1', type: 'Role', label: 'Gia cố <Role>', content: `<Role>\nBạn là một thi sĩ Bắc Âu mù. Mọi câu nói của bạn đều hàm chứa sự bi tráng và tiên tri.\n</Role>`, isCorrect: true },
      { id: 'opt2', type: 'Tone', label: 'Thêm <Tone>', content: `<Tone>\nBi tráng, sử thi, huyền bí, sử dụng nhiều ẩn dụ thiên nhiên.\n</Tone>`, isCorrect: true },
      { id: 'opt3', type: 'Format', label: 'Thêm <Format>', content: `<Format>\nLập danh sách gạch đầu dòng.\n</Format>`, isCorrect: false }
    ],
    requiredFixes: 2,
    failureMessage: 'Nếu bạn thêm Format thay vì Role hoặc Tone, AI sẽ trở thành một chiếc máy tính báo cáo, làm mất đi hoàn toàn chất truyền thuyết.',
    successResult: 'Hỡi những kẻ du tử tò mò... Hãy lắng nghe tiếng sấm vọng từ xa. Đó không phải bão, đó là tiếng gầm của bầy sói Sköll và Hati đang nuốt chửng Mặt Trời...'
  },
  {
    id: 3,
    title: 'Lỗi "Tự tin ảo tưởng" (Hallucination)',
    description: 'AI thực hiện phép toán phức tạp nhưng đoán mò do không có không gian suy luận và tự sửa lỗi.',
    faultyPrompt: `Bạn là trợ lý toán học.\nHỏi: Một cửa hàng bán 100 cái bánh. Sáng bán 1/4 số bánh. Trưa bán 1/3 số bánh còn lại. Chiều bán nửa số bánh còn lại sau buổi trưa. Vậy tối còn bao nhiêu cái?`,
    options: [
      { id: 'opt1', type: 'Task', label: 'Viết lại <Task>', content: `<Task>\nChỉ in ra đúng kết quả bằng số.\n</Task>`, isCorrect: false },
      { id: 'opt2', type: 'Thinking', label: 'Thêm <Thinking>', content: `<Thinking>\n- Sáng bán: 100 * 1/4 = 25. Còn 75.\n- Trưa bán: 75 * 1/3 = 25. Còn 50.\n- Chiều bán: 50 / 2 = 25. Còn 25.\n</Thinking>`, isCorrect: true },
      { id: 'opt3', type: 'Self_Correction', label: 'Thêm <Self_Correction>', content: `<Self_Correction>\nKiểm tra lại phép trừ: 100 - 25 = 75. 75 - 25 = 50. Phép toán logic hoàn toàn đúng.\n</Self_Correction>`, isCorrect: true }
    ],
    requiredFixes: 2,
    failureMessage: 'Nếu ép AI chỉ in ra đúng kết quả bằng số mà không cho phép nó Thinking, xác suất nó tính sai ở các bước trung gian là rất lớn!',
    successResult: '<Thinking>\n- Sáng bán: 100 * 1/4 = 25. Còn 75.\n- Trưa bán: 75 * 1/3 = 25. Còn 50.\n- Chiều bán: 50 / 2 = 25. Còn 25.\n</Thinking>\n\nXin chào, sau khi nhẩm tính qua các buổi, số bánh tối còn lại ở cửa hàng là 25 cái bánh nhé!'
  }
];

export default function DebuggingChallenge({ onBack }: { onBack: () => void }) {
  const [currentLevel, setCurrentLevel] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);

  const level = levels[currentLevel];

  const toggleOption = (id: string) => {
    if (showResult) return;
    if (selectedOptions.includes(id)) {
      setSelectedOptions(selectedOptions.filter(o => o !== id));
    } else {
      setSelectedOptions([...selectedOptions, id]);
    }
  };

  const handleFix = () => {
    setIsTesting(true);
    setTimeout(() => {
      setIsTesting(false);
      setShowResult(true);
      
      const correctOptionIds = level.options.filter(o => o.isCorrect).map(o => o.id);
      
      const correctSelected = selectedOptions.filter(id => correctOptionIds.includes(id)).length;
      const incorrectSelected = selectedOptions.filter(id => !correctOptionIds.includes(id)).length;
      
      if (correctSelected === level.requiredFixes && incorrectSelected === 0) {
        setTestSuccess(true);
      } else {
        setTestSuccess(false);
      }
    }, 1500);
  }

  const handleNextLevel = () => {
    setSelectedOptions([]);
    setShowResult(false);
    setTestSuccess(false);
    if (currentLevel < levels.length - 1) {
      setCurrentLevel(currentLevel + 1);
    } else {
      onBack();
    }
  };

  const handleRetry = () => {
    setSelectedOptions([]);
    setShowResult(false);
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
              <Bug className="text-rose-500" /> Thám Tử Prompt (Debugging)
            </h2>
            <p className="text-sm text-slate-500 hidden md:block">Bắt mạch và kê đơn cho Prompt bị lỗi.</p>
          </div>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 px-3 py-1 rounded text-indigo-700 font-bold text-sm">
           Level {currentLevel + 1} / {levels.length}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        {!showResult ? (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white border-2 border-rose-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-rose-50 border-b border-rose-100 p-4">
                <span className="font-bold text-rose-800 text-sm uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle size={16} /> Hiện trạng: {level.title}
                </span>
                <p className="text-xs text-rose-600 mt-1">{level.description}</p>
              </div>
              <div className="p-6 font-mono text-sm text-slate-300 bg-slate-900 border-t border-slate-700 leading-relaxed whitespace-pre-wrap">
                {level.faultyPrompt}
              </div>
            </div>

            <div className="bg-white border-2 border-indigo-200 rounded-2xl overflow-hidden shadow-sm">
               <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                 <div>
                   <h3 className="font-bold text-slate-800 mb-1">Kho Thuốc Giải (Vá Lỗi)</h3>
                   <p className="text-sm text-slate-500">Chọn {level.requiredFixes} khối cần thiết nhất để tiêm vào Prompt gốc.</p>
                 </div>
                 <div className="bg-slate-100 text-slate-600 font-bold px-3 py-1 text-sm rounded">
                   Đã chọn: {selectedOptions.length}
                 </div>
               </div>
               <div className="p-6 bg-slate-50 flex flex-col gap-4">
                 {level.options.map((opt) => (
                   <div 
                     key={opt.id} 
                     onClick={() => toggleOption(opt.id)}
                     className={`flex items-start gap-4 p-4 border rounded-xl cursor-pointer transition-all ${selectedOptions.includes(opt.id) ? 'border-indigo-400 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-sm' : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm'}`}
                   >
                     <input 
                       type="checkbox" 
                       checked={selectedOptions.includes(opt.id)}
                       readOnly
                       className="mt-1 w-5 h-5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 pointer-events-none" 
                     />
                     <div className="flex-1">
                       <label className="font-bold text-slate-700 block mb-1 text-sm cursor-pointer">{opt.label}</label>
                       <div className="text-xs bg-white border border-slate-200 p-3 rounded-lg font-mono whitespace-pre-wrap text-slate-600">
                         {opt.content}
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
               <div className="p-4 bg-white border-t border-slate-100 flex justify-end">
                 <button 
                   onClick={handleFix}
                   disabled={isTesting || selectedOptions.length === 0}
                   className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-2.5 px-8 rounded-lg flex items-center gap-2 shadow-md transition-all"
                 >
                   {isTesting ? "Đang vá lỗi..." : <><Play size={18} /> Khởi động lại AI</>}
                 </button>
               </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {testSuccess ? (
              <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4">
                 <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-500 mb-4 shadow-sm border-2 border-emerald-200">
                   <CheckCircle2 size={40} strokeWidth={3} />
                 </div>
                 <h3 className="text-3xl font-bold text-slate-800">Cứu viện thành công!</h3>
                 <p className="text-slate-500 mt-2 max-w-lg mx-auto">Bằng cách thêm đúng phương thuốc, bạn đã chặn đứng hành vi sai lệch của AI và đưa nó trở lại quỹ đạo.</p>
              </div>
            ) : (
              <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4">
                 <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-500 mb-4 shadow-sm border-2 border-rose-200">
                   <AlertTriangle size={40} strokeWidth={3} />
                 </div>
                 <h3 className="text-3xl font-bold text-slate-800">Cứu viện thất bại!</h3>
                 <p className="text-slate-500 mt-2 max-w-lg mx-auto">{level.failureMessage}</p>
                 <button onClick={handleRetry} className="mt-4 text-indigo-600 font-bold hover:underline">Thử lại nhé</button>
              </div>
            )}

            {testSuccess && (
              <div className="bg-white border-2 border-emerald-200 rounded-2xl overflow-hidden shadow-sm mb-8 animate-in fade-in slide-in-from-bottom-6">
                 <div className="bg-emerald-50 border-b border-emerald-100 p-4">
                   <span className="font-bold text-emerald-800 text-sm uppercase tracking-wider">AI phản hồi (Sau khi vá lỗi chuẩn)</span>
                 </div>
                 <div className="p-6 prose prose-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                   {level.successResult}
                 </div>
              </div>
            )}

            {testSuccess && (
              <div className="flex justify-center">
                 <button 
                   onClick={handleNextLevel} 
                   className="bg-slate-900 text-white font-bold px-8 py-3 rounded-xl hover:bg-slate-800 transition-all shadow-md flex items-center gap-2"
                 >
                   {currentLevel < levels.length - 1 ? 'Chuyển sang Cấp Độ Tiếp Theo' : 'Hoàn thành Nhiệm vụ'} <FastForward size={18} />
                 </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
