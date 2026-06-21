import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, X, Sparkles, RefreshCw, Check, AlertCircle, Edit2, HelpCircle } from 'lucide-react';
import { TreeNode, PromptProject } from '../../types';
import AIResponseRenderer from '../common/AIResponseRenderer';
import { getRequiredInputsForNode } from '../../utils/chainUtils';

interface SimulatorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  simulatorNode: TreeNode | null;
  activeProject: PromptProject | null;
  simProvider: 'gemini' | 'openai';
  setSimProvider: (provider: 'gemini' | 'openai') => void;
  simModel: string;
  setSimModel: (model: string) => void;
  isSimulating: boolean;
  compiledPromptPreview: string;
  simulationResponse: string;
  rootInputs: Record<string, string>;
  handleVariableInputChange: (name: string, value: string) => void;
  handleRunDraft: () => void;
  handleRunSimulation: () => void;
  handleEvaluateDraft: (evalType: 'effective' | 'ineffective') => void;
  handleCreateBranchNode: (branchType: 'success' | 'failure') => void;
  handleSaveModifiedSimulatorOutput: (text: string) => void;
  theme?: 'light' | 'dark';
}

export const SimulatorPanel: React.FC<SimulatorPanelProps> = ({
  isOpen,
  onClose,
  simulatorNode,
  activeProject,
  simProvider,
  setSimProvider,
  simModel,
  setSimModel,
  isSimulating,
  compiledPromptPreview,
  simulationResponse,
  rootInputs,
  handleVariableInputChange,
  handleRunDraft,
  handleRunSimulation,
  handleEvaluateDraft,
  handleCreateBranchNode,
  handleSaveModifiedSimulatorOutput,
  theme = 'dark',
}) => {
  return (
    <AnimatePresence>
      {isOpen && simulatorNode && activeProject && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!isSimulating) onClose();
            }}
            className="absolute inset-0 bg-slate-955/60 backdrop-blur-xs"
          />

          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            className="relative z-10 w-full max-w-5xl h-[85vh] rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-150 p-4 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-emerald-500/10 p-1.5 text-emerald-500">
                  <Play size={16} fill="currentColor" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Mô phỏng thực thi Node: <span className="text-cyan-500">{simulatorNode.title}</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-550 max-w-lg truncate">
                    {simulatorNode.description || 'Không có mô tả'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-xs">
                  <select
                    value={simProvider}
                    onChange={(e) => {
                      const prov = e.target.value as 'gemini' | 'openai';
                      setSimProvider(prov);
                      setSimModel(prov === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini');
                    }}
                    className="bg-slate-100 border-none rounded px-2 py-1 dark:bg-slate-800 dark:text-slate-350 cursor-pointer text-[11px]"
                  >
                    <option value="gemini">Gemini</option>
                    <option value="openai">OpenAI</option>
                  </select>
                  
                  <select
                    value={simModel}
                    onChange={(e) => setSimModel(e.target.value)}
                    className="bg-slate-100 border-none rounded px-2 py-1 dark:bg-slate-800 dark:text-slate-350 cursor-pointer text-[11px]"
                  >
                    {simProvider === 'gemini' ? (
                      <>
                        <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                        <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                        <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                      </>
                    ) : (
                      <>
                        <option value="gpt-4o-mini">gpt-4o-mini</option>
                        <option value="gpt-4o">gpt-4o</option>
                        <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                      </>
                    )}
                  </select>
                </div>

                <button 
                  disabled={isSimulating}
                  onClick={onClose}
                  className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white disabled:opacity-30 cursor-pointer transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden min-h-0">
              {/* Left Panel: Inputs & Preview */}
              <div className="w-96 border-r border-slate-150 p-4 dark:border-slate-800 flex flex-col space-y-4 overflow-y-auto shrink-0">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Biến dự án gốc cần thiết</h4>
                  {getRequiredInputsForNode(simulatorNode, activeProject).length === 0 ? (
                    <p className="text-[11px] italic text-slate-400 dark:text-slate-500">
                      Không yêu cầu biến đầu vào của root.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {getRequiredInputsForNode(simulatorNode, activeProject).map((varName) => {
                        const rootNode = activeProject.nodes.find(n => n.parentId === null);
                        const varInfo = rootNode?.variables?.find(v => v.name === varName);

                        return (
                          <div key={varName} className="flex flex-col gap-1">
                            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                              <span>{varName}</span>
                              {varInfo?.required && <span className="text-[9px] text-rose-500 font-bold">Bắt buộc</span>}
                            </label>
                            <input
                              type="text"
                              value={rootInputs[varName] || ''}
                              onChange={(e) => handleVariableInputChange(varName, e.target.value)}
                              className="w-full rounded-lg border border-slate-250 bg-white px-2.5 py-1.5 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                              placeholder={varInfo?.description || `Nhập giá trị cho {{${varName}}}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex-1 flex flex-col min-h-0 border-t border-slate-100 pt-3 dark:border-slate-800/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Prompt sau biên dịch thử nghiệm</span>
                  <div className="flex-1 rounded-xl bg-slate-50 dark:bg-slate-950 p-3 text-[11px] font-mono leading-relaxed overflow-y-auto whitespace-pre-wrap select-text text-slate-655 dark:text-slate-450 border border-slate-200/50 dark:border-slate-850">
                    {compiledPromptPreview}
                  </div>
                </div>
              </div>

              {/* Right Panel: Response stream & editable response */}
              <div className="flex-1 flex flex-col p-4 overflow-hidden min-h-0 bg-slate-50/50 dark:bg-slate-950/20">
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-550">
                    Kết quả hồi đáp từ mô hình
                  </span>
                  
                  <div className="flex items-center gap-2">
                    {/* Nút Chạy Nháp */}
                    <button
                      disabled={isSimulating || simulatorNode.status === 'running'}
                      onClick={handleRunDraft}
                      className="flex items-center gap-1.5 rounded-xl bg-purple-650 hover:bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-md disabled:opacity-50 cursor-pointer transition-all active:scale-95 text-[11px]"
                    >
                      {simulatorNode.status === 'drafting' ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" />
                          <span>Đang chạy nháp...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={13} fill="currentColor" />
                          <span>Chạy Nháp (Gemini Flash)</span>
                        </>
                      )}
                    </button>

                    {/* Nút Chạy chính thức */}
                    <button
                      disabled={isSimulating || simulatorNode.status === 'drafting' || simulatorNode.status === 'drafted'}
                      onClick={handleRunSimulation}
                      className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-cyan-500 disabled:opacity-50 cursor-pointer transition-all active:scale-95 text-[11px]"
                      title={simulatorNode.status === 'drafted' ? "Đang trong trạng thái Nháp, vui lòng đánh giá trước!" : "Chạy chính thức"}
                    >
                      {simulatorNode.status === 'running' ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" />
                          <span>Đang gọi LLM...</span>
                        </>
                      ) : (
                        <>
                          <Play size={13} fill="currentColor" />
                          <span>Chạy chính thức</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0 space-y-4">
                  <div className="flex-1 border border-slate-200/80 rounded-2xl bg-white dark:border-slate-800 dark:bg-slate-900 p-4 overflow-y-auto select-text">
                    {simulatorNode.status === 'drafting' || simulatorNode.status === 'drafted' ? (
                      <div>
                        <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold text-purple-600 dark:text-purple-400">
                          <Sparkles size={12} className="animate-pulse text-purple-500" />
                          <span>KẾT QUẢ CHẠY NHÁP & ĐÁNH GIÁ QUY CHUẨN</span>
                        </div>
                        <AIResponseRenderer content={simulationResponse || simulatorNode.draftOutput || ''} />
                      </div>
                    ) : (simulationResponse || simulatorNode.output) ? (
                      <AIResponseRenderer content={simulationResponse || simulatorNode.output || ''} />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                        <Sparkles size={30} className="mb-2 animate-pulse text-slate-300 dark:text-slate-700" />
                        <p className="text-xs">Đầu ra của Node sẽ được truyền trực tiếp vào các biến liên kết <code>{"{{parent.output}}"}</code> của các node con sau khi hoàn thành chạy thử.</p>
                      </div>
                    )}
                  </div>

                  {/* UI Đánh giá Nháp */}
                  {(simulatorNode.status === 'drafted' || (simulatorNode.draftOutput && !isSimulating)) && (
                    <div className="flex flex-col gap-3 rounded-2xl bg-purple-500/5 dark:bg-purple-950/20 p-4 border border-purple-500/20 shrink-0">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-purple-700 dark:text-purple-400">
                            Đánh giá kết quả chạy nháp (Nháp):
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-550">
                            Chọn hiệu quả để tạo nhánh Nâng cao, hoặc không hiệu quả để tạo nhánh Sửa lỗi.
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEvaluateDraft('effective')}
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-all cursor-pointer shadow-sm active:scale-95 text-[11px]"
                          >
                            <Check size={14} />
                            👍 Hiệu quả (Tạo Nhánh A Nâng Cao)
                          </button>
                          <button
                            onClick={() => handleEvaluateDraft('ineffective')}
                            className="flex items-center gap-1.5 rounded-xl bg-orange-650 px-3 py-2 text-xs font-bold text-white hover:bg-orange-600 transition-all cursor-pointer shadow-sm active:scale-95 text-[11px]"
                          >
                            <AlertCircle size={14} />
                            👎 Không hiệu quả (Tạo Nhánh B Sửa Lỗi)
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Đánh giá phản hồi chính thức */}
                  {simulatorNode.status !== 'drafting' && simulatorNode.status !== 'drafted' && !simulatorNode.draftOutput && simulationResponse && !isSimulating && (
                    <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 p-4 border border-slate-200 dark:border-slate-800 shrink-0">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-355">
                          Đánh giá phản hồi và mở rộng quy trình:
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCreateBranchNode('success')}
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-all cursor-pointer shadow-sm active:scale-95 text-[11px]"
                          >
                            <Check size={14} />
                            👍 Phản hồi Hiệu quả (Tạo Nhánh Nâng Cao)
                          </button>
                          <button
                            onClick={() => handleCreateBranchNode('failure')}
                            className="flex items-center gap-1.5 rounded-xl bg-orange-650 px-3 py-2 text-xs font-bold text-white hover:bg-orange-600 transition-all cursor-pointer shadow-sm active:scale-95 text-[11px]"
                          >
                            <AlertCircle size={14} />
                            👎 Phản hồi Chưa đạt (Tạo Nhánh Sửa Lỗi)
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tinh chỉnh kết quả */}
                  {simulationResponse && !isSimulating && (
                    <div className="flex flex-col gap-2 rounded-xl bg-amber-500/5 border border-amber-500/20 p-3 shrink-0">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Edit2 size={12} />
                          Tinh chỉnh câu trả lời (Tùy chọn)
                        </span>
                        <span className="text-[9px] text-slate-400">Bạn có thể chỉnh sửa thủ công để tối ưu kết quả trước khi đưa vào các node con.</span>
                      </div>
                      
                      <textarea
                        defaultValue={simulationResponse}
                        onBlur={(e) => handleSaveModifiedSimulatorOutput(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg p-2 text-xs focus:outline-none dark:text-slate-350 min-h-[60px]"
                        placeholder="Chỉnh sửa câu trả lời tại đây..."
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
