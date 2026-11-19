import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package, X, Download, Copy, Check } from 'lucide-react';
import { PromptProject } from '../../../types';
import { graphToSkillMd, graphSkillInstallCommands, downloadText } from '../../../utils/exporters';
import { slugifySkill } from '../../../utils/agentInstall';
import { toast } from '../../common/Toaster';

interface ExportSkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: PromptProject | null;
}

/** Xuất Prompt Graph thành Agent Skill: xem trước SKILL.md, tải về, hoặc chép lệnh cài cho từng agent. */
export const ExportSkillModal: React.FC<ExportSkillModalProps> = ({ isOpen, onClose, project }) => {
  const md = useMemo(() => (project ? graphToSkillMd(project) : null), [project]);
  const commands = useMemo(() => (project ? graphSkillInstallCommands(project) : []), [project]);
  const slug = project ? slugifySkill(project.name) : 'skill';
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      toast.error('Không sao chép được.');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && project && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-skill-title"
            className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-line bg-panel p-5 shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-line pb-3">
              <h3 id="export-skill-title" className="flex items-center gap-1.5 text-sm font-bold text-ink">
                <Package size={16} className="text-emerald-500" /> Xuất thành Agent Skill
              </h3>
              <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-hover" aria-label="Đóng">
                <X size={16} />
              </button>
            </div>

            {!md ? (
              <p className="my-6 text-sm text-muted">
                Không xuất được: prompt đang trống, hoặc đây là Project Chain dạng cây (cũ) chạy nhiều bước — chỉ Prompt Graph quy được về một skill.
              </p>
            ) : (
              <div className="my-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 text-left">
                <p className="text-xs text-muted">
                  Agent (Claude Code, Codex…) đọc file này như một skill: tự điền các <code>{'{{biến}}'}</code> từ yêu cầu của bạn, rồi làm theo prompt.
                </p>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-bold text-muted">SKILL.md</span>
                    <div className="flex gap-2">
                      <button onClick={() => copy('md', md)} className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-muted hover:bg-hover">
                        {copied === 'md' ? <Check size={12} /> : <Copy size={12} />} Sao chép
                      </button>
                      <button onClick={() => downloadText('SKILL.md', md)} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-500">
                        <Download size={12} /> Tải SKILL.md
                      </button>
                    </div>
                  </div>
                  <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl border border-line bg-surface p-3 font-mono text-xs text-ink">{md}</pre>
                  <p className="mt-1 text-xs text-faint">Tải về thì đặt vào thư mục <code>~/.claude/skills/{slug}/</code> (hoặc thư mục skills của agent bạn dùng).</p>
                </div>

                <div>
                  <div className="mb-1.5 text-xs font-bold text-muted">Hoặc cài bằng một lệnh (macOS / Linux / WSL)</div>
                  <div className="space-y-2">
                    {commands.map((c) => (
                      <div key={c.agent} className="rounded-xl border border-line bg-surface p-2.5">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-ink">{c.agent}</span>
                          <button onClick={() => copy(c.agent, c.command)} className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold text-emerald-600 hover:bg-hover dark:text-emerald-400">
                            {copied === c.agent ? <Check size={12} /> : <Copy size={12} />} Sao chép lệnh
                          </button>
                        </div>
                        <code className="block truncate font-mono text-xs text-muted" title={c.command}>{c.command.split('\n')[0]} …</code>
                        {c.note && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{c.note}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
