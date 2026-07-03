import React from 'react';
import { Coins, Hash, AlertTriangle } from 'lucide-react';
import { estimateTokens, estimateCostUSD, DEFAULT_MODEL, ALL_MODEL_OPTIONS } from '../../config/models';
import { PREFILL_URL_LIMIT } from '../../utils/aiLaunchTargets';

interface PromptMeterProps {
  /** Prompt đã compile (sau khi inject biến). */
  text: string;
}

function fmtCost(usd: number): string {
  if (usd <= 0) return '$0';
  // Chi phí một lượt thường rất nhỏ — hiển thị theo 1K lượt cho dễ cảm nhận.
  return `$${(usd * 1000).toFixed(2)}/1K lượt`;
}

/**
 * Thước đo prompt (H5): ~token, chi phí ước tính trên model mặc định và cảnh báo
 * khi vượt ngưỡng prefill URL của OpenInAiBar. Chỉ ước lượng (~4 ký tự/token) —
 * mục đích là cảm nhận tương đối, không phải hoá đơn.
 */
export function PromptMeter({ text }: PromptMeterProps) {
  const tokens = estimateTokens(text);
  const inputCost = estimateCostUSD(DEFAULT_MODEL, text, '');
  const modelLabel = ALL_MODEL_OPTIONS.find((m) => m.value === DEFAULT_MODEL)?.label || DEFAULT_MODEL;
  const overPrefill = text.length > PREFILL_URL_LIMIT;

  if (!text.trim()) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-muted">
      <span className="flex items-center gap-1" title="Ước lượng ~4 ký tự/token">
        <Hash size={11} className="text-violet-400" />
        ~{tokens.toLocaleString('vi-VN')} token · {text.length.toLocaleString('vi-VN')} ký tự
      </span>
      <span className="flex items-center gap-1" title={`Chi phí đầu vào ước tính trên ${modelLabel}`}>
        <Coins size={11} className="text-amber-400" />
        {fmtCost(inputCost)} ({modelLabel})
      </span>
      {overPrefill && (
        <span
          className="flex items-center gap-1 text-amber-500"
          title={`Prompt dài hơn ${PREFILL_URL_LIMIT} ký tự — nút "Dùng ngay với AI" sẽ mở trang gốc, prompt nằm sẵn trong clipboard để dán.`}
        >
          <AlertTriangle size={11} />
          Dài quá giới hạn URL — sẽ dán từ clipboard
        </span>
      )}
    </div>
  );
}
