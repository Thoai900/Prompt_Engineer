import { toast } from '../common/Toaster';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'motion/react';
import {
  Search, Copy, Check, ArrowRight, Bookmark, Loader2,
  Briefcase, CheckCircle, Compass, Info, Edit3, Layers,
  Workflow, Library, GraduationCap, Moon, Sun
} from 'lucide-react';
// aiService kéo theo @google/genai (~280KB). Import động khi người dùng thực sự
// bấm "Tạo prompt" để không nặng tải khởi động của trang chủ.
import { TabType } from '../../types';
import { GhostTextInput } from '../common/GhostTextInput';

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
  { tab: 'studio', title: 'Prompt Studio', desc: 'Đi từ ý tưởng đến prompt hoàn chỉnh, hoặc dán prompt thô để tăng cường nhanh.', icon: <Edit3 className="w-5 h-5" />, span: 'md:col-span-3' },
  { tab: 'library', title: 'Thư viện', desc: 'Mẫu prompt, rule, skill và cấu hình LLM tái sử dụng — kho cộng đồng và của riêng bạn, đồng bộ đám mây.', icon: <Library className="w-5 h-5" />, span: 'md:col-span-3' },
  { tab: 'learn', title: 'Learn', desc: 'Lộ trình học prompt engineering từ nền tảng tới nâng cao.', icon: <GraduationCap className="w-5 h-5" />, span: 'md:col-span-6' },
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
    <div className="text-ink w-full h-full overflow-x-hidden overflow-y-auto custom-scrollbar font-sans selection:bg-emerald-500/20 relative flex flex-col scroll-smooth">

      {/* ===================== TOP NAV ===================== */}
      <header className="sticky top-0 z-50 w-full border-b border-glass-edge glass-2">
        <nav className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <button onClick={() => onNavigateToTab('home')} className="flex items-center gap-2.5 cursor-pointer">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">P</div>
            <span className="text-base font-semibold tracking-tight text-ink">PromptBuilder</span>
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
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button
              onClick={onNavigateToBuilder}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-semibold transition-colors cursor-pointer"
            >
              Vào ứng dụng
              <ArrowRight size={15} />
            </button>
          </div>
        </nav>
      </header>

      {/* ===================== HERO ===================== */}
      <section className="relative w-full shrink-0">
        <div className="mx-auto max-w-5xl px-4 pt-14 pb-16 md:pt-20 md:pb-20 flex flex-col items-center text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-ink tracking-tight leading-[1.15] mb-5 max-w-3xl text-balance">
            Biến ý tưởng mơ hồ thành prompt cấp chuyên gia
          </h1>

          <p className="text-base md:text-lg text-muted max-w-2xl leading-relaxed mx-auto mb-8 text-pretty">
            Chia nhỏ mục tiêu thành khung sườn Multi-Block vững chắc, đối kháng ảo giác AI. Dựng, nối chuỗi, tinh chỉnh và lưu trữ prompt — tất cả trong một workspace.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mb-12">
            <a
              href="#generate"
              className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer"
            >
              Tạo prompt miễn phí
            </a>
            <a
              href="#features"
              className="inline-flex items-center gap-2 px-5 py-3 bg-panel hover:bg-hover border border-line text-ink rounded-lg text-sm font-semibold transition-colors cursor-pointer"
            >
              Khám phá tính năng
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Ảnh chụp giao diện thật (Prompt Graph) — thay cho khối 3D trang trí. */}
          <img
            src={theme === 'dark' ? '/screenshots/app-dark.webp' : '/screenshots/app-light.webp'}
            alt="Giao diện PromptBuilder: Prompt Graph nối các khối Vai trò, Định dạng, Giọng điệu, Ràng buộc vào Prompt gốc"
            width={2160}
            height={1284}
            className="hidden sm:block w-full h-auto rounded-xl border border-line shadow-sm"
          />
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
              className="rounded-2xl glass-1 border border-glass-edge p-5 text-center"
            >
              <div className="text-3xl md:text-4xl font-bold tracking-tight text-ink tabular-nums">
                {stat.static ? stat.static : <CountUp to={stat.value!} suffix={stat.suffix} />}
              </div>
              <p className="text-sm text-muted mt-1.5 leading-snug">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ===================== FEATURES BENTO ===================== */}
      <section id="features" className="w-full px-4 pt-24 pb-8 scroll-mt-20">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl mb-10">
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Tính năng</span>
            <h2 className="text-2xl md:text-3xl font-bold text-ink tracking-tight mt-2 text-balance">Một workspace, trọn vẹn vòng đời của một prompt</h2>
            <p className="text-base text-muted mt-3 leading-relaxed">Từ lúc nảy ra ý tưởng đến khi dựng, nối chuỗi, tinh chỉnh và chia sẻ — mọi công đoạn đều nằm gọn trong một nơi.</p>
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
                <div className={`h-full bg-panel border border-line rounded-xl hover:border-emerald-600/50 transition-colors flex flex-col ${f.featured ? 'p-6 gap-4' : 'p-5 gap-3'}`}>
                  <div className="flex items-center justify-center shrink-0 rounded-lg bg-hover text-muted w-10 h-10">
                    {f.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink mb-1 flex items-center gap-1.5 text-base">
                      {f.title}
                      <ArrowRight className="w-4 h-4 text-faint group-hover:text-emerald-600 transition-colors" />
                    </h3>
                    <p className="text-sm text-muted leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== TRY IT NOW (GENERATE) ===================== */}
      <section id="generate" className="w-full px-4 pt-20 pb-8 scroll-mt-20">
        <div className="mx-auto max-w-3xl flex flex-col items-center text-center">
          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Thử ngay</span>
          <h2 className="text-2xl md:text-3xl font-bold text-ink tracking-tight mt-2 text-balance">Mô tả một câu, nhận về prompt có cấu trúc</h2>
          <p className="text-base text-muted mt-3 mb-8 max-w-xl leading-relaxed">Nhập chủ đề bạn đang vướng. AI sẽ phân rã thành các khối Vai trò · Ràng buộc · Định dạng để bạn dùng ngay hoặc mở trong Builder.</p>

          <div className="w-full">
            <div className="rounded-xl glass-1 border border-glass-edge p-3 md:p-4">
              <form onSubmit={handleGeneratePrompt} className="relative flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
                <div className="relative flex-1 flex items-center bg-hover border border-line rounded-lg">
                  <Search className="absolute left-4 w-5 h-5 text-faint" />
                  <GhostTextInput
                    type="text"
                    ghostMode="prose"
                    placeholder="Bạn muốn tạo prompt để giải quyết bài toán gì hôm nay?..."
                    value={searchInput}
                    onValueChange={(next) => setSearchInput(next)}
                    disabled={isGenerating}
                    className="w-full pl-12 pr-4 py-3.5 input-transparent text-ink placeholder-faint focus:outline-none focus:ring-0 text-base"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isGenerating || !searchInput.trim()}
                  className="py-3 px-5 rounded-lg bg-emerald-600 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors hover:bg-emerald-700 disabled:bg-emerald-600/40 disabled:text-white/80 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang tạo...
                    </>
                  ) : (
                    <>Tạo prompt</>
                  )}
                </button>
              </form>

              <div className="mt-4 pt-3 border-t border-line flex flex-wrap gap-2 items-center text-left">
                <span className="text-sm font-medium text-muted pl-1">Gợi ý:</span>
                {POPULAR_SUGGESTIONS.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => setSearchInput(suggestion.text)}
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-hover border border-line rounded-lg text-sm text-muted hover:border-emerald-600/50 hover:text-ink transition-colors cursor-pointer"
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
                className="w-full max-w-2xl mt-8 bg-panel border border-line rounded-xl p-6 text-center overflow-hidden"
              >
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                  <div className="flex flex-col gap-1.5 w-full">
                    <span className="text-sm font-medium text-ink">{steps[generationStep]}</span>
                    <div className="w-48 h-1 bg-hover rounded-full mx-auto overflow-hidden">
                      <div className="h-full bg-emerald-600 transition-all duration-1000 ease-out" style={{ width: `${((generationStep + 1) / steps.length) * 100}%` }} />
                    </div>
                    <span className="text-xs text-muted">Bố cục Multi-block đang cấu hình cho tối ưu ngữ cảnh</span>
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
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-ink">Kết quả prompt hoàn chỉnh</span>
                  </div>
                </div>

                <div className="bg-panel border border-line rounded-xl overflow-hidden relative">
                  <div className="p-5 md:p-6 border-b border-line flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-ink tracking-tight">{generatedTemplate.title}</h3>
                      <p className="text-sm text-muted leading-relaxed">{generatedTemplate.description}</p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="px-2 py-0.5 bg-emerald-600/10 rounded-md text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          {generatedTemplate.category || 'Mẫu của tôi'}
                        </span>
                        {generatedTemplate.tags?.map((tag: string, index: number) => (
                          <span key={index} className="px-2 py-0.5 bg-hover rounded-md text-xs text-muted">#{tag}</span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:self-center">
                      <button
                        onClick={handleCopyPrompt}
                        className="px-3.5 py-2 rounded-lg bg-panel text-ink hover:bg-hover border border-line font-medium text-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Sao chép toàn bộ"
                      >
                        {textCopied ? (
                          <><Check className="w-4 h-4 text-emerald-600" /> Đã chép</>
                        ) : (
                          <><Copy className="w-4 h-4" /> Sao chép</>
                        )}
                      </button>

                      <button
                        onClick={handleSaveToLibrary}
                        disabled={isSaved || saveLoading}
                        className="px-3.5 py-2 rounded-lg font-medium text-sm flex items-center gap-1.5 border border-line bg-panel text-ink hover:bg-hover transition-colors cursor-pointer disabled:cursor-default"
                      >
                        {isSaved ? (
                          <><CheckCircle className="w-4 h-4 text-emerald-600" /> Đã lưu</>
                        ) : (
                          <><Bookmark className="w-4 h-4" /> {saveLoading ? 'Đang lưu...' : 'Lưu kết quả'}</>
                        )}
                      </button>

                      <button
                        onClick={() => onSelectTemplate(generatedTemplate)}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                        Mở trong Builder
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-line bg-panel">
                    {generatedTemplate.blocks?.map((block: any) => (
                      <div key={block.id} className="p-5 md:p-6 flex flex-col md:flex-row gap-4 md:items-start hover:bg-hover/60 transition-colors">
                        <div className="w-full md:w-44 shrink-0 flex items-center gap-1.5 md:flex-col md:items-stretch">
                          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 font-mono py-0.5 bg-emerald-600/10 px-2 rounded-md self-start">
                            {block.type}
                          </span>
                          <h4 className="text-sm font-semibold text-ink">{block.title}</h4>
                        </div>
                        <div className="flex-1 bg-hover border border-line p-4 rounded-xl font-mono text-xs md:text-sm text-ink whitespace-pre-wrap leading-relaxed">
                          {block.content}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-hover/50 border-t border-line flex items-center gap-2 text-sm text-muted px-6">
                    <Info className="w-4 h-4 shrink-0" />
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
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Quy trình</span>
            <h2 className="text-2xl md:text-3xl font-bold text-ink tracking-tight mt-2 text-balance">Ba khối tư duy làm nên một prompt vững chắc</h2>
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
                <div className="h-full bg-panel border border-line p-6 rounded-xl flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-lg bg-hover text-muted flex items-center justify-center shrink-0">{item.icon}</div>
                    <span className="text-sm font-semibold text-faint tabular-nums">{item.num}</span>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-ink">{item.title}</h3>
                    <p className="text-sm text-muted mb-2">{item.sub}</p>
                    <p className="text-sm text-muted leading-relaxed">{item.desc}</p>
                  </div>
                </div>
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
          className="mx-auto max-w-6xl rounded-xl border border-glass-edge glass-1 px-6 py-12 md:px-12 md:py-16 text-center"
        >
          <div className="flex flex-col items-center">
            <h2 className="text-2xl md:text-4xl font-bold text-ink tracking-tight max-w-2xl leading-[1.15] text-balance">
              Sẵn sàng dựng prompt tốt hơn ngay hôm nay?
            </h2>
            <p className="text-base text-muted mt-4 max-w-xl">Bắt đầu với một câu mô tả, hoặc tự tay dựng từng khối trong Prompt Builder. Bạn toàn quyền kiểm soát.</p>
            <div className="flex flex-wrap justify-center gap-3 mt-8">
              <button
                onClick={onNavigateToBuilder}
                className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer"
              >
                <Briefcase className="w-4 h-4" />
                Mở Prompt Builder
              </button>
              <a
                href="#generate"
                className="inline-flex items-center gap-2 px-5 py-3 bg-panel hover:bg-hover border border-line text-ink rounded-lg text-sm font-semibold transition-colors cursor-pointer"
              >
                Tạo nhanh bằng AI
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="w-full border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white">P</div>
            <span className="text-sm font-semibold tracking-tight text-ink">PromptBuilder</span>
          </div>
          <p className="text-sm text-muted">© 2026 PromptBuilder</p>
        </div>
      </footer>
    </div>
  );
}
