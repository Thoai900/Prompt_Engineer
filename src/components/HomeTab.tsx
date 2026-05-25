import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Copy, Check, Sparkles, ArrowRight, Bookmark, Play, 
  Layers, Brain, Briefcase, GraduationCap, HelpCircle, Compass, 
  CheckCircle, Flame, RefreshCw, Star, Info, Edit3, Sparkle, Trash2
} from 'lucide-react';
import { generateStructuredTemplateFromTopic } from '../services/aiService';

interface HomeTabProps {
  onSelectTemplate: (template: any) => void;
  onSaveTemplate: (template: any) => Promise<void>;
  user: any;
  onNavigateToBuilder: () => void;
}

const POPULAR_SUGGESTIONS = [
  { text: 'Kịch bản Video ngắn TikTok về du học sinh', icon: '🎥', category: 'Sáng tạo' },
  { text: 'Custom Hook React quản lý Global State', icon: '💻', category: 'Lập trình' },
  { text: 'Bài viết Sales PR sản phẩm thảo dược quý', icon: '✍️', category: 'Sáng tạo' },
  { text: 'Gia sư hướng dẫn giải Đạo hàm Logarit lớp 12', icon: '📐', category: 'Học tập' }
];

export default function HomeTab({ onSelectTemplate, onSaveTemplate, user, onNavigateToBuilder }: HomeTabProps) {
  const [searchInput, setSearchInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [generatedTemplate, setGeneratedTemplate] = useState<any>(null);
  const [textCopied, setTextCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Mouse trail dynamic wave coordinates for the soothing "làn nước" color stream
  const [mouseCoords, setMouseCoords] = useState({ x: 200, y: 150 });
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMouseCoords({ x, y });
  };

  // Steps typing loop
  const steps = [
    '🔍 Đang nghiên cứu bối cảnh & chủ đề của bạn...',
    '🧠 Đang thiết lập Vai trò chuyên môn thông thái nhất...',
    '🏗️ Đang lắp ráp Cấu trúc Multi-block thông minh...',
    '⚠️ Đang cô đặc các Ràng buộc & Tiêu chuẩn rà soát...',
    '📋 Định hình cấu trúc và phản hồi mẫu đầu ra...'
  ];

  useEffect(() => {
    let interval: any;
    if (isGenerating) {
      interval = setInterval(() => {
        setGenerationStep((prev) => {
          if (prev >= steps.length - 1) {
            return prev;
          }
          return prev + 1;
        });
      }, 1500);
    } else {
      setGenerationStep(0);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleGeneratePrompt = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchInput.trim()) return;

    setIsGenerating(true);
    setGeneratedTemplate(null);
    setErrorMessage('');
    setIsSaved(false);

    try {
      const result = await generateStructuredTemplateFromTopic(searchInput.trim());
      setGeneratedTemplate(result);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Có lỗi xảy ra khi tạo prompt bằng AI. Vui lòng kiểm tra API Key or đường truyền.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPrompt = () => {
    if (!generatedTemplate) return;

    // Convert blocks to beautifully compiled markdown prompt
    const compiled = generatedTemplate.blocks
      .map((b: any) => `## ${b.title}\n${b.content}`)
      .join('\n\n');

    navigator.clipboard.writeText(compiled);
    setTextCopied(true);
    setTimeout(() => setTextCopied(false), 2000);
  };

  const handleSaveToLibrary = async () => {
    if (!generatedTemplate) return;
    if (!user) {
      alert('Vui lòng đăng nhập bằng tài khoản Google (ở góc dưới bên trái menu) để đồng bộ lưu dữ liệu lên đám mây.');
      return;
    }

    setSaveLoading(true);
    try {
      await onSaveTemplate(generatedTemplate);
      setIsSaved(true);
    } catch (err) {
      console.error(err);
      alert('Lỗi lưu trữ dữ liệu.');
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div 
      className="bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 w-full h-full overflow-x-hidden overflow-y-auto custom-scrollbar font-sans selection:bg-indigo-500/20 relative flex flex-col items-center pb-24"
      onMouseMove={handleMouseMove}
    >
      {/* Decorative Grid Mesh Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-[0.35] dark:opacity-[0.2] pointer-events-none z-0"></div>

      {/* Hero Section Container */}
      <div className="relative py-12 md:py-20 flex flex-col items-center text-center px-4 w-full max-w-5xl z-10">
        
        {/* Hover Gradient Shifting "Làn Nước" Panel behind the Hero box */}
        <div 
          className="absolute inset-0 pointer-events-none transition-opacity duration-1000 opacity-80 md:opacity-100 z-0 overflow-hidden rounded-3xl"
          style={{
            filter: 'blur(100px)',
          }}
        >
          {/* Layered fluid water-like gradients mimicking oil paint in water */}
          <div 
            className="absolute w-[450px] h-[450px] rounded-full bg-gradient-to-tr from-indigo-300 via-sky-200 to-emerald-200 opacity-25 mix-blend-multiply transition-all duration-1000 ease-out"
            style={{
              transform: `translate(${(mouseCoords.x - 500) * 0.1}px, ${(mouseCoords.y - 250) * 0.1}px)`,
              left: '20%',
              top: '15%',
            }}
          />
          <div 
            className="absolute w-[400px] h-[400px] rounded-full bg-gradient-to-br from-violet-200 via-fuchsia-100 to-rose-200 opacity-20 mix-blend-screen transition-all duration-[1300ms] ease-out"
            style={{
              transform: `translate(${(mouseCoords.x - 500) * -0.08}px, ${(mouseCoords.y - 250) * -0.08}px)`,
              right: '25%',
              bottom: '15%',
            }}
          />
          <div 
            className="absolute w-[350px] h-[350px] rounded-full bg-gradient-to-tr from-teal-200 via-cyan-100 to-amber-100 opacity-15 mix-blend-overlay transition-all duration-700 ease-out"
            style={{
              transform: `translate(${(mouseCoords.x - 500) * 0.05}px, ${(mouseCoords.y - 250) * 0.05}px)`,
              left: '40%',
              top: '30%',
            }}
          />
        </div>

        {/* Minimal Hero Header */}
        <div className="relative z-10 mb-8 mt-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100/60 dark:border-indigo-900/50 rounded-full text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-6 uppercase tracking-wider animate-fade-in shadow-sm">
            <Sparkles className="w-3.5 h-3.5" /> Workspace Smart AI Generator
          </span>
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1] mb-5 max-w-3xl">
            Sáng Tạo Prompt Siêu Việt <br/>
            bằng <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500">Trí Tuệ Nhân Tạo</span>
          </h1>
          <p className="text-[15px] md:text-base font-semibold text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed mx-auto mb-6">
            Hóa giải trạng thái mơ hồ bằng cách chia nhỏ mục tiêu thành khung sườn Multi-Block vững chắc đối kháng ảo giác AI. Nhập chủ đề của bạn dưới đây hoặc tự tạo trong Prompt Builder.
          </p>
          <div className="flex flex-wrap justify-center gap-3 animate-fade-in relative z-20">
            <button
              onClick={onNavigateToBuilder}
              className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-xs font-black transition-all shadow-md shadow-indigo-100 hover:shadow-lg hover:shadow-indigo-200/50 cursor-pointer active:scale-95"
            >
              <Briefcase className="w-4 h-4 text-amber-300" />
              Đi tới Prompt Builder
            </button>
            <a
              href="#generate-section"
              className="inline-flex items-center gap-2 px-5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-indigo-500" />
              Tạo Prompt bằng AI
            </a>
          </div>
        </div>

        {/* Luồng tạo prompt dưới dạng thanh tìm kiếm AI thông minh */}
        <motion.div 
          id="generate-section"
          className="w-full max-w-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-[0_20px_50px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-3xl p-3 md:p-4 z-20 relative group transition-all hover:border-slate-300 dark:hover:border-slate-700 scroll-mt-24"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Subtle liquid outline glow matching "làn nước" concept */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/10 via-sky-500/10 to-emerald-500/10 rounded-3xl opacity-0 group-hover:opacity-100 transition duration-700 blur-[6px] -z-10 pointer-events-none" />

          <form onSubmit={handleGeneratePrompt} className="relative flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
            <div className="relative flex-1 flex items-center bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 rounded-full">
              <Search className="absolute left-4 w-5 h-5 text-slate-400 dark:text-slate-500" />
              <input 
                type="text"
                placeholder="Bạn muốn tạo prompt chuyên nghiệp để giải quyết bài toán gì hôm nay?..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                disabled={isGenerating}
                className="w-full pl-12 pr-4 py-4 input-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-0 text-medium md:text-[15px] font-semibold"
              />
            </div>
            <button 
              type="submit"
              disabled={isGenerating || !searchInput.trim()}
              className="py-3.5 px-6 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 transition-all hover:bg-indigo-600 dark:hover:bg-indigo-500 hover:text-white dark:hover:text-white hover:shadow-lg active:scale-95 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-650 disabled:scale-100 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="w-4 h-4 animate-pulse text-indigo-600 dark:text-indigo-400" />
                  Đang phân rã Prompt...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300 dark:text-amber-500 fill-amber-300 dark:fill-amber-500" />
                  Tạo Prompt
                </>
              )}
            </button>
          </form>

          {/* Suggestions List */}
          <div className="mt-4 pt-3 border-t border-slate-100/80 dark:border-slate-800/80 flex flex-wrap gap-2 items-center text-left">
            <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Gợi ý từ AI:</span>
            {POPULAR_SUGGESTIONS.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => setSearchInput(suggestion.text)}
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 rounded-xl text-xs text-slate-600 dark:text-slate-300 font-semibold hover:border-indigo-200 dark:hover:border-indigo-500/30 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all cursor-pointer"
              >
                <span>{suggestion.icon}</span>
                <span>{suggestion.text}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Real-time Loader animation */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div 
              key="loader"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full max-w-2xl mt-8 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/60 dark:border-indigo-900/40 rounded-3xl p-6 text-center shadow-sm overflow-hidden"
            >
              <div className="flex flex-col items-center gap-4">
                {/* Micro pulse indicator */}
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 animate-pulse">
                  <Sparkles className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                
                {/* Typo list of action blocks */}
                <div className="flex flex-col gap-1.5 w-full">
                  <span className="text-[13px] font-bold text-indigo-700 dark:text-indigo-300 animate-pulse">
                    {steps[generationStep]}
                  </span>
                  <div className="w-48 h-1 bg-slate-100 dark:bg-slate-900 rounded-full mx-auto overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 to-sky-500 transition-all duration-1000 ease-out" 
                      style={{ width: `${((generationStep + 1) / steps.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Bố cục Multi-block đang cấu hình cho tối ưu ngữ cảnh</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Interactive Error Display */}
        {errorMessage && (
          <div className="w-full max-w-2xl mt-6 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-2xl text-rose-700 dark:text-rose-450 text-xs font-semibold text-center flex items-center justify-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            {errorMessage}
          </div>
        )}

        {/* Feature Interactive Panel - Complete Prompt Output Container */}
        <AnimatePresence>
          {generatedTemplate && (
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 100, damping: 15 }}
              className="w-full max-w-4xl mt-12 text-left"
            >
              {/* Outer Header Info */}
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse"></div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">KẾT QUẢ PROMPT HOÀN CHỈNH</span>
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase select-none">
                  AI Generation Engine
                </div>
              </div>

              {/* High-Grade Glass Output Widget */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_15px_40px_rgba(0,0,0,0.04)] rounded-3xl overflow-hidden relative">
                {/* Soft gradient header inside card */}
                <div className="p-6 md:p-8 bg-gradient-to-r from-slate-50 dark:from-slate-850 to-indigo-50/30 dark:to-indigo-950/20 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                      ✨ {generatedTemplate.title}
                    </h2>
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-400 leading-relaxed">
                      {generatedTemplate.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/45 border border-indigo-100/50 dark:border-indigo-900/50 rounded-md text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
                        {generatedTemplate.category || 'Mẫu của tôi'}
                      </span>
                      {generatedTemplate.tags?.map((tag: string, index: number) => (
                        <span key={index} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-[9px] font-bold text-slate-500 dark:text-slate-400">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center gap-2 sm:self-center">
                    <button
                      onClick={handleCopyPrompt}
                      className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-650 font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                      title="Sao chép toàn bộ"
                    >
                      {textCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 font-bold" />
                          Có chứ! Đã chép
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                          Sao chép nhanh
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleSaveToLibrary}
                      disabled={isSaved || saveLoading}
                      className={`px-3.5 py-2 rounded-xl font-extrabold text-xs flex items-center gap-1.5 border transition-all cursor-pointer active:scale-95 ${
                        isSaved 
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300' 
                        : 'bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/65 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900/50 hover:border-indigo-250'
                      }`}
                    >
                      {isSaved ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-450" />
                          Đã lưu thư viện
                        </>
                      ) : (
                        <>
                          <Bookmark className="w-3.5 h-3.5" />
                          {saveLoading ? 'Đang lưu...' : 'Lưu kết quả'}
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => onSelectTemplate(generatedTemplate)}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-200/50 hover:shadow-lg transition-all cursor-pointer active:scale-95"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Chỉnh sửa trong Builder
                    </button>
                  </div>
                </div>

                {/* Blocks detail container list */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {generatedTemplate.blocks?.map((block: any) => (
                    <div key={block.id} className="p-5 md:p-6 flex flex-col md:flex-row gap-4 md:items-start hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors">
                      {/* Left Block Identifier tag */}
                      <div className="w-full md:w-44 shrink-0 flex items-center gap-1.5 md:flex-col md:items-stretch">
                        <span className="text-[10px] font-black text-rose-500/80 dark:text-rose-400/90 font-mono uppercase tracking-widest py-0.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 px-2 rounded-md self-start">
                          {block.type}
                        </span>
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 tracking-tight">
                          {block.title}
                        </h4>
                      </div>

                      {/* Right Block content editable look */}
                      <div className="flex-1 bg-slate-50/60 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-850 p-4 rounded-xl font-mono text-[11px] md:text-xs text-slate-600 dark:text-slate-350 whitespace-pre-wrap leading-relaxed shadow-inner">
                        {block.content}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer disclaimer help */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 font-semibold px-6">
                  <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  Bạn có thể nhấn nút "Chỉnh sửa trong Builder" ở phía trên để tách nhỏ các biến số, thêm khối tư duy mới, hay chỉnh giọng AI một cách chuyên nghiệp nhất.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Structured Minimal Core Showcase Blocks Grid */}
      <section className="py-8 px-4 w-full max-w-5xl z-10">
        <div className="text-center mb-10">
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Bố cục Cặp đôi Tối giản của Prompt Engineer</h2>
          <p className="text-xs font-semibold text-slate-400">Hiểu kỹ phương án thiết kế và vai trò của các khối cấu trúc tinh túy</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: <Layers className="w-5 h-5 text-indigo-500" />, title: '1. Khối Đóng vai (Role & Objectives)', desc: 'Xác lập lập luận, kỹ năng, kinh nghiệm đỉnh cao của AI để định vị hướng giải quyết chính xác.' },
            { icon: <CheckCircle className="w-5 h-5 text-emerald-500" />, title: '2. Khối Ràng buộc (Rule & Constraints)', desc: 'Chỉ định trực tiếp, khắt khe các điều không được làm, triệt tiêu sáo rỗng và ảo mộng ảo giác.' },
            { icon: <Compass className="w-5 h-5 text-amber-500" />, title: '3. Khối Định dạng (Format & Output)', desc: 'Sắp đặt cấu trúc trình bày của bảng, kịch bản, code hoặc XML rõ nét giúp thuận tiện sao chép.' }
          ].map((item, idx) => (
            <div key={idx} className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm hover:border-slate-300 transition-all flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center shrink-0">
                {item.icon}
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-800 tracking-tight mb-1">{item.title}</h3>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Simple footer badge */}
      <div className="w-full text-center mt-12 text-[10px] font-black text-slate-400 uppercase tracking-widest z-10 select-none">
        PROMPTBUILDER ORG © 2026 • THÂN THIỆN • HIỆN ĐẠI
      </div>
    </div>
  );
}
