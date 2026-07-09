import { PromptTemplate } from '../../types';
import { getShowcase } from '../../data/templateShowcase';
import { X, Layout, FileText, Code2, Video, GitMerge, GraduationCap, ArrowRight } from 'lucide-react';

interface ExamplePreviewModalProps {
  template: PromptTemplate;
  onClose: () => void;
}

export default function ExamplePreviewModal({ template, onClose }: ExamplePreviewModalProps) {
  const sc = getShowcase(template);

  // Không có kết quả mẫu → không mở preview (card cũng chỉ mở khi hasResult).
  if (!sc.hasResult) return null;

  const isCode = sc.outputType === 'code';

  const typeIcon = (() => {
    switch (sc.outputType) {
      case 'ui': return <Layout className="w-5 h-5 text-indigo-500" />;
      case 'text': return <FileText className="w-5 h-5 text-emerald-500" />;
      case 'code': return <Code2 className="w-5 h-5 text-blue-500" />;
      case 'video': return <Video className="w-5 h-5 text-rose-500" />;
      case 'mindmap': return <GitMerge className="w-5 h-5 text-amber-500" />;
      case 'tutor': return <GraduationCap className="w-5 h-5 text-blue-400" />;
      default: return <FileText className="w-5 h-5 text-slate-500" />;
    }
  })();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">{typeIcon}</div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">Kết quả mẫu: {template.title}</h2>
              {sc.hook && <p className="text-xs text-indigo-600 font-semibold mt-0.5">{sc.hook}</p>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Đóng" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content (2 columns) */}
        <div className="relative flex flex-col lg:flex-row flex-1 overflow-hidden bg-slate-50">
          {/* Input */}
          <div className="w-full lg:w-2/5 p-6 border-b lg:border-b-0 lg:border-r border-slate-200 overflow-y-auto flex flex-col bg-white">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold">1</span>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Bạn nhập</h3>
            </div>
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap flex-1 shadow-inner">
              {sc.input || 'Điền các biến {{...}} theo tình huống của bạn.'}
            </div>
          </div>

          {/* Transition icon */}
          <div className="hidden lg:flex absolute left-[40%] top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white border border-slate-200 rounded-full items-center justify-center shadow-md">
            <ArrowRight className="w-5 h-5 text-indigo-500" />
          </div>

          {/* Output */}
          <div className="w-full lg:w-3/5 p-6 overflow-y-auto flex flex-col bg-slate-50/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">2</span>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Kết quả AI</h3>
              </div>
              <span className="text-[10px] font-semibold text-slate-400">Mẫu đại diện — không phải cam kết</span>
            </div>

            {isCode ? (
              <pre className="flex-1 bg-[#0B0E14] border border-slate-800 rounded-xl p-4 overflow-auto custom-scrollbar font-mono text-[13px] leading-relaxed text-[#A9B2C3] whitespace-pre-wrap">
                {sc.output}
              </pre>
            ) : (
              <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-5 overflow-y-auto text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {sc.output || 'Chưa có nội dung kết quả mẫu.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
