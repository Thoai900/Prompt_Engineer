import React, { useState } from 'react';
import { Fingerprint, RefreshCw, Trash2, Hash, Variable, MessageSquare } from 'lucide-react';
import { getTasteInsights, resetTasteModel, type TasteInsights } from '../../services/suggestionStore';
import { confirmDialog } from '../common/ConfirmDialog';
import { toast } from '../common/Toaster';

/**
 * Hồ sơ phong cách (taste model): hệ thống học âm thầm từ những gì bạn gõ & lưu để
 * gợi ý ngày càng "đúng giọng" bạn. Panel này phơi bày phần đã học + cho phép xoá.
 */
export default function TastePanel() {
  const [insights, setInsights] = useState<TasteInsights>(() => getTasteInsights());

  const refresh = () => setInsights(getTasteInsights());

  const reset = async () => {
    if (!(await confirmDialog({ message: 'Xoá toàn bộ hồ sơ phong cách đã học? Gợi ý sẽ quay về mặc định.', danger: true, confirmText: 'Xoá' }))) return;
    resetTasteModel();
    refresh();
    toast.success('Đã xoá hồ sơ phong cách.');
  };

  const empty = insights.phraseCount === 0 && insights.varCount === 0;

  return (
    <>
      <p className="mb-4 text-sm text-muted">Hệ thống học âm thầm từ những gì bạn gõ &amp; lưu — <span className="font-semibold text-ink">càng dùng càng hiểu bạn</span>, gợi ý đúng giọng bạn hơn. Đây là phần nó đã học.</p>

      <div className="mb-4 flex items-center gap-2">
        <button onClick={refresh} className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-muted hover:bg-hover"><RefreshCw size={14} /> Làm mới</button>
        <button onClick={reset} className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"><Trash2 size={14} /> Xoá hồ sơ</button>
      </div>

      {empty ? (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line bg-panel p-8 text-sm text-muted">
          <Fingerprint size={22} className="shrink-0 text-emerald-500" />
          Chưa học được gì. Hãy dùng Builder, gõ và lưu prompt — hệ thống sẽ bắt đầu hiểu phong cách của bạn.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Sức mạnh cá nhân hoá */}
          <div className="rounded-2xl border border-line bg-panel p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-bold text-ink"><Fingerprint size={16} className="text-emerald-500" /> Độ hiểu bạn</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{insights.strength}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${insights.strength}%` }} />
            </div>
            <div className="mt-2 flex gap-4 text-xs text-muted">
              <span>{insights.phraseCount} cụm từ đã học</span>
              <span>{insights.varCount} biến quen thuộc</span>
            </div>
          </div>

          {/* Vốn từ / chủ đề */}
          {insights.topTerms.length > 0 && (
            <div className="rounded-2xl border border-line bg-panel p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink"><Hash size={15} className="text-emerald-500" /> Vốn từ &amp; chủ đề của bạn</h3>
              <div className="flex flex-wrap gap-1.5">
                {insights.topTerms.map((t) => (
                  <span key={t.term} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" style={{ fontSize: `${Math.min(15, 11 + t.count / 3)}px` }}>
                    {t.term}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Biến hay dùng */}
          {insights.topValues.length > 0 && (
            <div className="rounded-2xl border border-line bg-panel p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink"><Variable size={15} className="text-emerald-500" /> Giá trị biến bạn hay dùng</h3>
              <div className="space-y-2">
                {insights.topValues.map((v) => (
                  <div key={v.varName} className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-muted">{v.varName}:</span>
                    {v.values.map((val, i) => (
                      <span key={i} className="rounded-md bg-surface px-2 py-0.5 text-xs text-ink">{val}</span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cụm từ gần đây */}
          {insights.recentPhrases.length > 0 && (
            <div className="rounded-2xl border border-line bg-panel p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink"><MessageSquare size={15} className="text-emerald-500" /> Cụm từ gần đây bạn dạy AI</h3>
              <ul className="space-y-1.5">
                {insights.recentPhrases.map((p, i) => (
                  <li key={i} className="truncate rounded-lg bg-surface px-3 py-1.5 text-xs text-muted">{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  );
}
