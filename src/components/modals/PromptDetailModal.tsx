import React, { useState } from 'react';
import { PromptTemplate, TemplateVersion } from '../../types';
import { X, Heart, Bookmark, Copy, Users, CheckCircle, MessageSquare, Share2, Star, Workflow, History, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import InteractiveFewShotPanel from '../common/InteractiveFewShotPanel';
import { computeUnifiedDiff } from '../../utils/chainUtils';
import { blocksToText } from '../../utils/templateVersionUtils';

interface PromptDetailModalProps {
  template: PromptTemplate;
  onClose: () => void;
  onRemix: (template: PromptTemplate) => void;
  onAddToProject?: (template: PromptTemplate) => void;
  isSaved?: boolean;
  onToggleSave?: (template: PromptTemplate) => void;
  onShare?: (template: PromptTemplate) => void;
  /** H1: trạng thái "tôi đã thích" hiện tại (đọc từ localStorage ở tab cha). */
  liked?: boolean;
  /** H1: persist like lên Firestore. Không truyền = template không like được (demo/built-in). */
  onToggleLike?: () => Promise<boolean | null>;
}

export default function PromptDetailModal({ template, onClose, onRemix, onAddToProject, isSaved = false, onToggleSave, onShare, liked = false, onToggleLike }: PromptDetailModalProps) {
  const [isLiked, setIsLiked] = useState(liked);
  // Trạng thái ban đầu để hiệu chỉnh số đếm hiển thị (metrics là snapshot lúc mở modal).
  const [initialLiked] = useState(liked);
  const [newComment, setNewComment] = useState('');

  const metrics = template.metrics || { usageCount: 0, upvotes: 0, likes: 0, saves: 0 };
  const likeCount = Math.max(0, (metrics.likes || metrics.upvotes || 0) + (isLiked === initialLiked ? 0 : isLiked ? 1 : -1));
  const avatarName = template.authorName || 'Anonymous';
  const getAvatarFallback = (name: string) => name ? name.charAt(0).toUpperCase() : '?';

  // H1: bỏ bình luận mock — thảo luận bắt đầu rỗng, chỉ lưu trong phiên xem.
  const [comments, setComments] = useState<{ id: number; user: string; text: string; time: string; likes: number }[]>([]);

  // H2: phiên bản đang mở diff (so với bản hiện tại).
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const versions = template.versions || [];

  // Khôi phục: mở Builder với blocks của bản cũ (giữ nguyên id/metadata để lưu đè).
  const handleRestoreVersion = (v: TemplateVersion) => {
    onRemix({ ...template, blocks: (v.blocks || []).map((b) => ({ ...b })) });
  };

  const handleLike = async () => {
    if (!onToggleLike) {
      setIsLiked((v) => !v); // template demo: chỉ đổi giao diện cục bộ
      return;
    }
    const result = await onToggleLike();
    if (result !== null) setIsLiked(result);
  };
  const handleSave = () => onToggleSave?.(template);

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    
    const newCommentObj = {
      id: Date.now(),
      user: 'Tôi (Bạn)',
      text: newComment.trim(),
      time: 'Vừa xong',
      likes: 0
    };
    
    setComments([...comments, newCommentObj]);
    setNewComment('');
  };

  const handleRemix = () => {
    // We can track fork history here in a real app
    onRemix(template);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-end sm:items-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-6" onClick={onClose}>
      <div 
        className="w-full sm:w-[800px] h-[90vh] sm:h-auto sm:max-h-[85vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0 bg-white z-10">
          <div className="flex items-center gap-3">
            {template.authorAvatar ? (
              <img src={template.authorAvatar} alt={avatarName} className="w-10 h-10 rounded-full object-cover border border-slate-100" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                 {getAvatarFallback(avatarName)}
              </div>
            )}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-800">{avatarName}</span>
                {template.isVerified && <CheckCircle className="w-4 h-4 text-blue-500" />}
                <span className="text-slate-300 mx-1">•</span>
                <span className="text-xs text-slate-500 font-medium hover:text-indigo-600 cursor-pointer transition-colors">Theo dõi</span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Xuất bản: {template.createdAt ? new Date(template.createdAt).toLocaleDateString() : 'Gần đây'}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto w-full custom-scrollbar flex flex-col lg:flex-row">
          {/* Left Column: Prompt Info */}
          <div className="flex-1 p-6 border-b lg:border-b-0 lg:border-r border-slate-100">
            {template.category && (
               <span className="inline-block bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-lg text-xs mb-3">
                 {template.category.toUpperCase()}
               </span>
            )}
            <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight leading-tight">{template.title}</h2>
            <p className="text-sm text-slate-600 mb-5 leading-relaxed">{template.description}</p>
            
            {(template.tags && template.tags.length > 0) && (
              <div className="flex flex-wrap gap-2 mb-6">
                {template.tags.map(tag => (
                  <span key={tag} className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-md">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-8 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
              <div className="px-4 py-3 border-b border-slate-200 bg-white flex justify-between items-center">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Cấu trúc khối ({template.blocks.length})</h4>
              </div>
              <div className="p-4 flex flex-col gap-2">
                 {template.blocks.map((block, idx) => (
                    <div key={idx} className="flex gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                      <div className="shrink-0 pt-0.5">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold">
                          {idx + 1}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800 mb-1">{block.title}</span>
                        <span className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{block.content}</span>
                      </div>
                    </div>
                 ))}
                 <div className="text-center pt-2">
                   <p className="text-[10px] text-slate-400 font-medium">Nhấn Remix để xem chi tiết và chỉnh sửa cấu trúc khối.</p>
                 </div>
              </div>
            </div>
            {/* H2: Lịch sử phiên bản — diff so với bản hiện tại + khôi phục. */}
            {versions.length > 0 && (
              <div className="mt-6 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Lịch sử phiên bản ({versions.length})</h4>
                </div>
                <div className="p-3 flex flex-col gap-2">
                  {versions.map((v) => {
                    const isOpen = expandedVersionId === v.id;
                    return (
                      <div key={v.id} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between gap-2 p-2.5">
                          <button
                            onClick={() => setExpandedVersionId(isOpen ? null : v.id)}
                            className="flex flex-1 items-center gap-2 text-left cursor-pointer"
                            title="Xem khác biệt so với bản hiện tại"
                          >
                            {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-700">
                                {v.version ? `${v.version} · ` : ''}{new Date(v.at).toLocaleString('vi-VN')}
                              </span>
                              <span className="text-[10px] text-slate-400">{(v.blocks || []).length} khối{v.note ? ` · ${v.note}` : ''}</span>
                            </div>
                          </button>
                          <button
                            onClick={() => handleRestoreVersion(v)}
                            className="flex shrink-0 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-bold text-amber-700 transition-colors hover:bg-amber-100 cursor-pointer"
                            title="Mở bản này trong Builder — bấm Lưu Template để chốt khôi phục"
                          >
                            <RotateCcw className="w-3 h-3" /> Khôi phục
                          </button>
                        </div>
                        {isOpen && (
                          <div className="max-h-56 overflow-y-auto border-t border-slate-100 bg-slate-950 p-3 font-mono text-[10px] leading-relaxed">
                            {computeUnifiedDiff(blocksToText(v.blocks), blocksToText(template.blocks)).map((line, idx) => (
                              <div
                                key={idx}
                                className={
                                  line.type === 'added' ? 'text-emerald-400 whitespace-pre-wrap' :
                                  line.type === 'removed' ? 'text-rose-400 whitespace-pre-wrap line-through/50' :
                                  'text-slate-500 whitespace-pre-wrap'
                                }
                              >
                                {line.type === 'added' ? '+ ' : line.type === 'removed' ? '− ' : '  '}{line.text}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <p className="text-[10px] text-slate-400 font-medium px-1">
                    Diff hiển thị: <span className="text-rose-500">− bản cũ</span> → <span className="text-emerald-600">+ bản hiện tại</span>. "Khôi phục" mở bản cũ trong Builder; bấm Lưu Template để chốt.
                  </p>
                </div>
              </div>
            )}

            <InteractiveFewShotPanel
              template={template}
              onRemixWithFewShots={(fewShotTemplate) => onRemix(fewShotTemplate)}
            />
          </div>

          {/* Right Column: Social & Comments */}
          <div className="w-full lg:w-[320px] bg-slate-50/50 p-6 flex flex-col shrink-0">
            {/* Action Bar */}
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-200">
               <div className="flex items-center gap-6">
                 <button onClick={handleLike} className={`flex flex-col items-center gap-1 group`}>
                   <div className={`p-2.5 rounded-full transition-all ${isLiked ? 'bg-rose-100 text-rose-500' : 'bg-white border border-slate-200 text-slate-400 group-hover:bg-rose-50 group-hover:text-rose-400 group-hover:border-rose-200 shadow-sm'}`}>
                     <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                   </div>
                   <span className={`text-[10px] font-bold ${isLiked ? 'text-rose-600' : 'text-slate-500'}`}>
                     {likeCount}
                   </span>
                 </button>
                 <button onClick={handleSave} className={`flex flex-col items-center gap-1 group`}>
                   <div className={`p-2.5 rounded-full transition-all ${isSaved ? 'bg-indigo-100 text-indigo-600' : 'bg-white border border-slate-200 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 group-hover:border-indigo-200 shadow-sm'}`}>
                     <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
                   </div>
                   <span className={`text-[10px] font-bold ${isSaved ? 'text-indigo-600' : 'text-slate-500'}`}>
                     {isSaved ? 'Đã lưu' : 'Lưu'}
                   </span>
                 </button>
                 <div className={`flex flex-col items-center gap-1`}>
                   <div className={`p-2.5 rounded-full bg-white border border-slate-200 text-slate-400 shadow-sm`}>
                     <Users className={`w-5 h-5`} />
                   </div>
                   <span className={`text-[10px] font-bold text-slate-500`}>
                     {metrics.usageCount || 0} Uses
                   </span>
                 </div>
               </div>
               
               <button
                 onClick={() => onShare?.(template)}
                 title="Chia sẻ liên kết"
                 className="p-2.5 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 transition-colors shadow-sm"
               >
                 <Share2 className="w-5 h-5" />
               </button>
            </div>

            {/* Assessment / Rating — H1: hiển thị số THẬT, chưa có thì nói thẳng. */}
            <div className="mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              {metrics.averageRating ? (
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className={`w-4 h-4 ${i <= Math.round(metrics.averageRating || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                    ))}
                    <span className="text-sm font-bold text-slate-700 ml-1">{(metrics.averageRating || 0).toFixed(1)}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Điểm đánh giá trung bình</span>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className="w-4 h-4 text-slate-200" />
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Chưa có đánh giá</span>
                </div>
              )}
            </div>

            {/* Comments Section */}
            <div className="flex-1 flex flex-col">
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-slate-400" />
                Thảo luận ({comments.length})
              </h3>
              
              <div className="flex flex-col gap-4 mb-4 flex-1">
                {comments.map(comment => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-slate-200 shrink-0 flex items-center justify-center text-[10px] font-bold text-slate-500">
                      {comment.user.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-800">{comment.user}</span>
                        <span className="text-[10px] text-slate-400">{comment.time}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed bg-white p-2.5 rounded-r-xl rounded-bl-xl border border-slate-200 shadow-sm">{comment.text}</p>
                      <div className="flex items-center gap-3 mt-1.5 ml-1">
                        <button className="text-[10px] font-semibold text-slate-400 hover:text-rose-500 transition-colors">Thích ({comment.likes})</button>
                        <button className="text-[10px] font-semibold text-slate-400 hover:text-indigo-500 transition-colors">Phản hồi</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Comment Input */}
              <div className="mt-auto relative pt-4 border-t border-slate-200">
                <input 
                  type="text" 
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddComment();
                    }
                  }}
                  placeholder="Thêm bình luận..."
                  className="w-full pl-3 pr-10 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white shadow-sm"
                />
                <button 
                  onClick={handleAddComment}
                  className="absolute right-2 top-1/2 -translate-y-1/2 mt-2 p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors font-bold text-xs"
                >
                  Gửi
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-white shrink-0 flex justify-end gap-3 z-10 rounded-b-3xl">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Đóng
          </button>
          {onAddToProject && (
            <button 
              onClick={() => onAddToProject(template)}
              className="px-5 py-2.5 text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-700 rounded-xl transition-all shadow-md shadow-cyan-600/20 hover:shadow-lg hover:shadow-cyan-600/30 flex items-center gap-2 active:scale-95 cursor-pointer animate-fade-in"
            >
              <Workflow className="w-4 h-4" />
              Thêm vào Chain
            </button>
          )}
          <button 
            onClick={handleRemix}
            className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-600/20 hover:shadow-lg hover:shadow-indigo-600/30 flex items-center gap-2 active:scale-95"
          >
            <Copy className="w-4 h-4" />
            Remix Framework Này
          </button>
        </div>
      </div>
    </div>
  );
}
