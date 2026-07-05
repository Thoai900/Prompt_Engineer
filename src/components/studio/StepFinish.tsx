/**
 * Bước 5 — Hoàn tất: xem prompt cuối đã lắp ráp, rồi Copy / Lưu vào Library /
 * Mở trong Builder (deep-link, KHÔNG render lại UI Builder).
 */
import React, { useState } from 'react';
import { Check, Copy, Library, Loader2, PenTool } from 'lucide-react';
import { toast } from '../common/Toaster';
import { PromptTemplate } from '../../types';

interface StepFinishProps {
  /** Prompt cuối kèm persona (nếu có) — đúng thứ người dùng sẽ dán vào AI. */
  finalText: string;
  /** Template đã bake rules/skills thành block — tự chứa, sẵn sàng bàn giao. */
  mergedTemplate: PromptTemplate | null;
  personaName: string | null;
  onSaveTemplate: (t: PromptTemplate) => Promise<void>;
  onOpenInBuilder: (t: PromptTemplate) => void;
}

export default function StepFinish({ finalText, mergedTemplate, personaName, onSaveTemplate, onOpenInBuilder }: StepFinishProps) {
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(finalText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Đã copy prompt hoàn chỉnh.');
  };

  const handleSave = async () => {
    if (!mergedTemplate) return;
    setIsSaving(true);
    try {
      await onSaveTemplate(mergedTemplate);
      toast.success('Đã lưu vào Library.');
    } catch (err: any) {
      console.error(err);
      toast.error('Không lưu được template.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!mergedTemplate || !finalText.trim()) {
    return (
      <section className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-ink">Hoàn tất</h2>
        <p className="rounded-2xl border border-dashed border-line bg-panel/40 p-5 text-sm leading-relaxed text-muted">
          Chưa có prompt để hoàn tất. Quay lại bước <span className="font-semibold text-ink">Bản nháp</span> để
          AI dựng khung trước đã.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-xl font-bold tracking-tight text-ink">{mergedTemplate.title}</h2>
        <p className="mt-1 text-sm text-muted">
          {mergedTemplate.blocks.length} khối
          {personaName ? <> · persona <span className="font-semibold text-violet-500">{personaName}</span></> : null}
          {' '}· {finalText.length.toLocaleString('vi-VN')} ký tự
        </p>
      </header>

      <div className="max-h-96 overflow-y-auto custom-scrollbar rounded-2xl border border-line bg-panel/80 p-4">
        <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-ink/90">{finalText}</pre>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          onClick={handleCopy}
          className="flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-violet-500/20 transition-all hover:shadow-lg hover:shadow-violet-500/30"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Đã copy' : 'Copy prompt'}
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-panel px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-hover disabled:opacity-50"
        >
          {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Library size={15} />}
          Lưu vào Library
        </button>
        <button
          onClick={() => onOpenInBuilder(mergedTemplate)}
          className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-panel px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-hover"
        >
          <PenTool size={15} /> Mở trong Builder
        </button>
      </div>

      <p className="text-[11px] leading-relaxed text-faint">
        Khi lưu hoặc mở trong Builder, các Rules/Skills đã chọn được chuyển thành khối thật trong template —
        template tự chứa, không phụ thuộc Studio. Persona không được nhúng (là cấu hình chạy, chọn lại trong Builder).
      </p>
    </section>
  );
}
