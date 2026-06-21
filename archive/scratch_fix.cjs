const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'BuilderTab.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/\r\n/g, '\n');

// 1. Sửa lỗi 1: Dọn dẹp mobile settings bar bị duplicate
const startToken1 = 'bg-transparent">e View Toggle & Global Settings Bar';
const endToken1 = '<Droppable droppableId="builder-area">';

const idxStart1 = content.indexOf(startToken1);
const idxEnd1 = content.indexOf(endToken1);

if (idxStart1 !== -1 && idxEnd1 !== -1 && idxStart1 < idxEnd1) {
  const before = content.substring(0, idxStart1);
  const after = content.substring(idxEnd1);
  content = before + 'bg-transparent">\n              ' + after;
  console.log('Successfully cleaned duplicate Mobile settings bar using substring!');
} else {
  console.log('Could not find tokens for mobile settings bar fix:', { idxStart1, idxEnd1 });
}

// 2. Sửa lỗi 2 & 3: Sửa cấu trúc History Menu, AI Menu và Sparkles Spin
const startToken2 = '{activeHistoryMenuId === block.id && blockHistoryList';
const endToken2 = 'title="Ghim block này lại"';

const idxStart2 = content.indexOf(startToken2);
const idxEnd2 = content.indexOf(endToken2);

if (idxStart2 !== -1 && idxEnd2 !== -1 && idxStart2 < idxEnd2) {
  // Tìm nút button Ghim block bắt đầu ngay trước đó
  const buttonStartStr = '<button \n                                             onClick={(e) => { e.stopPropagation(); togglePin(block.id); }}';
  const buttonStartIdx = content.lastIndexOf('<button', idxEnd2);
  
  if (buttonStartIdx !== -1 && buttonStartIdx > idxStart2) {
    const before = content.substring(0, idxStart2);
    const after = content.substring(buttonStartIdx);
    
    const replacementHistoryAi = `{activeHistoryMenuId === block.id && blockHistoryList[block.id] && (
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
                                                      className="w-full text-left p-1.5 hover:bg-slate-850 rounded-lg transition-all flex flex-col gap-0.5 border border-transparent hover:border-violet-500/20"
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
                                                  <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
                                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Trợ lý AI khối</span>
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
                                                        className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center transition-colors shadow-sm shrink-0 active:scale-95"
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
                                                          className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-600 dark:hover:text-violet-400 rounded-md transition-colors text-left font-medium active:scale-[0.98]"
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
                                                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-650 dark:hover:text-violet-400 rounded-md transition-colors"
                                                      >
                                                        <Sparkles size={10} className="text-violet-500 dark:text-violet-400 shrink-0" />
                                                        <span>Tự động</span>
                                                      </button>
                                                      <button
                                                        onClick={(e) => { e.stopPropagation(); handleAiAssist(block, 'longer'); }}
                                                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-650 dark:hover:text-violet-400 rounded-md transition-colors"
                                                      >
                                                        <AlignLeft size={10} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
                                                        <span>Dài hơn</span>
                                                      </button>
                                                      <button
                                                        onClick={(e) => { e.stopPropagation(); handleAiAssist(block, 'shorter'); }}
                                                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-650 dark:hover:text-violet-400 rounded-md transition-colors"
                                                      >
                                                        <Minimize2 size={10} className="text-rose-500 dark:text-rose-400 shrink-0" />
                                                        <span>Ngắn gọn</span>
                                                      </button>
                                                      <button
                                                        onClick={(e) => { e.stopPropagation(); handleAiAssist(block, 'professional'); }}
                                                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-650 dark:hover:text-violet-400 rounded-md transition-colors"
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
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  \n                                  `;
    content = before + replacementHistoryAi + after;
    console.log('Successfully fixed History and AI Menu structure!');
  } else {
    console.log('Could not find the button start before title="Ghim block này lại"');
  }
} else {
  console.log('Could not find tokens for History and AI menu fix:', { idxStart2, idxEnd2 });
}

const finalContent = content.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, finalContent, 'utf8');
console.log('Finished writing back file.');
