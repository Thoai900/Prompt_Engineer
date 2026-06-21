import React, { useRef } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { 
  ChevronDown, ChevronUp, Clock, RotateCcw, RotateCw, Sparkles, Pin, Trash2, Send, 
  AlignLeft, Minimize2, Briefcase, Menu 
} from 'lucide-react';
import { PromptBlock } from '../../types';
import { TYPE_STYLES, BLOCK_ICONS, SMART_PRESETS, DEFAULT_SMART_PRESETS } from '../../utils/builderUtils';
import { ExtractedVar } from '../../hooks/usePromptBlocks';

interface PromptBlockCardProps {
  block: PromptBlock;
  index: number;
  isMobile: boolean;
  isExpanded: boolean;
  toggleBlockExpansion: (blockId: string, e: React.MouseEvent) => void;
  editingBlockId: string | null;
  setEditingBlockId: (id: string | null) => void;
  updateBlockTitle: (blockId: string, title: string) => void;
  updateBlockContent: (blockId: string, content: string) => void;
  deleteBlock: (blockId: string) => void;
  togglePinBlock: (blockId: string) => void;
  moveBlock: (index: number, direction: 'up' | 'down') => void;
  undoBlock: (blockId: string) => void;
  redoBlock: (blockId: string) => void;
  restoreBlockVersion: (blockId: string, content: string) => void;
  saveBlockVersion: (blockId: string, content: string, label: string) => void;
  blockHistoryList: Record<string, any[]>;
  blockRedoList: Record<string, any[]>;
  activeHistoryMenuId: string | null;
  setActiveHistoryMenuId: (id: string | null) => void;
  isGenerating: boolean;
  openAiMenuId: string | null;
  setOpenAiMenuId: (id: string | null) => void;
  customInstructions: Record<string, string>;
  setCustomInstructions: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleAiAssist: (block: PromptBlock, actionType: string) => void;
  variableValues: Record<string, string>;
  setVariableValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  getVariablesFromText: (text: string) => ExtractedVar[];
}

export const PromptBlockCard: React.FC<PromptBlockCardProps> = ({
  block,
  index,
  isMobile,
  isExpanded,
  toggleBlockExpansion,
  editingBlockId,
  setEditingBlockId,
  updateBlockTitle,
  updateBlockContent,
  deleteBlock,
  togglePinBlock,
  moveBlock,
  undoBlock,
  redoBlock,
  restoreBlockVersion,
  saveBlockVersion,
  blockHistoryList,
  blockRedoList,
  activeHistoryMenuId,
  setActiveHistoryMenuId,
  isGenerating,
  openAiMenuId,
  setOpenAiMenuId,
  customInstructions,
  setCustomInstructions,
  handleAiAssist,
  variableValues,
  setVariableValues,
  getVariablesFromText,
}) => {
  const focusContentsRef = useRef<Record<string, string>>({});
  const style = TYPE_STYLES[block.type] || { 
    badge: 'text-slate-350 bg-slate-500/10 ring-slate-500/20 border-slate-700/30', 
    border: 'border-l-slate-400 shadow-[0_0_10px_rgba(100,116,139,0.05)]' 
  };
  const blockVars = getVariablesFromText(block.content);

  return (
    <Draggable key={block.id} draggableId={block.id} index={index} isDragDisabled={isMobile}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`bg-slate-900/60 backdrop-blur-sm border-y border-r border-l-[4px] rounded-2xl flex items-start gap-2 lg:gap-3 transition-all duration-300 group relative
            ${style.border}
            ${snapshot.isDragging 
              ? 'shadow-2xl shadow-violet-500/10 border-r-violet-500 border-y-violet-500 rotate-1 scale-[1.01] bg-slate-900/90 z-50 overflow-hidden' 
              : isGenerating
                ? 'border-violet-500 border-y-[1.5px] border-r-[1.5px] shadow-[0_0_15px_rgba(139,92,246,0.15)] bg-violet-950/10 z-10 overflow-hidden'
                : openAiMenuId === block.id
                  ? 'border-y-slate-800 border-r-slate-800 shadow-md border-r-violet-500/30 border-y-violet-500/30 z-30 overflow-visible'
                  : 'border-y-slate-800 border-r-slate-800 shadow-sm hover:border-r-slate-700 hover:border-y-slate-700 hover:shadow-[0_0_15px_rgba(139,92,246,0.04)] z-10 overflow-visible'}`}
        >
          {isGenerating && (
            <div className="absolute inset-0 bg-violet-500/5 animate-[pulse_1.5s_ease-in-out_infinite] pointer-events-none rounded-r-2xl" />
          )}
          
          {/* Drag Handle */}
          <div {...provided.dragHandleProps} className="w-8 py-4 flex flex-col items-center gap-1 opacity-20 cursor-grab active:cursor-grabbing hover:opacity-60 transition-opacity z-10 hidden lg:flex">
            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
          </div>
          
          {/* Mobile Drag Handle */}
          <div {...provided.dragHandleProps} className="lg:hidden pt-4 pl-3 flex flex-col items-center opacity-40 cursor-grab active:cursor-grabbing z-10 touch-manipulation pb-1 flex-shrink-0">
            <Menu size={16} />
          </div>

          <div className="flex-1 w-full min-w-0 py-3 pr-3 lg:pr-4 z-10 relative">
            <div className="flex justify-between items-center mb-1 flex-wrap gap-y-2">
              <div 
                className="flex items-center gap-2 cursor-pointer touch-manipulation min-h-[32px] pl-1 pr-2 rounded-lg hover:bg-slate-800 transition-colors animate-fade-in"
                onClick={(e) => toggleBlockExpansion(block.id, e)}
              >
                <ChevronDown size={14} className={`text-slate-500 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                {editingBlockId === block.id ? (
                  <input 
                    autoFocus
                    value={block.title}
                    onChange={(e) => updateBlockTitle(block.id, e.target.value)}
                    onBlur={() => setEditingBlockId(null)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditingBlockId(null)}
                    onClick={(e) => e.stopPropagation()}
                    className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded border border-transparent whitespace-nowrap outline-none focus:ring-1 focus:ring-violet-500 ${style.badge}`}
                  />
                ) : (
                  <span 
                    onDoubleClick={(e) => { e.stopPropagation(); setEditingBlockId(block.id); }}
                    className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded ring-1 ring-inset border whitespace-nowrap cursor-text ${style.badge}`}
                    title="Nháy đúp để đổi tên"
                  >
                    {block.title}
                  </span>
                )}
                {!isExpanded && block.content && (
                  <span className="text-xs text-slate-400 truncate max-w-[120px] sm:max-w-[200px] ml-1.5">{block.content}</span>
                )}
              </div>

              <div className={`flex items-center gap-1 transition-opacity ${isExpanded ? 'opacity-100' : 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100'}`}>
                
                {/* Block Version History Controls */}
                <div className="flex items-center gap-0.5 bg-slate-950/40 rounded-lg p-0.5 border border-slate-800">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      undoBlock(block.id);
                    }}
                    disabled={!blockHistoryList[block.id] || blockHistoryList[block.id].length === 0}
                    className="p-1 px-1.5 hover:text-violet-400 hover:bg-slate-800 rounded-md transition-colors disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-500 text-slate-400 cursor-pointer"
                    title="Hoàn tác chỉnh sửa"
                  >
                    <RotateCcw size={12} />
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      redoBlock(block.id);
                    }}
                    disabled={!blockRedoList[block.id] || blockRedoList[block.id].length === 0}
                    className="p-1 px-1.5 hover:text-violet-400 hover:bg-slate-800 rounded-md transition-colors disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-500 text-slate-400 cursor-pointer"
                    title="Làm lại chỉnh sửa"
                  >
                    <RotateCw size={12} />
                  </button>

                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveHistoryMenuId(activeHistoryMenuId === block.id ? null : block.id);
                      }}
                      disabled={!blockHistoryList[block.id] || blockHistoryList[block.id].length === 0}
                      className={`p-1 px-1.5 hover:text-violet-400 hover:bg-slate-800 rounded-md transition-colors disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-500 cursor-pointer ${activeHistoryMenuId === block.id ? 'bg-slate-800 text-violet-400' : 'text-slate-400'}`}
                      title="Lịch sử chỉnh sửa"
                    >
                      <Clock size={12} />
                    </button>
                    
                    {activeHistoryMenuId === block.id && blockHistoryList[block.id] && (
                      <>
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={(e) => { e.stopPropagation(); setActiveHistoryMenuId(null); }}
                        />
                        <div className="absolute top-full right-0 mt-1 w-60 bg-slate-900 border border-slate-850 shadow-2xl rounded-xl z-55 flex flex-col overflow-hidden text-left animate-in fade-in slide-in-from-top-2 duration-150">
                          <div className="px-3 py-1.5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Lịch sử (Tối đa 10)</span>
                            <Clock size={10} className="text-violet-400" />
                          </div>
                          <div className="max-h-48 overflow-y-auto custom-scrollbar p-1 flex flex-col gap-0.5">
                            {blockHistoryList[block.id].slice().reverse().map((h, hIdx) => (
                              <button
                                key={hIdx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  restoreBlockVersion(block.id, h.content);
                                }}
                                className="w-full text-left p-1.5 hover:bg-slate-850 rounded-lg transition-all flex flex-col gap-0.5 border border-transparent hover:border-violet-500/20 cursor-pointer"
                              >
                                <div className="flex justify-between items-center text-[9px] w-full">
                                  <span className="font-bold text-violet-300 truncate max-w-[120px]">{h.label}</span>
                                  <span className="text-slate-500 whitespace-nowrap">{h.timestamp}</span>
                                </div>
                                <p className="text-[9px] text-slate-400 truncate line-clamp-1 w-full">{h.content}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {isGenerating ? (
                  <div className="p-1 px-2 flex items-center gap-1.5 text-violet-650 dark:text-violet-400 bg-violet-550/10 border border-violet-500/20 rounded-lg animate-pulse h-8" title="Đang tạo văn bản...">
                    <Sparkles size={12} className="animate-pulse text-violet-600 dark:text-violet-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider hidden lg:inline">Đang viết...</span>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setOpenAiMenuId(openAiMenuId === block.id ? null : block.id); }}
                        disabled={isGenerating}
                        className="flex items-center justify-center min-w-[32px] h-8 lg:w-auto lg:h-auto gap-1 lg:p-1.5 hover:text-violet-600 dark:hover:text-violet-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 touch-manipulation z-20 cursor-pointer text-slate-400"
                        title="Tùy chọn AI"
                      >
                        <Sparkles size={14} />
                        <ChevronDown size={10} className="hidden lg:block" />
                      </button>
                      
                      {openAiMenuId === block.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={(e) => { e.stopPropagation(); setOpenAiMenuId(null); }}
                          />
                          <div className="absolute top-full right-0 mt-1 w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-2xl rounded-xl z-50 flex flex-col overflow-hidden text-left animate-in fade-in slide-in-from-top-2 duration-150">
                            {/* Popover Header */}
                            <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-955 flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider">Trợ lý AI khối</span>
                              <span className="text-[9px] font-bold text-violet-650 dark:text-violet-400 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded uppercase">{block.type}</span>
                            </div>

                            {/* Custom Instruction Box */}
                            <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-1.5 bg-slate-50/40 dark:bg-slate-900/40">
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">🎯 Yêu cầu chỉnh sửa riêng</span>
                              <div className="flex gap-1.5">
                                <input
                                  type="text"
                                  autoFocus
                                  value={customInstructions[block.id] || ""}
                                  onChange={(e) => setCustomInstructions(prev => ({ ...prev, [block.id]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && (customInstructions[block.id] || "").trim()) {
                                      e.stopPropagation();
                                      handleAiAssist(block, (customInstructions[block.id] || "").trim());
                                      setCustomInstructions(prev => ({ ...prev, [block.id]: '' }));
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  placeholder="Dịch sang tiếng Anh, dạng bảng..."
                                  className="flex-1 text-xs border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500 bg-slate-50 dark:bg-slate-950 text-slate-850 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const text = (customInstructions[block.id] || "").trim();
                                    if (text) {
                                      handleAiAssist(block, text);
                                      setCustomInstructions(prev => ({ ...prev, [block.id]: '' }));
                                    }
                                  }}
                                  className="px-2.5 py-1.5 bg-violet-655 hover:bg-violet-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center transition-colors shadow-sm shrink-0 active:scale-95 cursor-pointer"
                                  title="Gửi yêu cầu"
                                >
                                  <Send size={11} />
                                </button>
                              </div>
                            </div>

                            {/* Smart Presets */}
                            <div className="p-2 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-1.5 bg-slate-50/50 dark:bg-slate-900">
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1 mb-0.5">💡 Gợi ý nhanh cho khối</span>
                              <div className="flex flex-col gap-0.5 max-h-36 overflow-y-auto custom-scrollbar">
                                {(SMART_PRESETS[block.type] || DEFAULT_SMART_PRESETS).map((preset, idx) => (
                                  <button
                                    key={idx}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAiAssist(block, preset.action);
                                    }}
                                    className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-650 dark:hover:text-violet-400 rounded-md transition-colors text-left font-medium active:scale-[0.98] cursor-pointer"
                                  >
                                    {preset.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Basic AI choices */}
                            <div className="p-2 flex flex-col gap-1.5 bg-slate-50/40 dark:bg-slate-950/40">
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1 mb-0.5">⚡ Lựa chọn cơ bản</span>
                              <div className="grid grid-cols-2 gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleAiAssist(block, 'auto'); }}
                                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-650 dark:hover:text-violet-400 rounded-md transition-colors cursor-pointer"
                                >
                                  <Sparkles size={10} className="text-violet-500 dark:text-violet-400 shrink-0" />
                                  <span>Tự động</span>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleAiAssist(block, 'longer'); }}
                                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-650 dark:hover:text-violet-400 rounded-md transition-colors cursor-pointer"
                                >
                                  <AlignLeft size={10} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
                                  <span>Dài hơn</span>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleAiAssist(block, 'shorter'); }}
                                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-650 dark:hover:text-violet-400 rounded-md transition-colors cursor-pointer"
                                >
                                  <Minimize2 size={10} className="text-rose-500 dark:text-rose-400 shrink-0" />
                                  <span>Ngắn gọn</span>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleAiAssist(block, 'professional'); }}
                                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-650 dark:hover:text-violet-400 rounded-md transition-colors cursor-pointer"
                                >
                                  <Briefcase size={10} className="text-blue-500 dark:text-blue-400 shrink-0" />
                                  <span>Chuyên nghiệp</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    
 
                    {isMobile && (
                      <>
                        <button 
                          onClick={(e) => { e.stopPropagation(); moveBlock(index, 'up'); }}
                          disabled={index === 0}
                          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-violet-400 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-20 shrink-0 cursor-pointer"
                          title="Di chuyển lên"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); moveBlock(index, 'down'); }}
                          disabled={index === index} // Will be verified dynamically
                          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-violet-400 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-20 shrink-0 cursor-pointer"
                          title="Di chuyển xuống"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </>
                    )}

                    <button 
                      onClick={(e) => { e.stopPropagation(); togglePinBlock(block.id); }}
                      className={`w-8 h-8 lg:w-7 lg:h-7 flex items-center justify-center rounded-lg transition-colors touch-manipulation shrink-0 cursor-pointer ${block.isPinned ? 'text-amber-500 bg-amber-500/10' : 'text-slate-500 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                      title="Ghim block này lại"
                    >
                      <Pin size={14} className={block.isPinned ? 'fill-current' : ''} />
                    </button>
                    
                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); }}
                      className="w-8 h-8 lg:w-7 lg:h-7 flex items-center justify-center text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors touch-manipulation shrink-0 cursor-pointer"
                      title="Xóa"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {isExpanded && (
              <div className="flex flex-col gap-2.5 mt-2">
                <textarea
                  value={block.content}
                  onChange={(e) => updateBlockContent(block.id, e.target.value)}
                  onFocus={() => { focusContentsRef.current[block.id] = block.content; }}
                  onBlur={() => {
                    const initialVal = focusContentsRef.current[block.id];
                    if (initialVal !== undefined && initialVal !== block.content) {
                      saveBlockVersion(block.id, initialVal, 'Chỉnh sửa thủ công');
                    }
                  }}
                  placeholder={isGenerating ? "AI đang tự động soạn thảo..." : "Nhập nội dung khối ở đây..."}
                  disabled={isGenerating}
                  className={`w-full text-sm font-medium focus:outline-none resize-y min-h-[90px] bg-transparent leading-relaxed transition-all duration-300 p-3 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 rounded-2xl border border-slate-200 dark:border-slate-800/80 ${
                    isGenerating ? 'text-violet-600 dark:text-violet-400 placeholder-violet-400/50 cursor-wait opacity-65' : 'opacity-100'
                  }`}
                />
                
                {/* In-place Variables Inputs inside the block */}
                {blockVars.length > 0 && (
                  <div className="mt-1 p-3 bg-slate-100/60 dark:bg-slate-955/60 rounded-2xl border border-slate-200 dark:border-slate-850 flex flex-col gap-2 relative text-left">
                    <div className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={11} className="text-violet-500" />
                      <span>Điền nhanh biến số</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {blockVars.map(v => (
                        <div key={v.name} className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-bold text-slate-655 dark:text-slate-455">{v.name}</span>
                          {v.options ? (
                            <select
                              className="w-full text-xs px-2.5 py-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 font-medium text-slate-800 dark:text-slate-200 cursor-pointer"
                              value={variableValues[v.name] || v.options[0]}
                              onChange={e => setVariableValues(prev => ({...prev, [v.name]: e.target.value}))}
                            >
                              {v.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          ) : (
                            <input 
                              type="text"
                              className="w-full text-xs px-2.5 py-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600"
                              placeholder={`Thông tin cho ${v.name}...`}
                              value={variableValues[v.name] || ''}
                              onChange={e => setVariableValues(prev => ({...prev, [v.name]: e.target.value}))}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
};
