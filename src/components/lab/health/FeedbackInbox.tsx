import React, { useEffect, useMemo, useState } from 'react';
import { Inbox, ThumbsUp, ThumbsDown, Loader2, RefreshCw, Plus, X, Ban } from 'lucide-react';
import { AppFeedback, HealthSuite, HealthTest } from '../../../types';
import {
  listAppFeedback, setFeedbackStatus, loadBlockedSenders, blockSender,
} from '../../../services/feedbackService';
import { feedbackToTest, feedbackRevisionLabel, MAX_SUITE_TESTS } from '../../../utils/feedbackUtils';
import { toast } from '../../common/Toaster';
import { confirmDialog } from '../../common/ConfirmDialog';

interface Props {
  suite: HealthSuite;
  user: { uid: string };
  /** Thêm test (đã duyệt) vào suite và lưu. */
  onAddTest: (test: HealthTest) => Promise<void>;
}

const REV_LABEL = { head: 'bản hiện hành', old: 'bản cũ', unknown: 'bản không rõ' } as const;

/** Flywheel: hộp phản hồi từ người dùng Shared App → chủ app duyệt → "Biến thành test". */
export default function FeedbackInbox({ suite, user, onAddTest }: Props) {
  const appId = suite.source?.id || '';
  const [items, setItems] = useState<AppFeedback[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'new' | 'down' | 'all'>('new');
  const [blocked, setBlocked] = useState<string[]>(() => loadBlockedSenders(user.uid));
  // Đang biến phản hồi nào thành test: id → tiêu chí (sửa được trước khi lưu).
  const [converting, setConverting] = useState<{ id: string; criteria: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setItems(await listAppFeedback(user, appId));
    setLoading(false);
  };
  useEffect(() => { if (appId) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [appId, user.uid]);

  const visible = useMemo(() => items
    .filter((f) => !blocked.includes(f.userId))
    .filter((f) => (filter === 'all' ? true : filter === 'new' ? f.status === 'new' : f.rating === 'down' && f.status !== 'dismissed')),
  [items, blocked, filter]);
  const newCount = items.filter((f) => f.status === 'new' && !blocked.includes(f.userId)).length;

  const patchStatus = async (fb: AppFeedback, status: AppFeedback['status']) => {
    await setFeedbackStatus(fb.id, status);
    setItems((prev) => prev.map((x) => (x.id === fb.id ? { ...x, status } : x)));
  };

  const startConvert = (fb: AppFeedback) => {
    if (suite.testCases.length >= MAX_SUITE_TESTS) { toast.error(`Suite đã đủ ${MAX_SUITE_TESTS} test.`); return; }
    setConverting({ id: fb.id, criteria: feedbackToTest(fb).criteria.join('\n') });
  };

  const confirmConvert = async (fb: AppFeedback) => {
    if (!converting) return;
    setBusy(true);
    try {
      const test = feedbackToTest(fb);
      test.criteria = converting.criteria.split('\n').map((c) => c.trim()).filter(Boolean);
      await onAddTest(test);
      await patchStatus(fb, 'converted');
      setConverting(null);
      toast.success('Đã thêm test vào suite. Chạy kiểm tra để chấm.');
    } catch {
      toast.error('Không thêm được test.');
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async (fb: AppFeedback) => {
    try { await patchStatus(fb, 'dismissed'); } catch { toast.error('Không cập nhật được phản hồi.'); }
  };

  const block = async (fb: AppFeedback) => {
    if (!(await confirmDialog({ message: 'Ẩn mọi phản hồi của người gửi này (chỉ trên máy này)?', confirmText: 'Chặn' }))) return;
    setBlocked(blockSender(user.uid, fb.userId));
  };

  const tab = (value: typeof filter, label: string) => (
    <button
      onClick={() => setFilter(value)}
      className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${filter === value ? 'bg-emerald-600 text-white' : 'text-muted hover:bg-hover'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-2xl border border-glass-edge glass-1 p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-muted">
          <Inbox size={14} /> Phản hồi từ người dùng app
          {newCount > 0 && <span className="rounded-full bg-emerald-600 px-1.5 text-xs text-white">{newCount}</span>}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {tab('new', 'Mới')}
          {tab('down', '👎 Chưa tốt')}
          {tab('all', 'Tất cả')}
          <button onClick={load} disabled={loading} className="rounded-lg p-1.5 text-muted hover:bg-hover" aria-label="Tải lại phản hồi" title="Tải lại">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-xs text-faint">
          {loading ? 'Đang tải…' : items.length === 0
            ? 'Chưa có phản hồi. Xuất bản app và chia sẻ link — người dùng đăng nhập sẽ thấy nút 👍/👎 dưới kết quả.'
            : 'Không có phản hồi nào trong bộ lọc này.'}
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((fb) => {
            const rev = feedbackRevisionLabel(fb, suite);
            const isConverting = converting?.id === fb.id;
            return (
              <div key={fb.id} className="rounded-xl border border-line bg-surface p-3 text-xs">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  {fb.rating === 'up'
                    ? <ThumbsUp size={13} className="text-emerald-500" />
                    : <ThumbsDown size={13} className="text-rose-500" />}
                  <span className="text-muted">{new Date(fb.createdAt).toLocaleString()}</span>
                  <span className="rounded bg-hover px-1.5 py-0.5 text-muted">{REV_LABEL[rev]}</span>
                  {fb.status !== 'new' && <span className="text-faint">{fb.status === 'converted' ? '· đã thành test' : '· đã bỏ qua'}</span>}
                </div>
                {fb.comment && <p className="mb-1.5 font-semibold text-ink">“{fb.comment}”</p>}
                {Object.keys(fb.inputs).length > 0 && (
                  <div className="mb-1.5 flex flex-wrap gap-1">
                    {Object.entries(fb.inputs).map(([k, v]) => (
                      <span key={k} className="max-w-full truncate rounded bg-panel px-1.5 py-0.5 text-muted" title={v}>{k}: {v || '—'}</span>
                    ))}
                  </div>
                )}
                <details>
                  <summary className="cursor-pointer text-faint">Xem kết quả app đã trả</summary>
                  <pre className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-panel p-2 text-ink">{fb.output}</pre>
                </details>

                {isConverting ? (
                  <div className="mt-2 space-y-2">
                    <label className="block font-bold text-muted">Tiêu chí chấm cho test mới (mỗi dòng một tiêu chí)</label>
                    <textarea
                      value={converting.criteria}
                      onChange={(e) => setConverting({ id: fb.id, criteria: e.target.value })}
                      rows={3}
                      className="w-full resize-y rounded-lg border border-line bg-panel px-2.5 py-1.5 text-ink focus:border-emerald-500 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => confirmConvert(fb)} disabled={busy} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white hover:bg-emerald-500 disabled:opacity-60">
                        {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Thêm vào suite
                      </button>
                      <button onClick={() => setConverting(null)} className="rounded-lg border border-line px-3 py-1.5 font-semibold text-muted hover:bg-hover">Huỷ</button>
                    </div>
                  </div>
                ) : fb.status === 'new' && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => startConvert(fb)} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white hover:bg-emerald-500"><Plus size={12} /> Biến thành test</button>
                    <button onClick={() => dismiss(fb)} className="flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 font-semibold text-muted hover:bg-hover"><X size={12} /> Bỏ qua</button>
                    <button onClick={() => block(fb)} className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1.5 text-faint hover:bg-hover hover:text-rose-500" title="Ẩn mọi phản hồi của người gửi này"><Ban size={12} /> Chặn</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
