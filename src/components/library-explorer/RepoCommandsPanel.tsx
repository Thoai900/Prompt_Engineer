import React, { useState } from 'react';
import { Star, ExternalLink, Copy, Check, Terminal, Bot, Download, MessageSquare } from 'lucide-react';
import { RepoHit } from '../../utils/repoInference';
import { buildRepoCommands } from '../../utils/agentInstall';

interface Props {
  repo: RepoHit;
}

/** Panel tổng quan repo + lệnh tải toàn bộ (dùng chung) + prompt ra lệnh cho agent tự cài. */
export default function RepoCommandsPanel({ repo }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const { universal, agents } = buildRepoCommands(repo);

  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
  };

  const CopyBtn = ({ k, text }: { k: string; text: string }) => (
    <button onClick={() => copy(k, text)}
      className="text-[10px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 cursor-pointer shrink-0">
      {copied === k ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
      {copied === k ? 'Đã chép' : 'Chép'}
    </button>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header repo */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {repo.ownerAvatar && (
            <img src={repo.ownerAvatar} alt="" className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          )}
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-slate-800 dark:text-white truncate">{repo.fullName}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
              <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400"><Star size={10} className="fill-current" /> {repo.stars.toLocaleString()}</span>
              {repo.language && <span>{repo.language}</span>}
              {repo.license && <span>{repo.license}</span>}
            </p>
          </div>
        </div>
        <a href={repo.htmlUrl} target="_blank" rel="noopener noreferrer"
          className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-350 flex items-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0">
          <ExternalLink size={12} /> GitHub
        </a>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {repo.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{repo.description}</p>
        )}

        {/* ── Câu lệnh chung: tải TOÀN BỘ repo (để riêng, ai cũng chạy được) ── */}
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/50 overflow-hidden">
          <div className="px-3 py-2 bg-indigo-50 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-900/40 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
            <Download size={12} /> Tải toàn bộ repo về máy (dùng chung)
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {universal.map((u) => (
              <div key={u.label} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{u.label}</span>
                  <CopyBtn k={`u-${u.label}`} text={u.command} />
                </div>
                <code className="block text-[10px] font-mono bg-slate-100 dark:bg-slate-950 rounded px-2 py-1 overflow-x-auto whitespace-pre text-slate-700 dark:text-slate-300">
                  {u.command}
                </code>
                {u.note && <p className="text-[9px] text-slate-400 mt-1">{u.note}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* ── Ra lệnh cho Agent tự tải & kích hoạt: lệnh terminal + prompt ── */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <Bot size={12} /> Ra lệnh cho Agent tự tải &amp; kích hoạt
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {agents.map((a) => (
              <div key={a.agent} className="px-3 py-2.5 space-y-2">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{a.agent}</span>

                {/* Lệnh terminal tải về */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1"><Terminal size={10} /> Lệnh tải</span>
                    <CopyBtn k={`cmd-${a.agent}`} text={a.command} />
                  </div>
                  <code className="block text-[10px] font-mono bg-slate-100 dark:bg-slate-950 rounded px-2 py-1 overflow-x-auto whitespace-pre text-slate-700 dark:text-slate-300">
                    {a.command}
                  </code>
                </div>

                {/* Prompt dán vào agent */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1"><MessageSquare size={10} /> Prompt cho agent</span>
                    <CopyBtn k={`prompt-${a.agent}`} text={a.prompt} />
                  </div>
                  <p className="text-[10px] leading-relaxed bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded px-2 py-1.5 text-slate-600 dark:text-slate-300">
                    {a.prompt}
                  </p>
                </div>

                {a.note && <p className="text-[9px] text-amber-600 dark:text-amber-400">{a.note}</p>}
              </div>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-slate-400 italic">
          Muốn nhập riêng từng skill/rule/config vào thư viện? Chọn một file ở danh sách bên trái.
        </p>
      </div>
    </div>
  );
}
