import { ComponentType } from 'react';
import { PromptTemplate } from '../../types';
import { detectFrameworkName } from '../../utils/libraryUtils';
import { getShowcase, ShowcaseOutputType } from '../../data/templateShowcase';
import { Bookmark, Copy, Users, CheckCircle, Layout, FileText, Code2, Video, GitMerge, GraduationCap, Share2, FolderPlus, ArrowDown, Target, Clock } from 'lucide-react';

interface PromptCardProps {
  template: PromptTemplate;
  onSelect: (template: PromptTemplate) => void;
  onRemix?: (template: PromptTemplate) => void;
  onPreview?: (template: PromptTemplate) => void;
  isSaved?: boolean;
  onToggleSave?: (template: PromptTemplate) => void;
  onShare?: (template: PromptTemplate) => void;
  onAddToCollection?: (template: PromptTemplate) => void;
  /** Số bộ sưu tập đang chứa template — hiện đốm chỉ báo trên nút thư mục. */
  collectionCount?: number;
}

const OUTPUT_TYPE_ICON: Record<ShowcaseOutputType, ComponentType<{ className?: string }>> = {
  code: Code2,
  video: Video,
  mindmap: GitMerge,
  tutor: GraduationCap,
  text: FileText,
  ui: Layout,
};

export default function PromptCard({ template, onSelect, onRemix, onPreview, isSaved, onToggleSave, onShare, onAddToCollection, collectionCount = 0 }: PromptCardProps) {
  const metrics = template.metrics || { usageCount: 0, upvotes: 0, likes: 0, saves: 0 };
  const getAvatarFallback = (name: string) => name ? name.charAt(0).toUpperCase() : '?';
  const fw = detectFrameworkName(template);

  // Đợt 4 — "bán giá trị": hiện trước→sau THẬT + câu chốt lợi ích (getShowcase).
  const showcase = getShowcase(template);
  const OutIcon = OUTPUT_TYPE_ICON[showcase.outputType] || FileText;
  const isCode = showcase.outputType === 'code';

  return (
    <div className="group bg-white rounded-3xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-lg transition-all relative flex flex-col min-h-[400px] overflow-hidden">
      {/* Vùng kết quả — Phương án A: Bạn nhập → Kết quả mẫu (thật) */}
      {showcase.hasResult ? (
        <div
          onClick={() => onPreview?.(template)}
          className="border-b border-slate-100 bg-slate-50 p-4 cursor-pointer flex flex-col gap-2 shrink-0"
          title="Xem kết quả mẫu đầy đủ"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-slate-500">
              <OutIcon className="w-3 h-3 text-indigo-500" /> Kết quả mẫu
            </span>
            <span className="text-[9px] font-bold text-slate-400 group-hover:text-indigo-500 transition-colors">Xem đầy đủ →</span>
          </div>

          {showcase.input && (
            <>
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Bạn nhập</div>
              <div className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-700 leading-snug line-clamp-2">
                {showcase.input}
              </div>
              <div className="flex justify-center text-slate-300">
                <ArrowDown className="w-3.5 h-3.5" />
              </div>
            </>
          )}

          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Kết quả AI</div>
          <div
            className={`rounded-lg px-2.5 py-2 leading-snug whitespace-pre-line line-clamp-4 overflow-hidden ${
              isCode
                ? 'bg-[#0B0E14] border border-slate-800 text-[#A9B2C3] font-mono text-[10px]'
                : 'bg-white border border-slate-200 text-slate-600 text-[11px]'
            }`}
          >
            {showcase.output}
          </div>
        </div>
      ) : (
        <div className="border-b border-slate-100 bg-slate-50 h-[120px] flex flex-col items-center justify-center gap-2 shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shadow-sm">
            <FileText className="w-6 h-6 text-slate-300" />
          </div>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">
            <Clock className="w-3 h-3" /> Kết quả mẫu sẽ bổ sung sau
          </span>
        </div>
      )}

      {/* Nội dung */}
      <div className="flex-1 flex flex-col p-5 bg-white">
        {/* Tác giả */}
        <div className="flex items-center justify-between mb-2.5 shrink-0">
          <div className="flex items-center gap-2">
            {template.authorAvatar ? (
              <img src={template.authorAvatar} alt={template.authorName || 'Author'} className="w-6 h-6 rounded-full object-cover border border-slate-100 shadow-sm" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shadow-sm">
                {getAvatarFallback(template.authorName || 'Anonymous')}
              </div>
            )}
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold text-slate-700">{template.authorName || 'Anonymous'}</span>
              {template.isVerified && <CheckCircle className="w-3 h-3 text-blue-500" />}
            </div>
          </div>
          {template.category && (
            <span className="bg-slate-50 border border-slate-100 text-slate-500 text-[9px] font-bold px-2 py-1 rounded-lg whitespace-nowrap">
              {template.category.toUpperCase()}
            </span>
          )}
        </div>

        <div onClick={() => onSelect(template)} className="cursor-pointer flex-1 flex flex-col min-h-0">
          <h3 className="text-lg font-bold text-slate-900 line-clamp-1 mb-1.5 group-hover:text-indigo-600 transition-colors shrink-0">{template.title}</h3>

          {/* Câu chốt lợi ích (hook) — hoặc mô tả khi chưa có hook */}
          {showcase.hook ? (
            <div className="flex items-start gap-1.5 text-[13px] font-bold text-indigo-600 leading-snug mb-2 shrink-0">
              <Target className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="line-clamp-2">{showcase.hook}</span>
            </div>
          ) : (
            <p className="text-xs text-slate-500 mb-2 line-clamp-2 leading-relaxed shrink-0">{template.description}</p>
          )}

          <div className="flex-1 min-h-0 overflow-hidden">
            <div className="flex flex-wrap gap-1.5 content-start pb-1">
              {fw && (
                <span className="text-[10px] font-bold px-2 py-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md">
                  Khung {fw}
                </span>
              )}
              {(template.tags || []).slice(0, fw ? 3 : 4).map(tag => (
                <span key={tag} className="text-[10px] font-semibold px-2 py-1 bg-slate-50 text-slate-600 border border-slate-100 rounded-md">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 text-slate-400">
            <div className="flex items-center gap-1" title="Lượt dùng">
              <Users className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">{metrics.usageCount || 0}</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSave?.(template); }}
              aria-pressed={!!isSaved}
              aria-label={isSaved ? 'Bỏ lưu' : 'Lưu vào bộ sưu tập của bạn'}
              className={`flex items-center gap-1 transition-colors ${isSaved ? 'text-indigo-600' : 'cursor-pointer hover:text-indigo-500'}`}
              title={isSaved ? 'Bỏ lưu' : 'Lưu vào bộ sưu tập của bạn'}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
              <span className="text-xs font-semibold">{isSaved ? 'Đã lưu' : 'Lưu'}</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onShare?.(template); }}
              aria-label="Chia sẻ liên kết"
              className="flex items-center gap-1 cursor-pointer hover:text-emerald-500 transition-colors"
              title="Chia sẻ liên kết"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
            {onAddToCollection && (
              <button
                onClick={(e) => { e.stopPropagation(); onAddToCollection(template); }}
                aria-label="Thêm vào bộ sưu tập"
                className={`relative flex items-center gap-1 cursor-pointer transition-colors ${collectionCount > 0 ? 'text-indigo-600' : 'hover:text-indigo-500'}`}
                title="Thêm vào bộ sưu tập"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                {collectionCount > 0 && <span className="text-xs font-semibold">{collectionCount}</span>}
              </button>
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); if (onRemix) onRemix(template); else onSelect(template); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl text-[11px] font-bold transition-all shadow-md shadow-indigo-600/20 hover:shadow-lg hover:shadow-indigo-600/30 active:scale-95"
          >
            <Copy className="w-3.5 h-3.5" />
            Remix
          </button>
        </div>
      </div>
    </div>
  );
}
