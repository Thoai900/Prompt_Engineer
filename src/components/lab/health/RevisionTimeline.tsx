import React, { useMemo, useState } from 'react';
import { GitCommitVertical, Star, TrendingUp, TrendingDown, RotateCcw, GitCompare } from 'lucide-react';
import { HealthSuite, PromptRevision } from '../../../types';
import { scoreByRevision, bestRevision, blameByTest } from '../../../utils/promptRevisions';
import { computeUnifiedDiff } from '../../../utils/chainUtils';

const ORIGIN_LABEL: Record<PromptRevision['origin'], string> = {
  manual: 'Sửa tay',
  optimizer: 'Optimizer',
  'source-sync': 'Từ nguồn',
  restore: 'Khôi phục',
};

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

interface Props {
  suite: HealthSuite;
  onRestore: (revisionId: string) => void;
}

/** Prompt Git: dòng thời gian revision của suite — điểm, bản tốt nhất, diff + so điểm từng test. */
export default function RevisionTimeline({ suite, onRestore }: Props) {
  const scores = useMemo(() => scoreByRevision(suite, suite.model), [suite]);
  const best = useMemo(() => bestRevision(suite, suite.model), [suite]);
  // Chọn tối đa 2 revision để so sánh: [cũ hơn, mới hơn] theo thứ tự chọn.
  const [picked, setPicked] = useState<string[]>([]);

  if (scores.length === 0) return null;

  const togglePick = (id: string) => {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-2)));
  };

  // Sắp cặp theo thời gian: A = cũ hơn, B = mới hơn (revisions mới nhất ở đầu).
  const order = (suite.revisions || []).map((r) => r.id);
  const pair = picked.length === 2
    ? [...picked].sort((x, y) => order.indexOf(y) - order.indexOf(x))
    : null;
  const revA = pair ? suite.revisions!.find((r) => r.id === pair[0])! : null;
  const revB = pair ? suite.revisions!.find((r) => r.id === pair[1])! : null;
  const blame = pair ? blameByTest(suite, pair[0], pair[1], suite.model) : [];
  const testIndex = (testId: string) => suite.testCases.findIndex((t) => t.id === testId) + 1;

  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-muted">
          <GitCommitVertical size={14} /> Phiên bản prompt ({scores.length})
          <span className="font-normal text-faint">· điểm theo model {suite.model}</span>
        </div>
        <span className="text-xs text-faint">Chọn 2 bản để so sánh</span>
      </div>

      <div className="space-y-1.5">
        {scores.map(({ revision, lastScore, deltaVsParent, runs }) => {
          const isHead = revision.id === suite.headRevisionId;
          const isBest = best?.id === revision.id;
          const isPicked = picked.includes(revision.id);
          return (
            <div
              key={revision.id}
              className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs ${isPicked ? 'border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/30' : 'border-transparent bg-surface'}`}
            >
              <input
                type="checkbox"
                checked={isPicked}
                onChange={() => togglePick(revision.id)}
                className="h-3.5 w-3.5 accent-emerald-600"
                aria-label="Chọn để so sánh"
              />
              <span className="text-muted">{new Date(revision.at).toLocaleString()}</span>
              <span className="rounded bg-hover px-1.5 py-0.5 font-semibold text-muted">{ORIGIN_LABEL[revision.origin]}</span>
              {isHead && <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">Hiện hành</span>}
              {isBest && <span className="flex items-center gap-0.5 font-bold text-amber-500" title="Điểm lần chạy gần nhất cao nhất"><Star size={12} fill="currentColor" /> Tốt nhất</span>}
              {revision.note && <span className="truncate text-faint" title={revision.note}>{revision.note}</span>}

              <span className="ml-auto flex items-center gap-2">
                {deltaVsParent !== null && deltaVsParent !== 0 && (
                  <span className={`flex items-center gap-0.5 ${deltaVsParent > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {deltaVsParent > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{deltaVsParent > 0 ? '+' : ''}{deltaVsParent}
                  </span>
                )}
                {lastScore !== null
                  ? <span className={`font-black ${scoreColor(lastScore)}`} title={`${runs.length} lần chạy`}>{lastScore}</span>
                  : <span className="text-faint">chưa chạy</span>}
                {!isHead && (
                  <button
                    onClick={() => onRestore(revision.id)}
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold text-emerald-600 hover:bg-hover dark:text-emerald-400"
                    title="Đặt bản này làm prompt hiện hành"
                  >
                    <RotateCcw size={11} /> Dùng bản này
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {revA && revB && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <div className="mb-1.5 flex items-center gap-1 text-xs font-bold text-muted"><GitCompare size={12} /> Khác biệt (bản cũ → bản mới)</div>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-line bg-surface p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {computeUnifiedDiff(revA.content, revB.content).map((line, idx) => (
                <div
                  key={idx}
                  className={line.type === 'added'
                    ? 'border-l-2 border-emerald-500/50 bg-emerald-500/10 px-1 text-emerald-600 dark:text-emerald-400'
                    : line.type === 'removed'
                      ? 'border-l-2 border-rose-500/50 bg-rose-500/10 px-1 text-rose-600 line-through dark:text-rose-400'
                      : 'px-1 text-muted'}
                >
                  {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}{line.text}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-bold text-muted">Điểm từng test (tụt nhiều nhất lên đầu)</div>
            <div className="space-y-1">
              {blame.map((b) => (
                <div key={b.testId} className="flex items-center justify-between rounded-lg bg-surface px-3 py-1.5 text-xs">
                  <span className="text-muted">Test {testIndex(b.testId)}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-faint">{b.scoreA ?? '—'} → {b.scoreB ?? '—'}</span>
                    {b.delta !== null && (
                      <span className={`w-10 text-right font-bold ${b.delta > 0 ? 'text-emerald-500' : b.delta < 0 ? 'text-rose-500' : 'text-faint'}`}>
                        {b.delta > 0 ? '+' : ''}{b.delta}
                      </span>
                    )}
                  </span>
                </div>
              ))}
              {blame.every((b) => b.delta === null) && (
                <p className="text-xs text-faint">Một trong hai bản chưa được chạy với model {suite.model} — chạy kiểm tra để có điểm so sánh.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
