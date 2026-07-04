import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity, Bot, Check, ChevronRight, Copy, Info, Newspaper, RefreshCw, Search, X,
} from 'lucide-react';
import { generateLatestAiNews, AiNewsItem } from '../../services/aiService';

/**
 * Bản tin AI (M3: tách nguyên khối "SECTION 2 — LIVE AI NEWS TERMINAL" + modal chi tiết
 * khỏi AIFutureTab 1.600 dòng). Tự chứa hoàn toàn: state, nạp/cache tin, lọc, modal.
 * Giao diện + hành vi giữ NGUYÊN so với bản nằm trong AIFutureTab.
 */
export default function AiNewsSection() {
  const [newsItems, setNewsItems] = useState<AiNewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [newsSearch, setNewsSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'models' | 'technology' | 'policy' | 'society'>('all');
  const [selectedImpact, setSelectedImpact] = useState<'all' | 'High' | 'Medium' | 'Low'>('all');
  const [activeNewsDetail, setActiveNewsDetail] = useState<AiNewsItem | null>(null);
  const [newsCopied, setNewsCopied] = useState<string | null>(null);
  const [agentLogs, setAgentLogs] = useState<string[]>([]);

  // Load News on Mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem('mentor_ai_news_cache');
      if (cached) {
        setNewsItems(JSON.parse(cached));
      }
    } catch (e) {
      console.error("Failed to parse cached news:", e);
    }
    loadNews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const simulateLogs = async () => {
    const logs = [
      "📡 Đang kết nối tới trạm dữ liệu AI toàn cầu...",
      "🔍 Quét các trang tin công nghệ và AI Press Hub...",
      "⚙️ Đang xử lý dữ liệu qua mô hình gemini-2.5-flash...",
      "📝 Tổng hợp tóm tắt bản tin và đánh giá chỉ số ảnh hưởng...",
      "✅ Hoàn tất! Đã cập nhật bản tin AI mới nhất."
    ];
    setAgentLogs([]);
    for (let i = 0; i < logs.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      setAgentLogs(prev => [...prev, logs[i]]);
    }
  };

  const loadNews = async () => {
    setNewsLoading(true);
    setNewsError(null);
    const logPromise = simulateLogs();

    try {
      const items = await generateLatestAiNews();
      await logPromise;
      if (items && items.length > 0) {
        setNewsItems(items);
        localStorage.setItem('mentor_ai_news_cache', JSON.stringify(items));
      } else {
        const cached = localStorage.getItem('mentor_ai_news_cache');
        if (cached) {
          setNewsItems(JSON.parse(cached));
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch latest AI news:", err);
      setNewsError(err.message || String(err));
      const cached = localStorage.getItem('mentor_ai_news_cache');
      if (cached) {
        try {
          setNewsItems(JSON.parse(cached));
        } catch (e) { /* cache hỏng — bỏ qua */ }
      }
    } finally {
      setNewsLoading(false);
    }
  };

  // Utility copy helper for news item
  const handleCopyNews = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setNewsCopied(id);
    setTimeout(() => setNewsCopied(null), 2000);
  };

  // Filters calculation
  const filteredNews = newsItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(newsSearch.toLowerCase()) ||
                          item.summary.toLowerCase().includes(newsSearch.toLowerCase()) ||
                          item.source.toLowerCase().includes(newsSearch.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesImpact = selectedImpact === 'all' || item.impactLevel === selectedImpact;
    return matchesSearch && matchesCategory && matchesImpact;
  });

  return (
    <>
        {/* SECTION 2: LIVE AI NEWS TERMINAL */}
        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-md mb-12 shadow-sm dark:shadow-none">

          {/* Header Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/15 pb-6 mb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Newspaper className="text-emerald-500 dark:text-emerald-400" size={20} />
                <h2 className="text-2xl font-bold text-slate-850 dark:text-white">Bản Tin Trí Tuệ Nhân Tạo 2026</h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                AI Agent quét thông tin, dịch thuật và tổng hợp bản tin công nghệ thời gian thực bằng mô hình <strong className="text-indigo-650 dark:text-indigo-300">gemini-2.5-flash</strong>.
              </p>
            </div>

            <button
              onClick={loadNews}
              disabled={newsLoading}
              className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-2 shadow-md ${
                newsLoading
                  ? 'bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-white/5 cursor-not-allowed text-slate-400 dark:text-slate-500'
                  : 'bg-emerald-600 hover:bg-emerald-500 cursor-pointer shadow-emerald-950/20'
              }`}
            >
              <RefreshCw size={14} className={newsLoading ? 'animate-pulse text-emerald-500' : ''} />
              {newsLoading ? 'Đang nạp tin tức AI...' : 'Làm mới tin tức'}
            </button>
          </div>

          {newsError && (
            <div className="mb-6 p-4 rounded-2xl border border-amber-250 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-400 flex items-center gap-2 shadow-xs">
              <Info size={14} className="shrink-0 text-amber-600 dark:text-amber-500" />
              <span>Không thể kết nối đến máy chủ tin tức AI (mô hình đang quá tải hoặc hết lượt gọi). Đang hiển thị bản tin cũ được lưu từ bộ nhớ tạm.</span>
            </div>
          )}

          {/* Filtering and Searching Bar */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-8 bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-200 dark:border-white/5">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-2.5 text-slate-400 dark:text-slate-500" size={16} />
              <input
                type="text"
                placeholder="Tìm kiếm nội dung tin tức..."
                value={newsSearch}
                onChange={(e) => setNewsSearch(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/15 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="flex bg-white dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-white/5">
                {[
                  { id: 'all', name: 'Tất cả' },
                  { id: 'models', name: 'Mô hình AI' },
                  { id: 'technology', name: 'Công nghệ' },
                  { id: 'policy', name: 'Luật lệ' },
                  { id: 'society', name: 'Xã hội' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedCategory === cat.id ? 'bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              <div className="flex bg-white dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-white/5">
                {[
                  { id: 'all', name: 'Mức tác động' },
                  { id: 'High', name: 'Cao 🔥' },
                  { id: 'Medium', name: 'Trung bình' }
                ].map(imp => (
                  <button
                    key={imp.id}
                    onClick={() => setSelectedImpact(imp.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedImpact === imp.id ? 'bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {imp.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grid list display */}
          {newsLoading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-6">
              {/* Futuristic logs printing loader */}
              <div className="w-full max-w-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-white/5 rounded-2xl p-5 font-mono text-[11px] text-emerald-650 dark:text-emerald-400/80 space-y-2 shadow-inner">
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/5 pb-2 text-slate-400 dark:text-slate-500 mb-2">
                  <Activity size={12} className="animate-pulse" />
                  <span>AI AGENT LIVE PARSING SHELL</span>
                </div>
                {agentLogs.map((log, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="leading-relaxed"
                  >
                    {log}
                  </motion.div>
                ))}
                <div className="w-1.5 h-3.5 bg-emerald-650 dark:bg-emerald-400 animate-pulse inline-block mt-2"></div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">Mô hình AI đang tổng hợp các bài viết...</p>
            </div>
          ) : filteredNews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredNews.map((news) => {
                let categoryColor = "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-205 dark:border-blue-500/20";
                let categoryLabel = "Mô hình";
                if (news.category === 'technology') { categoryColor = "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-205 dark:border-purple-500/20"; categoryLabel = "Công nghệ"; }
                else if (news.category === 'policy') { categoryColor = "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-205 dark:border-amber-500/20"; categoryLabel = "Chính sách"; }
                else if (news.category === 'society') { categoryColor = "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-205 dark:border-rose-500/20"; categoryLabel = "Xã hội"; }

                const isHigh = news.impactLevel === 'High';

                return (
                  <motion.div
                    key={news.id}
                    layoutId={news.id}
                    className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15 rounded-2xl p-5 flex flex-col justify-between transition-all group hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-950/5 relative overflow-hidden"
                  >
                    {isHigh && (
                      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-red-500 to-amber-500"></div>
                    )}

                    <div className="space-y-3">
                      {/* Top tags */}
                      <div className="flex justify-between items-center">
                        <span className={`text-[10px] uppercase px-2 py-0.5 font-bold rounded-lg border ${categoryColor}`}>
                          {categoryLabel}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">{news.date}</span>
                          <span className={`w-1.5 h-1.5 rounded-full ${isHigh ? 'bg-red-500 animate-pulse' : 'bg-slate-405 dark:bg-slate-500'}`}></span>
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="font-bold text-sm text-slate-850 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors leading-snug">
                        {news.title}
                      </h3>

                      {/* Summary snippet */}
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3">
                        {news.summary}
                      </p>
                    </div>

                    {/* Card Footer action */}
                    <div className="border-t border-slate-150 dark:border-white/5 pt-4 mt-4 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-medium">Nguồn: {news.source}</span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopyNews(news.id, `${news.title}\n\n${news.summary}`)}
                          className="p-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                          title="Sao chép tóm tắt"
                        >
                          {newsCopied === news.id ? <Check size={12} className="text-emerald-500 dark:text-emerald-400" /> : <Copy size={12} />}
                        </button>
                        <button
                          onClick={() => setActiveNewsDetail(news)}
                          className="px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-600/10 hover:bg-indigo-650 dark:hover:bg-indigo-600 text-indigo-600 dark:text-indigo-300 hover:text-white dark:hover:text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
                        >
                          Xem phân tích <ChevronRight size={10} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Newspaper className="mx-auto text-slate-400 dark:text-slate-600 mb-2" size={32} />
              <p className="text-xs text-slate-500 dark:text-slate-400">Không tìm thấy bản tin nào khớp với điều kiện lọc.</p>
            </div>
          )}
        </div>

      {/* DETAIL OVERLAY MODAL */}
      <AnimatePresence>
        {activeNewsDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveNewsDetail(null)}
              className="absolute inset-0 bg-slate-950/40 dark:bg-slate-950/80 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl bg-white dark:bg-[#0d0e15] border border-slate-200 dark:border-white/10 rounded-3xl p-6 md:p-8 relative z-10 shadow-2xl flex flex-col max-h-[85vh] overflow-y-auto custom-scrollbar"
            >
              {/* Close Button */}
              <button
                onClick={() => setActiveNewsDetail(null)}
                aria-label="Đóng phân tích tin tức"
                className="absolute top-6 right-6 p-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
              >
                <X size={16} />
              </button>

              {/* Category & Date */}
              <div className="flex items-center gap-2.5 mb-4">
                <span className="text-[10px] uppercase px-2 py-0.5 font-bold rounded-lg border bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20">
                  {activeNewsDetail.category}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{activeNewsDetail.date}</span>
                <span className="text-xs text-slate-500">• Nguồn: {activeNewsDetail.source}</span>
              </div>

              {/* Title */}
              <h2 className="text-xl md:text-2xl font-bold mb-4 text-slate-900 dark:text-white leading-snug">
                {activeNewsDetail.title}
              </h2>

              {/* Core Content */}
              <div className="space-y-6 text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 space-y-1">
                  <h4 className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase">Tóm tắt nội dung</h4>
                  <p>{activeNewsDetail.summary}</p>
                </div>

                {/* AI Analysis section */}
                <div className="space-y-4 border-t border-slate-100 dark:border-white/5 pt-4">
                  <h3 className="text-base font-bold flex items-center gap-2 text-indigo-650 dark:text-indigo-300">
                    <Bot size={18} /> Phân Tích Độc Quyền bởi AI Agent
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-white/5 space-y-1">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Mức độ ảnh hưởng</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {activeNewsDetail.impactLevel === 'High'
                          ? '🔥 Tác động cực kỳ lớn: Làm thay đổi lộ trình công nghệ hiện có, thúc đẩy nâng cấp hạ tầng mã nguồn rộng rãi.'
                          : '⚡ Tác động trung bình: Cải tiến hiệu quả làm việc hiện tại, mở ra các tính năng bổ trợ hữu ích.'}
                      </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-white/5 space-y-1">
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Khuyến nghị cho Prompt Engineer</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Nên thử nghiệm lập cấu hình bộ nhớ LLM (Memory) hoặc thiết lập System Instructions tương thích với cải tiến mới này để đón đầu hiệu năng.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-slate-100 dark:border-white/5 pt-6 mt-8 flex justify-end gap-3">
                <button
                  onClick={() => handleCopyNews(activeNewsDetail.id, `${activeNewsDetail.title}\n\n${activeNewsDetail.summary}`)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white transition-all flex items-center gap-1.5"
                >
                  {newsCopied === activeNewsDetail.id ? <Check size={14} className="text-emerald-500 dark:text-emerald-400" /> : <Copy size={14} />}
                  Sao chép bản tin
                </button>
                <button
                  onClick={() => setActiveNewsDetail(null)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white transition-all"
                >
                  Đóng phân tích
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
