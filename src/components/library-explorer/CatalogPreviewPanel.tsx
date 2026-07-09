import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { RefreshCw, Download, ExternalLink, AlertTriangle } from 'lucide-react';
import { CatalogEntry } from '../../data/skillCatalog';

interface Props {
  entry: CatalogEntry | null;
  content: string;
  loading: boolean;
  error: string | null;
  importing: boolean;
  onImport: () => void;
}

export default function CatalogPreviewPanel({ entry, content, loading, error, importing, onImport }: Props) {
  if (!entry) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-xs italic p-6 text-center">
        Chọn một mục ở danh sách bên trái để xem trước nội dung.
      </div>
    );
  }
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-sm text-slate-800 dark:text-white truncate flex items-center gap-1.5">
            <span>{entry.icon || '📦'}</span>{entry.title}
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {entry.repo}{entry.license ? ` · ${entry.license}` : ''}{entry.author ? ` · @${entry.author}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {entry.htmlUrl && (
            <a href={entry.htmlUrl} target="_blank" rel="noopener noreferrer"
              className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-350 flex items-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-800">
              <ExternalLink size={12} /> GitHub
            </a>
          )}
          <button onClick={onImport} disabled={loading || importing || !content}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
            {importing ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
            <span>Nhập vào thư viện</span>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        {loading ? (
          <p className="text-slate-400 italic text-xs flex items-center gap-2">
            <RefreshCw size={13} className="animate-spin" /> Đang tải nội dung từ GitHub…
          </p>
        ) : error ? (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-xs">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{error}{entry.htmlUrl ? ' — bạn vẫn có thể mở trên GitHub.' : ''}</span>
          </div>
        ) : (
          <>
            {entry.format === 'skill-md' && (
              <p className="mb-3 text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 rounded-lg px-3 py-2">
                Chỉ nhập nội dung <strong>SKILL.md</strong>; tài nguyên phụ (scripts/, references/) không được nhập — xem trên GitHub nếu cần.
              </p>
            )}
            <div className="prose prose-slate dark:prose-invert prose-sm max-w-none text-xs leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
