import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Loader2, Check } from 'lucide-react';
import { submitFeedback } from '../../../services/feedbackService';
import { FEEDBACK_LIMITS, type FeedbackDraft } from '../../../utils/feedbackUtils';
import { toast } from '../../common/Toaster';

interface Props {
  /** Mọi trường trừ rating/comment — AppPanel điền từ lần chạy vừa xong. */
  draft: Omit<FeedbackDraft, 'rating' | 'comment'>;
}

/** Flywheel: người dùng Shared App gửi 👍/👎 + góp ý về kết quả cho chủ app (cần đồng ý chia sẻ input/output). */
export default function FeedbackForm({ draft }: Props) {
  const [rating, setRating] = useState<'up' | 'down' | null>(null);
  const [comment, setComment] = useState('');
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-panel p-4 text-sm text-muted">
        <Check size={15} className="text-emerald-500" /> Đã gửi phản hồi cho chủ app. Cảm ơn bạn!
      </div>
    );
  }

  const send = async () => {
    if (!rating || !consent) return;
    setSending(true);
    try {
      await submitFeedback({ ...draft, rating, comment });
      setSent(true);
      toast.success('Đã gửi phản hồi.');
    } catch {
      toast.error('Không gửi được phản hồi.');
    } finally {
      setSending(false);
    }
  };

  const pill = (value: 'up' | 'down') =>
    `flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-semibold transition-colors ${rating === value
      ? (value === 'up' ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300')
      : 'border-line bg-surface text-muted hover:bg-hover'}`;

  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-ink">Kết quả này có tốt không?</span>
        <button onClick={() => setRating('up')} className={pill('up')} aria-pressed={rating === 'up'}><ThumbsUp size={14} /> Tốt</button>
        <button onClick={() => setRating('down')} className={pill('down')} aria-pressed={rating === 'down'}><ThumbsDown size={14} /> Chưa tốt</button>
      </div>
      {rating && (
        <div className="space-y-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, FEEDBACK_LIMITS.comment))}
            rows={2}
            placeholder={rating === 'down' ? 'Kết quả nên như thế nào? (vd: "phải có ví dụ cụ thể", "quá dài")' : 'Góp ý thêm (tuỳ chọn)'}
            className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-emerald-500 focus:outline-none"
          />
          <label className="flex cursor-pointer items-start gap-2 text-xs text-muted">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
            <span>Cho phép chủ app xem <b>dữ liệu tôi nhập</b> và <b>kết quả</b> của lần chạy này để cải thiện app.</span>
          </label>
          <button
            onClick={send}
            disabled={!consent || sending}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {sending && <Loader2 size={14} className="animate-spin" />} Gửi phản hồi
          </button>
        </div>
      )}
    </div>
  );
}
