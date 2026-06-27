import React from 'react';
import { Upload, Download, Plus, X, Play, Settings, Sparkles, Wrench } from 'lucide-react';
import { TreeNode, PromptProject, PromptBlock, PromptVariable, EvolutionType } from '../../types';
import { PRESET_SYSTEM_ROLES } from '../../presets';
import { compileEvolutionPrompt } from '../../utils/chainUtils';
import { GhostTextArea } from '../common/GhostTextArea';

interface NodeDetailSidebarProps {
  activeNode: TreeNode | null;
  activeProject: PromptProject | null;
  selectedNodeId: string | null;
  theme?: 'light' | 'dark';
  rootInputs: Record<string, string>;
  isImportModalOpen: boolean;
  setIsImportModalOpen: (open: boolean) => void;
  handleExportNodeAsTemplate: () => void;
  handleUpdateNodeFields: (fields: Partial<TreeNode>) => void;
  handleAddBlockToNode: (type: PromptBlock['type']) => void;
  handleUpdateBlockContent: (blockId: string, content: string) => void;
  handleUpdateBlockTitle: (blockId: string, title: string) => void;
  handleDeleteBlockFromNode: (blockId: string) => void;
  handleAddPresetBlock: (type: string, title: string, content: string) => void;
  handleAddVariableToNode: () => void;
  handleUpdateVariableField: (index: number, fields: Partial<PromptVariable>) => void;
  handleDeleteVariable: (index: number) => void;
  handleSelectSystemRole: (roleId: string) => void;
  handleOpenSimulator: (nodeId: string) => void;
}

export const NodeDetailSidebar: React.FC<NodeDetailSidebarProps> = ({
  activeNode,
  activeProject,
  selectedNodeId,
  theme = 'dark',
  rootInputs,
  setIsImportModalOpen,
  handleExportNodeAsTemplate,
  handleUpdateNodeFields,
  handleAddBlockToNode,
  handleUpdateBlockContent,
  handleUpdateBlockTitle,
  handleDeleteBlockFromNode,
  handleAddPresetBlock,
  handleAddVariableToNode,
  handleUpdateVariableField,
  handleDeleteVariable,
  handleSelectSystemRole,
  handleOpenSimulator,
}) => {
  if (!activeNode) {
    return (
      <div className="w-80 border-l border-slate-200/50 bg-white dark:border-slate-850/50 dark:bg-slate-900 flex flex-col shrink-0 overflow-y-auto">
        <div className="flex h-full flex-col items-center justify-center p-6 text-center text-slate-400 dark:text-slate-550">
          <Settings size={36} className="mb-3 text-slate-350 dark:text-slate-700" />
          <p className="text-xs font-semibold">Chọn một Node trên sơ đồ để chỉnh sửa cấu trúc Prompt và các biến đi kèm.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 border-l border-slate-200/50 bg-white dark:border-slate-850/50 dark:bg-slate-900 flex flex-col shrink-0 overflow-y-auto">
      <div className="flex flex-col h-full">
        {/* Header Sidebar */}
        <div className="border-b border-slate-150 p-4 dark:border-slate-800/80 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-550">Cấu hình Node</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-705 cursor-pointer transition-colors"
              >
                <Upload size={11} />
                Nạp mẫu
              </button>
              <button
                onClick={handleExportNodeAsTemplate}
                className="flex items-center gap-1 rounded bg-indigo-55 px-2 py-1 text-[11px] font-bold text-indigo-605 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-900/50 cursor-pointer transition-colors"
              >
                <Download size={11} />
                Lưu mẫu
              </button>
            </div>
          </div>

          <input
            type="text"
            value={activeNode.title}
            onChange={(e) => handleUpdateNodeFields({ title: e.target.value })}
            className="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none dark:text-white border-b border-transparent hover:border-slate-200 focus:border-cyan-505 dark:hover:border-slate-850 pb-1"
            placeholder="Tên node..."
          />
          <textarea
            value={activeNode.description}
            onChange={(e) => handleUpdateNodeFields({ description: e.target.value })}
            className="mt-2 w-full bg-transparent text-xs text-slate-500 focus:outline-none dark:text-slate-400 border-none resize-none leading-relaxed"
            placeholder="Nhập mô tả về vai trò của bước này trong sơ đồ..."
            rows={2}
          />
        </div>

        {/* Blocks List */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {activeNode.parentId === null ? (
            /* --- ROOT NODE SIDEBAR: SYSTEM ROLE DROPDOWN & PRESET PROMPT --- */
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-550 block mb-1.5">
                  Chọn Vai trò Hệ thống
                </label>
                <select
                  value={PRESET_SYSTEM_ROLES.find(r => r.rolePrompt === activeNode.blocks[0]?.content)?.id || ''}
                  onChange={(e) => handleSelectSystemRole(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                >
                  <option value="" disabled>-- Chọn Vai trò Hệ thống --</option>
                  {PRESET_SYSTEM_ROLES.map(role => (
                    <option key={role.id} value={role.id}>{role.title}</option>
                  ))}
                </select>
              </div>

              {activeNode.blocks[0] && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-550 block mb-1.5">
                    Nội dung Vai trò Hệ thống
                  </label>
                  <textarea
                    value={activeNode.blocks[0].content}
                    readOnly
                    className="w-full bg-slate-55 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none dark:text-slate-450 min-h-[120px] font-mono leading-relaxed"
                  />
                </div>
              )}
            </div>
          ) : (
            /* --- CHILD NODE SIDEBAR: EVOLUTION & ACCUMULATED PREVIEW --- */
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-550 block mb-1.5">
                  Loại tiến hóa (Evolution Type)
                </label>
                <select
                  value={activeNode.evolutionType || ''}
                  onChange={(e) => handleUpdateNodeFields({ evolutionType: e.target.value as EvolutionType })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-955 dark:text-slate-300"
                >
                  <option value="">-- Chọn loại tiến hóa --</option>
                  <option value="expand">Chi tiết hơn (Expand)</option>
                  <option value="shorten">Ngắn gọn lại (Shorten)</option>
                  <option value="refocus">Tái lập hướng đi mới (Refocus)</option>
                  <option value="fix">Sửa lỗi / Ràng buộc (Fix)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-550 block mb-1.5">
                  Chỉ thị tiến hóa (evolutionInstruction)
                </label>
                <GhostTextArea
                  value={activeNode.evolutionInstruction || ''}
                  onValueChange={(next) => handleUpdateNodeFields({ evolutionInstruction: next })}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none dark:text-slate-300 min-h-[100px] leading-relaxed"
                  placeholder="Nhập hướng dẫn tối ưu/ràng buộc cho prompt..."
                />
              </div>

              {/* Context Pruning Settings */}
              <div className="border-t border-slate-100 pt-3 dark:border-slate-800/40">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-550 block mb-1.5">
                  Kế thừa Ngữ cảnh (Context Pruning)
                </label>
                <div className="space-y-2">
                  <select
                    value={activeNode.contextMode || 'full'}
                    onChange={(e) => handleUpdateNodeFields({ contextMode: e.target.value as any })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 cursor-pointer"
                  >
                    <option value="full">Mặc định (Kế thừa đầy đủ)</option>
                    <option value="parent_only">Chỉ kế thừa Node Cha trực tiếp</option>
                    <option value="limit">Giới hạn cấp tổ tiên (Window Limit)</option>
                  </select>
                  
                  {activeNode.contextMode === 'limit' && (
                    <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200/50 dark:border-slate-850">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">Số cấp cha kế thừa:</span>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={activeNode.contextLimit !== undefined ? activeNode.contextLimit : 2}
                        onChange={(e) => handleUpdateNodeFields({ contextLimit: Math.max(1, parseInt(e.target.value) || 2) })}
                        className="w-16 rounded border border-slate-250 bg-white px-2 py-0.5 text-xs text-center focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Evolutive Blocks */}
              {activeNode.blocks.length > 0 && (
                <div className="border-t border-slate-100 pt-3 dark:border-slate-800/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-550 block mb-2">Các khối Prompt ({activeNode.blocks.length})</span>
                  <div className="space-y-3">
                    {activeNode.blocks.map((block) => (
                      <div 
                        key={block.id}
                        className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-850 dark:bg-slate-955/40"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <input
                            type="text"
                            value={block.title}
                            onChange={(e) => handleUpdateBlockTitle(block.id, e.target.value)}
                            className="bg-transparent text-[11px] font-bold text-slate-800 dark:text-slate-300 focus:outline-none w-2/3 border-b border-transparent hover:border-slate-200 dark:hover:border-slate-850"
                          />
                          <button
                            onClick={() => handleDeleteBlockFromNode(block.id)}
                            className="text-slate-400 hover:text-rose-500 p-0.5 cursor-pointer"
                            title="Xóa khối"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <textarea
                          value={block.content}
                          onChange={(e) => handleUpdateBlockContent(block.id, e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-lg p-2 text-xs focus:outline-none dark:text-slate-300 min-h-[80px]"
                          placeholder="Nội dung chi tiết của khối..."
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preset upgrades for branch types */}
              {activeNode.branchType === 'success' && (
                <div className="border-t border-slate-150 pt-3 dark:border-slate-800/40">
                  <div className="rounded-xl border border-emerald-250 bg-emerald-500/5 p-3 dark:border-emerald-900/30">
                    <h4 className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 mb-1.5">
                      <Sparkles size={13} className="text-emerald-505 animate-pulse" />
                      Nâng cấp & Phát triển Prompt
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                      Prompt trước đang chạy rất tốt. Nhấn chèn các khối tối ưu cao cấp để phát triển thêm:
                    </p>
                    
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleAddPresetBlock(
                          'task',
                          'Suy nghĩ logic (Chain-of-thought)',
                          'Hãy phân tích vấn đề và lập luận từng bước (Chain-of-Thought) trong thẻ suy nghĩ <thinking>...</thinking> trước khi đưa ra phản hồi cuối cùng cho học sinh.'
                        )}
                        className="w-full text-left bg-white dark:bg-slate-900 hover:bg-slate-55 border border-slate-250 dark:border-slate-800 rounded-lg p-2 transition-colors flex flex-col gap-0.5 cursor-pointer border-l-3 border-l-emerald-500 text-[10px]"
                      >
                        <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                          <Plus size={11} />
                          Khối Suy nghĩ logic (Chain-of-Thought)
                        </span>
                        <span className="text-[9.5px] text-slate-450 dark:text-slate-400">Yêu cầu AI phân tích và suy luận từng bước.</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeNode.branchType === 'failure' && (
                <div className="border-t border-slate-150 pt-3 dark:border-slate-800/40">
                  <div className="rounded-xl border border-amber-250 bg-amber-500/5 p-3 dark:border-amber-900/30">
                    <h4 className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-1.5">
                      <Wrench size={13} className="text-amber-550 dark:text-amber-400" />
                      Khắc phục & Sửa đổi Prompt
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                      Prompt trước hoạt động chưa tốt. Áp dụng các preset để khắc phục nhanh:
                    </p>
                    
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleAddPresetBlock(
                          'constraints',
                          'Ràng buộc Socratic',
                          'Tuyệt đối không giải bài tập hoặc cung cấp đáp án trực tiếp cho học sinh. Hãy đặt câu hỏi gợi mở, hướng dẫn từng bước nhỏ để học sinh tự suy nghĩ và tìm ra lời giải.'
                        )}
                        className="w-full text-left bg-white dark:bg-slate-900 hover:bg-slate-55 border border-slate-250 dark:border-slate-800 rounded-lg p-2 transition-colors flex flex-col gap-0.5 cursor-pointer border-l-3 border-l-amber-500 text-[10px]"
                      >
                        <span className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                          <Plus size={11} />
                          Ràng buộc Socratic (Không giải hộ)
                        </span>
                        <span className="text-[9.5px] text-slate-455 dark:text-slate-400">Không cung cấp đáp án trực tiếp.</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Cumulative Prompt Preview */}
              <div className="border-t border-slate-100 pt-3 dark:border-slate-800/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-550 block mb-2">
                  Xem trước Prompt Cộng dồn
                </span>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-2.5 text-[11px] font-mono leading-relaxed overflow-y-auto max-h-48 whitespace-pre-wrap text-slate-500 dark:text-slate-450 border border-slate-200/50 dark:border-slate-850 select-text">
                  {compileEvolutionPrompt(activeNode, activeProject!, rootInputs) || '(Chưa có nội dung)'}
                </div>
              </div>
            </div>
          )}

          {/* Node Variables */}
          <div className="border-t border-slate-100 pt-4 dark:border-slate-800/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-550">Biến đầu vào của Node này</span>
              {activeNode.parentId !== null && (
                <button 
                  onClick={handleAddVariableToNode}
                  className="flex items-center gap-0.5 text-[10px] font-bold text-cyan-600 dark:text-cyan-400 cursor-pointer"
                >
                  <Plus size={11} /> Thêm biến
                </button>
              )}
            </div>

            {(activeNode.variables || []).length === 0 ? (
              <p className="text-[11px] italic text-slate-400 dark:text-slate-500">
                Không có biến định nghĩa riêng biệt.
              </p>
            ) : (
              <div className="space-y-2.5">
                {(activeNode.variables || []).map((v, i) => (
                  <div key={i} className="flex flex-col gap-1 rounded-lg bg-slate-50 dark:bg-slate-950 p-2.5 border border-slate-200/40 dark:border-slate-800/40">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={v.name}
                        onChange={(e) => handleUpdateVariableField(i, { name: e.target.value })}
                        className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 w-2/3 focus:outline-none border-b border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                        placeholder="Tên biến"
                      />
                      <button
                        onClick={() => handleDeleteVariable(i)}
                        className="text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={v.defaultValue || ''}
                      onChange={(e) => handleUpdateVariableField(i, { defaultValue: e.target.value })}
                      className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded px-1.5 py-0.5 text-[11px] focus:outline-none text-slate-600 dark:text-slate-400"
                      placeholder="Giá trị mặc định"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Run simulator button */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800/50 mt-auto shrink-0">
          <button
            onClick={() => handleOpenSimulator(activeNode.id)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-cyan-500 cursor-pointer transition-all active:scale-95"
          >
            <Play size={14} fill="currentColor" />
            Mở bảng chạy thử Simulator
          </button>
        </div>
      </div>
    </div>
  );
};
