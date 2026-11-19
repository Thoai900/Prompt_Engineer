import React, { useEffect, useMemo, useState } from 'react';
import { KeyRound, Loader2, Copy, Check, Plus, Ban, Plug, Bot } from 'lucide-react';
import { PromptProject } from '../../../types';
import { publishApp, getAppApiState } from '../../../services/chainAppService';
import { listApiKeys, createApiKey, revokeApiKey, type ApiKeyInfo } from '../../../services/apiKeyService';
import { buildPublishSnapshot, buildCurlExample, buildMcpSetup, quotaToday } from '../../../utils/apiAccess';
import { toast } from '../../common/Toaster';
import { confirmDialog } from '../../common/ConfirmDialog';

interface Props {
  project: PromptProject;
  user: { uid: string };
}

/** Chủ app: bật API cho app, xem ví dụ gọi, quản lý API key (Đợt 2 — spec #4). */
export default function ApiAccessPanel({ project, user }: Props) {
  const snapshot = useMemo(() => buildPublishSnapshot(project), [project]);
  const apiUrl = `${window.location.origin}/api/run`;
  const mcpUrl = `${window.location.origin}/api/mcp`;

  const [state, setState] = useState<{ published: boolean; apiEnabled: boolean } | null>(null);
  const [toggling, setToggling] = useState(false);
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [keyName, setKeyName] = useState('');
  const [onlyThisApp, setOnlyThisApp] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    let off = false;
    getAppApiState(project.id).then((s) => { if (!off) setState(s); });
    listApiKeys(user).then((k) => { if (!off) setKeys(k); });
    return () => { off = true; };
  }, [project.id, user]);

  const copy = async (id: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied((c) => (c === id ? '' : c)), 2000); }
    catch { toast.error('Không sao chép được.'); }
  };

  const toggleApi = async (enabled: boolean) => {
    if (enabled && !(await confirmDialog({
      message: 'Bật API: ai có API key của bạn sẽ chạy được app này bằng key AI của hệ thống (giới hạn 100 lượt/ngày mỗi key). Prompt của app vẫn công khai như link chia sẻ. Tiếp tục?',
      confirmText: 'Bật API',
    }))) return;
    setToggling(true);
    try {
      await publishApp(user, project, { apiEnabled: enabled }); // xuất bản lại → snapshot API luôn khớp graph hiện tại
      setState({ published: true, apiEnabled: enabled });
      toast.success(enabled ? 'Đã bật API cho app (và cập nhật bản xuất bản).' : 'Đã tắt API cho app.');
    } catch (e: any) {
      toast.error(e?.message || 'Không cập nhật được.');
    } finally {
      setToggling(false);
    }
  };

  const create = async () => {
    setCreating(true);
    try {
      const key = await createApiKey(user, keyName || 'API key', onlyThisApp ? [project.id] : ['*']);
      setNewKey(key);
      setKeyName('');
      setKeys(await listApiKeys(user));
    } catch {
      toast.error('Không tạo được API key.');
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (k: ApiKeyInfo) => {
    if (!(await confirmDialog({ message: `Thu hồi key "${k.name}" (${k.prefix}…)? Mọi nơi đang dùng key này sẽ ngừng chạy ngay.`, danger: true, confirmText: 'Thu hồi' }))) return;
    try {
      await revokeApiKey(k.id);
      setKeys((prev) => prev.map((x) => (x.id === k.id ? { ...x, revoked: true } : x)));
    } catch {
      toast.error('Không thu hồi được key.');
    }
  };

  const curl = snapshot ? buildCurlExample(apiUrl, project.id, snapshot.variables) : '';
  // Key vừa tạo thì điền thẳng vào lệnh (chỉ trong phiên này); còn lại dùng chỗ giữ.
  const mcpSetup = buildMcpSetup(mcpUrl, newKey || undefined);
  const today = quotaToday();

  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink"><Plug size={15} className="text-emerald-500" /> Gọi app qua API &amp; MCP</div>

      {!snapshot ? (
        <p className="text-xs text-muted">App này không bật API được: chỉ Prompt Graph có prompt (không trống, ≤ 50.000 ký tự, ≤ 30 biến) quy được về một lời gọi.</p>
      ) : (
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={!!state?.apiEnabled}
              disabled={!state || toggling}
              onChange={(e) => toggleApi(e.target.checked)}
              className="h-4 w-4 accent-emerald-600"
            />
            Cho phép gọi app này qua API
            {toggling && <Loader2 size={14} className="animate-spin text-muted" />}
          </label>
          {state?.apiEnabled && (
            <p className="text-xs text-faint">API chạy theo bản ĐÃ XUẤT BẢN. Sửa graph xong, bấm "Xuất bản dạng App" để API dùng bản mới.</p>
          )}

          {state?.apiEnabled && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-bold text-muted">Ví dụ gọi</span>
                <button onClick={() => copy('curl', curl)} className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {copied === 'curl' ? <Check size={12} /> : <Copy size={12} />} Sao chép
                </button>
              </div>
              <pre className="overflow-x-auto rounded-xl border border-line bg-surface p-3 font-mono text-xs text-ink">{curl}</pre>
              <p className="mt-1 text-xs text-faint">
                Trả về <code>{'{ "output": "…", "model": "…", "usage": { "today", "quota" } }'}</code>. Gửi kèm header
                <code> X-Gemini-Api-Key</code> hoặc <code>X-Groq-Api-Key</code> để chạy bằng key AI của bạn và không tính lượt. Chỉ gọi từ server — đừng nhúng API key vào trang web.
              </p>
            </div>
          )}

          {state?.apiEnabled && (
            <div className="border-t border-line pt-4">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-muted"><Bot size={13} /> Dùng như MCP server cho agent</div>
              <p className="mb-2 text-xs text-faint">
                Mỗi app đã bật API (trong phạm vi key) thành một tool; agent tự điền biến theo mô tả. Dùng chung quota với API.
              </p>
              <div className="space-y-2">
                {mcpSetup.map((m) => (
                  <div key={m.label}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-semibold text-ink">{m.label}</span>
                      <button onClick={() => copy(m.label, m.text)} className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {copied === m.label ? <Check size={12} /> : <Copy size={12} />} Sao chép
                      </button>
                    </div>
                    <pre className="overflow-x-auto rounded-xl border border-line bg-surface p-3 font-mono text-xs text-ink">{m.text}</pre>
                    {m.note && <p className="mt-1 text-xs text-faint">{m.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-line pt-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted"><KeyRound size={13} /> API key của bạn</div>

            {newKey && (
              <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-800 dark:bg-amber-950/30">
                <p className="mb-1.5 font-semibold text-amber-700 dark:text-amber-300">Sao chép key ngay — key chỉ hiện MỘT lần này.</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all font-mono text-ink">{newKey}</code>
                  <button onClick={() => copy('newkey', newKey)} className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1 font-bold text-white">
                    {copied === 'newkey' ? <Check size={12} /> : 'Sao chép'}
                  </button>
                </div>
                <button onClick={() => setNewKey('')} className="mt-2 text-faint underline">Tôi đã lưu key</button>
              </div>
            )}

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="Tên key (vd: n8n, server-bot)"
                maxLength={100}
                className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-faint focus:border-emerald-500 focus:outline-none"
              />
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <input type="checkbox" checked={onlyThisApp} onChange={(e) => setOnlyThisApp(e.target.checked)} className="h-3.5 w-3.5 accent-emerald-600" />
                Chỉ app này
              </label>
              <button onClick={create} disabled={creating} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-60">
                {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Tạo key
              </button>
            </div>

            {keys.length === 0 ? (
              <p className="text-xs text-faint">Chưa có key. Mặc định một key gọi được mọi app bạn đã bật API.</p>
            ) : (
              <div className="space-y-1.5">
                {keys.map((k) => (
                  <div key={k.id} className={`flex flex-wrap items-center gap-2 rounded-lg bg-surface px-3 py-2 text-xs ${k.revoked ? 'opacity-50' : ''}`}>
                    <span className="font-semibold text-ink">{k.name}</span>
                    <code className="text-faint">{k.prefix}…</code>
                    <span className="text-muted">{k.appIds.includes('*') ? 'mọi app' : k.appIds.includes(project.id) ? 'app này' : `${k.appIds.length} app khác`}</span>
                    <span className="ml-auto text-muted">
                      {k.revoked ? 'đã thu hồi' : `${k.usage.day === today ? k.usage.count : 0}/${k.dailyQuota} lượt hôm nay`}
                    </span>
                    {!k.revoked && (
                      <button onClick={() => revoke(k)} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-faint hover:bg-hover hover:text-rose-500" aria-label={`Thu hồi key ${k.name}`}>
                        <Ban size={12} /> Thu hồi
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
