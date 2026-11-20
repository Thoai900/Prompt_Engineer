import React, { useMemo, useState } from 'react';
import { Trophy, Heart, Play, ShieldCheck, GitFork, Eye } from 'lucide-react';
import { PromptTemplate } from '../../types';
import { featuredScore, qualityStatus, rankTemplates, type LeaderboardSort } from '../../utils/leaderboard';

const SORTS: { id: LeaderboardSort; label: string }[] = [
  { id: 'top', label: 'Nổi bật' },
  { id: 'likes', label: 'Được thích' },
  { id: 'usage', label: 'Được dùng' },
  { id: 'quality', label: 'Điểm chất lượng' },
];

interface Props {
  /** Template công khai do người dùng đăng (đã lọc). */
  templates: PromptTemplate[];
  /** Danh mục đang chọn ở bộ lọc chung của Thư viện ('Tất cả' = không lọc). */
  category: string;
  onOpen: (t: PromptTemplate) => void;
  onRemix: (t: PromptTemplate) => void;
}

/** Bảng xếp hạng template cộng đồng: lượt thích, lượt dùng, điểm Prompt Health tác giả công bố. */
export default function LeaderboardView({ templates, category, onOpen, onRemix }: Props) {
  const [sort, setSort] = useState<LeaderboardSort>('top');
  const ranked = useMemo(() => rankTemplates(templates, sort, category), [templates, sort, category]);

  return (
    <div className="pb-20">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-faint">Xếp theo</span>
        {SORTS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSort(s.id)}
            aria-pressed={sort === s.id}
            className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${sort === s.id ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : 'border-line bg-surface text-muted hover:bg-hover'}`}
          >
            {s.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-faint" title="Nổi bật = 3·log₂(1+thích) + 2·log₂(1+dùng) + điểm chất lượng/20 (chỉ điểm còn hiệu lực)">
          {ranked.length} template công khai{category && category !== 'Tất cả' ? ` · ${category}` : ''}
        </span>
      </div>

      {ranked.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-panel p-10 text-center text-sm text-muted">
          Chưa có template công khai nào{category && category !== 'Tất cả' ? ' trong danh mục này' : ''}. Bật "Công khai" khi lưu template để lên bảng.
        </div>
      ) : (
        <ol className="space-y-2">
          {ranked.map((t, i) => {
            const qs = qualityStatus(t);
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-3">
                <span className={`w-8 text-center text-lg font-black ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-400' : 'text-faint'}`}>
                  {i < 3 ? <Trophy size={18} className="mx-auto" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <button onClick={() => onOpen(t)} className="block max-w-full truncate text-left text-sm font-bold text-ink hover:underline">{t.title}</button>
                  <div className="truncate text-xs text-faint">
                    {t.authorName || 'Ẩn danh'}{t.category ? ` · ${t.category}` : ''}
                  </div>
                </div>
                <span className="flex items-center gap-1 text-xs text-muted" title="Lượt thích"><Heart size={13} /> {t.metrics?.likes ?? 0}</span>
                <span className="flex items-center gap-1 text-xs text-muted" title="Lượt mở vào Builder"><Play size={13} /> {t.metrics?.usageCount ?? 0}</span>
                {qs === 'none' ? (
                  <span className="w-28 text-right text-xs text-faint">chưa có điểm</span>
                ) : (
                  <span
                    className={`flex w-28 items-center justify-end gap-1 text-xs font-bold ${qs === 'current' ? 'text-emerald-600 dark:text-emerald-400' : 'text-faint line-through'}`}
                    title={`Điểm Prompt Health tác giả tự chạy và công bố: ${t.quality!.tests} test · ${t.quality!.model} · ${new Date(t.quality!.at).toLocaleDateString('vi-VN')}${qs === 'outdated' ? ' — template đã sửa sau lần chạy này' : ''}`}
                  >
                    <ShieldCheck size={13} /> {t.quality!.score}{qs === 'outdated' ? ' (bản cũ)' : ''}
                  </span>
                )}
                {sort === 'top' && <span className="w-12 text-right text-xs text-faint" title="Điểm nổi bật">{featuredScore(t)}</span>}
                <span className="flex gap-1">
                  <button onClick={() => onOpen(t)} className="rounded-lg p-1.5 text-muted hover:bg-hover" aria-label={`Xem ${t.title}`} title="Xem"><Eye size={14} /></button>
                  <button onClick={() => onRemix(t)} className="rounded-lg p-1.5 text-muted hover:bg-hover" aria-label={`Remix ${t.title}`} title="Remix (tạo bản của bạn)"><GitFork size={14} /></button>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-4 text-xs text-faint">
        Điểm chất lượng do tác giả tự chạy bằng Prompt Health và công bố — xem số test, model, ngày chạy khi rê chuột. Điểm gạch ngang là của phiên bản cũ (template đã sửa sau đó) và không được cộng vào xếp hạng.
      </p>
    </div>
  );
}
