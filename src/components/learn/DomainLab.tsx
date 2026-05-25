import React, { useState } from 'react';
import { ArrowLeft, Beaker, Play, Atom, Lightbulb, Briefcase, Gamepad2, Settings } from 'lucide-react';

type DomainId = 'academic' | 'creative' | 'professional' | 'entertainment';

interface DomainLabProps {
  domainId: DomainId;
  onBack: () => void;
}

const labData = {
  academic: {
    title: 'Lab Học thuật: Trợ giảng Vật lý',
    icon: Atom,
    color: 'blue',
    description: 'Thiết kế một Prompt để AI đóng vai trò như một trợ giảng, không đưa ra đáp án trực tiếp mà phải hướng dẫn từng bước.',
    inputs: [
      { id: 'role', label: 'Vai trò (Role)', type: 'select', options: ['Chuyên gia giải bài hộ', 'Trợ giảng Socrate (hỏi gợi mở)'] },
      { id: 'subject', label: 'Chủ đề', type: 'text', defaultValue: 'Định luật Newton' },
      { id: 'student_query', label: 'Câu hỏi của học sinh', type: 'textarea', defaultValue: 'Tại sao quả táo rơi xuống đất?' }
    ],
    simulateResult: (inputs: Record<string, string>) => {
      if (inputs.role === 'Chuyên gia giải bài hộ') {
        return "Quả táo rơi xuống đất do lực hấp dẫn của Trái Đất kéo nó xuống. Công thức là F = G * (m1*m2)/r^2.";
      }
      return "<Thinking>Học sinh muốn biết nguyên nhân táo rơi. Cần hướng dẫn khái niệm lực hấp dẫn.</Thinking>\n\nChào em, một câu hỏi rất hay! Trước khi tìm câu trả lời, em hãy thử nghĩ xem: Liệu có một lực vô hình nào đó kéo nó xuống không? Và lực đó đến từ đâu?";
    }
  },
  creative: {
    title: 'Lab Sáng tạo: Đồng sáng tác Tiểu thuyết',
    icon: Lightbulb,
    color: 'amber',
    description: 'Sử dụng kỹ thuật <Prefill> và <Tone> để điều hướng AI viết tiếp câu chuyện theo đúng văn phong đen tối.',
    inputs: [
      { id: 'tone', label: 'Giọng văn (Tone)', type: 'select', options: ['Tích cực, tươi sáng', 'Gothic, ám ảnh, đen tối'] },
      { id: 'prefill', label: 'Mớm lời (Prefill)', type: 'text', defaultValue: 'Hắn mở cánh cửa, ' }
    ],
    simulateResult: (inputs: Record<string, string>) => {
      if (inputs.tone === 'Tích cực, tươi sáng') {
        return inputs.prefill + "điều đầu tiên đập vào mắt là những tia nắng mai ấm áp nhảy múa qua khung cửa sổ. Một luồng gió mát mang theo mùi bánh mì nướng thơm lừng.";
      }
      return inputs.prefill + "một làn gió lạnh buốt sống lưng ập tới. Tiếng cọt kẹt của bản lề nghe như tiếng khóc than từ nhiều thế kỷ trước. Không có ánh sáng, chỉ có thứ bóng tối đặc quánh chờ đợi hắn.";
    }
  },
  professional: {
    title: 'Lab Chuyên môn: Tự động hóa Phân tích',
    icon: Briefcase,
    color: 'emerald',
    description: 'Viết Prompt để AI trích xuất dữ liệu từ một văn bản lộn xộn thành JSON có cấu trúc.',
    inputs: [
      { id: 'format', label: 'Định dạng đầu ra', type: 'select', options: ['Văn bản tự do', 'Chỉ JSON (Format constraint)'] },
      { id: 'rawData', label: 'Dữ liệu thô', type: 'textarea', defaultValue: 'Hôm qua anh Bình bán được 5 ly cafe sữa. Sáng nay chị Yến mua 2 ly đen đá. Bình thu tiền tổng cộng 250k.' }
    ],
    simulateResult: (inputs: Record<string, string>) => {
      if (inputs.format === 'Văn bản tự do') {
        return "Dựa trên dữ liệu bạn cung cấp, anh Bình bán 5 ly cafe sữa và thu được 250k. Chị Yến bán được 2 ly đen đá. Chúc bạn kinh doanh hồng phát!";
      }
      return '{\n  "transactions": [\n    {"staff": "anh Bình", "item": "cafe sữa", "quantity": 5, "total": 250000},\n    {"staff": "chị Yến", "item": "đen đá", "quantity": 2, "total": null}\n  ]\n}';
    }
  },
  entertainment: {
    title: 'Lab Giải trí: Quản trò Game Nhập vai',
    icon: Gamepad2,
    color: 'purple',
    description: 'Bắt AI đóng vai Dungeon Master. Nếu không có <Constraints> tốt, AI sẽ cho bạn thắng quá dễ dàng.',
    inputs: [
      { id: 'constraints', label: 'Ràng buộc luật chơi', type: 'select', options: ['Để người chơi luôn thắng', 'Sát thương thực tế, phải thử thách người chơi'] },
      { id: 'action', label: 'Hành động của bạn', type: 'text', defaultValue: 'Tôi nhảy từ vách đá cao 100 mét xuống con rồng và vung kiếm.' }
    ],
    simulateResult: (inputs: Record<string, string>) => {
      if (inputs.constraints === 'Để người chơi luôn thắng') {
        return "Bạn lao mình xuống như một vị thần! Lưỡi kiếm của bạn chém đứt đôi con rồng ngay lập tức. Mọi người tung hô bạn là anh hùng vĩ đại!";
      }
      return "<Thinking>Nhảy từ 100m là quá cao, cần yêu cầu đổ xí ngầu (roll dice) cho Dexterity. Xác suất thành công rất thấp.</Thinking>\n\nMột hành động vô cùng liều lĩnh! Tuy nhiên, khoảng cách 100 mét là cực cao. Hãy tung xúc xắc (D20) cho chỉ số Nhanh nhẹn (Dexterity). Bạn cần đổ trên 18 để không bị gãy chân khi tiếp đất. Roll đi nào!";
    }
  }
};

export default function DomainLab({ domainId, onBack }: DomainLabProps) {
  const lab = labData[domainId];
  const Icon = lab.icon;
  
  const [formValues, setFormValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    lab.inputs.forEach(input => {
      initial[input.id] = input.options ? input.options[0] : (input.defaultValue || '');
    });
    return initial;
  });

  const [result, setResult] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRun = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setResult(lab.simulateResult(formValues));
      setIsProcessing(false);
    }, 800);
  };

  const handleInputChange = (id: string, value: string) => {
    setFormValues(prev => ({ ...prev, [id]: value }));
  };

  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
  };

  const themeClass = colors[lab.color as keyof typeof colors];

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      <div className="bg-white p-4 md:p-6 border-b border-slate-200 flex items-center gap-4 shrink-0">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span className={`p-1.5 rounded-lg ${themeClass}`}><Icon size={24} /></span> 
            {lab.title}
          </h2>
          <p className="text-sm text-slate-500 hidden md:block">{lab.description}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
          
          {/* Bảng điều khiển (Control Panel) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-6">
               <Settings size={18} className="text-slate-400" /> Cấu hình Prompt
            </h3>
            
            <div className="space-y-6 flex-1">
              {lab.inputs.map(input => (
                <div key={input.id}>
                  <label className="block text-sm font-bold text-slate-700 mb-2">{input.label}</label>
                  {input.type === 'select' ? (
                    <select 
                      value={formValues[input.id]} 
                      onChange={(e) => handleInputChange(input.id, e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                    >
                      {input.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : input.type === 'textarea' ? (
                    <textarea 
                      value={formValues[input.id]} 
                      onChange={(e) => handleInputChange(input.id, e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all h-24 resize-none"
                    />
                  ) : (
                    <input 
                      type="text"
                      value={formValues[input.id]} 
                      onChange={(e) => handleInputChange(input.id, e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  )}
                </div>
              ))}
            </div>

            <button 
              onClick={handleRun}
              disabled={isProcessing}
              className="mt-8 w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all"
            >
              {isProcessing ? 'Đang chạy mô phỏng...' : <><Play size={18} /> Chạy thử Model</>}
            </button>
          </div>

          {/* Màn hình kết quả */}
          <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col relative overflow-hidden">
            <h3 className="font-bold text-slate-100 flex items-center gap-2 mb-6 opacity-80">
               <Beaker size={18} /> Đầu ra AI
            </h3>
            
            <div className="flex-1 bg-slate-950/50 rounded-xl border border-slate-800 p-5 font-mono text-sm overflow-y-auto w-full">
              {!result && !isProcessing && (
                <div className="h-full flex items-center justify-center text-slate-600">
                   Nhấn "Chạy thử Model" để xem AI phản hồi như thế nào dựa trên cấu hình của bạn.
                </div>
              )}
              {isProcessing && (
                <div className="flex items-center text-indigo-400 gap-2">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-ping"></span> Đang sinh văn bản...
                </div>
              )}
              {result && !isProcessing && (
                <div className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {result}
                </div>
              )}
            </div>
            
            {result && !isProcessing && (
              <div className="mt-4 text-xs text-slate-500 italic p-3 bg-slate-800/50 rounded-lg border border-slate-800">
                Lưu ý cách AI thay đổi giọng điệu hay định dạng dựa trên những Ràng buộc và Vai trò mà bạn đã thay đổi ở bảng điều khiển bên trái.
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
