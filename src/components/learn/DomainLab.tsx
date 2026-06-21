import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Atom, Lightbulb, Briefcase, Gamepad2, Settings, Send, 
  Trash2, Award, CheckCircle2, AlertTriangle, Sparkles, RefreshCw, 
  ChevronDown, ChevronUp, Star, Play, Terminal, MessageSquare, ShieldAlert
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { runPlaygroundChatStream, evaluateSandboxPrompt, SandboxEvaluationResult } from '../../services/aiService';

type DomainId = 'academic' | 'creative' | 'professional' | 'entertainment';

interface DomainLabProps {
  domainId: DomainId;
  onBack: () => void;
  onEarnXP?: (xp: number, badgeId?: string) => void;
}

interface PromptPreset {
  id: string;
  name: string;
  description: string;
  isGood: boolean;
  systemPrompt: string;
}

const labConfigs = {
  academic: {
    title: 'Lab Học thuật: Trợ giảng Socratic',
    icon: Atom,
    color: 'blue',
    description: 'Thiết kế một Prompt để AI đóng vai trò như một trợ giảng Vật lý Socratic, tuyệt đối không giải hộ mà phải hướng dẫn từng bước bằng câu hỏi gợi mở, kèm công thức LaTeX.',
    badgeId: 'badge-socratic-scholar',
    badgeName: 'Nhà Hiền Triết Socratic',
    defaultStudentMessage: 'Giải giúp em bài tập tính lực hấp dẫn giữa Trái Đất và Mặt Trăng với ạ. Em không biết dùng công thức nào cả.',
    presets: [
      {
        id: 'acad-good',
        name: '🤖 Trợ giảng Socratic (Chuẩn Đạt)',
        description: 'Định hướng tư duy, không giải hộ, dùng LaTeX toán học và động viên học sinh nhiệt tình.',
        isGood: true,
        systemPrompt: `Bạn là một AI Gia sư Vật lý tên là Mentor AI dành cho học sinh cấp 3.
Hãy tuân thủ nghiêm ngặt các quy tắc sau:
1. KHÔNG được giải bài tập hộ hay cung cấp trực tiếp đáp án cho học sinh. Luôn sử dụng phương pháp Socratic để đặt câu hỏi gợi mở, dẫn dắt học sinh tự suy nghĩ và tìm ra lời giải.
2. Định dạng các công thức vật lý bằng LaTeX và bọc chúng trong ký hiệu $ hoặc $$. Ví dụ: $F = G \\cdot \\frac{m_1 \\cdot m_2}{r^2}$.
3. Sử dụng giọng điệu ấm áp, kiên nhẫn, gần gũi và liên tục động viên học sinh. Thỉnh thoảng sử dụng emoji phù hợp.
4. Trước khi đưa ra phản hồi chính, hãy ghi lại suy nghĩ định hướng học tập của bạn nằm trong cặp thẻ <Thinking>...</Thinking>.`
      },
      {
        id: 'acad-lazy',
        name: '❌ Chuyên gia giải hộ (Tệ)',
        description: 'Đưa thẳng công thức thô sơ và lời giải trực tiếp, vi phạm quy tắc gợi mở.',
        isGood: false,
        systemPrompt: `Bạn là một chuyên gia giải bài tập Vật lý nhanh. Nhiệm vụ của bạn là giải hộ bài tập và đưa ra đáp án trực tiếp cho học sinh ngay khi được yêu cầu để học sinh chép bài. Trình bày công thức thô sơ dạng F = G * m1 * m2 / r^2. Không cần hỏi han hay gợi ý dông dài.`
      },
      {
        id: 'acad-angry',
        name: '⚠️ Gia sư cộc cằn (Không kiên nhẫn)',
        description: 'Không động viên học sinh, mắng mỏ và đưa đáp án qua loa.',
        isGood: false,
        systemPrompt: `Bạn là một gia sư Vật lý cộc cằn và khó tính. Nếu học sinh hỏi câu hỏi đơn giản, hãy mắng học sinh lười suy nghĩ, sau đó viết ngay đáp án trực tiếp để giải quyết cho nhanh. Tuyệt đối không dùng emoji và không hỏi gợi mở gì cả.`
      }
    ]
  },
  creative: {
    title: 'Lab Sáng tạo: Đồng sáng tác Gothic Novel',
    icon: Lightbulb,
    color: 'amber',
    description: 'Thiết kế System Prompt để AI làm bạn đồng hành viết tiếp câu chuyện theo văn phong đen tối, cổ điển (Gothic) và bám sát câu mớm lời (Prefill).',
    badgeId: 'badge-gothic-writer',
    badgeName: 'Bậc Thầy Gothic',
    defaultStudentMessage: 'Hắn mở cánh cửa, ',
    presets: [
      {
        id: 'creat-good',
        name: '🎨 Nhà văn Gothic (Chuẩn Đạt)',
        description: 'Văn phong Gothic cổ điển, u ám, tiếp nối mượt mà từ câu mớm của người viết.',
        isGood: true,
        systemPrompt: `Bạn là một tiểu thuyết gia kinh dị Gothic chuyên viết truyện kinh dị cổ điển.
Quy tắc viết:
1. Luôn viết tiếp câu chuyện từ câu mớm lời (prefill) mà người dùng cung cấp một cách liền mạch.
2. Giọng văn phải mang màu sắc u tối, ám ảnh, miêu tả chi tiết âm thanh cọt kẹt, bóng tối đặc quánh, gió lạnh buốt sống lưng.
3. Không tự giải thích hay bình luận kiểu "Dưới đây là phần tiếp theo". Chỉ xuất ra trực tiếp nội dung truyện viết tiếp.
4. Trình bày giàu hình ảnh ẩn dụ cổ kính.`
      },
      {
        id: 'creat-happy',
        name: '❌ Nhà văn truyện cổ tích (Tệ)',
        description: 'Chuyển hướng câu chuyện sang tông màu tươi sáng, phá vỡ bối cảnh Gothic.',
        isGood: false,
        systemPrompt: `Bạn là một nhà viết truyện trẻ em vui vẻ. Dù người dùng viết gì, hãy tiếp tục câu chuyện bằng một giọng điệu tươi vui, ngập tràn ánh nắng ấm áp, hoa cỏ nhảy múa và phép màu hạnh phúc để mang lại tiếng cười.`
      }
    ]
  },
  professional: {
    title: 'Lab Chuyên môn: Trích xuất JSON',
    icon: Briefcase,
    color: 'emerald',
    description: 'Thiết kế Prompt để AI tự động trích xuất giao dịch từ văn bản thô lộn xộn thành cấu trúc JSON chuẩn mực, không kèm lời giải thích.',
    badgeId: 'badge-json-parser',
    badgeName: 'Kiến Trúc Sư Cấu Trúc',
    defaultStudentMessage: 'Hôm qua anh Bình bán được 5 ly cafe sữa thu 150k. Sáng nay chị Yến mua 2 ly đen đá trả 50k. Bình thu tiền tổng cộng 200k.',
    presets: [
      {
        id: 'prof-good',
        name: '💼 Bộ máy phân tích JSON (Chuẩn Đạt)',
        description: 'Chỉ xuất ra JSON sạch sẽ, trích xuất chuẩn xác, không giải thích thừa.',
        isGood: true,
        systemPrompt: `Bạn là một công cụ xử lý dữ liệu và trích xuất JSON.
Quy tắc:
1. Phân tích văn bản thô người dùng gửi và trích xuất danh sách giao dịch gồm: tên người thực hiện, mặt hàng, số lượng, số tiền.
2. Trả về ĐÚNG cấu trúc JSON sau: {"transactions": [{"person": "string", "item": "string", "quantity": number, "amount": number}]}.
3. KHÔNG trả về bất kỳ văn bản nào khác ngoài chuỗi JSON. KHÔNG bọc trong markdown \`\`\`json. Không chào hỏi.`
      },
      {
        id: 'prof-chatty',
        name: '❌ Trợ lý nói nhiều (Tệ)',
        description: 'Viết văn xuôi dông dài, kèm theo JSON bị lỗi định dạng hoặc giải thích không cần thiết.',
        isGood: false,
        systemPrompt: `Bạn là một trợ lý ảo thân thiện. Hãy đọc văn bản của người dùng, giải thích chi tiết các giao dịch đó bằng văn xuôi tiếng Việt, sau đó vẽ một bảng hoặc ghi vài dòng JSON mẫu để người dùng tham khảo. Đừng quên chúc họ một ngày làm việc vui vẻ ở cuối tin nhắn.`
      }
    ]
  },
  entertainment: {
    title: 'Lab Giải trí: Dungeon Master RPG',
    icon: Gamepad2,
    color: 'purple',
    description: 'Thiết kế System Prompt để AI làm Quản trò Game (Dungeon Master) đầy thử thách. AI phải yêu cầu người chơi đổ xúc xắc (D20) cho các hành động nguy hiểm.',
    badgeId: 'badge-dungeon-master',
    badgeName: 'Quản Trò Vĩ Đại',
    defaultStudentMessage: 'Tôi chạy hết tốc lực và nhảy thẳng từ vách đá cao 50 mét xuống hồ nước bên dưới để trốn lũ Orc.',
    presets: [
      {
        id: 'ent-good',
        name: '🎲 Dungeon Master Nghiêm Khắc (Chuẩn Đạt)',
        description: 'Yêu cầu người chơi kiểm tra chỉ số xúc xắc, dẫn dắt kịch tính và đưa ra hậu quả chân thực.',
        isGood: true,
        systemPrompt: `Bạn là một Dungeon Master (Quản trò) trong game nhập vai Dungeons & Dragons cổ điển.
Quy tắc quản lý game:
1. Dẫn chuyện kịch tính, sinh động, mô tả môi trường chân thực.
2. Tuyệt đối KHÔNG tự quyết định kết quả thành công cho hành động nguy hiểm của người chơi. Hãy bắt người chơi tung xúc xắc D20 (Ví dụ: "Hãy tung xúc xắc Dexterity, bạn cần trên 15 để tiếp đất an toàn").
3. Phản ứng chân thực với hậu quả (nếu nhảy từ 50m xuống nước mà đổ xúc xắc thấp, chân họ vẫn sẽ bị gãy hoặc va vào đá ngầm).
4. Luôn kết thúc lượt bằng câu hỏi gợi mở để người chơi đưa ra hành động tiếp theo.`
      },
      {
        id: 'ent-easy',
        name: '❌ Quản trò chiều chuộng (Tệ)',
        description: 'Cho người chơi làm siêu nhân thắng lập tức mà không cần thử thách hay tung xúc xắc.',
        isGood: false,
        systemPrompt: `Bạn là một quản trò cực kỳ dễ tính. Bất kể người chơi làm hành động điên rồ hay nguy hiểm nào, hãy mô tả hành động đó thành công rực rỡ ngay lập tức mà không cần thử thách gì cả. Hãy nâng tầm người chơi thành siêu anh hùng bất tử để họ luôn cảm thấy vui vẻ.`
      }
    ]
  }
};

function parseThinkingContent(text: string) {
  const thinkingRegex = /<Thinking>([\s\S]*?)<\/Thinking>/i;
  const match = text.match(thinkingRegex);
  if (match) {
    const thinking = match[1].trim();
    const content = text.replace(thinkingRegex, '').trim();
    return { thinking, content };
  }
  return { thinking: '', content: text };
}

export default function DomainLab({ domainId, onBack, onEarnXP }: DomainLabProps) {
  const config = labConfigs[domainId];
  const Icon = config.icon;

  const [systemPrompt, setSystemPrompt] = useState(config.presets[0].systemPrompt);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant' | 'model'; content: string }[]>([
    {
      role: 'assistant',
      content: `Hệ thống mô phỏng đã khởi động thành công dựa trên System Prompt hiện tại của bạn. Hãy nhập câu hỏi thử nghiệm của người dùng ở bên dưới để kiểm tra xem AI sẽ phản hồi thế nào!`
    }
  ]);
  const [inputMessage, setInputMessage] = useState(config.defaultStudentMessage);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<SandboxEvaluationResult | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<'editor' | 'chat'>('editor');
  const [showThinkingMap, setShowThinkingMap] = useState<Record<number, boolean>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset lại prompt và chat khi đổi domain
    setSystemPrompt(config.presets[0].systemPrompt);
    setMessages([
      {
        role: 'assistant',
        content: `Hệ thống mô phỏng đã khởi động thành công dựa trên System Prompt hiện tại của bạn. Hãy nhập câu hỏi thử nghiệm của người dùng ở bên dưới để kiểm tra xem AI sẽ phản hồi thế nào!`
      }
    ]);
    setInputMessage(config.defaultStudentMessage);
    setEvaluation(null);
  }, [domainId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const selectPreset = (preset: PromptPreset) => {
    setSystemPrompt(preset.systemPrompt);
    setEvaluation(null);
    // Reset chat
    setMessages([
      {
        role: 'assistant',
        content: `Đã nạp bộ cấu hình "${preset.name}". Lịch sử chat cũ đã được xóa. Hãy gửi tin nhắn để thử nghiệm!`
      }
    ]);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isStreaming) return;

    const userText = inputMessage;
    setInputMessage('');

    // Thêm tin nhắn user vào lịch sử chat
    const updatedMessages = [...messages, { role: 'user' as const, content: userText }];
    setMessages(updatedMessages);
    setIsStreaming(true);

    // Thêm tin nhắn trống của AI để chuẩn bị stream
    setMessages(prev => [...prev, { role: 'model' as const, content: '' }]);

    try {
      // Chuẩn bị payload chat loại bỏ tin nhắn đầu tiên (tin nhắn hệ thống)
      const chatPayload = updatedMessages
        .filter((_, idx) => idx > 0)
        .map(m => ({
          role: m.role === 'assistant' ? 'model' as const : m.role,
          content: m.content
        }));

      let accumulatedText = "";

      await runPlaygroundChatStream(
        'gemini',
        systemPrompt,
        chatPayload,
        { model: 'gemini-2.5-flash', temperature: 0.7 },
        (chunk) => {
          accumulatedText += chunk;
          setMessages(prev => {
            const copy = [...prev];
            if (copy.length > 0) {
              copy[copy.length - 1] = {
                role: 'model',
                content: accumulatedText
              };
            }
            return copy;
          });
        }
      );
    } catch (err) {
      console.error(err);
      setMessages(prev => {
        const copy = [...prev];
        if (copy.length > 0) {
          copy[copy.length - 1] = {
            role: 'model',
            content: '❌ Lỗi kết nối mô hình. Vui lòng kiểm tra GEMINI_API_KEY trong file `.env` hoặc thử lại.'
          };
        }
        return copy;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: `Đã dọn dẹp lịch sử trò chuyện. Hãy gõ tin nhắn thử nghiệm mới!`
      }
    ]);
    setEvaluation(null);
  };

  const handleEvaluate = async () => {
    setIsEvaluating(true);
    setEvaluation(null);

    // Lấy lịch sử chat thực tế (bỏ đi tin nhắn hệ thống chào mừng đầu tiên)
    const chatPayload = messages
      .filter((_, idx) => idx > 0)
      .map(m => ({
        role: m.role,
        content: m.content
      }));

    try {
      const res = await evaluateSandboxPrompt(domainId, systemPrompt, chatPayload);
      setEvaluation(res);

      // Nếu đạt điểm >= 80, phát thưởng XP
      if (res.score >= 80 && onEarnXP) {
        onEarnXP(res.xpEarned, config.badgeId);
      }
    } catch (err) {
      console.error(err);
      alert('Không thể thực hiện đánh giá tự động lúc này. Hãy kiểm tra kết nối API.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const toggleThinking = (idx: number) => {
    setShowThinkingMap(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const colors = {
    blue: {
      lightBg: 'bg-blue-50/50 dark:bg-blue-950/20',
      border: 'border-blue-200 dark:border-blue-900/50',
      text: 'text-blue-600 dark:text-blue-400',
      solidBg: 'bg-blue-600 dark:bg-blue-700',
      lightBorder: 'border-blue-100 dark:border-blue-950',
      accentText: 'text-blue-700 dark:text-blue-300'
    },
    amber: {
      lightBg: 'bg-amber-50/50 dark:bg-amber-950/20',
      border: 'border-amber-200 dark:border-amber-900/50',
      text: 'text-amber-600 dark:text-amber-400',
      solidBg: 'bg-amber-600 dark:bg-amber-700',
      lightBorder: 'border-amber-100 dark:border-amber-950',
      accentText: 'text-amber-700 dark:text-amber-300'
    },
    emerald: {
      lightBg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
      border: 'border-emerald-200 dark:border-emerald-900/50',
      text: 'text-emerald-600 dark:text-emerald-400',
      solidBg: 'bg-emerald-600 dark:bg-emerald-700',
      lightBorder: 'border-emerald-100 dark:border-emerald-950',
      accentText: 'text-emerald-700 dark:text-emerald-300'
    },
    purple: {
      lightBg: 'bg-purple-50/50 dark:bg-purple-950/20',
      border: 'border-purple-200 dark:border-purple-900/50',
      text: 'text-purple-600 dark:text-purple-400',
      solidBg: 'bg-purple-600 dark:bg-purple-700',
      lightBorder: 'border-purple-100 dark:border-purple-950',
      accentText: 'text-purple-700 dark:text-purple-300'
    }
  };

  const theme = colors[config.color as keyof typeof colors];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Header bar */}
      <header className="flex items-center justify-between border-b border-slate-200/50 bg-white/80 p-4 backdrop-blur-md dark:border-slate-800/50 dark:bg-slate-900/80 shrink-0">
        <div className="flex items-center gap-3.5">
          <button 
            onClick={onBack} 
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 cursor-pointer"
            title="Quay lại Học Viện"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-850 dark:text-white md:text-lg">
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${theme.lightBg} ${theme.text}`}><Icon size={18} /></span> 
              {config.title}
            </h2>
            <p className="hidden text-xs text-slate-450 dark:text-slate-550 md:block">{config.description}</p>
          </div>
        </div>
      </header>

      {/* Selector tab trên mobile */}
      <div className="flex border-b border-slate-200/50 bg-slate-100/50 dark:border-slate-800/50 dark:bg-slate-900/50 md:hidden shrink-0">
        <button
          onClick={() => setActiveMobileTab('editor')}
          className={`flex-1 py-3 text-center text-xs font-bold transition-all ${
            activeMobileTab === 'editor'
              ? `border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400`
              : 'text-slate-500'
          }`}
        >
          <span className="inline-flex items-center gap-1.5"><Settings size={14} /> Thiết kế Prompt</span>
        </button>
        <button
          onClick={() => setActiveMobileTab('chat')}
          className={`flex-1 py-3 text-center text-xs font-bold transition-all ${
            activeMobileTab === 'chat'
              ? `border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400`
              : 'text-slate-500'
          }`}
        >
          <span className="inline-flex items-center gap-1.5"><MessageSquare size={14} /> Chat & Đánh giá</span>
        </button>
      </div>

      {/* Main Workspace split screen */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Side: System Prompt Editor & Presets */}
        <section className={`h-full w-full flex-col border-r border-slate-200/50 bg-white dark:border-slate-850/50 dark:bg-slate-950 md:flex md:w-[45%] lg:w-[40%] ${activeMobileTab === 'editor' ? 'flex' : 'hidden'}`}>
          <div className="flex flex-1 flex-col overflow-y-auto p-4 space-y-5">
            {/* Presets Card */}
            <div className="rounded-2xl border border-slate-250/60 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Sparkles size={14} className="text-amber-500" /> Chọn Cấu hình Prompt Mẫu
              </h3>
              <div className="flex flex-col gap-2">
                {config.presets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => selectPreset(preset)}
                    className="flex w-full cursor-pointer flex-col rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xs transition-all hover:border-indigo-400 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-indigo-500"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{preset.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        preset.isGood 
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-450' 
                          : 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-450'
                      }`}>
                        {preset.isGood ? 'Chuẩn' : 'Bị lỗi'}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-normal">{preset.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Editor Input Area */}
            <div className="flex flex-1 flex-col space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Terminal size={14} className="text-indigo-500" /> Hệ thống Chỉ thị (System Prompt)
                </label>
                <span className="text-[10px] text-slate-400">Tự soạn thảo để tùy chỉnh</span>
              </div>
              <textarea
                value={systemPrompt}
                onChange={(e) => { setSystemPrompt(e.target.value); setEvaluation(null); }}
                className="flex-1 w-full min-h-[300px] md:min-h-0 rounded-2xl border border-slate-250 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:focus:ring-indigo-950/30"
                placeholder="Nhập System Instructions chỉ đạo hoạt động của mô hình..."
              />
            </div>

            {/* Mentor suggestion tip */}
            <div className="flex gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 text-xs dark:border-indigo-950/50 dark:bg-indigo-950/20">
              <span className="text-base shrink-0">💡</span>
              <p className="text-indigo-700 dark:text-indigo-300 leading-relaxed font-medium">
                {domainId === 'academic' && "Để đạt điểm cao, hãy hướng dẫn AI đóng vai cụ thể, nghiêm cấm giải hộ bài tập, yêu cầu đặt câu hỏi gợi ý và định dạng công thức Toán học bằng LaTeX $...$."}
                {domainId === 'creative' && "Gợi ý: Chỉ đạo AI giữ đúng phong cách viết Gothic cổ điển, sử dụng các hình ảnh bóng đêm, gió lạnh để tạo không khí ám ảnh."}
                {domainId === 'professional' && "Gợi ý: Cấm tuyệt đối AI trả về văn bản mô tả. Chỉ xuất ra cấu trúc JSON nguyên bản hợp lệ để khớp mã lập trình."}
                {domainId === 'entertainment' && "Gợi ý: Yêu cầu AI luôn bắt người chơi roll dice khi làm hành động nguy hiểm. Đừng quên đưa ra các kết cục nghiêm khắc."}
              </p>
            </div>
          </div>
        </section>

        {/* Right Side: Chat sandbox & AI Evaluator */}
        <section className={`h-full w-full flex-1 flex-col bg-slate-100/30 dark:bg-slate-950/20 md:flex ${activeMobileTab === 'chat' ? 'flex' : 'hidden'}`}>
          {/* Chat area */}
          <div className="flex flex-[2] flex-col overflow-hidden min-h-[40%] bg-white dark:bg-slate-950 border-b border-slate-200/50 dark:border-slate-850/50">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-850">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <MessageSquare size={14} className={theme.text} /> Môi trường hội thoại thử nghiệm
              </span>
              <button 
                onClick={handleClearChat}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-450 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-500 dark:hover:bg-slate-900 dark:hover:text-slate-350 cursor-pointer"
                title="Xóa cuộc hội thoại"
              >
                <Trash2 size={13} /> Reset Chat
              </button>
            </div>

            {/* Chat Messages Log */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                const { thinking, content } = isUser ? { thinking: '', content: msg.content } : parseThinkingContent(msg.content);
                const showThinking = showThinkingMap[idx] ?? true;

                return (
                  <div key={idx} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                    {/* Render Thinking Block if present */}
                    {!isUser && thinking && (
                      <div className="mb-2 max-w-[85%] rounded-xl border border-slate-200 bg-slate-50/70 p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900/50">
                        <button 
                          onClick={() => toggleThinking(idx)}
                          className="flex w-full items-center justify-between text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-300"
                        >
                          <span className="flex items-center gap-1.5">🧠 Luồng tư duy ngầm (Thinking)</span>
                          {showThinking ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        {showThinking && (
                          <div className="mt-2 border-t border-slate-200/50 pt-2 font-mono text-[10.5px] leading-relaxed text-slate-600 dark:border-slate-850 dark:text-slate-400 whitespace-pre-wrap">
                            {thinking}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Chat Bubble */}
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-xs leading-relaxed ${
                      isUser
                        ? `${theme.solidBg} text-white font-medium`
                        : 'bg-slate-100 text-slate-850 dark:bg-slate-900 dark:text-slate-200 border border-slate-200/60 dark:border-slate-800'
                    }`}>
                      {isUser ? (
                        <div className="whitespace-pre-wrap">{content}</div>
                      ) : content === '' && isStreaming ? (
                        <div className="flex items-center gap-1.5 py-1 text-slate-500 font-medium">
                          <span className="h-1.5 w-1.5 bg-slate-500 rounded-full animate-bounce"></span>
                          <span className="h-1.5 w-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                          <span className="h-1.5 w-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                        </div>
                      ) : (
                        <div className="prose prose-slate dark:prose-invert prose-xs max-w-none">
                          <ReactMarkdown>{content}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 border-t border-slate-150 bg-white/50 backdrop-blur-md dark:border-slate-850 dark:bg-slate-950/50 shrink-0 flex items-center gap-2">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isStreaming}
                placeholder="Nhập tin nhắn giả lập của học sinh..."
                className="flex-1 min-h-[42px] max-h-20 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/50 resize-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-350"
              />
              <button
                onClick={handleSendMessage}
                disabled={isStreaming || !inputMessage.trim()}
                className={`h-10 w-10 flex items-center justify-center rounded-xl text-white shadow-md transition-all cursor-pointer ${
                  isStreaming || !inputMessage.trim()
                    ? 'bg-slate-200 dark:bg-slate-850 text-slate-400 cursor-not-allowed shadow-none'
                    : `${theme.solidBg} hover:scale-105 active:scale-95`
                }`}
              >
                <Send size={16} />
              </button>
            </div>
          </div>

          {/* Evaluator Panel */}
          <div className="flex-1 flex flex-col min-h-[35%] overflow-hidden bg-slate-50 dark:bg-slate-950/30">
            <div className="flex items-center justify-between border-b border-slate-200/50 px-4 py-3 dark:border-slate-850 shrink-0">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Award size={14} className="text-amber-500" /> Hệ thống Kiểm Định AI Evaluator
              </span>
              
              <button
                onClick={handleEvaluate}
                disabled={isEvaluating || isStreaming || messages.length <= 1}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                  isEvaluating || isStreaming || messages.length <= 1
                    ? 'bg-slate-200 dark:bg-slate-850 text-slate-400 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-600 text-white hover:scale-105 active:scale-95'
                }`}
              >
                {isEvaluating ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" /> Đang chấm điểm...
                  </>
                ) : (
                  <>
                    <Play size={13} /> Nộp bài & Chấm điểm
                  </>
                )}
              </button>
            </div>

            {/* Evaluation Results Log */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Chưa chấm điểm */}
              {!evaluation && !isEvaluating && (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400 text-xl font-bold">🎯</div>
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-350">Chưa bắt đầu kiểm định</h4>
                  <p className="text-[11px] text-slate-500 max-w-xs leading-normal">
                    Hãy trò chuyện thử với AI ít nhất 1-2 câu để tích lũy ngữ cảnh, sau đó nhấn <strong>"Nộp bài & Chấm điểm"</strong> để AI Evaluator phân tích.
                  </p>
                </div>
              )}

              {/* Đang chấm điểm Loading */}
              {isEvaluating && (
                <div className="h-full flex flex-col items-center justify-center p-6 space-y-4">
                  <div className="relative flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full border-4 border-amber-100 border-t-amber-500 animate-spin"></div>
                    <Award size={20} className="absolute text-amber-500 animate-pulse" />
                  </div>
                  <div className="text-center space-y-1">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">AI Evaluator đang làm việc...</h4>
                    <p className="text-[10px] text-slate-500">Phân tích cấu trúc System Instructions và hành vi phản hồi trong chat...</p>
                  </div>
                </div>
              )}

              {/* Hiển thị kết quả chấm điểm */}
              {evaluation && !isEvaluating && (
                <div className="space-y-5 animate-fade-in pb-4">
                  {/* Điểm số lớn */}
                  <div className="flex flex-col sm:flex-row items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                    <div className={`w-20 h-20 rounded-full flex flex-col items-center justify-center shrink-0 border-4 shadow-sm ${
                      evaluation.score >= 80 
                        ? 'border-emerald-100 dark:border-emerald-950 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20' 
                        : evaluation.score >= 50
                          ? 'border-amber-100 dark:border-amber-950 text-amber-600 bg-amber-50/50 dark:bg-amber-950/20'
                          : 'border-rose-100 dark:border-rose-950 text-rose-600 bg-rose-50/50 dark:bg-rose-950/20'
                    }`}>
                      <span className="text-2xl font-black">{evaluation.score}</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-70">Điểm</span>
                    </div>

                    <div className="flex-1 space-y-1.5 text-center sm:text-left">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Kết quả kiểm định</h4>
                        {evaluation.score >= 80 ? (
                          <span className="bg-emerald-50 text-emerald-600 text-[10px] px-2 py-0.5 rounded-full font-bold border border-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-450 dark:border-emerald-900">Hoàn Thành Xuất Sắc</span>
                        ) : (
                          <span className="bg-rose-50 text-rose-600 text-[10px] px-2 py-0.5 rounded-full font-bold border border-rose-100 dark:bg-rose-950/50 dark:text-rose-455 dark:border-rose-900">Cần Cải Thiện</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{evaluation.generalFeedback}</p>
                      
                      {evaluation.score >= 80 && (
                        <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 px-2.5 py-1 rounded-xl w-fit">
                          <Star size={12} className="text-amber-500 fill-amber-500" />
                          <span className="text-[10.5px] font-bold text-amber-700 dark:text-amber-300">Đã mở khóa Huy hiệu "{config.badgeName}" (+{evaluation.xpEarned} XP)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4 tiêu chí chi tiết */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {evaluation.criteria.map((crit, idx) => (
                      <div key={idx} className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/50">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[11.5px] font-bold text-slate-850 dark:text-slate-300">{crit.name}</span>
                          <span className={`text-xs font-black ${
                            crit.score >= 80 ? 'text-emerald-600 dark:text-emerald-400' : crit.score >= 50 ? 'text-amber-500' : 'text-rose-500'
                          }`}>{crit.score}/100</span>
                        </div>
                        {/* Thanh progress bar */}
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              crit.score >= 80 ? 'bg-emerald-500' : crit.score >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${crit.score}%` }}
                          />
                        </div>
                        <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-normal">{crit.feedback}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
