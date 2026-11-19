import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, Scale, ShieldCheck, Sparkles } from 'lucide-react';
import type { LintIssue } from '../../services/aiService';
import { PromptMeter } from '../builder/PromptMeter';
import { sendToLab } from '../../services/labSeed';
import { toast } from './Toaster';
import LintIssueList, { LintCounts } from './LintIssueList';

interface PromptInspectorProps {
  /** Prompt cần soi (đã lắp ráp/compile). */
  text: string;
  /** Hiện nút gửi sang Lab (So tài model / Auto-Optimizer). Tắt khi đã đứng trong Lab. */
  labActions?: boolean;
}

/**
 * Prompt Inspector — một chỗ "soi" prompt dùng chung cho Builder, Prompt Graph và Lab:
 * token + chi phí ước tính (tức thì), linter AI (bấm mới chạy), lối tắt sang Lab.
 */
export default function PromptInspector({ text, labActions = true }: PromptInspectorProps) {
  const [running, setRunning] = useState(false);
  const [issues, setIssues] = useState<LintIssue[] | null>(null);
  const [checkedText, setCheckedText] = useState('');
  const [expanded, setExpanded] = useState(true);

  if (!text.trim()) return null;

  const stale = issues !== null && checkedText !== text;

  const runLint = async () => {
    setRunning(true);
    try {
      const { lintPrompt } = await import('../../services/aiService');
      const result = await lintPrompt(text);
      setIssues(result);
      setCheckedText(text);
      setExpanded(true);
    } catch (e: any) {
      toast.error(e?.message || 'Không kiểm tra được prompt. Hãy đăng nhập và thử lại.');
    } finally {
      setRunning(false);
    }
  };

  const btn = 'flex cursor-pointer items-center gap-1 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface/60 p-3 text-left">
      <PromptMeter text={text} />
      <div className="flex flex-wrap gap-1.5">
        <button onClick={runLint} disabled={running} className={btn} title="Phân tích tĩnh: mâu thuẫn, mơ hồ, thiếu ngữ cảnh, ràng buộc xung đột">
          {running ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
          {running ? 'Đang kiểm tra…' : issues ? 'Kiểm tra lại' : 'Kiểm tra prompt'}
        </button>
        {labActions && (
          <>
            <button onClick={() => sendToLab('bakeoff', text)} className={btn} title="Chạy prompt này trên nhiều model và so sánh">
              <Scale size={12} /> So tài model
            </button>
            <button onClick={() => sendToLab('optimizer', text)} className={btn} title="Gửi sang Auto-Optimizer để tự tiến hoá">
              <Sparkles size={12} /> Tối ưu
            </button>
          </>
        )}
      </div>

      {stale && <p className="text-xs text-amber-600 dark:text-amber-400">Prompt đã thay đổi sau lần kiểm tra — bấm "Kiểm tra lại".</p>}

      {issues && issues.length === 0 && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 size={13} /> Không phát hiện vấn đề rõ ràng.
        </p>
      )}

      {issues && issues.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2">
            <LintCounts issues={issues} />
            <button onClick={() => setExpanded((v) => !v)} className="flex cursor-pointer items-center gap-0.5 text-xs font-semibold text-muted hover:text-ink">
              {expanded ? <>Ẩn <ChevronUp size={12} /></> : <>Xem <ChevronDown size={12} /></>}
            </button>
          </div>
          {expanded && <LintIssueList issues={issues} />}
        </>
      )}
    </div>
  );
}
