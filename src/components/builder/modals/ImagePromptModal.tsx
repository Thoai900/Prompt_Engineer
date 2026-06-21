import React from 'react';
import { X, Layers, Image as ImageIcon, Upload } from 'lucide-react';

interface ImagePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedImage: string | null;
  selectedImageMime: string | null;
  isGeneratingFromImage: boolean;
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onConfirmGenerate: () => void;
  hasBlocks: boolean;
}

export const ImagePromptModal: React.FC<ImagePromptModalProps> = ({
  isOpen,
  onClose,
  selectedImage,
  selectedImageMime,
  isGeneratingFromImage,
  onImageSelect,
  onConfirmGenerate,
  hasBlocks,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-955/70 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
      <div 
        className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-lg border border-slate-200/50 dark:border-slate-800/50 text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-center justify-center text-violet-600 dark:text-violet-400">
              <ImageIcon size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-850 dark:text-slate-100">Quét Ảnh & Sinh Prompt</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Bóc tách cấu trúc từ hình ảnh tự động</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-550 hover:text-slate-850 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            disabled={isGeneratingFromImage}
          >
            <X size={18} />
          </button>
        </div>

        {!hasBlocks ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
              <Layers size={32} />
            </div>
            <h3 className="text-slate-800 dark:text-slate-200 font-bold mb-2">Chưa có khối nào</h3>
            <p className="text-slate-500 dark:text-slate-455 text-sm mb-6 leading-relaxed">
              Vui lòng thêm hoặc kéo thả các khối vào Workshop trước khi sử dụng tính năng này.
            </p>
            <button 
              onClick={onClose}
              className="px-6 py-2 text-sm font-semibold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-205 rounded-lg transition-colors cursor-pointer active:scale-95"
            >
              Đã hiểu
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-5">
              
              <div className="w-full">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400 mb-2 block">
                  Tải ảnh lên (Sơ đồ, UI/UX, Bảng dữ liệu)
                </label>
                <label htmlFor="image-prompt-upload" className="flex flex-col items-center justify-center w-full h-48 border-2 border-slate-200 dark:border-slate-850 border-dashed rounded-2xl cursor-pointer bg-slate-50/50 dark:bg-slate-955 hover:bg-slate-100/50 dark:hover:bg-slate-900/50 hover:border-violet-500 overflow-hidden relative transition-all">
                  {selectedImage ? (
                    <div className="absolute inset-0 w-full h-full p-2">
                       <img src={`data:${selectedImageMime};base64,${selectedImage}`} alt="Selected" className="w-full h-full object-contain rounded-xl" />
                       <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl m-2">
                         <p className="text-white text-xs font-bold bg-slate-900/90 border border-slate-750 px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-md">
                           <Upload size={14}/> Đổi ảnh khác
                         </p>
                       </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-9 h-9 mb-3 text-slate-400 dark:text-slate-500 animate-bounce" />
                      <p className="mb-2 text-xs text-slate-700 dark:text-slate-350 font-bold">
                        <span className="text-violet-500 dark:text-violet-400">Nhấn để tải lên</span> hoặc kéo thả
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-550">PNG, JPG, WebP (Tối đa 5MB)</p>
                    </div>
                  )}
                  <input id="image-prompt-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={onImageSelect} disabled={isGeneratingFromImage} />
                </label>
              </div>

              <div className="p-3 bg-violet-50 dark:bg-violet-955/15 border border-violet-200 dark:border-violet-500/10 rounded-xl text-[11px] text-violet-700 dark:text-violet-300 leading-normal">
                <strong>Mẹo:</strong> Máy quét cấu trúc AI sẽ nhận diện nội dung ảnh (sơ đồ, giao diện, ý tưởng) và tự động rải dữ liệu vào các khối hiện có (Role, Task, Constraints, v.v).
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-8">
              <button 
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent cursor-pointer"
                disabled={isGeneratingFromImage}
              >
                Hủy
              </button>
              <button 
                onClick={onConfirmGenerate}
                disabled={!selectedImage || isGeneratingFromImage}
                className="px-5 py-2.5 text-sm font-semibold bg-violet-600 hover:bg-violet-505 text-white rounded-lg transition-all shadow-md flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
              >
                {isGeneratingFromImage ? (
                  <>
                    <ImageIcon size={14} className="animate-pulse" />
                    Đang phân tích ảnh...
                  </>
                ) : (
                  <>
                    <ImageIcon size={14} /> Bắt đầu bóc tách
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
