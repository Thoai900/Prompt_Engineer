import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { 
  ChevronLeft, ChevronDown, ChevronRight, Layers, Plus, Search, ScrollText, 
  Workflow, GraduationCap 
} from 'lucide-react';
import { BLOCK_ICONS, TYPE_STYLES } from '../../utils/builderUtils';
import { AVAILABLE_BLOCKS } from '../../data';
import { AiRule, AiSkill, TabType, PromptBlock } from '../../types';

interface BuilderSidebarProps {
  isLeftSidebarCollapsed: boolean;
  setIsLeftSidebarCollapsed: (collapsed: boolean) => void;
  globalTheme: string;
  setGlobalTheme: (theme: string) => void;
  showFrameworks: boolean;
  setShowFrameworks: (show: boolean) => void;
  showRulesLibrary: boolean;
  setShowRulesLibrary: (show: boolean) => void;
  showComponents: boolean;
  setShowComponents: (show: boolean) => void;
  localRules: AiRule[];
  localSkills: AiSkill[];
  sidebarSearchQuery: string;
  setSidebarSearchQuery: (query: string) => void;
  showRulesInSidebar: boolean;
  setShowRulesInSidebar: (show: boolean) => void;
  showSkillsInSidebar: boolean;
  setShowSkillsInSidebar: (show: boolean) => void;
  allFrameworks: any[];
  handleApplyFramework: (blocks: any[]) => void;
  addBlock: (type: string) => void;
  addCustomBlock: () => void;
  handleQuickAddSet: () => void;
  clearAllBlocks: () => void;
  onApplyTemplate: (template: any) => void;
  PRESET_RULES: AiRule[];
  PRESET_SKILLS: AiSkill[];
}

export const BuilderSidebar: React.FC<BuilderSidebarProps> = ({
  isLeftSidebarCollapsed,
  setIsLeftSidebarCollapsed,
  globalTheme,
  setGlobalTheme,
  showFrameworks,
  setShowFrameworks,
  showRulesLibrary,
  setShowRulesLibrary,
  showComponents,
  setShowComponents,
  localRules,
  localSkills,
  sidebarSearchQuery,
  setSidebarSearchQuery,
  showRulesInSidebar,
  setShowRulesInSidebar,
  showSkillsInSidebar,
  setShowSkillsInSidebar,
  allFrameworks,
  handleApplyFramework,
  addBlock,
  addCustomBlock,
  handleQuickAddSet,
  clearAllBlocks,
  onApplyTemplate,
  PRESET_RULES,
  PRESET_SKILLS,
}) => {
  // Filters for search query
  const filteredFrameworks = allFrameworks.filter(fw => 
    fw.name.toLowerCase().includes(sidebarSearchQuery.toLowerCase())
  );

  // localRules/localSkills đã bao gồm sẵn PRESET_* (xem BuilderTab). Khử trùng theo id
  // để không nhân đôi preset → tránh trùng React key, đồng thời vẫn an toàn nếu caller
  // không kèm preset.
  const dedupeById = <T extends { id: string }>(items: T[]): T[] => {
    const map = new Map<string, T>();
    for (const item of items) if (!map.has(item.id)) map.set(item.id, item);
    return Array.from(map.values());
  };

  const filteredRules = dedupeById([...localRules, ...PRESET_RULES]).filter(rule =>
    rule.title.toLowerCase().includes(sidebarSearchQuery.toLowerCase()) ||
    rule.description.toLowerCase().includes(sidebarSearchQuery.toLowerCase())
  );

  const filteredSkills = dedupeById([...localSkills, ...PRESET_SKILLS]).filter(skill =>
    skill.title.toLowerCase().includes(sidebarSearchQuery.toLowerCase()) ||
    skill.description.toLowerCase().includes(sidebarSearchQuery.toLowerCase())
  );

  return (
    <aside className={`hidden md:flex flex-col border-r border-slate-200/50 bg-white/40 dark:border-slate-850/50 dark:bg-slate-950/45 transition-all duration-300 ease-in-out relative shrink-0 ${
      isLeftSidebarCollapsed ? 'w-[72px]' : 'w-72 lg:w-80'
    }`}>
      {/* Collapse/Expand Toggle Button */}
      <button 
        onClick={() => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed)}
        className="absolute top-4 -right-3 z-30 w-6.5 h-6.5 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 hover:border-violet-500/50 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 shadow-md transition-colors cursor-pointer"
        title={isLeftSidebarCollapsed ? "Mở rộng sidebar" : "Thu hẹp sidebar"}
      >
        {isLeftSidebarCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>

      {isLeftSidebarCollapsed ? (
        /* Collapsed Sidebar Icon View */
        <div className="flex-1 flex flex-col items-center py-5 gap-3.5 select-none overflow-y-auto custom-scrollbar">
          <div 
            className="w-10 h-10 rounded-xl bg-violet-550/10 border border-violet-500/20 text-violet-650 dark:text-violet-400 flex items-center justify-center cursor-pointer active:scale-95 transition-all"
            onClick={() => setIsLeftSidebarCollapsed(false)}
            title="Thư viện & Workshop"
          >
            <Layers size={18} />
          </div>
          <div className="w-full border-t border-slate-200/50 dark:border-slate-850/50 my-2"></div>
          
          {AVAILABLE_BLOCKS.map(block => (
            <button
              key={block.type}
              onClick={() => addBlock(block.type)}
              className="w-10 h-10 bg-white/80 dark:bg-slate-900 hover:bg-violet-600 border border-slate-200/60 dark:border-slate-800/80 hover:border-violet-500 text-slate-650 dark:text-slate-350 hover:text-white rounded-xl transition-all shadow-sm flex items-center justify-center group relative cursor-pointer active:scale-95"
              title={`Thêm ${block.title}`}
            >
              {BLOCK_ICONS[block.type] || <Plus size={16} />}
              <span className="absolute left-full ml-3 px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-xl">
                {block.title}
              </span>
            </button>
          ))}
          
          <div className="w-full border-t border-slate-200/50 dark:border-slate-850/50 my-2"></div>
          
          <button
            onClick={addCustomBlock}
            className="w-10 h-10 border border-dashed border-slate-300 dark:border-slate-700 hover:border-violet-500 bg-white/50 dark:bg-slate-900 hover:bg-violet-50 dark:hover:bg-violet-955/20 text-slate-500 dark:text-slate-400 hover:text-violet-500 dark:hover:text-violet-400 rounded-xl transition-all flex items-center justify-center group relative cursor-pointer active:scale-95"
            title="Tạo Khối Mới"
          >
            <Plus size={16} />
            <span className="absolute left-full ml-3 px-2 py-1 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-xl">
              Khối tùy chỉnh
            </span>
          </button>
        </div>
      ) : (
        /* Fully Expanded Sidebar View */
        <div className="flex-1 flex flex-col h-full overflow-hidden pt-2 pb-14 lg:pb-0 select-none">
          <div className="p-4 border-b border-slate-200/50 dark:border-slate-850/50 flex flex-col gap-4 shrink bg-white/40 dark:bg-slate-900/10 overflow-y-auto custom-scrollbar max-h-[60%]">
            <div>
               <h3 className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-550 tracking-wider mb-2">Cài đặt bộ</h3>
               <div className="relative mb-2">
                 <select 
                   value={globalTheme}
                   onChange={(e) => setGlobalTheme(e.target.value)}
                   className="w-full text-xs font-semibold text-violet-600 dark:text-violet-300 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800/80 rounded-lg px-4 py-2.5 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-colors cursor-pointer appearance-none shadow-sm text-slate-800 dark:text-slate-100"
                 >
                    <option value="empty">✏️ Tự do (Trống)</option>
                    <option value="math">🧮 Giải toán</option>
                    <option value="writing">✍️ Viết bài dài</option>
                    <option value="coding">💻 Lập trình</option>
                    <option value="self_dev">🌱 Phát triển bản thân</option>
                    <option value="roadmap">🗺️ Lộ trình học tập</option>
                 </select>
                 <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-violet-600 dark:text-violet-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                 </div>
               </div>
               
               <div className="grid grid-cols-2 gap-2 mt-1">
                 <button
                   onClick={handleQuickAddSet}
                   disabled={globalTheme === 'empty'}
                   className="w-full px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-lg flex justify-center items-center h-10 shadow-md shadow-violet-900/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
                 >
                   + TẠO BỘ
                 </button>
                 <button
                   onClick={clearAllBlocks}
                   className="w-full px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-lg flex justify-center items-center h-10 shadow-sm transition-all cursor-pointer active:scale-95"
                 >
                   XÓA TẤT CẢ
                 </button>
               </div>
            </div>

            {/* Sidebar Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-450 dark:text-slate-500" />
              <input
                type="text"
                value={sidebarSearchQuery}
                onChange={e => setSidebarSearchQuery(e.target.value)}
                placeholder="Tìm kiếm thư viện nhanh..."
                className="w-full text-xs pl-9 pr-3.5 py-2.5 border border-slate-200 dark:border-slate-850/80 bg-white dark:bg-slate-950 rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 placeholder-slate-400 dark:placeholder-slate-655 shadow-sm text-slate-850 dark:text-slate-200"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            
            {/* 1. COLLAPSIBLE COMPONENT PALETTE (Drag block source) */}
            <div className="flex flex-col">
              <button 
                onClick={() => setShowComponents(!showComponents)}
                className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-450 dark:text-slate-500 tracking-wider hover:text-slate-700 dark:hover:text-slate-300 py-1 transition-colors text-left cursor-pointer"
              >
                <span>📦 Khối xây dựng prompt</span>
                <ChevronDown size={12} className={`transition-transform duration-200 ${showComponents ? 'rotate-0' : '-rotate-90'}`} />
              </button>

              <Droppable droppableId="available-blocks" isDropDisabled={true}>
                {(provided) => (
                  <div 
                    ref={provided.innerRef} 
                    {...provided.droppableProps}
                    className={`transition-all duration-300 ease-in-out overflow-hidden bg-white/10 dark:bg-slate-900/10 ${showComponents ? 'flex-1 overflow-y-auto space-y-2 opacity-100 mt-2 p-1' : 'h-0 opacity-0 pointer-events-none p-0'}`}
                    style={{ minHeight: showComponents ? '150px' : '0px' }}
                  >
                    {AVAILABLE_BLOCKS.map((block, index) => (
                      <Draggable key={block.type} draggableId={`available-${block.type}`} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="group"
                          >
                            <div className={`p-3 border border-slate-200 dark:border-slate-850 hover:border-violet-500/40 rounded-2xl bg-white/80 dark:bg-slate-900/60 backdrop-blur-md hover:bg-white/90 dark:hover:bg-slate-850/80 transition-all duration-300
                              ${snapshot.isDragging ? 'shadow-lg border-violet-500 ring-1 ring-violet-500/30 bg-white dark:bg-slate-800' : ''}`}
                            >
                              <div className="flex justify-between items-center min-h-[28px]">
                                <div className="flex flex-col min-w-0 flex-1 pr-2">
                                  <p className="text-xs font-semibold truncate text-slate-800 dark:text-slate-100">{block.title}</p>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">{block.description}</p>
                                </div>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addBlock(block.type);
                                  }}
                                  className="text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-violet-500/30 rounded-lg shadow-sm w-7 h-7 flex items-center justify-center p-0 active:scale-95 cursor-pointer"
                                  aria-label="Thêm vào"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    <button
                      onClick={addCustomBlock}
                      className="w-full mt-3 p-3 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-violet-500/50 rounded-xl text-slate-500 dark:text-slate-400 bg-white/40 dark:bg-slate-900/20 hover:bg-white/60 dark:hover:bg-slate-900/40 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-[0.98]"
                    >
                      <Plus size={18} className="text-violet-500 dark:text-violet-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Tạo Khối Mới</span>
                    </button>
                  </div>
                )}
              </Droppable>
            </div>

            {/* 2. COLLAPSIBLE FRAMEWORKS SECTION */}
            <div className="flex flex-col">
              <button 
                onClick={() => setShowFrameworks(!showFrameworks)}
                className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-450 dark:text-slate-550 tracking-wider hover:text-slate-700 dark:hover:text-slate-300 py-1 transition-colors text-left cursor-pointer"
              >
                <span>🎨 Cấu trúc Khung mẫu (Framework)</span>
                <ChevronDown size={12} className={`transition-transform duration-200 ${showFrameworks ? 'rotate-0' : '-rotate-90'}`} />
              </button>

              {showFrameworks && (
                <div className="mt-2 space-y-1.5">
                  {filteredFrameworks.map(fw => (
                    <button
                      key={fw.id}
                      onClick={() => handleApplyFramework(fw.blocks)}
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-850 bg-white/60 dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-850 hover:border-violet-500/30 rounded-xl text-left text-xs font-semibold text-slate-750 dark:text-slate-300 transition-colors shadow-sm flex items-center justify-between cursor-pointer active:scale-[0.99] group"
                    >
                      <div className="flex items-center gap-2">
                        <Workflow size={13} className="text-violet-500" />
                        <span className="truncate">{fw.name}</span>
                      </div>
                      <Plus size={11} className="text-slate-400 group-hover:text-violet-500 transition-colors" />
                    </button>
                  ))}
                  {filteredFrameworks.length === 0 && (
                    <p className="text-[10px] text-slate-500 italic p-1">Không tìm thấy khung mẫu nào phù hợp.</p>
                  )}
                </div>
              )}
            </div>

            {/* 3. COLLAPSIBLE RULES & SKILLS LIBRARY SECTION */}
            <div className="flex flex-col">
              <button 
                onClick={() => setShowRulesLibrary(!showRulesLibrary)}
                className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-450 dark:text-slate-550 tracking-wider hover:text-slate-700 dark:hover:text-slate-300 py-1 transition-colors text-left cursor-pointer"
              >
                <span>📜 Thư viện Hệ thống & Quy chuẩn</span>
                <ChevronDown size={12} className={`transition-transform duration-200 ${showRulesLibrary ? 'rotate-0' : '-rotate-90'}`} />
              </button>

              {showRulesLibrary && (
                <div className="mt-2 space-y-3">
                  {/* Internal Filter Tabs */}
                  <div className="flex gap-1 border-b border-slate-200 dark:border-slate-850 pb-1.5">
                    <button 
                      onClick={() => { setShowRulesInSidebar(true); setShowSkillsInSidebar(false); }}
                      className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md cursor-pointer ${showRulesInSidebar && !showSkillsInSidebar ? 'bg-violet-550/15 text-violet-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      Quy chuẩn
                    </button>
                    <button 
                      onClick={() => { setShowRulesInSidebar(false); setShowSkillsInSidebar(true); }}
                      className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md cursor-pointer ${showSkillsInSidebar && !showRulesInSidebar ? 'bg-violet-550/15 text-violet-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      Kỹ năng
                    </button>
                    <button 
                      onClick={() => { setShowRulesInSidebar(true); setShowSkillsInSidebar(true); }}
                      className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md cursor-pointer ${showRulesInSidebar && showSkillsInSidebar ? 'bg-slate-800 text-slate-300' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      Tất cả
                    </button>
                  </div>

                  {showRulesInSidebar && (
                    <div className="space-y-1.5">
                      <span className="text-[8px] font-bold uppercase tracking-widest text-slate-550 dark:text-slate-600 block px-1">Quy chuẩn AI (System Rules)</span>
                      {filteredRules.map(rule => (
                        <button
                          key={rule.id}
                          onClick={() => onApplyTemplate({ title: rule.title, description: rule.description, blocks: [{ type: 'constraints', title: rule.title, content: rule.content }] })}
                          className="w-full p-2.5 border border-slate-250 dark:border-slate-850/80 bg-white/40 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-850 hover:border-violet-500/30 rounded-xl text-left text-xs font-semibold text-slate-800 dark:text-slate-350 transition-colors shadow-sm flex items-center justify-between cursor-pointer active:scale-[0.99] group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <ScrollText size={13} className="text-emerald-500 shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className="truncate text-slate-800 dark:text-slate-200">{rule.title}</span>
                              <span className="text-[9px] text-slate-500 truncate">{rule.description}</span>
                            </div>
                          </div>
                          <Plus size={11} className="text-slate-400 group-hover:text-violet-500 shrink-0 ml-1.5" />
                        </button>
                      ))}
                    </div>
                  )}

                  {showSkillsInSidebar && (
                    <div className="space-y-1.5">
                      <span className="text-[8px] font-bold uppercase tracking-widest text-slate-550 dark:text-slate-600 block px-1">Kỹ năng AI (Skills Instructions)</span>
                      {filteredSkills.map(skill => (
                        <button
                          key={skill.id}
                          onClick={() => onApplyTemplate({ title: skill.title, description: skill.description, blocks: [{ type: 'custom', title: skill.title, content: skill.instructions }] })}
                          className="w-full p-2.5 border border-slate-250 dark:border-slate-850/80 bg-white/40 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-850 hover:border-violet-500/30 rounded-xl text-left text-xs font-semibold text-slate-800 dark:text-slate-350 transition-colors shadow-sm flex items-center justify-between cursor-pointer active:scale-[0.99] group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <GraduationCap size={13} className="text-violet-500 shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className="truncate text-slate-800 dark:text-slate-200">{skill.title}</span>
                              <span className="text-[9px] text-slate-500 truncate">{skill.description}</span>
                            </div>
                          </div>
                          <Plus size={11} className="text-slate-400 group-hover:text-violet-500 shrink-0 ml-1.5" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            
          </div>
        </div>
      )}
    </aside>
  );
};
