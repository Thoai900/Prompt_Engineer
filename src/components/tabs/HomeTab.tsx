import { toast } from '../common/Toaster';
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence, useInView } from 'motion/react';
import {
  Search, Copy, Check, Sparkles, ArrowRight, Bookmark,
  Briefcase, CheckCircle, Compass, Info, Edit3, Zap, Layers,
  Workflow, Library, ScrollText, GraduationCap, Brain, Moon, Sun
} from 'lucide-react';
// aiService kéo theo @google/genai (~280KB). Import động khi người dùng thực sự
// bấm "Tạo prompt" để không nặng tải khởi động của trang chủ.
import { TabType } from '../../types';
import SpotlightCard from '../common/SpotlightCard';
import { GhostTextInput } from '../common/GhostTextInput';
// Lazy: kéo theo three.js (~rất nặng) — chỉ tải khi khối 3D thực sự hiển thị.
const AIShowcase3D = lazy(() => import('../common/AIShowcase3D'));
import AuroraBackground from '../common/AuroraBackground';

interface HomeTabProps {
  onSelectTemplate: (template: any) => void;
  onSaveTemplate: (template: any) => Promise<void>;
  user: any;
  onNavigateToBuilder: () => void;
  onNavigateToTab: (tab: TabType) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const POPULAR_SUGGESTIONS = [
  { text: 'Kịch bản Video ngắn TikTok về du học sinh', icon: '🎥' },
  { text: 'Custom Hook React quản lý Global State', icon: '💻' },
  { text: 'Bài viết Sales PR sản phẩm thảo dược quý', icon: '✍️' },
  { text: 'Gia sư hướng dẫn giải Đạo hàm Logarit lớp 12', icon: '📐' }
];

// Feature set surfaced as the landing-page bento grid. `span` controls the
// asymmetric layout on the 6-column md grid.
const FEATURES: {
  tab: TabType; title: string; desc: string; icon: React.ReactNode; span: string; featured?: boolean;
}[] = [
  { tab: 'builder', title: 'Prompt Builder', desc: 'Dựng prompt theo khung Multi-block trực quan: vai trò, ràng buộc, định dạng — kéo thả, thêm biến số, kiểm soát từng khối tư duy.', icon: <Briefcase className="w-5 h-5" />, span: 'md:col-span-3', featured: true },
  { tab: 'projectchain', title: 'Project Chain', desc: 'Nối nhiều prompt thành một quy trình, trực quan hoá trên canvas và lan truyền thay đổi tự động.', icon: <Workflow className="w-5 h-5" />, span: 'md:col-span-3', featured: true },
  { tab: 'enhancer', title: 'AI Enhancer', desc: 'Dán prompt thô, nhận lại bản tinh chỉnh rõ ràng hơn.', icon: <Sparkles className="w-5 h-5" />, span: 'md:col-span-2' },
  { tab: 'library', title: 'Thư viện mẫu', desc: 'Kho prompt cộng đồng và của riêng bạn, đồng bộ đám mây.', icon: <Library className="w-5 h-5" />, span: 'md:col-span-2' },
  { tab: 'rulesskills', title: 'Rules & Skills', desc: 'Bộ luật và kỹ năng tái sử dụng cho mọi prompt.', icon: <ScrollText className="w-5 h-5" />, span: 'md:col-span-2' },
  { tab: 'utilitybelt', title: 'LLM Config', desc: 'Tinh chỉnh model, nhiệt độ và tham số cho từng tác vụ.', icon: <Zap className="w-5 h-5" />, span: 'md:col-span-3' },
  { tab: 'learn', title: 'Learn', desc: 'Lộ trình học prompt engineering từ nền tảng tới nâng cao.', icon: <GraduationCap className="w-5 h-5" />, span: 'md:col-span-3' },
  { tab: 'aifuture', title: 'AI Future', desc: 'Cập nhật tin tức và xu hướng AI mới nhất ngay trong app.', icon: <Brain className="w-5 h-5" />, span: 'md:col-span-6' },
];

/** Small count-up that animates once when scrolled into view. */
function CountUp({ to, suffix = '', duration = 1400 }: { to: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * to));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);

  return <span ref={ref}>{val}{suffix}</span>;
}

export default function HomeTab({ onSelectTemplate, onSaveTemplate, user, onNavigateToBuilder, onNavigateToTab, theme, onToggleTheme }: HomeTabProps) {
  const [searchInput, setSearchInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [generatedTemplate, setGeneratedTemplate] = useState<any>(null);
  const [textCopied, setTextCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
        setGenerationStep((prev) => (prev >= steps.length - 1 ? prev : prev + 1));
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
      const { generateStructuredTemplateFromTopic } = await import('../../services/aiService');
      const result = await generateStructuredTemplateFromTopic(searchInput.trim());
      setGeneratedTemplate(result);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Có lỗi xảy ra khi tạo prompt bằng AI. Vui lòng kiểm tra API Key hoặc đường truyền.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPrompt = () => {
    if (!generatedTemplate) return;
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
      toast('Vui lòng đăng nhập bằng tài khoản Google để đồng bộ lưu dữ liệu lên đám mây.');
      return;
    }
    setSaveLoading(true);
    try {
      await onSaveTemplate(generatedTemplate);
      setIsSaved(true);
    } catch (err) {
      console.error(err);
      toast('Lỗi lưu trữ dữ liệu.');
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="bg-surface text-ink w-full h-full overflow-x-hidden overflow-y-auto custom-scrollbar font-sans selection:bg-emerald-500/20 relative flex flex-col scroll-smooth">

      {/* ===================== TOP NAV ===================== */}
      <header className="sticky top-0 z-50 w-full border-b border-line/60 bg-glass/70 backdrop-blur-xl">
        <nav className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <button onClick={() => onNavigateToTab('home')} className="flex items-center gap-2.5 cursor-pointer">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-sm font-bold text-white shadow-sm shadow-emerald-500/30">P</div>
            <span className="text-base font-bold tracking-tight text-ink">Prompt<span className="text-emerald-500">Builder</span></span>
          </button>

          <div className="hidden md:flex items-center gap-1 text-sm font-semibold text-muted">
            <a href="#features" className="px-3 py-2 rounded-lg hover:text-ink hover:bg-hover transition-colors">Tính năng</a>
            <a href="#how" className="px-3 py-2 rounded-lg hover:text-ink hover:bg-hover transition-colors">Quy trình</a>
            <a href="#generate" className="px-3 py-2 rounded-lg hover:text-ink hover:bg-hover transition-colors">Thử ngay</a>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleTheme}
              title={theme === 'light' ? 'Giao diện tối' : 'Giao diện sáng'}
              className="rounded-xl p-2 text-muted hover:text-ink hover:bg-hover transition-colors cursor-pointer"
            >
              {theme === 'light' ? <Moon size={18} className="text-emerald-500" /> : <Sun size={18} className="text-amber-400" />}
            </button>
            <button
              onClick={onNavigateToBuilder}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 text-sm font-bold transition-all shadow-sm shadow-emerald-500/30 hover:shadow-md hover:shadow-emerald-500/40 active:scale-95 cursor-pointer"
            >
              Vào ứng dụng
              <ArrowRight size={15} />
            </button>
          </div>
        </nav>
      </header>

      {/* ===================== HERO ===================== */}
      <section className="relative w-full shrink-0 overflow-hidden">
        <AuroraBackground intensity="hero" />
        <div className="absolute inset-0 hero-spotlight pointer-events-none z-[1]" />
        <div className="absolute inset-0 hero-grid pointer-events-none z-[1]" />

        <div className="relative z-10 mx-auto max-w-5xl px-4 pt-16 pb-20 md:pt-24 md:pb-24 flex flex-col items-center text-center">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-7 uppercase tracking-[0.18em] animate-fade-in">
            <Sparkles className="w-3.5 h-3.5" /> Nền tảng Prompt Engineering
          </span>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-ink tracking-tight leading-[1.05] mb-6 max-w-4xl text-balance">
            Biến ý tưởng mơ hồ thành <span className="text-aurora-sweep">prompt cấp chuyên gia</span>
          </h1>

          <p className="text-[15px] md:text-lg font-medium text-muted max-w-2xl leading-relaxed mx-auto mb-9 text-pretty">
            Chia nhỏ mục tiêu thành khung sườn Multi-Block vững chắc, đối kháng ảo giác AI. Dựng, nối chuỗi, tinh chỉnh và lưu trữ prompt — tất cả trong một workspace.
          </p>

          <div className="flex flex-wrap justify-center gap-3 animate-fade-in mb-16">
            <a
              href="#generate"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-sm font-black transition-all shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 cursor-pointer active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              Tạo Prompt miễn phí
            </a>
            <a
              href="#features"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-panel hover:bg-hover border border-line text-ink rounded-full text-sm font-bold transition-all cursor-pointer active:scale-95"
            >
              Khám phá tính năng
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          <motion.div
            className="relative z-10 w-full"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-faint mb-7">
              Tối ưu cho mọi nền tảng AI hàng đầu
            </p>
            <Suspense fallback={<div className="h-[320px] w-full" />}>
              <AIShowcase3D />
            </Suspense>
          </motion.div>
        </div>
      </section>

      {/* ===================== STATS STRIP ===================== */}
      <section className="w-full px-4 -mt-4">
        <div className="mx-auto max-w-5xl grid grid-cols-2 md:grid-cols-4 gap-4">
          {([
            { value: 3, suffix: '', label: 'Nền tảng AI hàng đầu được tối ưu' },
            { value: 8, suffix: '', label: 'Công cụ trong cùng một workspace' },
            { value: 100, suffix: '%', label: 'Đầu ra theo chuẩn Multi-block' },
            { static: 'Hybrid', label: 'Engine giảm chi phí gọi API' },
          ] as Array<{ value?: number; suffix?: string; static?: string; label: string }>).map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="rounded-2xl bg-panel border border-line p-5 text-center"
            >
              <div className="text-3xl md:text-4xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
                {stat.static ? stat.static : <CountUp to={stat.value!} suffix={stat.suffix} />}
              </div>
              <p className="text-[11px] font-semibold text-muted mt-1.5 leading-snug">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ===================== FEATURES BENTO ===================== */}
      <section id="features" className="w-full px-4 pt-24 pb-8 scroll-mt-20">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl mb-10">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Tính năng</span>
            <h2 className="text-3xl md:text-4xl font-black text-ink tracking-tight mt-2 text-balance">Một workspace, trọn vẹn vòng đời của một prompt</h2>
            <p className="text-sm font-medium text-muted mt-3 leading-relaxed">Từ lúc nảy ra ý tưởng đến khi dựng, nối chuỗi, tinh chỉnh và chia sẻ — mọi công đoạn đều nằm gọn trong một nơi.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {FEATURES.map((f, i) => (
              <motion.button
                key={f.tab}
                onClick={() => onNavigateToTab(f.tab)}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.45, delay: (i % 3) * 0.07 }}
                className={`group ${f.span} text-left`}
              >
                <SpotlightCard className={`h-full bg-panel border border-line rounded-2xl hover:border-emerald-500/40 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300 flex flex-col ${f.featured ? 'p-7 gap-4' : 'p-6 gap-3'}`}>
                  <div className={`flex items-center justify-center shrink-0 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ${f.featured ? 'w-12 h-12' : 'w-10 h-10'}`}>
                    {f.icon}
                  </div>
                  <div>
                    <h3 className={`font-black text-ink tracking-tight mb-1 flex items-center gap-1.5 ${f.featured ? 'text-lg' : 'text-sm'}`}>
                      {f.title}
                      <ArrowRight className="w-3.5 h-3.5 text-emerald-500 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </h3>
                    <p className={`text-muted font-medium leading-relaxed ${f.featured ? 'text-[13px]' : 'text-[11px]'}`}>{f.desc}</p>
                  </div>
                </SpotlightCard>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== TRY IT NOW (GENERATE) ===================== */}
      <section id="generate" className="w-full px-4 pt-20 pb-8 scroll-mt-20">
        <div className="mx-auto max-w-3xl flex flex-col items-center text-center">
          <span className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Thử ngay</span>
          <h2 className="text-3xl md:text-4xl font-black text-ink tracking-tight mt-2 text-balance">Mô tả một câu, nhận về prompt có cấu trúc</h2>
          <p className="text-sm font-medium text-muted mt-3 mb-9 max-w-xl leading-relaxed">Nhập chủ đề bạn đang vướng. AI sẽ phân rã thành các khối Vai trò · Ràng buộc · Định dạng để bạn dùng ngay hoặc mở trong Builder.</p>

          <div className="glow-border w-full rounded-[26px] relative">
            <div className="rounded-[26px] bg-panel border border-line p-3 md:p-4 shadow-xl shadow-emerald-500/5">
              <form onSubmit={handleGeneratePrompt} className="relative flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
                <div className="relative flex-1 flex items-center bg-hover border border-line rounded-full">
                  <Search className="absolute left-4 w-5 h-5 text-faint" />
                  <GhostTextInput
                    type="text"
                    ghostMode="prose"
                    placeholder="Bạn muốn tạo prompt để giải quyết bài toán gì hôm nay?..."
                    value={searchInput}
                    onValueChange={(next) => setSearchInput(next)}
                    disabled={isGenerating}
                    className="w-full pl-12 pr-4 py-4 input-transparent text-ink placeholder-faint focus:outline-none focus:ring-0 text-medium md:text-[15px] font-semibold"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isGenerating || !searchInput.trim()}
                  className="py-3.5 px-6 rounded-full bg-emerald-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-all hover:bg-emerald-600 hover:shadow-lg hover:shadow-emerald-500/30 active:scale-95 disabled:bg-emerald-500/40 disabled:text-white/70 disabled:scale-100 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-pulse" />
                      Đang phân rã...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Tạo Prompt
                    </>
                  )}
                </button>
              </form>

              <div className="mt-4 pt-3 border-t border-line flex flex-wrap gap-2 items-center text-left">
                <span className="text-[11px] font-black text-faint uppercase tracking-widest pl-1">Gợi ý:</span>
                {POPULAR_SUGGESTIONS.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => setSearchInput(suggestion.text)}
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-hover border border-line rounded-xl text-xs text-muted font-semibold hover:border-emerald-500/40 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all cursor-pointer"
                  >
                    <span>{suggestion.icon}</span>
                    <span>{suggestion.text}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Loader */}
          <AnimatePresence>
            {isGenerating && (
              <motion.div
                key="loader"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full max-w-2xl mt-8 bg-panel border border-emerald-500/20 rounded-3xl p-6 text-center shadow-lg overflow-hidden"
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 animate-pulse">
                    <Sparkles className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div className="flex flex-col gap-1.5 w-full">
                    <span className="text-[13px] font-bold text-emerald-600 dark:text-emerald-300 animate-pulse">{steps[generationStep]}</span>
                    <div className="w-48 h-1 bg-hover rounded-full mx-auto overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all duration-1000 ease-out" style={{ width: `${((generationStep + 1) / steps.length) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-faint font-medium">Bố cục Multi-block đang cấu hình cho tối ưu ngữ cảnh</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error */}
          {errorMessage && (
            <div className="w-full max-w-2xl mt-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-600 dark:text-rose-400 text-xs font-semibold text-center flex items-center justify-center gap-2">
              <Info className="w-4 h-4 shrink-0" />
              {errorMessage}
            </div>
          )}

          {/* Output */}
          <AnimatePresence>
            {generatedTemplate && (
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                className="w-full max-w-4xl mt-12 text-left"
              >
                <div className="flex items-center justify-between mb-4 px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-muted uppercase tracking-widest">Kết quả prompt hoàn chỉnh</span>
                  </div>
                  <div className="text-[10px] text-faint font-bold uppercase select-none">AI Generation Engine</div>
                </div>

                <div className="bg-panel border border-line shadow-xl rounded-3xl overflow-hidden relative">
                  <div className="p-6 md:p-8 bg-emerald-500/[0.04] border-b border-line flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="text-xl font-black text-ink tracking-tight flex items-center gap-2">✨ {generatedTemplate.title}</h3>
                      <p className="text-xs font-semibold text-muted leading-relaxed">{generatedTemplate.description}</p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
                          {generatedTemplate.category || 'Mẫu của tôi'}
                        </span>
                        {generatedTemplate.tags?.map((tag: string, index: number) => (
                          <span key={index} className="px-2 py-0.5 bg-hover rounded-md text-[9px] font-bold text-muted">#{tag}</span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:self-center">
                      <button
                        onClick={handleCopyPrompt}
                        className="px-3.5 py-2 rounded-xl bg-hover text-muted hover:text-ink border border-line font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                        title="Sao chép toàn bộ"
                      >
                        {textCopied ? (
                          <><Check className="w-3.5 h-3.5 text-emerald-500" /> Đã chép</>
                        ) : (
                          <><Copy className="w-3.5 h-3.5 text-emerald-500" /> Sao chép</>
                        )}
                      </button>

                      <button
                        onClick={handleSaveToLibrary}
                        disabled={isSaved || saveLoading}
                        className={`px-3.5 py-2 rounded-xl font-extrabold text-xs flex items-center gap-1.5 border transition-all cursor-pointer active:scale-95 ${
                          isSaved
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        }`}
                      >
                        {isSaved ? (
                          <><CheckCircle className="w-3.5 h-3.5" /> Đã lưu</>
                        ) : (
                          <><Bookmark className="w-3.5 h-3.5" /> {saveLoading ? 'Đang lưu...' : 'Lưu kết quả'}</>
                        )}
                      </button>

                      <button
                        onClick={() => onSelectTemplate(generatedTemplate)}
                        className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-sm shadow-emerald-500/30 hover:shadow-md transition-all cursor-pointer active:scale-95"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Mở trong Builder
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-line bg-panel">
                    {generatedTemplate.blocks?.map((block: any) => (
                      <div key={block.id} className="p-5 md:p-6 flex flex-col md:flex-row gap-4 md:items-start hover:bg-hover/60 transition-colors">
                        <div className="w-full md:w-44 shrink-0 flex items-center gap-1.5 md:flex-col md:items-stretch">
                          <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 font-mono uppercase tracking-widest py-0.5 bg-emerald-500/10 border border-emerald-500/20 px-2 rounded-md self-start">
                            {block.type}
                          </span>
                          <h4 className="text-xs font-black text-ink tracking-tight">{block.title}</h4>
                        </div>
                        <div className="flex-1 bg-hover border border-line p-4 rounded-xl font-mono text-[11px] md:text-xs text-muted whitespace-pre-wrap leading-relaxed">
                          {block.content}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-hover/50 border-t border-line flex items-center gap-2 text-[10px] text-faint font-semibold px-6">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    Nhấn "Mở trong Builder" để tách nhỏ biến số, thêm khối tư duy mới, hay chỉnh giọng AI một cách chuyên nghiệp nhất.
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ===================== HOW IT WORKS ===================== */}
      <section id="how" className="w-full px-4 pt-24 pb-8 scroll-mt-20">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl mb-10">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Quy trình</span>
            <h2 className="text-3xl md:text-4xl font-black text-ink tracking-tight mt-2 text-balance">Ba khối tư duy làm nên một prompt vững chắc</h2>
          </div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
            variants={{ show: { transition: { staggerChildren: 0.12 } } }}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
          >
            {[
              { num: '01', icon: <Layers className="w-5 h-5" />, title: 'Khối Đóng vai', sub: 'Role & Objectives', desc: 'Xác lập lập luận, kỹ năng và kinh nghiệm đỉnh cao của AI để định vị hướng giải quyết chính xác.' },
              { num: '02', icon: <CheckCircle className="w-5 h-5" />, title: 'Khối Ràng buộc', sub: 'Rules & Constraints', desc: 'Chỉ định khắt khe những điều không được làm, triệt tiêu câu chữ sáo rỗng và ảo giác AI.' },
              { num: '03', icon: <Compass className="w-5 h-5" />, title: 'Khối Định dạng', sub: 'Format & Output', desc: 'Sắp đặt cấu trúc trình bày: bảng, kịch bản, code hay XML rõ nét, thuận tiện sao chép.' }
            ].map((item, idx) => (
              <motion.div
                key={idx}
                variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } }}
              >
                <SpotlightCard className="h-full bg-panel border border-line p-6 rounded-2xl hover:border-emerald-500/40 transition-all flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">{item.icon}</div>
                    <span className="text-3xl font-black text-line tabular-nums">{item.num}</span>
                  </div>
                  <div>
                    <h3 className="text-base font-black text-ink tracking-tight">{item.title}</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-2">{item.sub}</p>
                    <p className="text-[12px] text-muted font-medium leading-relaxed">{item.desc}</p>
                  </div>
                </SpotlightCard>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===================== CLOSING CTA ===================== */}
      <section className="w-full px-4 pt-20 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-6xl relative overflow-hidden rounded-[28px] border border-emerald-500/20 bg-emerald-500/[0.06] px-6 py-14 md:px-12 md:py-20 text-center"
        >
          <div className="absolute inset-0 hero-spotlight opacity-80 pointer-events-none" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/30">
              <Zap className="w-6 h-6" />
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-ink tracking-tight max-w-2xl leading-[1.1] text-balance">
              Sẵn sàng dựng prompt <span className="text-aurora-sweep">tốt hơn</span> ngay hôm nay?
            </h2>
            <p className="text-sm font-medium text-muted mt-4 max-w-xl">Bắt đầu với một câu mô tả, hoặc tự tay dựng từng khối trong Prompt Builder. Bạn toàn quyền kiểm soát.</p>
            <div className="flex flex-wrap justify-center gap-3 mt-8">
              <button
                onClick={onNavigateToBuilder}
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-sm font-black transition-all shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 cursor-pointer active:scale-95"
              >
                <Briefcase className="w-4 h-4" />
                Mở Prompt Builder
              </button>
              <a
                href="#generate"
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-panel hover:bg-hover border border-line text-ink rounded-full text-sm font-bold transition-all cursor-pointer active:scale-95"
              >
                Tạo nhanh bằng AI
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="w-full border-t border-line/60">
        <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-xs font-bold text-white">P</div>
            <span className="text-sm font-bold tracking-tight text-ink">Prompt<span className="text-emerald-500">Builder</span></span>
          </div>
          <p className="text-[11px] font-semibold text-faint uppercase tracking-widest">© 2026 PromptBuilder Org • Thân thiện • Hiện đại</p>
        </div>
      </footer>
    </div>
  );
}
