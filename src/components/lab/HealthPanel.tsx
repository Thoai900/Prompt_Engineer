import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Play, Loader2, Save, Activity, TrendingUp, TrendingDown, Minus, AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ALL_MODEL_OPTIONS, GEMINI_FLASH } from '../../config/models';
import { HealthSuite, HealthTest, PromptTemplate } from '../../types';
import {
  loadHealthSuites, saveHealthSuite, deleteHealthSuite, runHealthCheck, newHealthSuite, compareRuns,
} from '../../services/healthService';
import { toast } from '../common/Toaster';
import { confirmDialog } from '../common/ConfirmDialog';
import RevisionTimeline from './health/RevisionTimeline';
import OptimizeSuggestion from './health/OptimizeSuggestion';
import {
  commitRevision, restoreRevision, hasUncommittedPrompt, headRevision, judgeRevision, REGRESSION_DROP,
} from '../../utils/promptRevisions';
import { blocksToText } from '../../utils/templateVersionUtils';
import { promptToTemplate } from '../../utils/labUtils';

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function tid(): string { return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`; }

interface HealthPanelProps {
  /** Template trong thư viện — để lấy prompt làm nguồn cho suite. */
  libraryTemplates?: PromptTemplate[];
  /** Mở prompt trong Builder (App.tsx điều hướng). */
  onApplyTemplate?: (t: PromptTemplate) => void;
}

/** Prompt Health/CI: suite có version + bộ test, chạy "khám sức khoẻ" và bắt hồi quy. */
export default function HealthPanel({ libraryTemplates = [], onApplyTemplate }: HealthPanelProps) {
  const { user, geminiApiKey, groqApiKey, openaiApiKey, useSystemGeminiKey, activeWorkspaceId } = useWorkspace();

  const [suites, setSuites] = useState<HealthSuite[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  // Đợt 2: bản do Optimizer tạo đang chờ so với bản trước nó (sau khi chạy lại toàn suite).
  const [pendingJudge, setPendingJudge] = useState<{ suiteId: string; oldRevId: string; newRevId: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadHealthSuites(user).then((s) => {
      if (cancelled) return;
      setSuites(s);
      setActiveId((prev) => prev || s[0]?.id || null);

      // H3 (thông báo hồi quy): suite nào lần chạy MỚI NHẤT tụt ≥10 điểm so với lần
      // trước (kể cả run do cron chạy nền) → cảnh báo ngay khi mở panel.
      for (const suite of s) {
        const [latest, prev] = suite.runs || [];
        if (latest && prev && latest.avgScore - prev.avgScore <= -10) {
          toast.error(`⚠️ Suite "${suite.name}" tụt ${prev.avgScore - latest.avgScore} điểm (${prev.avgScore} → ${latest.avgScore}). Kiểm tra hồi quy!`);
        }
      }
    });
    return () => { cancelled = true; };
  }, [user]);

  const active = useMemo(() => suites.find((s) => s.id === activeId) || null, [suites, activeId]);

  const patchActive = (patch: Partial<HealthSuite>) => {
    setSuites((prev) => prev.map((s) => (s.id === activeId ? { ...s, ...patch } : s)));
  };

  const createSuite = () => {
    const s = newHealthSuite('Suite mới', GEMINI_FLASH);
    if (activeWorkspaceId) s.workspaceId = activeWorkspaceId;
    setSuites((prev) => [s, ...prev]);
    setActiveId(s.id);
  };

  const removeSuite = async (id: string, name: string) => {
    if (!(await confirmDialog({ message: `Xoá suite "${name}"?`, danger: true, confirmText: 'Xoá' }))) return;
    setSuites((prev) => prev.filter((s) => s.id !== id));
    if (activeId === id) setActiveId(null);
    try { await deleteHealthSuite(user, id); } catch { /* đã toast trong service */ }
  };

  const addTest = () => {
    if (!active) return;
    const t: HealthTest = { id: tid(), input: '', criteria: [] };
    patchActive({ testCases: [...active.testCases, t] });
  };
  const updateTest = (testId: string, patch: Partial<HealthTest>) => {
    if (!active) return;
    patchActive({ testCases: active.testCases.map((t) => (t.id === testId ? { ...t, ...patch } : t)) });
  };
  const removeTest = (testId: string) => {
    if (!active) return;
    patchActive({ testCases: active.testCases.filter((t) => t.id !== testId) });
  };

  /** Thay suite đang mở bằng `next` và lưu ngay (dùng cho thao tác revision). */
  const replaceAndSave = async (next: HealthSuite) => {
    setSuites((prev) => prev.map((s) => (s.id === next.id ? next : s)));
    try { await saveHealthSuite(user, next); } catch { /* toast trong service */ }
  };

  // Prompt Git: "Lưu" ghi prompt đã sửa thành revision mới — để cron (chạy theo prompt
  // đã lưu) luôn gắn run vào đúng revision.
  const saveActive = async () => {
    if (!active) return;
    setSaving(true);
    const next = commitRevision(active, active.prompt, 'manual');
    setSuites((prev) => prev.map((s) => (s.id === next.id ? next : s)));
    try { await saveHealthSuite(user, next); toast.success('Đã lưu suite.'); }
    catch { toast.error('Không lưu được suite.'); }
    finally { setSaving(false); }
  };

  /** Chạy toàn bộ test của `base` (đã commit revision), cập nhật state + lưu. */
  const runSuite = async (base: HealthSuite) => {
    setRunning(true);
    const apiKeys = {
      gemini: useSystemGeminiKey ? undefined : (geminiApiKey || undefined),
      groq: groqApiKey || undefined,
      openai: openaiApiKey || undefined,
    };
    try {
      const run = await runHealthCheck(base, apiKeys);
      const updated: HealthSuite = { ...base, runs: [run, ...base.runs].slice(0, 10) };
      setSuites((prev) => prev.map((s) => (s.id === base.id ? updated : s)));
      try { await saveHealthSuite(user, updated); } catch { /* toast trong service */ }
    } finally {
      setRunning(false);
    }
  };

  const runCheck = async () => {
    if (!active) return;
    if (active.testCases.length === 0) { toast.error('Thêm ít nhất một test case.'); return; }
    await runSuite(commitRevision(active, active.prompt, 'manual'));
  };

  // Đợt 2: nhận bản từ Optimizer → revision 'optimizer' (thành hiện hành) → chạy lại TOÀN suite
  // → so với bản trước (judgeRevision). Kém hơn thì hiện cảnh báo + nút quay lại.
  const acceptOptimized = async (prompt: string, note: string) => {
    if (!active) return;
    const oldRevId = active.headRevisionId;
    const next = commitRevision(active, prompt, 'optimizer', note);
    if (next === active || !next.headRevisionId) return;
    if (oldRevId && oldRevId !== next.headRevisionId) {
      setPendingJudge({ suiteId: next.id, oldRevId, newRevId: next.headRevisionId });
    }
    await runSuite(next);
  };

  const restore = async (revisionId: string) => {
    if (!active) return;
    if (hasUncommittedPrompt(active) && !(await confirmDialog({ message: 'Prompt đang sửa chưa được lưu thành phiên bản. Bỏ thay đổi đó?', danger: true, confirmText: 'Bỏ & khôi phục' }))) return;
    await replaceAndSave(restoreRevision(active, revisionId));
    toast.success('Đã đặt phiên bản làm hiện hành. Chạy kiểm tra để cập nhật điểm.');
  };

  // Nguồn template: lấy prompt từ template trong thư viện (ghi thành revision 'source-sync').
  const sourceTemplate = active?.source ? libraryTemplates.find((t) => t.id === active.source!.id) : undefined;
  const linkTemplate = async (templateId: string) => {
    if (!active) return;
    if (!templateId) { await replaceAndSave({ ...active, source: undefined }); return; }
    const t = libraryTemplates.find((x) => x.id === templateId);
    if (!t) return;
    const text = blocksToText(t.blocks);
    if (!text.trim()) { toast.error('Template này chưa có nội dung.'); return; }
    const linked: HealthSuite = { ...active, source: { kind: 'template', id: t.id, title: t.title } };
    await replaceAndSave(commitRevision(linked, text, 'source-sync', `Từ template "${t.title}"`));
    toast.success(`Đã lấy prompt từ "${t.title}".`);
  };
  const syncFromSource = async () => {
    if (!active || !sourceTemplate) return;
    const next = commitRevision(active, blocksToText(sourceTemplate.blocks), 'source-sync', `Đồng bộ từ "${sourceTemplate.title}"`);
    if (next === active) { toast('Prompt đã trùng với template — không có gì mới.'); return; }
    await replaceAndSave(next);
    toast.success('Đã đồng bộ prompt mới nhất từ template.');
  };
  const openInBuilder = () => {
    if (!active || !onApplyTemplate) return;
    onApplyTemplate(promptToTemplate(headRevision(active)?.content || active.prompt, 'health'));
  };

  const verdict = active && pendingJudge?.suiteId === active.id
    ? judgeRevision(active, pendingJudge.oldRevId, pendingJudge.newRevId)
    : null;
  const testNo = (testId: string) => (active?.testCases.findIndex((t) => t.id === testId) ?? -1) + 1;

  const latest = active?.runs[0];
  const prev = active?.runs[1];
  const cmp = useMemo(() => compareRuns(latest, prev), [latest, prev]);

  return (
    <>
      <p className="mb-4 text-sm text-muted">CI/CD cho prompt: lưu prompt + bộ test, chạy "khám sức khoẻ" và bắt <span className="font-semibold text-ink">hồi quy</span> giữa các lần / khi đổi model. <span className="text-faint">(Chạy ở client, lưu lịch sử {user ? 'Firestore' : 'cục bộ'}.)</span></p>

      {/* Thanh chọn suite */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {suites.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveId(s.id)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${s.id === activeId ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-line bg-surface text-muted hover:bg-hover'}`}
          >
            <Activity size={12} /> {s.name}
          </button>
        ))}
        <button onClick={createSuite} className="flex items-center gap-1 rounded-full border border-dashed border-line px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-hover dark:text-emerald-400"><Plus size={13} /> Suite mới</button>
      </div>

      {!active ? (
        <div className="rounded-2xl border border-dashed border-line bg-panel p-10 text-center text-sm text-muted">Chưa có suite nào. Tạo "Suite mới" để bắt đầu theo dõi sức khoẻ prompt.</div>
      ) : (
        <div className="space-y-4">
          {/* Cấu hình suite */}
          <div className="rounded-2xl border border-line bg-panel p-5">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <input
                value={active.name}
                onChange={(e) => patchActive({ name: e.target.value })}
                className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <select value={active.model} onChange={(e) => patchActive({ model: e.target.value })} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink">
                {ALL_MODEL_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <button onClick={() => removeSuite(active.id, active.name)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30" title="Xoá suite" aria-label="Xoá suite"><Trash2 size={15} /></button>
            </div>

            {/* H3: bật cron — Vercel Cron chạy suite này hằng ngày, kết quả tự cộng vào lịch sử run. */}
            <label className="mb-4 flex cursor-pointer items-center gap-2 text-xs font-semibold text-muted">
              <input
                type="checkbox"
                checked={active.cronEnabled === true}
                onChange={(e) => patchActive({ cronEnabled: e.target.checked })}
                className="h-4 w-4 accent-emerald-600"
              />
              <span>
                Tự động chạy hằng ngày (server)
                {!user && <span className="ml-1 text-xs text-amber-500">— cần đăng nhập &amp; bấm Lưu để suite lên cloud</span>}
              </span>
            </label>

            {/* Prompt Git: nguồn prompt (template trong thư viện) */}
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-muted">Nguồn:</span>
              <select
                value={active.source?.id || ''}
                onChange={(e) => linkTemplate(e.target.value)}
                className="max-w-xs rounded-lg border border-line bg-surface px-2 py-1 text-ink"
              >
                <option value="">— Không liên kết —</option>
                {active.source && !sourceTemplate && <option value={active.source.id}>{active.source.title || 'Template'} (không còn trong thư viện)</option>}
                {libraryTemplates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
              {sourceTemplate && (
                <button onClick={syncFromSource} className="flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-emerald-600 hover:bg-hover dark:text-emerald-400" title="Lấy nội dung mới nhất của template thành phiên bản mới">
                  <RefreshCw size={12} /> Đồng bộ từ nguồn
                </button>
              )}
              {onApplyTemplate && active.prompt.trim() && (
                <button onClick={openInBuilder} className="flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-muted hover:bg-hover" title="Mở phiên bản hiện hành trong Builder để sửa/lưu thành template">
                  <ExternalLink size={12} /> Mở trong Builder
                </button>
              )}
            </div>

            <label className="mb-1.5 flex items-center gap-2 text-xs font-bold text-muted">
              Prompt được kiểm thử
              {hasUncommittedPrompt(active) && (active.revisions || []).length > 0 && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">Đã sửa — chạy hoặc Lưu để tạo phiên bản mới</span>
              )}
            </label>
            <textarea
              value={active.prompt}
              onChange={(e) => patchActive({ prompt: e.target.value })}
              rows={3}
              placeholder="Prompt / chỉ dẫn hệ thống cần theo dõi chất lượng theo thời gian."
              className="mb-4 w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />

            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-bold text-muted">Bộ test ({active.testCases.length})</label>
              <button onClick={addTest} className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"><Plus size={13} /> Thêm test</button>
            </div>
            <div className="space-y-3">
              {active.testCases.map((t, i) => {
                const delta = cmp.perTest[t.id];
                const latestRes = latest?.results.find((r) => r.testId === t.id);
                return (
                  <div key={t.id} className="rounded-xl border border-line bg-surface p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-bold text-faint">
                        Test {i + 1}
                        {latestRes && <span className={`text-sm font-black ${scoreColor(latestRes.score)}`}>{latestRes.score}</span>}
                        {typeof delta === 'number' && delta !== 0 && (
                          <span className={`flex items-center gap-0.5 text-xs ${delta > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {delta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{delta > 0 ? '+' : ''}{delta}
                          </span>
                        )}
                      </span>
                      <button onClick={() => removeTest(t.id)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30" aria-label="Xoá test"><Trash2 size={12} /></button>
                    </div>
                    <textarea
                      value={t.input}
                      onChange={(e) => updateTest(t.id, { input: e.target.value })}
                      rows={2}
                      placeholder="Đầu vào thử…"
                      className="mb-2 w-full resize-y rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs text-ink placeholder:text-faint focus:border-emerald-500 focus:outline-none"
                    />
                    <textarea
                      value={t.criteria.join('\n')}
                      onChange={(e) => updateTest(t.id, { criteria: e.target.value.split('\n').map((c) => c.trim()).filter(Boolean) })}
                      rows={2}
                      placeholder="Tiêu chí chấm — mỗi dòng một tiêu chí…"
                      className="w-full resize-y rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs text-ink placeholder:text-faint focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button onClick={runCheck} disabled={running} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60">
                {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                {running ? 'Đang khám…' : 'Chạy kiểm tra'}
              </button>
              <button onClick={saveActive} disabled={saving} className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-muted hover:bg-hover disabled:opacity-60">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Lưu
              </button>
            </div>
          </div>

          {!running && <OptimizeSuggestion suite={active} signedIn={!!user} onAccept={acceptOptimized} />}

          {verdict?.ready && (
            <div className={`rounded-2xl border p-4 text-sm ${verdict.ok ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/20' : 'border-rose-300 bg-rose-50/60 dark:border-rose-800 dark:bg-rose-950/20'}`}>
              <div className="flex flex-wrap items-center gap-2 text-ink">
                {verdict.ok
                  ? <>Bản tối ưu <b>đạt</b> trên toàn suite ({verdict.avgDelta! >= 0 ? '+' : ''}{verdict.avgDelta} điểm TB), không test nào tụt quá {REGRESSION_DROP} điểm. Đang là phiên bản hiện hành.</>
                  : <>Bản tối ưu <b>chưa đạt</b> trên toàn suite: TB {verdict.avgDelta! >= 0 ? '+' : ''}{verdict.avgDelta} điểm{verdict.regressions.length > 0 && <>, tụt quá {REGRESSION_DROP} điểm ở {verdict.regressions.map((r) => `Test ${testNo(r.testId)} (${r.scoreA}→${r.scoreB})`).join(', ')}</>}.</>}
                <span className="ml-auto flex gap-2">
                  {!verdict.ok && active.headRevisionId === pendingJudge!.newRevId && (
                    <button
                      onClick={async () => { await replaceAndSave(restoreRevision(active, pendingJudge!.oldRevId)); setPendingJudge(null); toast.success('Đã quay lại bản trước.'); }}
                      className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500"
                    >
                      Quay lại bản trước
                    </button>
                  )}
                  <button onClick={() => setPendingJudge(null)} className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted hover:bg-hover">Đóng</button>
                </span>
              </div>
            </div>
          )}

          <RevisionTimeline suite={active} onRestore={restore} />

          {/* Kết quả & lịch sử */}
          {latest && (
            <div className="rounded-2xl border border-line bg-panel p-5">
              <div className="mb-4 flex flex-wrap items-center gap-5">
                <div>
                  <div className="text-xs font-semibold text-faint">điểm sức khoẻ</div>
                  <div className={`text-3xl font-black ${scoreColor(latest.avgScore)}`}>{latest.avgScore}</div>
                </div>
                {cmp.avgDelta !== null && (
                  <div className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${cmp.avgDelta > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : cmp.avgDelta < 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                    {cmp.avgDelta > 0 ? <TrendingUp size={14} /> : cmp.avgDelta < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                    {cmp.avgDelta > 0 ? '+' : ''}{cmp.avgDelta} so với lần trước
                  </div>
                )}
                {cmp.avgDelta !== null && cmp.avgDelta <= -5 && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"><AlertTriangle size={12} /> Hồi quy</span>
                )}
                {cmp.modelChanged && <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">Đổi model</span>}
              </div>

              <div className="text-xs font-bold text-muted">Lịch sử ({active.runs.length})</div>
              <div className="mt-2 space-y-1.5">
                {active.runs.map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-surface px-3 py-1.5 text-xs">
                    <span className="text-muted">{new Date(r.at).toLocaleString()} · {r.model}</span>
                    <span className={`font-black ${scoreColor(r.avgScore)}`}>{r.avgScore}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
