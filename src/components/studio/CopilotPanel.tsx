/**
 * Đợt 3 — chế độ Copilot: thay thanh bước bằng một trợ lý điều phối.
 * Hai tầng, đúng mức điều phối B (người dùng luôn là người bấm):
 *   1. Hành động kế tiếp — suy ra TẤT ĐỊNH từ draft (miễn phí, luôn đúng trạng thái).
 *   2. Chat tư vấn — hỏi đáp prompt engineering với ngữ cảnh draft (1 lượt gọi/câu).
 */
import React, { useRef, useState } from 'react';
import { ArrowRight, Bot, Loader2, Send, Sparkles } from 'lucide-react';
import { toast } from '../common/Toaster';
import {
  CompositeQuality, StudioDraft, buildCopilotContext, stepIndexByKey, suggestNextAction,
} from '../../utils/studioFlow';

interface CopilotPanelProps {
  draft: StudioDraft;
  quality: CompositeQuality | null;
  onGoToStep: (index: number) => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function CopilotPanel({ draft, quality, onGoToStep }: CopilotPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const next = suggestNextAction(draft);

  const handleAsk = async () => {
    const question = input.trim();
    if (!question || isThinking) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: question }, { role: 'assistant', content: '' }]);
    setIsThinking(true);
    try {
      const { generateQuickResponse } = await import('../../services/aiService');
      await generateQuickResponse(
        question,
        [{ type: 'context', title: 'Studio', content: buildCopilotContext(draft, quality) }],
        (chunk) => {
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: 'assistant', content: copy[copy.length - 1].content + chunk };
            return copy;
          });
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
        },
      );
    } catch (err: any) {
      console.error(err);
      setMessages((prev) => prev.slice(0, -1));
      toast.error(err?.message || 'Copilot không trả lời được. Thử lại sau.');
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="flex max-h-[calc(100vh-7rem)] flex-col gap-3">
      {/* Hành động kế tiếp (tất định, miễn phí) */}
      <div className="rounded-2xl border border-line bg-panel/80 p-4">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-faint">
          <Sparkles size={11} className="text-violet-500" /> Hành động kế tiếp
        </div>
        <div className="mt-1.5 text-sm font-bold tracking-tight text-ink">{next.title}</div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">{next.reason}</p>
        <button
          onClick={() => onGoToStep(stepIndexByKey(next.step))}
          className="mt-3 flex cursor-pointer items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 px-3 py-2 text-xs font-bold text-white shadow-sm shadow-violet-500/20 transition-all hover:shadow-md"
        >
          Đến bước này <ArrowRight size={12} />
        </button>
      </div>

      {/* Điểm chất lượng tổng hợp */}
      {quality && (
        <div className="rounded-2xl border border-line bg-panel/80 p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-faint">Điểm chất lượng</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className={`text-2xl font-bold tracking-tight ${quality.score >= 80 ? 'text-emerald-500' : quality.score >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>
              {quality.score}
            </span>
            <span className="text-[10px] font-semibold text-faint">/100</span>
          </div>
          <div className="mt-2 space-y-1">
            {quality.parts.map((p) => (
              <div key={p.key} className="flex items-center justify-between text-[11px]">
                <span className="text-muted">{p.label}</span>
                <span className={p.value === null ? 'text-faint' : 'font-semibold text-ink'}>
                  {p.value === null ? 'chưa đo' : p.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat tư vấn */}
      <div className="flex min-h-48 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-panel/80">
        <div className="flex items-center gap-1.5 border-b border-line/60 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-faint">
          <Bot size={11} className="text-violet-500" /> Hỏi copilot
        </div>
        <div ref={scrollRef} className="custom-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {messages.length === 0 && (
            <p className="text-[11px] leading-relaxed text-faint">
              Copilot biết trạng thái bản nháp của bạn. Hỏi bất cứ điều gì: "khối ràng buộc nên thêm gì?",
              "vì sao lint báo mơ hồ?"… Copilot chỉ tư vấn — mọi thay đổi vẫn do bạn thực hiện.
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`text-xs leading-relaxed ${m.role === 'user' ? 'font-semibold text-ink' : 'text-muted'}`}>
              {m.role === 'user' ? <span className="mr-1 text-violet-500">›</span> : null}
              {m.content || (isThinking && i === messages.length - 1 ? <Loader2 size={12} className="inline animate-spin text-violet-500" /> : null)}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 border-t border-line/60 p-2.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAsk(); }}
            placeholder="Hỏi về prompt của bạn…"
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink placeholder:text-faint focus:border-violet-400/60 focus:outline-none"
          />
          <button
            onClick={handleAsk}
            disabled={isThinking || !input.trim()}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-sm transition-all hover:shadow-md disabled:opacity-40"
          >
            {isThinking ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}
