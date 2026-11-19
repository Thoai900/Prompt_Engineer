import React, { useEffect, useMemo, useState } from 'react';
import { AppWindow, Play, Loader2, Share2, Check, AlertCircle, Rocket, Activity } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { PromptProject } from '../../types';
import {
  loadLocalProjects, collectChainInputs, runChainApp, publishApp, loadSharedApp, buildAppUrl, type ChainStep,
} from '../../services/chainAppService';
import { toast } from '../common/Toaster';
import FeedbackForm from '../lab/health/FeedbackForm';
import { loadHealthSuites, newHealthSuite, saveHealthSuite } from '../../services/healthService';
import { compileAppTemplate, effectiveInputs, appTemplateHash } from '../../utils/feedbackUtils';
import { commitRevision } from '../../utils/promptRevisions';
import { GEMINI_FLASH } from '../../config/models';

interface AppPanelProps {
  /** Chọn sẵn dự án đang mở trong Project Chain. */
  initialProjectId?: string;
  /** Mở Prompt Health ở suite vừa tạo/tìm thấy cho app. */
  onOpenHealth?: (suiteId: string) => void;
}

/**
 * Chain → App: chạy một Project Chain như một app (form biến → output), chia sẻ qua link.
 * Hiển thị trong Project Chain (nút "Chạy như App"); trước đây là chế độ trong Lab.
 */
export default function AppPanel({ initialProjectId, onOpenHealth }: AppPanelProps) {
  const { user, geminiApiKey, groqApiKey, openaiApiKey, useSystemGeminiKey, activeWorkspaceId } = useWorkspace();

  const [localProjects] = useState<PromptProject[]>(() => loadLocalProjects());
  const [sharedApp, setSharedApp] = useState<PromptProject | null>(null);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(() => {
    const list = loadLocalProjects();
    return list.find((p) => p.id === initialProjectId)?.id || list[0]?.id || '';
  });
  const [values, setValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<ChainStep[] | null>(null);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [openingSuite, setOpeningSuite] = useState(false);
  // Giá trị biến của LẦN CHẠY gần nhất (chụp lúc bấm Chạy) — gửi kèm phản hồi.
  const [ranInputs, setRanInputs] = useState<Record<string, string>>({});

  // Deep-link ?app=<id> → nạp app đã chia sẻ (public), rồi dọn URL.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('app');
    if (!id) return;
    setSharedLoading(true);
    loadSharedApp(id)
      .then((p) => { setSharedApp(p); if (!p) setError('Không tìm thấy app được chia sẻ (có thể đã gỡ).'); })
      .finally(() => setSharedLoading(false));
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash || '#projectchain'}`);
  }, []);

  const activeProject = sharedApp || localProjects.find((p) => p.id === selectedId) || null;
  const inputs = useMemo(() => (activeProject ? collectChainInputs(activeProject) : []), [activeProject]);

  useEffect(() => {
    if (!activeProject) return;
    const init: Record<string, string> = {};
    for (const f of collectChainInputs(activeProject)) init[f.name] = f.defaultValue || '';
    setValues(init);
    setSteps(null);
    setError('');
    setShareUrl('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?.id]);

  const apiKeys = {
    gemini: useSystemGeminiKey ? undefined : (geminiApiKey || undefined),
    groq: groqApiKey || undefined,
    openai: openaiApiKey || undefined,
  };

  const run = async () => {
    if (!activeProject) return;
    setRunning(true);
    setError('');
    setSteps([]);
    setRanInputs(effectiveInputs(collectChainInputs(activeProject), values));
    try {
      const result = await runChainApp(activeProject, values, apiKeys, (s) => setSteps((prev) => [...(prev || []), s]));
      setSteps(result.steps);
    } catch (e: any) {
      setError(e?.message || 'Chạy app thất bại.');
    } finally {
      setRunning(false);
    }
  };

  const publish = async () => {
    if (!activeProject) return;
    if (!user) { toast.error('Cần đăng nhập để xuất bản app.'); return; }
    setPublishing(true);
    try {
      const id = await publishApp(user, activeProject);
      const url = buildAppUrl(id);
      setShareUrl(url);
      navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
      toast.success('Đã xuất bản & sao chép link chia sẻ.');
    } catch {
      toast.error('Không xuất bản được app.');
    } finally {
      setPublishing(false);
    }
  };

  // Flywheel: tạo (hoặc mở) Health suite theo dõi app này — prompt MẪU giữ {{biến}}.
  const openHealthSuite = async () => {
    if (!activeProject || !user || !onOpenHealth) return;
    const template = compileAppTemplate(activeProject);
    if (!template) { toast.error('Chỉ hỗ trợ Project Chain dạng Prompt Graph (v3).'); return; }
    setOpeningSuite(true);
    try {
      const existing = (await loadHealthSuites(user)).find((s) => s.source?.kind === 'sharedApp' && s.source.id === activeProject.id);
      if (existing) { onOpenHealth(existing.id); return; }
      let suite = newHealthSuite(`App: ${activeProject.name}`, GEMINI_FLASH); // cùng model app dùng khi chạy
      if (activeWorkspaceId) suite.workspaceId = activeWorkspaceId;
      suite.source = { kind: 'sharedApp', id: activeProject.id, title: activeProject.name };
      suite = commitRevision(suite, template, 'source-sync', 'Prompt mẫu của app');
      await saveHealthSuite(user, suite);
      onOpenHealth(suite.id);
    } catch {
      toast.error('Không tạo được suite.');
    } finally {
      setOpeningSuite(false);
    }
  };

  const finalOutput = steps && steps.length > 0 && !running ? steps[steps.length - 1].output : '';
  const canFeedback = !!sharedApp && !!user && !!sharedApp.userId && sharedApp.userId !== user.uid;

  return (
    <>
      <p className="mb-4 text-sm text-muted">Biến một <span className="font-semibold text-ink">Project Chain</span> thành app: điền biến → chạy cả chuỗi → nhận kết quả. Chia sẻ bằng link; người nhận chạy bằng tài khoản của họ (an toàn, không mở API công khai).</p>

      {sharedLoading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-panel p-6 text-sm text-muted"><Loader2 size={16} className="animate-spin" /> Đang tải app được chia sẻ…</div>
      ) : !activeProject ? (
        <div className="rounded-2xl border border-dashed border-line bg-panel p-8 text-center text-sm text-muted">
          Chưa có dự án nào ở máy này. Hãy tạo một dự án ở danh sách bên trái trước.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Chọn / thông tin app */}
          <div className="rounded-2xl border border-line bg-panel p-5">
            {sharedApp ? (
              <div className="mb-3 flex items-center gap-2 text-sm">
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">App chia sẻ</span>
                <span className="font-bold text-ink">{activeProject.name}</span>
              </div>
            ) : (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <AppWindow size={16} className="text-emerald-500" />
                <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink">
                  {localProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {user && onOpenHealth && (
                  <button
                    onClick={openHealthSuite}
                    disabled={openingSuite}
                    title="Theo dõi chất lượng app bằng Prompt Health; phản hồi của người dùng app (khi đã xuất bản) đổ về suite này"
                    className="ml-auto flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-muted hover:bg-hover disabled:opacity-60"
                  >
                    {openingSuite ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />} Suite kiểm thử
                  </button>
                )}
                <button onClick={publish} disabled={publishing} className={`${user && onOpenHealth ? '' : 'ml-auto '}flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-muted hover:bg-hover disabled:opacity-60`}>
                  {publishing ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />} Xuất bản dạng App
                </button>
              </div>
            )}

            {activeProject.description && <p className="mb-4 text-xs text-faint">{activeProject.description}</p>}

            {shareUrl && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-2.5 text-xs dark:bg-emerald-950/30">
                <Share2 size={13} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                <input readOnly value={shareUrl} className="flex-1 bg-transparent text-emerald-700 outline-none dark:text-emerald-300" onFocus={(e) => e.target.select()} />
                <button onClick={() => { navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="shrink-0 text-emerald-600 dark:text-emerald-400">{copied ? <Check size={14} /> : 'Copy'}</button>
              </div>
            )}

            {/* Form biến đầu vào */}
            {inputs.length > 0 ? (
              <div className="mb-4 space-y-3">
                {inputs.map((f) => (
                  <div key={f.name}>
                    <label className="mb-1 block text-xs font-bold text-ink">{f.name}{f.required && <span className="text-rose-500"> *</span>}</label>
                    {f.description && <p className="mb-1 text-xs text-faint">{f.description}</p>}
                    <input
                      value={values[f.name] ?? ''}
                      onChange={(e) => setValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
                      placeholder={f.defaultValue || `Nhập ${f.name}…`}
                      className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-4 text-xs text-faint">Chuỗi này không cần biến đầu vào — bấm Chạy để thực thi.</p>
            )}

            <button onClick={run} disabled={running} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60">
              {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {running ? 'Đang chạy app…' : 'Chạy app'}
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-rose-50 p-4 text-sm text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
              <AlertCircle size={16} className="mt-0.5 shrink-0" /><span className="break-words">{error}</span>
            </div>
          )}

          {steps && steps.length > 0 && (
            <div className="space-y-3">
              {steps.map((s, i) => {
                const isFinal = i === steps.length - 1;
                return (
                  <div key={s.nodeId} className={`rounded-2xl border bg-panel p-4 ${isFinal ? 'border-emerald-400 ring-1 ring-emerald-400/40' : 'border-line'}`}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">{i + 1}</span>
                      <span className="text-sm font-bold text-ink">{s.title}</span>
                      {isFinal && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">Kết quả cuối</span>}
                    </div>
                    <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-surface p-3 font-mono text-xs leading-relaxed text-ink">{s.output}</pre>
                  </div>
                );
              })}
            </div>
          )}

          {canFeedback && finalOutput && (
            <FeedbackForm
              key={finalOutput}
              draft={{
                appId: activeProject.id,
                ownerId: sharedApp!.userId!,
                userId: user!.uid,
                inputs: ranInputs,
                output: finalOutput,
                revisionHash: appTemplateHash(activeProject),
              }}
            />
          )}
        </div>
      )}
    </>
  );
}
