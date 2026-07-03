import React, { useRef, useState } from 'react';
import { DatabaseBackup, Download, Upload, Loader2 } from 'lucide-react';
import { toast } from './Toaster';
import { confirmDialog } from './ConfirmDialog';
import { applyBackup, backupFileName, collectBackup, validateBackup } from '../../utils/backupUtils';

/**
 * Sao lưu & khôi phục dữ liệu cục bộ (H6): xuất toàn bộ dữ liệu app trong
 * localStorage ra file JSON và nhập lại (ghi đè, có xác nhận). Không chứa API key.
 */
export default function BackupPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleExport = () => {
    const backup = collectBackup(localStorage);
    const count = Object.keys(backup.data).length;
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFileName();
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Đã xuất backup (${count} mục dữ liệu).`);
  };

  const handleImportFile = async (file: File) => {
    setImporting(true);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        toast.error('File không phải JSON hợp lệ.');
        return;
      }
      const result = validateBackup(parsed);
      if (!result.ok || !result.backup) {
        toast.error(result.error || 'File backup không hợp lệ.');
        return;
      }
      const backup = result.backup;
      const count = Object.keys(backup.data).length;
      const confirmed = await confirmDialog({
        message: `Khôi phục ${count} mục từ backup (xuất lúc ${new Date(backup.exportedAt).toLocaleString('vi-VN')})? Dữ liệu cục bộ hiện tại của các mục này sẽ bị GHI ĐÈ. Trang sẽ tải lại sau khi khôi phục.`,
        danger: true,
        confirmText: 'Khôi phục',
      });
      if (!confirmed) return;
      const restored = applyBackup(backup, localStorage);
      toast.success(`Đã khôi phục ${restored} mục — đang tải lại…`);
      // Tải lại để mọi tab/state đọc dữ liệu mới từ localStorage.
      setTimeout(() => window.location.reload(), 800);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <DatabaseBackup size={15} className="text-emerald-600" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Sao lưu &amp; Khôi phục dữ liệu</span>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
        Xuất template cục bộ, chain, rule, skill, hồ sơ phong cách… ra một file JSON để backup hoặc chuyển máy.
        File <span className="font-semibold">không chứa API key</span>.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-500 active:scale-95 cursor-pointer"
        >
          <Download size={13} /> Xuất backup (.json)
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition-all hover:border-emerald-400 hover:text-emerald-700 active:scale-95 cursor-pointer disabled:opacity-60"
        >
          {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Nhập backup
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }}
        />
      </div>
    </div>
  );
}
