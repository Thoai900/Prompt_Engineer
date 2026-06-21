import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, Trash2, Play, Check, AlertCircle, Database, HelpCircle, RefreshCw } from 'lucide-react';
import { TestCase, PromptProject } from '../../types';
import AIResponseRenderer from '../common/AIResponseRenderer';

interface TestCasesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeProject: PromptProject | null;
  selectedTestCaseId: string | null;
  setSelectedTestCaseId: (id: string | null) => void;
  isRunningAllTests: boolean;
  testSuiteLogs: string[];
  handleAddTestCase: () => void;
  handleDeleteTestCase: (id: string) => void;
  handleUpdateTestCase: (id: string, fields: Partial<TestCase>) => void;
  runIndividualTestCase: (id: string) => void;
  runTestSuiteExecution: () => void;
  theme?: 'light' | 'dark';
}

export const TestCasesPanel: React.FC<TestCasesPanelProps> = ({
  isOpen,
  onClose,
  activeProject,
  selectedTestCaseId,
  setSelectedTestCaseId,
  isRunningAllTests,
  testSuiteLogs,
  handleAddTestCase,
  handleDeleteTestCase,
  handleUpdateTestCase,
  runIndividualTestCase,
  runTestSuiteExecution,
  theme = 'dark',
}) => {
  return (
    <AnimatePresence>
      {isOpen && activeProject && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!isRunningAllTests) onClose();
            }}
            className="absolute inset-0 bg-slate-955/60 backdrop-blur-xs"
          />

          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            className="relative z-10 w-full max-w-6xl h-[85vh] rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-150 p-4 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-purple-500/10 p-1.5 text-purple-500">
                  <Database size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Hệ thống Kiểm thử tự động & AI Judge (Automated Unit Testing)
                  </h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-550">
                    Thiết lập các bộ test case, chạy kiểm thử qua chuỗi prompt và tự động chấm điểm chất lượng bằng LLM Judge.
                  </p>
                </div>
              </div>

              <button 
                disabled={isRunningAllTests}
                onClick={onClose}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white disabled:opacity-30 cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 flex overflow-hidden min-h-0">
              {/* Left Panel: Test Cases List */}
              <div className="w-80 border-r border-slate-150 p-4 dark:border-slate-800 flex flex-col overflow-y-auto shrink-0 bg-slate-55/30 dark:bg-slate-955/10">
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-550">
                    Bộ kiểm thử ({ (activeProject.testCases || []).length })
                  </span>
                  <button
                    onClick={handleAddTestCase}
                    disabled={isRunningAllTests}
                    className="flex items-center gap-1 rounded-lg bg-purple-600 hover:bg-purple-550 px-2 py-1 text-[11px] font-bold text-white transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    <Plus size={12} />
                    <span>Thêm Case</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {(activeProject.testCases || []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 dark:text-slate-550">
                      <Database size={20} className="mb-1 text-slate-350 dark:text-slate-805" />
                      <p className="text-[11px] italic">Chưa cấu hình test case nào.</p>
                    </div>
                  ) : (
                    (activeProject.testCases || []).map((tc) => {
                      const isSelected = selectedTestCaseId === tc.id;
                      let statusColor = "text-slate-400 dark:text-slate-600";
                      let statusIcon = <HelpCircle size={14} className={statusColor} />;
                      
                      if (tc.status === 'running') {
                        statusColor = "text-cyan-500 animate-spin";
                        statusIcon = <RefreshCw size={14} className={statusColor} />;
                      } else if (tc.status === 'success') {
                        statusColor = "text-emerald-500";
                        statusIcon = <Check size={14} className={statusColor} />;
                      } else if (tc.status === 'failed') {
                        statusColor = "text-rose-500";
                        statusIcon = <AlertCircle size={14} className={statusColor} />;
                      }

                      return (
                        <div
                          key={tc.id}
                          onClick={() => setSelectedTestCaseId(tc.id)}
                          className={`group flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300'
                              : 'bg-white border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden flex-1">
                            <div className="shrink-0">{statusIcon}</div>
                            <span className="text-xs font-semibold truncate leading-none">{tc.name}</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {tc.score !== undefined && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                tc.score >= 80
                                  ? 'bg-emerald-500/10 text-emerald-605 dark:text-emerald-400'
                                  : 'bg-rose-500/10 text-rose-605 dark:text-rose-400'
                              }`}>
                                {tc.score}
                              </span>
                            )}
                            <button
                              disabled={isRunningAllTests}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTestCase(tc.id);
                              }}
                              className="text-slate-400 hover:text-rose-550 opacity-0 group-hover:opacity-100 p-0.5 transition-opacity disabled:opacity-0 cursor-pointer"
                              title="Xóa test case"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Panel: Test Case Settings & Results */}
              <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-slate-50/20 dark:bg-slate-955/5">
                {selectedTestCaseId && activeProject.testCases?.find(t => t.id === selectedTestCaseId) ? (
                  (() => {
                    const tc = activeProject.testCases.find(t => t.id === selectedTestCaseId)!;
                    const rootNode = activeProject.nodes.find(n => n.parentId === null);
                    const rootVars = rootNode?.variables || [];
                    
                    return (
                      <div className="flex-1 flex flex-col overflow-hidden min-h-0 p-4">
                        
                        {/* Testcase header info */}
                        <div className="flex items-center justify-between border-b border-slate-150 pb-3 mb-3 dark:border-slate-800 shrink-0">
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="text"
                              value={tc.name}
                              disabled={isRunningAllTests}
                              onChange={(e) => handleUpdateTestCase(tc.id, { name: e.target.value })}
                              className="text-sm font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-purple-500 px-1 py-0.5 focus:outline-none dark:text-white max-w-xs transition-colors"
                            />
                          </div>

                          <button
                            onClick={() => runIndividualTestCase(tc.id)}
                            disabled={isRunningAllTests || tc.status === 'running'}
                            className="flex items-center gap-1 rounded-xl bg-purple-650 hover:bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm cursor-pointer transition-all active:scale-95 disabled:opacity-50 text-[11px]"
                          >
                            {tc.status === 'running' ? (
                              <>
                                <RefreshCw size={13} className="animate-spin" />
                                <span>Đang chạy...</span>
                              </>
                            ) : (
                              <>
                                <Play size={13} fill="currentColor" />
                                <span>Chạy Case này</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Scrollable inputs & output section */}
                        <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                          
                          {/* Inputs fields */}
                          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-550 mb-3">
                              1. Biến đầu vào của chuỗi (Inputs)
                            </h4>
                            {rootVars.length === 0 ? (
                              <p className="text-xs italic text-slate-400 dark:text-slate-500">Node gốc không cấu hình biến đầu vào nào.</p>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {rootVars.map(v => (
                                  <div key={v.name} className="flex flex-col gap-1">
                                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                      {v.name} {v.required && <span className="text-[9px] text-rose-500 font-bold">*</span>}
                                    </label>
                                    <input
                                      type="text"
                                      disabled={isRunningAllTests}
                                      value={tc.inputs[v.name] || ''}
                                      onChange={(e) => {
                                        const newInputs = { ...tc.inputs, [v.name]: e.target.value };
                                        handleUpdateTestCase(tc.id, { inputs: newInputs });
                                      }}
                                      className="w-full rounded-lg border border-slate-250 bg-white px-2.5 py-1.5 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-955 dark:text-slate-305 disabled:opacity-50"
                                      placeholder={v.description || `Nhập giá trị cho {{${v.name}}}`}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Specific Criteria */}
                          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-550">
                                2. Quy chuẩn đánh giá kiểm thử (AI Judge Criteria)
                              </h4>
                              <span className="text-[10px] text-slate-450 dark:text-slate-550">
                                Được áp dụng để AI chấm điểm (0-100)
                              </span>
                            </div>
                            
                            <div className="space-y-1.5 mb-3">
                              {(!tc.expectedCriteria || tc.expectedCriteria.length === 0) ? (
                                <p className="text-xs italic text-slate-400 dark:text-slate-550">Chưa thiết lập quy chuẩn riêng. Sẽ tự động dùng Quy chuẩn toàn cục.</p>
                              ) : (
                                tc.expectedCriteria.map((crit, idx) => (
                                  <div 
                                    key={idx}
                                    className="flex items-center justify-between rounded-lg border border-slate-150 bg-slate-50/60 p-2 dark:border-slate-850 dark:bg-slate-955/20 text-xs text-slate-655 dark:text-slate-350"
                                  >
                                    <span className="flex-1 pr-3 leading-relaxed">{crit}</span>
                                    <button
                                      disabled={isRunningAllTests}
                                      onClick={() => {
                                        const updated = (tc.expectedCriteria || []).filter((_, i) => i !== idx);
                                        handleUpdateTestCase(tc.id, { expectedCriteria: updated });
                                      }}
                                      className="text-slate-455 hover:text-rose-500 disabled:opacity-0 cursor-pointer p-0.5"
                                      title="Xóa quy chuẩn"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>

                            <div className="flex gap-2">
                              <input
                                type="text"
                                disabled={isRunningAllTests}
                                placeholder="Thêm quy chuẩn kiểm thử mới riêng cho case này..."
                                id={`new-crit-tc-${tc.id}`}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = (e.target as HTMLInputElement).value.trim();
                                    if (val) {
                                      const updated = [...(tc.expectedCriteria || []), val];
                                      handleUpdateTestCase(tc.id, { expectedCriteria: updated });
                                      (e.target as HTMLInputElement).value = '';
                                    }
                                  }
                                }}
                                className="flex-1 rounded-lg border border-slate-250 bg-white px-2.5 py-1.5 text-xs focus:outline-none dark:border-slate-800 dark:bg-slate-955 dark:text-slate-300 disabled:opacity-50"
                              />
                              <button
                                disabled={isRunningAllTests}
                                onClick={() => {
                                  const el = document.getElementById(`new-crit-tc-${tc.id}`) as HTMLInputElement;
                                  const val = el?.value.trim();
                                  if (val) {
                                    const updated = [...(tc.expectedCriteria || []), val];
                                    handleUpdateTestCase(tc.id, { expectedCriteria: updated });
                                    el.value = '';
                                  }
                                }}
                                className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-550 transition-all cursor-pointer text-[11px]"
                              >
                                Thêm
                              </button>
                            </div>
                          </div>

                          {/* Results & AI Judge */}
                          {(tc.outputText || tc.score !== undefined) && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              {/* LLM output preview */}
                              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 flex flex-col h-[320px]">
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-550 mb-2 shrink-0">
                                  Kết quả đầu ra của chuỗi (Output)
                                </h4>
                                <div className="flex-1 border border-slate-100 rounded-xl bg-slate-50/30 dark:border-slate-850 dark:bg-slate-955/10 p-3 overflow-y-auto select-text text-xs leading-relaxed">
                                  <AIResponseRenderer content={tc.outputText || ''} />
                                </div>
                              </div>

                              {/* AI Judge grading */}
                              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 flex flex-col h-[320px]">
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-550 mb-2 shrink-0">
                                  Kết quả thẩm định của AI Judge
                                </h4>
                                
                                <div className="flex-1 flex flex-col justify-between overflow-y-auto pr-1">
                                  {/* Score Gauge */}
                                  {tc.score !== undefined && (
                                    <div className="mb-4 shrink-0">
                                      <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[11px] font-bold text-slate-605 dark:text-slate-300">Điểm số AI Judge:</span>
                                        <span className={`text-sm font-black ${
                                          tc.score >= 80 ? 'text-emerald-500' : 'text-rose-505'
                                        }`}>
                                          {tc.score} / 100
                                        </span>
                                      </div>
                                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all duration-500 ${
                                            tc.score >= 80 ? 'bg-emerald-500' : 'bg-rose-500'
                                          }`}
                                          style={{ width: `${tc.score}%` }}
                                        />
                                      </div>
                                      <div className="flex justify-between items-center mt-2">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                          tc.score >= 80
                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                            : 'bg-rose-505/10 text-rose-600 dark:text-rose-455'
                                        }`}>
                                          {tc.score >= 80 ? 'ĐẠT TIÊU CHUẨN ✓' : 'CHƯA ĐẠT TIÊU CHUẨN ✗'}
                                        </span>
                                        <span className="text-[10px] text-slate-400 italic">Yêu cầu &ge; 80 điểm</span>
                                      </div>
                                    </div>
                                  )}

                                  {/* Feedback Box */}
                                  <div className="flex-1 border border-slate-100 dark:border-slate-850 rounded-xl bg-slate-50/20 p-3 overflow-y-auto">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-550 block mb-1">
                                      Nhận xét chi tiết từ AI:
                                    </span>
                                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap select-text">
                                      {tc.feedback || 'Không có nhận xét nào.'}
                                    </p>
                                  </div>
                                  
                                  <div className="border-t border-slate-100 dark:border-slate-800/60 pt-2 mt-3 text-[10px] text-slate-400 leading-normal flex items-start gap-1 shrink-0">
                                    <span>💡</span>
                                    <span>AI Judge đánh giá bám sát các tiêu chí của Mentor AI như: Socratic Method (không giải hộ), LaTeX ($ / $$), giọng điệu ấm áp và quy chuẩn riêng của test case.</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400 dark:text-slate-550">
                    <HelpCircle size={32} className="mb-2 text-slate-350 dark:text-slate-750" />
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-1">Chưa chọn Bộ Kiểm Thử</h4>
                    <p className="text-xs max-w-sm">Hãy chọn một bộ kiểm thử ở thanh bên trái hoặc tạo mới để thiết lập cấu hình chạy đánh giá prompt.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Console Logs Terminal & Footer */}
            <div className="border-t border-slate-150 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-955/20 shrink-0 flex flex-col gap-3">
              {/* Console view */}
              <div className="h-24 border border-slate-200/80 rounded-xl bg-slate-955 dark:border-slate-800 dark:bg-slate-950 p-2.5 flex flex-col font-mono text-[9px] text-slate-350 dark:text-slate-350">
                <span className="text-[8px] uppercase font-bold text-slate-500 mb-1 pb-1 border-b border-slate-200 dark:border-slate-900 flex items-center justify-between">
                  <span>Nhật ký chạy kiểm thử (Suite Runner Console)</span>
                  {isRunningAllTests && <RefreshCw size={8} className="animate-spin text-purple-400" />}
                </span>
                <div className="flex-1 overflow-y-auto space-y-0.5 scrollbar-thin select-text">
                  {testSuiteLogs.length === 0 ? (
                    <span className="text-slate-500 italic">Chưa có nhật ký hoạt động.</span>
                  ) : (
                    testSuiteLogs.map((log, idx) => (
                      <div key={idx} className="leading-normal">{log}</div>
                    ))
                  )}
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={runTestSuiteExecution}
                    disabled={isRunningAllTests || (activeProject.testCases || []).length === 0}
                    className="flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-550 px-4 py-2 text-xs font-bold text-white shadow-md cursor-pointer transition-all active:scale-95 disabled:opacity-50 text-[11px]"
                  >
                    {isRunningAllTests ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Đang chạy Suite...</span>
                      </>
                    ) : (
                      <>
                        <Play size={14} fill="currentColor" />
                        <span>Chạy toàn bộ Test Suite</span>
                      </>
                    )}
                  </button>
                  {isRunningAllTests && (
                    <span className="text-[11px] text-purple-650 dark:text-purple-405 font-semibold animate-pulse">
                      Đang thực thi bộ kiểm thử. Vui lòng giữ cửa sổ mở...
                    </span>
                  )}
                </div>

                <button
                  disabled={isRunningAllTests}
                  onClick={onClose}
                  className="rounded-xl border border-slate-250 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-55 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-850 cursor-pointer disabled:opacity-50 text-[11px]"
                >
                  Đóng
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
