import React from 'react';
import { Save, User } from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: string;
  setUserProfile: (profile: string) => void;
  onSaveProfile: (profile: string) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  setUserProfile,
  onSaveProfile,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-955/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl w-full max-w-md shadow-2xl p-6 flex flex-col animate-in fade-in zoom-in-95 duration-200 text-slate-900 dark:text-slate-100">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-violet-500/10 text-violet-655 dark:text-violet-405 border border-violet-500/20 rounded-full flex items-center justify-center">
            <User size={20} />
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Hồ Sơ Cá Nhân</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          Mô tả bản thân để AI có thể tự động điền biến nhanh chóng và phân tích cấu trúc prompt tốt hơn.
        </p>
        
        <div className="flex flex-col gap-4 mb-8">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 mb-1.5 block">
              Bạn là ai? Ngữ cảnh của bạn?
            </label>
            <textarea 
              value={userProfile}
              onChange={e => setUserProfile(e.target.value)}
              placeholder="Vd: Tôi là học sinh lớp 12, đang ôn thi khối A. Điểm yếu là môn Lý. Thích lối giao tiếp hài hước..."
              rows={4}
              className="w-full text-sm py-2 px-3 border border-slate-200 dark:border-slate-850 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-colors bg-slate-50/50 dark:bg-slate-955 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-655 resize-y min-h-[100px]"
              autoFocus
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-auto">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent cursor-pointer"
          >
            Đóng
          </button>
          <button 
            onClick={() => onSaveProfile(userProfile)}
            className="px-5 py-2 text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg hover:from-violet-500 hover:to-indigo-500 transition-colors shadow-md shadow-violet-900/10 flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Save size={14} />
            Lưu hồ sơ
          </button>
        </div>
      </div>
    </div>
  );
};
