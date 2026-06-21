import React, { useState } from 'react';
import { PromptTemplate } from '../../types';
import { X, Heart, Bookmark, Copy, Users, CheckCircle, MessageSquare, Share2, Star, Workflow } from 'lucide-react';
import InteractiveFewShotPanel from '../common/InteractiveFewShotPanel';

interface PromptDetailModalProps {
  template: PromptTemplate;
  onClose: () => void;
  onRemix: (template: PromptTemplate) => void;
  onAddToProject?: (template: PromptTemplate) => void;
}

export default function PromptDetailModal({ template, onClose, onRemix, onAddToProject }: PromptDetailModalProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [newComment, setNewComment] = useState('');

  const metrics = template.metrics || { usageCount: 0, upvotes: 0, likes: 0, saves: 0 };
  const avatarName = template.authorName || 'Anonymous';
  const getAvatarFallback = (name: string) => name ? name.charAt(0).toUpperCase() : '?';

  const [comments, setComments] = useState([
    { id: 1, user: 'Hoàng Trần', text: 'Prompt này rất hiệu quả cho việc viết blog SEO! Cảm ơn tác giả.', time: '2 giờ trước', likes: 12 },
    { id: 2, user: 'Linh Nguyễn', text: 'Mình đã remix thêm phần tone of voice, kết quả xuất ra tự nhiên hơn hẳn.', time: '5 giờ trước', likes: 8 },
    { id: 3, user: 'Bảo Anh', text: 'Chuẩn! Framework này giải quyết được vấn đề lan man của AI.', time: '1 ngày trước', likes: 4 },
  ]);

  const handleLike = () => setIsLiked(!isLiked);
  const handleSave = () => setIsSaved(!isSaved);

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
                     {(metrics.likes || metrics.upvotes || 0) + (isLiked ? 1 : 0)}
                   </span>
                 </button>
                 <button onClick={handleSave} className={`flex flex-col items-center gap-1 group`}>
                   <div className={`p-2.5 rounded-full transition-all ${isSaved ? 'bg-indigo-100 text-indigo-600' : 'bg-white border border-slate-200 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 group-hover:border-indigo-200 shadow-sm'}`}>
                     <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
                   </div>
                   <span className={`text-[10px] font-bold ${isSaved ? 'text-indigo-600' : 'text-slate-500'}`}>
                     {(metrics.saves || 0) + (isSaved ? 1 : 0)} Lưus
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
               
               <button className="p-2.5 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
                 <Share2 className="w-5 h-5" />
               </button>
            </div>

            {/* Assessment / Rating */}
            <div className="mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <Star className="w-4 h-4 text-slate-200" />
                  <span className="text-sm font-bold text-slate-700 ml-1">4.2</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Từ 128 đánh giá</span>
              </div>
              <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700 px-3 py-1.5 bg-indigo-50 rounded-lg transition-colors">
                Đánh giá
              </button>
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
