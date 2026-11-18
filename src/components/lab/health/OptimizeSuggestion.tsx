import React, { useState } from 'react';
import { Sparkles, Loader2, X, Check } from 'lucide-react';
import { HealthSuite } from '../../../types';
import { optimizePrompt, type OptimizeResult } from '../../../services/aiProxy';
import { pickFailingTests, headRevision, MIN_FAILING_TO_SUGGEST, FAIL_THRESHOLD } from '../../../utils/promptRevisions';
import { toast } from '../../common/Toaster';

interface Props {
  suite: HealthSuite;
  signedIn: boolean;
  /** Người dùng chấp nhận bản tối ưu → lưu thành revision 'optimizer' và chạy lại toàn suite. */
  onAccept: (prompt: string, note: string) => Promise<void>;
}

/**
 * Prompt Git · Đợt 2: khi phiên bản hiện hành có ≥ 2 test trượt, gợi ý chạy Auto-Optimizer
 * trên CHÍNH các test đó (api/optimize với `tests`). Không tự chạy — người dùng bấm.
 */
export default function OptimizeSuggestion({ suite, signedIn, onAccept }: Props) {
  const failing = pickFailingTests(suite);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [forHead, setForHead] = useState(suite.headRevisionId);

  // Đổi phiên bản hiện hành → kết quả cũ không còn đúng ngữ cảnh.
  if (forHead !== suite.headRevisionId) {
    setForHead(suite.headRevisionId);
    setResult(null);
  }

  if (failing.length < MIN_FAILING_TO_SUGGEST && !result && !running) return null;

  const start = async () => {
    setRunning(true);
    setResult(null);
    setProgress('Đang chấm bản hiện tại…');
    try {
      const r = await optimizePrompt(
        {
          // Tối ưu đúng bản đã chấm (head), không phải chỗ đang sửa dở chưa lưu.
          basePrompt: headRevision(suite)?.content || suite.prompt,
          tests: failing.map(({ test }) => ({ input: test.input, criteria: test.criteria })),
        },
        (p) => {
          if (p.type === 'baseline') setProgress(`Điểm bản hiện tại trên các test trượt: ${p.score} · ~${p.estimatedCalls ?? '?'} lời gọi model`);
          else setProgress(`Vòng ${p.round}/${p.rounds} — tốt nhất: ${p.bestScore}`);
        },
      );
      setResult(r);
    } catch (e: any) {
      toast.error(e?.message || 'Không chạy được Optimizer.');
    } finally {
      setRunning(false);
      setProgress('');
    }
  };

  const accept = async () => {
    if (!result) return;
    setAccepting(true);
    try {
      await onAccept(result.bestPrompt, `Optimizer: ${result.baselineScore} → ${result.bestScore} trên ${result.testCount ?? failing.length} test trượt`);
      setResult(null);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50/60 p-4 dark:border-amber-800 dark:bg-amber-950/20">
      {!result ? (
        <div className="flex flex-wrap items-center gap-3">
          <Sparkles size={16} className="text-amber-500" />
          <div className="flex-1 text-sm text-ink">
            {running
              ? progress
              : <>Có <b>{failing.length} test trượt</b> (dưới {FAIL_THRESHOLD} điểm) ở phiên bản hiện hành. Tối ưu prompt theo các test này?</>}
          </div>
          {running ? (
            <Loader2 size={16} className="animate-spin text-amber-500" />
          ) : signedIn ? (
            <button onClick={start} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-400">Tối ưu</button>
          ) : (
            <span className="text-xs text-amber-600 dark:text-amber-400">Cần đăng nhập để dùng Optimizer</span>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink">
            <Sparkles size={16} className="text-amber-500" />
            Trên các test trượt: <b>{result.baselineScore} → {result.bestScore}</b>
            <span className={result.improvement > 0 ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-muted'}>
              ({result.improvement > 0 ? '+' : ''}{result.improvement})
            </span>
          </div>
          {result.improvement <= 0 ? (
            <p className="text-xs text-muted">Optimizer không tìm được bản tốt hơn. Thử chỉnh tiêu chí test hoặc sửa prompt tay.</p>
          ) : (
            <>
              <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl border border-line bg-surface p-3 text-xs text-ink">{result.bestPrompt}</pre>
              <p className="text-xs text-muted">Lưu thành phiên bản mới sẽ chạy lại TOÀN BỘ suite để kiểm tra các test đang đạt có bị tụt không.</p>
            </>
          )}
          <div className="flex gap-2">
            {result.improvement > 0 && (
              <button onClick={accept} disabled={accepting} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60">
                {accepting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Lưu thành phiên bản & chạy lại suite
              </button>
            )}
            <button onClick={() => setResult(null)} className="flex items-center gap-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-muted hover:bg-hover">
              <X size={14} /> Bỏ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
