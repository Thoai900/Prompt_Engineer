import React from 'react';
import { ExternalLink } from 'lucide-react';
import { toast } from '../common/Toaster';
import { AI_LAUNCH_TARGETS, buildAiLaunchUrl, type AiLaunchTarget } from '../../utils/aiLaunchTargets';

interface OpenInAiBarProps {
  /** Lấy prompt hoàn chỉnh tại thời điểm bấm (đã inject biến số). */
  getPrompt: () => string;
}

/** Hàng nút mở nhanh prompt vừa build trong các nền tảng AI lớn (ChatGPT, Gemini, Claude…). */
export function OpenInAiBar({ getPrompt }: OpenInAiBarProps) {
  const handleLaunch = async (target: AiLaunchTarget) => {
    const prompt = getPrompt().trim();
    if (!prompt) {
      toast.info('Chưa có nội dung prompt để gửi đi.');
      return;
    }

    // Luôn copy vào clipboard làm dự phòng — kể cả khi URL đã prefill sẵn prompt.
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      // Clipboard bị chặn (quyền/không secure context) — vẫn mở trang, chỉ đổi thông báo.
    }

    const { url, prefilled } = buildAiLaunchUrl(target, prompt);
    window.open(url, '_blank', 'noopener,noreferrer');

    if (prefilled) {
      toast.success(`Đã mở ${target.name} kèm sẵn prompt (clipboard có bản dự phòng).`);
    } else {
      toast.success(`Đã sao chép prompt — dán (Ctrl+V) vào ${target.name} để dùng ngay.`);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-455 text-left">
        Dùng ngay với AI
      </span>
      <div className="flex flex-wrap gap-1.5">
        {AI_LAUNCH_TARGETS.map(target => (
          <button
            key={target.id}
            onClick={() => handleLaunch(target)}
            title={`Sao chép prompt & mở ${target.name}`}
            className="touch-manipulation flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-violet-400/50 dark:hover:border-violet-500/40 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-[10px] font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${target.accentClass}`} />
            {target.name}
            <ExternalLink size={10} className="opacity-50" />
          </button>
        ))}
      </div>
    </div>
  );
}
