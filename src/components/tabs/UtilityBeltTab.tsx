import { toast } from '../common/Toaster';
import { confirmDialog } from '../common/ConfirmDialog';
import React, { useState, useEffect } from 'react';
import { 
  Zap, Brain, Settings, Sliders, Copy, Check, RotateCcw, 
  Sparkles, Plus, Trash2, HelpCircle, ArrowRight, BookOpen, Info,
  CheckCircle, MessageSquare, Save, Terminal, Globe, Cpu
} from 'lucide-react';
import { User } from 'firebase/auth';
import { optimizeCustomInstructions } from '../../services/aiService';
import { useWorkspace } from '../../context/WorkspaceContext';
import BackupPanel from '../common/BackupPanel';
import UsageStatsPanel from '../common/UsageStatsPanel';
import { CustomProfile } from '../../types';

interface UtilityBeltTabProps {
  user: User | null;
  onSaveTemplate?: (template: any) => Promise<void>;
}

// Preset Profiles Definitions
const PRESETS: CustomProfile[] = [
  {
    id: 'preset-developer',
    name: '💻 Lập trình viên React & TS',
    role: 'Bạn là chuyên gia lập trình React, TypeScript và phát triển web hiện đại với hơn 10 năm kinh nghiệm thực chiến.',
    context: 'Tôi đang phát triển dự án web React, sử dụng Vite làm công cụ build, Tailwind CSS v4 để thiết kế giao diện và sử dụng Google GenAI SDK để tích hợp AI.',
    constraints: '- Chỉ viết code TypeScript chất lượng cao, có xử lý lỗi (error handling) đầy đủ.\n- Bỏ qua các câu chào hoặc các câu giải thích rườm rà dài dòng.\n- Giải thích logic code ngắn gọn, súc tích bằng Tiếng Việt.',
    outputFormat: '- Trình bày code đầy đủ trong các khối code block (Markdown Code Block).\n- Đưa ra các ghi chú kỹ thuật dạng gạch đầu dòng rõ ràng bên dưới code.'
  },
  {
    id: 'preset-copywriter',
    name: '✍️ Copywriter & Content Creator',
    role: 'Bạn là một chuyên gia viết kịch bản, viết bài quảng cáo (Copywriter) sáng tạo, am hiểu tâm lý khách hàng đại chúng.',
    context: 'Dự án của tôi tập trung viết nội dung ngắn cho mạng xã hội (Facebook Reels, TikTok, Threads) và bài đăng blog SEO nhằm giới thiệu dịch vụ và tăng tỷ lệ chuyển đổi.',
    constraints: '- Không sử dụng các từ ngữ sáo rỗng thường thấy (như "đột phá", "vượt trội", "cam kết hoàn hảo").\n- Hành văn trẻ trung, lôi cuốn, ngắt câu ngắn gọn dễ đọc.\n- Sử dụng icon/emoji một cách thông minh để thu hút sự chú ý.',
    outputFormat: '- Cấu trúc bài viết theo khung sườn AIDA (Attention - Interest - Desire - Action).\n- Cuối bài viết luôn có lời kêu gọi hành động (CTA) rõ ràng, trực diện.'
  },
  {
    id: 'preset-mentor',
    name: '📐 Mentor AI (Gia sư Socratic)',
    role: 'Bạn là gia sư Mentor AI thân thiện, kiên nhẫn và giàu kinh nghiệm dạy học sinh THPT.',
    context: 'Học sinh đang hỏi bài toán học, vật lý, hóa học để chuẩn bị ôn thi tốt nghiệp trung học phổ thông quốc gia.',
    constraints: '- Tuyệt đối KHÔNG trực tiếp giải hộ bài tập cho học sinh.\n- Sử dụng phương pháp Socratic để đặt câu hỏi gợi mở, giúp học sinh tự tìm ra lời giải.\n- Hành văn khuyến khích, tích cực, đồng cảm cảm xúc.',
    outputFormat: '- Công thức toán lý hóa viết bằng ký hiệu LaTeX chuẩn chỉnh.\n- Sử dụng các ví dụ tương tự gần gũi trong đời sống để minh họa khái niệm khó.'
  },
  {
    id: 'preset-assistant',
    name: '💼 Trợ lý Văn phòng Đa năng',
    role: 'Bạn là trợ lý hành chính kiêm thư ký chuyên nghiệp, am hiểu nghiệp vụ doanh nghiệp.',
    context: 'Tôi cần xử lý các tác vụ văn phòng hàng ngày: viết email gửi đối tác, soạn thảo biên bản họp, tóm tắt báo cáo và lập kế hoạch công việc tuần.',
    constraints: '- Giọng văn trang trọng, lịch sự và cực kỳ rõ ràng.\n- Đảm bảo tính bảo mật thông tin và tính chính xác của các con số.\n- Tóm tắt gọn gàng, tránh diễn giải mơ hồ.',
    outputFormat: '- Định dạng email và biên bản theo quy chuẩn văn bản công sở.\n- Các phần tóm tắt dài phải được chuyển thành bảng so sánh (Markdown Table).'
  }
];

export default function UtilityBeltTab({ user, onSaveTemplate }: UtilityBeltTabProps) {
  const { ghostTextEnabled, setGhostTextEnabled } = useWorkspace();
  // Load profiles from localStorage or initialize with presets
  const [profiles, setProfiles] = useState<CustomProfile[]>(() => {
    try {
      const stored = localStorage.getItem('llm_custom_profiles');
      return stored ? JSON.parse(stored) : [...PRESETS];
    } catch {
      return [...PRESETS];
    }
  });

  const [activeProfileId, setActiveProfileId] = useState<string>(() => {
    return profiles.length > 0 ? profiles[0].id : 'preset-developer';
  });

  // Editor states
  const [profileName, setProfileName] = useState('');
  const [role, setRole] = useState('');
  const [context, setContext] = useState('');
  const [constraints, setConstraints] = useState('');
  const [outputFormat, setOutputFormat] = useState('');

  // UI state controllers
  const [activeRightTab, setActiveRightTab] = useState<'preview' | 'guide'>('preview');
  
  // New State for Platform Selection & specific guide
  const [selectedPlatform, setSelectedPlatform] = useState<'gemini' | 'chatgpt' | 'claude'>('gemini');
  const [activeGuideLLM, setActiveGuideLLM] = useState<'gemini_gems' | 'gemini_studio' | 'chatgpt_custom' | 'chatgpt_gpt' | 'claude_projects'>('gemini_gems');

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [history, setHistory] = useState<Omit<CustomProfile, 'id' | 'name'> | null>(null);
  const [copyStates, setCopyStates] = useState<Record<string, boolean>>({});

  // Sync editor fields with the active profile
  useEffect(() => {
    const activeProfile = profiles.find(p => p.id === activeProfileId);
    if (activeProfile) {
      setProfileName(activeProfile.name);
      setRole(activeProfile.role);
      setContext(activeProfile.context);
      setConstraints(activeProfile.constraints);
      setOutputFormat(activeProfile.outputFormat);
      setHistory(null); // Clear history on switch
    }
  }, [activeProfileId, profiles]);

  // Sync active guide when platform changes
  const handlePlatformChange = (platform: 'gemini' | 'chatgpt' | 'claude') => {
    setSelectedPlatform(platform);
    if (platform === 'gemini') {
      setActiveGuideLLM('gemini_gems');
    } else if (platform === 'chatgpt') {
      setActiveGuideLLM('chatgpt_custom');
    } else if (platform === 'claude') {
      setActiveGuideLLM('claude_projects');
    }
  };

  // Save profiles to LocalStorage
  const saveToLocalStorage = (updatedProfiles: CustomProfile[]) => {
    localStorage.setItem('llm_custom_profiles', JSON.stringify(updatedProfiles));
  };

  // Update profile fields in list & localStorage
  const updateActiveProfileField = (field: keyof Omit<CustomProfile, 'id'>, value: string) => {
    const updated = profiles.map(p => {
      if (p.id === activeProfileId) {
        return { ...p, [field]: value };
      }
      return p;
    });
    setProfiles(updated);
    saveToLocalStorage(updated);
  };

  // Create new empty profile
  const handleCreateNewProfile = () => {
    const newId = `profile-${Date.now()}`;
    const newProfile: CustomProfile = {
      id: newId,
      name: '📂 Cấu hình mới ' + (profiles.length - PRESETS.length + 1),
      role: '',
      context: '',
      constraints: '',
      outputFormat: ''
    };
    const updated = [...profiles, newProfile];
    setProfiles(updated);
    setActiveProfileId(newId);
    saveToLocalStorage(updated);
  };

  // Delete current profile
  const handleDeleteProfile = async (idToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (profiles.length <= 1) {
      toast("Bạn phải giữ lại ít nhất một cấu hình.");
      return;
    }
    if (await confirmDialog({ message: "Bạn có chắc chắn muốn xóa cấu hình này?", danger: true, confirmText: 'Xoá' })) {
      const updated = profiles.filter(p => p.id !== idToDelete);
      setProfiles(updated);
      saveToLocalStorage(updated);
      // Select another profile
      if (activeProfileId === idToDelete) {
        setActiveProfileId(updated[0].id);
      }
    }
  };

  // Reset current profile to preset default if it matches preset ID
  const handleResetToPresetDefault = async () => {
    const defaultPreset = PRESETS.find(p => p.id === activeProfileId);
    if (defaultPreset) {
      if (await confirmDialog({ message: "Khôi phục lại nội dung mặc định của mẫu thiết lập này?" })) {
        const updated = profiles.map(p => p.id === activeProfileId ? { ...defaultPreset } : p);
        setProfiles(updated);
        saveToLocalStorage(updated);
      }
    } else {
      // For custom ones, just clear fields
      if (await confirmDialog({ message: "Bạn muốn xóa sạch nội dung các ô nhập liệu?" })) {
        const updated = profiles.map(p => p.id === activeProfileId ? {
          ...p,
          role: '',
          context: '',
          constraints: '',
          outputFormat: ''
        } : p);
        setProfiles(updated);
        saveToLocalStorage(updated);
      }
    }
  };

  // Call AI (Gemini 3.5 Flash) to optimize system prompt structure
  const handleOptimizeWithAI = async () => {
    if (!role.trim() && !context.trim() && !constraints.trim() && !outputFormat.trim()) {
      toast("Vui lòng điền nội dung vào ít nhất một trường để AI có dữ liệu tối ưu hóa.");
      return;
    }

    setIsOptimizing(true);
    try {
      // Save current state to history for Undo
      setHistory({ role, context, constraints, outputFormat });

      const optimized = await optimizeCustomInstructions({
        role: role.trim() || 'Chưa định cấu hình',
        context: context.trim() || 'Chưa định cấu hình',
        constraints: constraints.trim() || 'Chưa định cấu hình',
        outputFormat: outputFormat.trim() || 'Chưa định cấu hình'
      });

      // Update states
      setRole(optimized.role);
      setContext(optimized.context);
      setConstraints(optimized.constraints);
      setOutputFormat(optimized.outputFormat);

      // Update in profile list
      const updated = profiles.map(p => {
        if (p.id === activeProfileId) {
          return {
            ...p,
            role: optimized.role,
            context: optimized.context,
            constraints: optimized.constraints,
            outputFormat: optimized.outputFormat
          };
        }
        return p;
      });
      setProfiles(updated);
      saveToLocalStorage(updated);
    } catch (err) {
      console.error(err);
      toast("Đã xảy ra lỗi trong quá trình tối ưu bằng AI. Vui lòng kiểm tra lại API Key hoặc thử lại.");
    } finally {
      setIsOptimizing(false);
    }
  };

  // Undo AI Optimization
  const handleUndoAI = () => {
    if (!history) return;
    setRole(history.role);
    setContext(history.context);
    setConstraints(history.constraints);
    setOutputFormat(history.outputFormat);

    const updated = profiles.map(p => {
      if (p.id === activeProfileId) {
        return {
          ...p,
          role: history.role,
          context: history.context,
          constraints: history.constraints,
          outputFormat: history.outputFormat
        };
      }
      return p;
    });
    setProfiles(updated);
    saveToLocalStorage(updated);
    setHistory(null);
  };

  // Quick Copy mechanism
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopyStates(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopyStates(prev => ({ ...prev, [key]: false }));
    }, 2000);
  };

  // Compiled output representations
  const compiledFullPrompt = `## 🎭 ROLE & PERSONA
${role || '(Chưa điền)'}

## 📌 CONTEXT & PROJECT MEMORY
${context || '(Chưa điền)'}

## ⚠️ RULES & CONSTRAINTS
${constraints || '(Chưa điền)'}

## 📋 OUTPUT PREFERENCES
${outputFormat || '(Chưa điền)'}`;

  const compiledChatGPTBox1 = `${context || '(Chưa điền)'}`;

  const compiledChatGPTBox2 = `Role & Persona:
${role || '(Chưa điền)'}

Rules & Constraints:
${constraints || '(Chưa điền)'}

Output Format:
${outputFormat || '(Chưa điền)'}`;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAFAFA] dark:bg-slate-950 overflow-hidden">
      {/* Header bar */}
      <div className="flex-none p-5 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-100 dark:border-orange-900/50 flex items-center justify-center text-orange-600 dark:text-orange-400 shadow-sm shrink-0">
            <Zap size={22} className="fill-orange-500" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
              Bộ Nhớ & Cấu Hình LLM
            </h1>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider hidden sm:block">
              Quản lý Custom Instructions & Thiết lập hệ thống cho Gemini, ChatGPT, Claude
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setGhostTextEnabled(!ghostTextEnabled)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer border ${
              ghostTextEnabled
                ? 'bg-violet-600 text-white border-violet-600 hover:bg-violet-500'
                : 'bg-transparent text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:border-violet-400'
            }`}
            title="Bật/tắt gợi ý gõ nhanh (ghost-text). Nhấn Tab để điền."
          >
            <Sparkles size={14} />
            Gợi ý gõ nhanh: {ghostTextEnabled ? 'BẬT' : 'TẮT'}
          </button>

          <button
            onClick={handleCreateNewProfile}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-black text-white dark:text-slate-900 bg-slate-900 dark:bg-white hover:bg-indigo-600 dark:hover:bg-indigo-100 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Plus size={14} />
            Tạo Cấu Hình Mới
          </button>
        </div>
      </div>

      {/* Main Body Layout Split */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden w-full">
        
        {/* Left Side: Sidebar selector & Fields editor */}
        <div className="w-full lg:w-1/2 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-200 overflow-hidden bg-white shrink-0">
          
          {/* Quick Select Profile Slider */}
          <div className="flex-none p-4 border-b border-slate-100 bg-slate-50/50 overflow-x-auto flex gap-2 custom-scrollbar">
            {profiles.map(p => {
              const isActive = p.id === activeProfileId;
              const isPreset = PRESETS.some(preset => preset.id === p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveProfileId(p.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition-all border flex items-center gap-2 cursor-pointer ${
                    isActive 
                    ? 'bg-orange-50 border-orange-200 text-orange-700 shadow-sm' 
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate max-w-[130px]">{p.name}</span>
                  {!isPreset && (
                    <span 
                      onClick={(e) => handleDeleteProfile(p.id, e)} 
                      className="hover:text-rose-600 p-0.5 rounded-md hover:bg-rose-50/50 transition-colors"
                      title="Xóa cấu hình"
                    >
                      <Trash2 size={12} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Form Editor Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
            {/* Profile Name Edit */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Tên Cấu Hình</label>
              <input 
                type="text" 
                value={profileName}
                onChange={(e) => {
                  setProfileName(e.target.value);
                  updateActiveProfileField('name', e.target.value);
                }}
                placeholder="Nhập tên cấu hình (ví dụ: Lập trình viên React)..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500 font-semibold text-slate-700 text-xs shadow-sm bg-white"
              />
            </div>

            {/* Field 1: Role & Persona */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between mb-1.5">
                <span>🎭 Vai trò & Tính cách (Role & Persona)</span>
                <span className="text-[9px] text-slate-300 font-normal lowercase">AI là ai?</span>
              </label>
              <textarea
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  updateActiveProfileField('role', e.target.value);
                }}
                placeholder="Ví dụ: Bạn là chuyên gia tư vấn tài chính cá nhân với bằng CFA và 8 năm kinh nghiệm. Giọng văn chân thành, thực tế..."
                className="w-full min-h-[90px] px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500 text-xs text-slate-600 font-medium leading-relaxed shadow-sm bg-white"
              />
            </div>

            {/* Field 2: Context & Memory */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between mb-1.5">
                <span>📌 Bối cảnh & Bộ nhớ dự án (Context & Memory)</span>
                <span className="text-[9px] text-slate-300 font-normal lowercase">Dự án/Công việc hiện tại</span>
              </label>
              <textarea
                value={context}
                onChange={(e) => {
                  setContext(e.target.value);
                  updateActiveProfileField('context', e.target.value);
                }}
                placeholder="Ví dụ: Tôi đang làm dự án xây dựng ứng dụng Web bán quần áo bằng ReactJS, Next.js. Thư mục mã nguồn chính ở src/components..."
                className="w-full min-h-[90px] px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500 text-xs text-slate-600 font-medium leading-relaxed shadow-sm bg-white"
              />
            </div>

            {/* Field 3: Rules & Constraints */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between mb-1.5">
                <span>⚠️ Luật lệ & Ràng buộc (Rules & Constraints)</span>
                <span className="text-[9px] text-slate-300 font-normal lowercase">Những điều cấm kỵ/Phải làm</span>
              </label>
              <textarea
                value={constraints}
                onChange={(e) => {
                  setConstraints(e.target.value);
                  updateActiveProfileField('constraints', e.target.value);
                }}
                placeholder="Ví dụ: - Trình bày ngắn gọn trực diện.\n- Không được chào hỏi hay tóm tắt ở đầu.\n- Tuyệt đối không dùng từ ngữ sáo rỗng..."
                className="w-full min-h-[90px] px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500 text-xs text-slate-600 font-medium leading-relaxed shadow-sm bg-white"
              />
            </div>

            {/* Field 4: Output Preferences */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between mb-1.5">
                <span>📋 Định dạng đầu ra (Output Preferences)</span>
                <span className="text-[9px] text-slate-300 font-normal lowercase">Định dạng hiển thị kết quả</span>
              </label>
              <textarea
                value={outputFormat}
                onChange={(e) => {
                  setOutputFormat(e.target.value);
                  updateActiveProfileField('outputFormat', e.target.value);
                }}
                placeholder="Ví dụ: - Trình bày kết quả dạng danh sách gạch đầu dòng rõ ràng.\n- Bọc mã nguồn hoàn chỉnh trong Markdown code blocks..."
                className="w-full min-h-[90px] px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500 text-xs text-slate-600 font-medium leading-relaxed shadow-sm bg-white"
              />
            </div>

            {/* Công cụ dữ liệu: sao lưu/khôi phục (H6) + thống kê sử dụng AI (M2) */}
            <BackupPanel />
            <UsageStatsPanel />
          </div>

          {/* Action Row Editor */}
          <div className="flex-none p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <button
              onClick={handleResetToPresetDefault}
              className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl transition-all cursor-pointer"
            >
              Reset mẫu
            </button>

            <div className="flex items-center gap-2">
              {history && (
                <button
                  onClick={handleUndoAI}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all cursor-pointer active:scale-95"
                  title="Hoàn tác lại trước khi AI tối ưu"
                >
                  <RotateCcw size={14} />
                  Hoàn tác
                </button>
              )}

              <button
                onClick={handleOptimizeWithAI}
                disabled={isOptimizing}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 rounded-xl transition-all shadow-md shadow-indigo-100 hover:shadow-lg hover:shadow-indigo-200/50 cursor-pointer active:scale-95 disabled:scale-100"
              >
                {isOptimizing ? (
                  <>
                    <Sparkles size={14} className="text-white animate-pulse shrink-0" />
                    Đang làm sắc nét...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} className="text-amber-300 fill-amber-300 animate-pulse" />
                    Tối ưu hóa bằng AI (Flash)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Tab panel switcher (Preview / Setup Guide) */}
        <div className="w-full lg:w-1/2 flex flex-col bg-[#FAFBFD] overflow-hidden">
          {/* Tab switches */}
          <div className="flex-none border-b border-slate-200 bg-white flex p-1 justify-center">
            <div className="flex bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/50 w-full max-w-sm">
              <button
                onClick={() => setActiveRightTab('preview')}
                className={`flex-1 py-1.5 text-xs font-extrabold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeRightTab === 'preview'
                  ? 'bg-white text-slate-800 shadow-sm border border-slate-100'
                  : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Terminal size={14} />
                Xem trước & Sao chép
              </button>
              <button
                onClick={() => setActiveRightTab('guide')}
                className={`flex-1 py-1.5 text-xs font-extrabold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeRightTab === 'guide'
                  ? 'bg-white text-slate-800 shadow-sm border border-slate-100'
                  : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <BookOpen size={14} />
                Hướng dẫn cài đặt
              </button>
            </div>
          </div>

          {/* Tab 1: Live Preview of System Prompt */}
          {activeRightTab === 'preview' && (
            <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
              
              {/* Full System Prompt Render */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
                    <span className="text-[10px] font-black text-slate-500 tracking-wider uppercase">Full System Prompt</span>
                  </div>
                  <button
                    onClick={() => handleCopy(compiledFullPrompt, 'full')}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                      copyStates['full']
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    {copyStates['full'] ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    {copyStates['full'] ? 'Đã sao chép' : 'Sao chép Full'}
                  </button>
                </div>
                <div className="font-mono text-slate-600 text-xs whitespace-pre-wrap leading-relaxed bg-slate-50/60 p-4 rounded-xl border border-slate-100/50 shadow-inner max-h-[300px] overflow-y-auto custom-scrollbar">
                  {compiledFullPrompt}
                </div>
                <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5">
                  <Info size={12} className="shrink-0" />
                  Sử dụng tệp cấu hình nguyên khối này dán vào hộp **Gems** (Gemini), **Projects** (Claude) hoặc **Custom GPTs** (ChatGPT).
                </div>
              </div>

              {/* Split Prompt for ChatGPT Custom Instructions */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-5">
                <div className="pb-2 border-b border-slate-100 flex items-center gap-2">
                  <MessageSquare className="text-orange-500" size={16} />
                  <span className="text-[10px] font-black text-slate-500 tracking-wider uppercase">ChatGPT Custom Instructions (Hộp chia đôi)</span>
                </div>

                {/* Box 1 */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10.5px] font-black text-slate-600">Hộp 1: What to know (Bối cảnh về bạn)</span>
                    <button
                      onClick={() => handleCopy(compiledChatGPTBox1, 'box1')}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                        copyStates['box1']
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                      }`}
                    >
                      {copyStates['box1'] ? <Check size={12} /> : <Copy size={12} />}
                      Dán Hộp 1
                    </button>
                  </div>
                  <div className="font-mono text-slate-600 text-[11px] whitespace-pre-wrap leading-relaxed bg-slate-50/40 p-3 rounded-lg border border-slate-100 max-h-[100px] overflow-y-auto custom-scrollbar">
                    {compiledChatGPTBox1 || '(Chưa có thông tin bối cảnh dự án)'}
                  </div>
                </div>

                {/* Box 2 */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10.5px] font-black text-slate-600">Hộp 2: How to respond (Cách AI phản hồi)</span>
                    <button
                      onClick={() => handleCopy(compiledChatGPTBox2, 'box2')}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                        copyStates['box2']
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                      }`}
                    >
                      {copyStates['box2'] ? <Check size={12} /> : <Copy size={12} />}
                      Dán Hộp 2
                    </button>
                  </div>
                  <div className="font-mono text-slate-600 text-[11px] whitespace-pre-wrap leading-relaxed bg-slate-50/40 p-3 rounded-lg border border-slate-100 max-h-[120px] overflow-y-auto custom-scrollbar">
                    {compiledChatGPTBox2}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Step-by-Step Setup Guide */}
          {activeRightTab === 'guide' && (
            <div className="flex-1 overflow-y-auto p-5 flex flex-col overflow-x-hidden custom-scrollbar">
              
              {/* Premium Platform Selector */}
              <div className="mb-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Bước 1: Chọn nền tảng AI của bạn</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handlePlatformChange('gemini')}
                    className={`p-3 rounded-2xl border text-xs font-black transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center relative overflow-hidden ${
                      selectedPlatform === 'gemini'
                      ? 'border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-blue-50/50 text-indigo-950 shadow-sm ring-1 ring-indigo-300'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                    }`}
                  >
                    <Brain size={18} className={selectedPlatform === 'gemini' ? 'text-indigo-600' : 'text-slate-400'} />
                    <span>Google Gemini</span>
                  </button>

                  <button
                    onClick={() => handlePlatformChange('chatgpt')}
                    className={`p-3 rounded-2xl border text-xs font-black transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center relative overflow-hidden ${
                      selectedPlatform === 'chatgpt'
                      ? 'border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-teal-50/50 text-emerald-950 shadow-sm ring-1 ring-emerald-300'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                    }`}
                  >
                    <MessageSquare size={18} className={selectedPlatform === 'chatgpt' ? 'text-emerald-600' : 'text-slate-400'} />
                    <span>OpenAI ChatGPT</span>
                  </button>

                  <button
                    onClick={() => handlePlatformChange('claude')}
                    className={`p-3 rounded-2xl border text-xs font-black transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center relative overflow-hidden ${
                      selectedPlatform === 'claude'
                      ? 'border-orange-200 bg-gradient-to-br from-orange-50/80 to-amber-50/50 text-orange-950 shadow-sm ring-1 ring-orange-300'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                    }`}
                  >
                    <Sliders size={18} className={selectedPlatform === 'claude' ? 'text-orange-600' : 'text-slate-400'} />
                    <span>Anthropic Claude</span>
                  </button>
                </div>
              </div>

              {/* Step 2: Specific Integration Type Switcher */}
              <div className="mb-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Bước 2: Chọn phương thức cấu hình</span>
                
                {selectedPlatform === 'gemini' && (
                  <div className="flex gap-1.5 bg-slate-100 p-0.5 rounded-xl border border-slate-200/50 w-fit">
                    <button
                      onClick={() => setActiveGuideLLM('gemini_gems')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                        activeGuideLLM === 'gemini_gems'
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Gemini Gems (Advanced)
                    </button>
                    <button
                      onClick={() => setActiveGuideLLM('gemini_studio')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                        activeGuideLLM === 'gemini_studio'
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      AI Studio System Prompt
                    </button>
                  </div>
                )}

                {selectedPlatform === 'chatgpt' && (
                  <div className="flex gap-1.5 bg-slate-100 p-0.5 rounded-xl border border-slate-200/50 w-fit">
                    <button
                      onClick={() => setActiveGuideLLM('chatgpt_custom')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                        activeGuideLLM === 'chatgpt_custom'
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Custom Instructions (Mọi Chat)
                    </button>
                    <button
                      onClick={() => setActiveGuideLLM('chatgpt_gpt')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                        activeGuideLLM === 'chatgpt_gpt'
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Custom GPTs (Trợ lý riêng)
                    </button>
                  </div>
                )}

                {selectedPlatform === 'claude' && (
                  <div className="flex gap-1.5 bg-slate-100 p-0.5 rounded-xl border border-slate-200/50 w-fit">
                    <button
                      onClick={() => setActiveGuideLLM('claude_projects')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                        activeGuideLLM === 'claude_projects'
                        ? 'bg-white text-orange-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Claude Projects (Bối cảnh dự án)
                    </button>
                  </div>
                )}
              </div>

              {/* Guide Contents */}
              <div className="flex-1 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
                
                {/* 1. Gemini Gems */}
                {activeGuideLLM === 'gemini_gems' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                      <Brain className="text-indigo-500" size={16} />
                      Cài đặt cấu hình thông qua Gemini Gems
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                      Gems giúp bạn xây dựng các trợ lý chuyên môn sâu, tự động ghi nhớ toàn bộ bối cảnh dự án ở mọi phiên hội thoại mới.
                    </p>
                    <ol className="space-y-3.5 text-xs text-slate-600 font-medium">
                      <li className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-700">1</span>
                        <div className="leading-relaxed">
                          Tại trang chủ <strong>Gemini.google.com</strong>, nhìn ở thanh điều hướng bên trái, tìm và nhấp chọn <strong>Gems Manager</strong> hoặc biểu tượng <strong>New Gem</strong> (Gem mới).
                        </div>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-700">2</span>
                        <div className="leading-relaxed">
                          Đặt tên gợi nhớ cho Gem của bạn (ví dụ: <em>{profileName || 'Gia sư học tập'}</em>).
                        </div>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-700">3</span>
                        <div className="leading-relaxed">
                          Chuyển qua tab **Xem trước & Sao chép** của chúng tôi, bấm nút <strong>"Sao chép Full"</strong>.
                        </div>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-700">4</span>
                        <div className="leading-relaxed">
                          Dán toàn bộ mã chỉ dẫn vừa sao chép vào hộp <strong>Instructions (Hướng dẫn cho Gem)</strong>.
                        </div>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-700">5</span>
                        <div className="leading-relaxed">
                          Bấm nút <strong>Create (Tạo)</strong> ở góc trên bên phải. Từ đây trợ lý chuyên dụng của bạn đã sẵn sàng làm việc nhất quán!
                        </div>
                      </li>
                    </ol>
                  </div>
                )}

                {/* 2. Gemini System Instructions (AI Studio) */}
                {activeGuideLLM === 'gemini_studio' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                      <Cpu className="text-indigo-500" size={16} />
                      Thiết lập System Instructions trong Google AI Studio
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                      Phù hợp cho lập trình viên và nhà phát triển ứng dụng muốn tinh chỉnh cấu trúc chỉ thị cứng cho mô hình Gemini (Gemini 2.5 Pro, 1.5 Pro, 3.5 Flash) trước khi đưa vào code.
                    </p>
                    <ol className="space-y-3.5 text-xs text-slate-600 font-medium">
                      <li className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-700">1</span>
                        <div className="leading-relaxed">
                          Truy cập vào trang **[Google AI Studio](https://aistudio.google.com/)** và đăng nhập tài khoản Google Developer.
                        </div>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-700">2</span>
                        <div className="leading-relaxed">
                          Bấm nút <strong>Create new prompt</strong> (ví dụ: Chat Prompt) ở góc trên bên trái màn hình.
                        </div>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-700">3</span>
                        <div className="leading-relaxed">
                          Nhìn sang thanh cấu hình bên phải màn hình, tìm mục **System Instructions** (Chỉ dẫn hệ thống).
                        </div>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-700">4</span>
                        <div className="leading-relaxed">
                          Click <strong>"Sao chép Full"</strong> tại tab Xem trước và dán toàn bộ vào ô **System Instructions**.
                        </div>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-700">5</span>
                        <div className="leading-relaxed">
                          Nhập test case ở ô chat ở giữa để chạy thử nghiệm xem mô hình phản hồi nhất quán theo định hướng hay chưa.
                        </div>
                      </li>
                    </ol>
                  </div>
                )}

                {/* 3. ChatGPT Custom Instructions */}
                {activeGuideLLM === 'chatgpt_custom' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                      <Settings className="text-emerald-500" size={16} />
                      Cài đặt Custom Instructions trong ChatGPT
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                      Cách tốt nhất để ChatGPT luôn nhớ về bạn và các dự án của bạn trong tất cả các cuộc trò chuyện thông thường.
                    </p>
                    <ol className="space-y-3.5 text-xs text-slate-600 font-medium">
                      <li className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-700">1</span>
                        <div className="leading-relaxed">
                          Nhấp vào <strong>Ảnh đại diện tài khoản (Avatar)</strong> của bạn ở góc trên bên phải hoặc thanh điều hướng.
                        </div>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-700">2</span>
                        <div className="leading-relaxed">
                          Chọn mục <strong>Customize ChatGPT</strong> (Tùy chỉnh ChatGPT) trong danh sách menu xổ xuống.
                        </div>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-700">3</span>
                        <div className="leading-relaxed">
                          Tại ô nhập thứ nhất (<em>"What would you like ChatGPT to know about you..."</em>), hãy copy nội dung từ nút <strong>"Dán Hộp 1"</strong> ở tab Xem trước và dán vào.
                        </div>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-700">4</span>
                        <div className="leading-relaxed">
                          Tại ô nhập thứ hai (<em>"How would you like ChatGPT to respond..."</em>), hãy copy nội dung từ nút <strong>"Dán Hộp 2"</strong> ở tab Xem trước và dán vào.
                        </div>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-700">5</span>
                        <div className="leading-relaxed">
                          Nhấn nút <strong>Save (Lưu)</strong>. Từ nay các phiên chat mới của bạn sẽ tự động áp dụng bộ cấu hình này.
                        </div>
                      </li>
                    </ol>
                  </div>
                )}

                {/* 4. ChatGPT Custom GPTs */}
                {activeGuideLLM === 'chatgpt_gpt' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                      <MessageSquare className="text-emerald-500" size={16} />
                      Tạo Trợ lý Custom GPT riêng trong ChatGPT
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                      Tạo chatbot chuyên dụng cho công việc hoặc chia sẻ với những người khác trong tổ chức của bạn.
                    </p>
                    <ol className="space-y-3.5 text-xs text-slate-600 font-medium">
                      <li className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-700">1</span>
                        <div className="leading-relaxed">
                          Nhấp chọn mục <strong>Explore GPTs (Khám phá GPT)</strong> ở thanh bên và click vào nút <strong>Create (Tạo)</strong> ở góc trên cùng bên phải.
                        </div>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-700">2</span>
                        <div className="leading-relaxed">
                          Chuyển đổi giao diện từ tab <em>Create</em> sang tab <strong>Configure (Cấu hình)</strong> ở phía trên.
                        </div>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-700">3</span>
                        <div className="leading-relaxed">
                          Bấm sao chép **Full System Prompt** ở tab Xem trước.
                        </div>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-700">4</span>
                        <div className="leading-relaxed">
                          Dán văn bản vừa copy vào ô <strong>Instructions</strong>.
                        </div>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-700">5</span>
                        <div className="leading-relaxed">
                          Nhấn nút <strong>Save</strong> hoặc <strong>Publish</strong> ở góc trên bên phải để hoàn tất lưu trữ.
                        </div>
                      </li>
                    </ol>
                  </div>
                )}

                {/* 5. Claude Projects */}
                {activeGuideLLM === 'claude_projects' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                      <Sliders className="text-orange-500" size={16} />
                      Định cấu hình Custom Instructions cho Claude Projects
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                      Lý tưởng khi làm việc với Claude trên một dự án mã nguồn cụ thể (Áp dụng cho tài khoản Claude Pro / Team).
                    </p>
                    <ol className="space-y-3.5 text-xs text-slate-600 font-medium">
                      <li className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-700">1</span>
                        <div className="leading-relaxed">
                          Ở trang chủ Claude.ai, nhấp chọn mục <strong>Projects (Dự án)</strong> ở sidebar và bấm <strong>Create Project</strong> để tạo dự án mới.
                        </div>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-700">2</span>
                        <div className="leading-relaxed">
                          Đặt tên và bấm tạo. Sau khi giao diện dự án mở ra, tìm bảng <strong>Set custom instructions</strong> ở cột bên phải.
                        </div>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-700">3</span>
                        <div className="leading-relaxed">
                          Chuyển sang tab Xem trước của chúng tôi, bấm <strong>"Sao chép Full"</strong> để copy toàn bộ System Prompt.
                        </div>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-700">4</span>
                        <div className="leading-relaxed">
                          Dán nội dung vào panel và nhấn <strong>Save Instructions</strong>. Mọi đoạn chat trong Project này sẽ tự động được định cấu hình.
                        </div>
                      </li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
