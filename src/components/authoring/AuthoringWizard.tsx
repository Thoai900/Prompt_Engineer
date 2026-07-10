import { toast } from '../common/Toaster';
import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { Sparkles, X, RefreshCw, Download, AlertTriangle, CheckCircle2, ChevronLeft } from 'lucide-react';
import { AiSkill, AiRule, CustomProfile } from '../../types';
import { draftSkillFromBrief, draftRuleFromBrief, draftProfileFromBrief } from '../../services/aiService';
import { lintSkill, lintRule, lintProfile, LintFinding } from '../../utils/authoringLint';
import { toSkillMd, toCursorrules, toAgentsMd, toClaudeMd, downloadText } from '../../utils/exporters';
import { persistImport } from '../../services/importService';

type Kind = 'skill' | 'rule' | 'config';

interface Props {
  open: boolean;
  onClose: () => void;
  user: User | null;
  defaultKind?: Kind;
  model: string;
  onCreated: (kind: Kind) => void;
}

const KIND_LABEL: Record<Kind, string> = { skill: 'Skill', rule: 'Rule', config: 'LLM Config' };

function assembleSkill(d: any): AiSkill {
  return { id: `skill-${Date.now()}`, title: d.title || 'Kỹ năng mới', description: d.description || '', inputs: d.inputs || [], steps: d.steps || [], instructions: d.instructions || '', updatedAt: new Date().toISOString() };
}
function assembleRule(d: any): AiRule {
  return { id: `rule-${Date.now()}`, title: d.title || 'Quy tắc mới', description: d.description || '', content: d.content || '', type: 'system-rules', tags: d.tags || [], updatedAt: new Date().toISOString() };
}
function assembleProfile(d: any): CustomProfile {
  return { id: `profile-${Date.now()}`, name: d.name || 'Cấu hình mới', role: d.role || '', context: d.context || '', constraints: d.constraints || '', outputFormat: d.outputFormat || '' };
}

export default function AuthoringWizard({ open, onClose, user, defaultKind, model, onCreated }: Props) {
  const [kind, setKind] = useState<Kind>(defaultKind || 'skill');
  const [step, setStep] = useState<1 | 2>(1);
  const [brief, setBrief] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setKind(defaultKind || 'skill'); setStep(1); setBrief(''); setDraft(null); setDrafting(false); setSaving(false); }
  }, [open, defaultKind]);

  if (!open) return null;

  const set = (k: string, v: any) => setDraft((d: any) => ({ ...d, [k]: v }));

  const handleDraft = async () => {
    if (!brief.trim()) { toast('Hãy mô tả một câu về thứ bạn muốn tạo.'); return; }
    setDrafting(true);
    try {
      const opts = { model };
      const d = kind === 'skill' ? await draftSkillFromBrief(brief, opts)
        : kind === 'rule' ? await draftRuleFromBrief(brief, opts)
        : await draftProfileFromBrief(brief, opts);
      setDraft(d);
      setStep(2);
    } catch (e) {
      console.error(e);
      toast.error('AI dựng nháp thất bại — kiểm tra API key/kết nối rồi thử lại.');
    } finally {
      setDrafting(false);
    }
  };

  const findings: LintFinding[] = !draft ? [] :
    kind === 'skill' ? lintSkill(assembleSkill(draft)) :
    kind === 'rule' ? lintRule(assembleRule(draft)) :
    lintProfile(assembleProfile(draft));

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const routed = kind === 'skill' ? { target: 'skill' as const, skill: assembleSkill(draft) }
        : kind === 'rule' ? { target: 'rule' as const, rule: assembleRule(draft) }
        : { target: 'config' as const, profile: assembleProfile(draft) };
      await persistImport(routed, user);
      toast.success(`Đã tạo ${KIND_LABEL[kind]} "${draft.title || draft.name}".`);
      onCreated(kind);
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Lưu thất bại. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const doExport = (fmt: string) => {
    const obj = kind === 'skill' ? assembleSkill(draft) : assembleRule(draft);
    const slug = (draft.title || 'export').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export';
    if (fmt === 'skill') downloadText('SKILL.md', toSkillMd(obj));
    else if (fmt === 'cursor') downloadText('.cursorrules', toCursorrules(obj));
    else if (fmt === 'agents') downloadText('AGENTS.md', toAgentsMd(obj));
    else if (fmt === 'claude') downloadText('CLAUDE.md', toClaudeMd(obj));
    else downloadText(`${slug}.md`, toAgentsMd(obj));
  };

  const inputCls = 'w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 focus:outline-none focus:border-indigo-500 text-slate-700 dark:text-slate-200';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999] animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-250 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-2">
            <Sparkles className="text-indigo-600 w-5 h-5" />
            <h2 className="font-bold text-sm text-slate-800 dark:text-white">Tạo bằng AI — {KIND_LABEL[kind]}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
          {step === 1 ? (
            <>
              {/* Chọn loại */}
              <div className="flex bg-slate-100 dark:bg-slate-950 p-0.5 rounded-xl border border-slate-200/50 dark:border-slate-800 w-fit">
                {(['skill', 'rule', 'config'] as Kind[]).map((k) => (
                  <button key={k} onClick={() => setKind(k)}
                    className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${kind === k ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    {KIND_LABEL[k]}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Mô tả một câu</label>
                <textarea value={brief} onChange={(e) => setBrief(e.target.value)}
                  placeholder={kind === 'skill' ? 'Ví dụ: kỹ năng review code TypeScript và đề xuất sửa'
                    : kind === 'rule' ? 'Ví dụ: quy tắc gia sư Socratic không giải hộ bài'
                    : 'Ví dụ: trợ lý copywriter cho landing page SaaS'}
                  className={`${inputCls} h-24 resize-none leading-relaxed`} />
              </div>
              <button onClick={handleDraft} disabled={drafting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
                {drafting ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {drafting ? 'AI đang dựng nháp…' : 'AI dựng nháp'}
              </button>
            </>
          ) : draft && (
            <>
              <button onClick={() => setStep(1)} className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline cursor-pointer"><ChevronLeft size={13} /> Sửa mô tả</button>

              {/* Lint */}
              {findings.length === 0 ? (
                <div className="flex items-center gap-2 text-[11px] text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40 rounded-lg px-3 py-2">
                  <CheckCircle2 size={13} /> Không phát hiện vấn đề — sẵn sàng lưu.
                </div>
              ) : (
                <div className="space-y-1">
                  {findings.map((f, i) => (
                    <div key={i} className={`flex items-start gap-2 text-[11px] rounded-lg px-3 py-1.5 ${f.level === 'error' ? 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20' : 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20'}`}>
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" /> <span>{f.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Review fields */}
              {kind === 'config' ? (
                <>
                  <Field label="Tên"><input value={draft.name || ''} onChange={(e) => set('name', e.target.value)} className={inputCls} /></Field>
                  <Field label="Vai trò (Role)"><textarea value={draft.role || ''} onChange={(e) => set('role', e.target.value)} className={`${inputCls} h-16 resize-none`} /></Field>
                  <Field label="Bối cảnh (Context)"><textarea value={draft.context || ''} onChange={(e) => set('context', e.target.value)} className={`${inputCls} h-16 resize-none`} /></Field>
                  <Field label="Ràng buộc"><textarea value={draft.constraints || ''} onChange={(e) => set('constraints', e.target.value)} className={`${inputCls} h-16 resize-none`} /></Field>
                  <Field label="Định dạng đầu ra"><textarea value={draft.outputFormat || ''} onChange={(e) => set('outputFormat', e.target.value)} className={`${inputCls} h-16 resize-none`} /></Field>
                </>
              ) : (
                <>
                  <Field label="Tiêu đề"><input value={draft.title || ''} onChange={(e) => set('title', e.target.value)} className={inputCls} /></Field>
                  <Field label="Mô tả"><input value={draft.description || ''} onChange={(e) => set('description', e.target.value)} className={inputCls} /></Field>
                  {kind === 'skill' ? (
                    <>
                      {(draft.inputs?.length || draft.steps?.length) ? (
                        <p className="text-[10px] text-slate-400">
                          {draft.inputs?.length || 0} input · {draft.steps?.length || 0} step (tinh chỉnh chi tiết trong editor sau khi lưu)
                        </p>
                      ) : null}
                      <Field label="Chỉ dẫn (Instructions)"><textarea value={draft.instructions || ''} onChange={(e) => set('instructions', e.target.value)} className={`${inputCls} h-32 resize-none font-mono`} /></Field>
                    </>
                  ) : (
                    <Field label="Nội dung quy tắc"><textarea value={draft.content || ''} onChange={(e) => set('content', e.target.value)} className={`${inputCls} h-40 resize-none font-mono`} /></Field>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {step === 2 && draft && (
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-950/40">
            {kind !== 'config' ? (
              <div className="relative group">
                <button className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-350 flex items-center gap-1.5 cursor-pointer">
                  <Download size={13} /> Xuất
                </button>
                <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block group-focus-within:block bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-20 py-1 min-w-[140px]">
                  {[['skill', 'SKILL.md'], ['cursor', '.cursorrules'], ['agents', 'AGENTS.md'], ['claude', 'CLAUDE.md']].map(([f, l]) => (
                    <button key={f} onClick={() => doExport(f)} className="w-full text-left px-3.5 py-2 text-[11px] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">{l}</button>
                  ))}
                </div>
              </div>
            ) : <span />}
            <button onClick={handleSave} disabled={saving || findings.some((f) => f.level === 'error')}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              title={findings.some((f) => f.level === 'error') ? 'Sửa các lỗi (error) trước khi lưu' : ''}>
              {saving && <RefreshCw size={13} className="animate-spin" />} Lưu vào thư viện
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{label}</label>
      {children}
    </div>
  );
}
