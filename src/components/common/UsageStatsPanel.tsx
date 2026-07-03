import React, { useState } from 'react';
import { BarChart3, RefreshCw, Coins } from 'lucide-react';
import { loadUsage, summarizeUsage, type UsageSummary } from '../../utils/usageStats';
import { ALL_MODEL_OPTIONS } from '../../config/models';

function modelLabel(model: string): string {
  return ALL_MODEL_OPTIONS.find((m) => m.value === model)?.label || model;
}

function fmtUSD(usd: number): string {
  if (usd === 0) return '$0';
  if (usd < 0.01) return `< $0.01`;
  return `$${usd.toFixed(2)}`;
}

/**
 * Thống kê sử dụng AI (M2): tổng lượt gọi, chi phí ước tính 30 ngày và biểu đồ
 * 7 ngày gần nhất — đọc từ localStorage (pb_usage_stats), không gọi mạng.
 */
export default function UsageStatsPanel() {
  const [summary, setSummary] = useState<UsageSummary>(() => summarizeUsage(loadUsage(), 7));

  const refresh = () => setSummary(summarizeUsage(loadUsage(), 7));
  const maxDayCalls = Math.max(1, ...summary.perDay.map((d) => d.calls));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={15} className="text-indigo-600" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Sử dụng AI (30 ngày)</span>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
          title="Làm mới thống kê"
        >
          <RefreshCw size={11} /> Làm mới
        </button>
      </div>

      {summary.totalCalls === 0 ? (
        <p className="py-3 text-center text-[11px] italic text-slate-400">
          Chưa có lượt gọi AI nào được ghi nhận trên thiết bị này.
        </p>
      ) : (
        <>
          <div className="mb-3 flex items-end gap-4">
            <div>
              <div className="text-xl font-black text-slate-800">{summary.totalCalls.toLocaleString('vi-VN')}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Lượt gọi</div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-xl font-black text-amber-600">
                <Coins size={15} /> {fmtUSD(summary.totalCostUSD)}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Chi phí ước tính</div>
            </div>
          </div>

          {/* 7 ngày gần nhất */}
          <div className="mb-3 flex h-12 items-end gap-1" title="Số lượt gọi 7 ngày gần nhất">
            {summary.perDay.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-0.5">
                <div
                  className="w-full rounded-t bg-indigo-400/80 transition-all"
                  style={{ height: `${Math.max(4, (d.calls / maxDayCalls) * 40)}px` }}
                  title={`${d.date}: ${d.calls} lượt`}
                />
                <span className="text-[8px] font-semibold text-slate-300">{d.date.slice(8)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1">
            {summary.perModel.slice(0, 5).map((m) => (
              <div key={m.model} className="flex items-center justify-between text-[11px]">
                <span className="truncate font-semibold text-slate-600">{modelLabel(m.model)}</span>
                <span className="shrink-0 font-medium text-slate-400">
                  {m.calls.toLocaleString('vi-VN')} lượt · {fmtUSD(m.costUSD)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[9px] italic leading-relaxed text-slate-300">
            Ước lượng ~4 ký tự/token theo bảng giá trong app — dùng để so sánh tương đối, không phải hoá đơn.
          </p>
        </>
      )}
    </div>
  );
}
