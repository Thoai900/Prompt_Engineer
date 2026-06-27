import React, { useState } from 'react';
import { Sparkles, ArrowRight, Loader2, Copy, Check, ExternalLink, Settings } from 'lucide-react';
import { PromptBlock, PromptTemplate } from '../../types';
import { enhancePromptWithAi } from '../../services/aiService';
import StepNarrator from '../common/StepNarrator';
import { GhostTextArea } from '../common/GhostTextArea';

interface EnhancerTabProps {
  onApplyTemplate?: (template: PromptTemplate) => void;
}

export default function EnhancerTab({ onApplyTemplate }: EnhancerTabProps) {
  const [inputPrompt, setInputPrompt] = useState('');
  const [optimizedBlocks, setOptimizedBlocks] = useState<PromptBlock[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // AI parameters
  const [useDeepReasoning, setUseDeepReasoning] = useState(false);
  const [customTemp, setCustomTemp] = useState<number>(0.7);
  const [customTopP, setCustomTopP] = useState<number>(0.95);
  const [showSettings, setShowSettings] = useState(false);

  const handleEnhance = async () => {
    if (!inputPrompt.trim()) return;
    
    setIsLoading(true);
    setErrorMsg('');
    try {
      const blocks = await enhancePromptWithAi(inputPrompt, {
        useDeepReasoning,
        temperature: customTemp,
        topP: customTopP
      });
      
      if (blocks && Array.isArray(blocks)) {
        const blocksWithIds = blocks.map((b: any, idx: number) => ({
          ...b,
          id: `ai-${b.type}-${Date.now()}-${idx}`
        }));
        setOptimizedBlocks(blocksWithIds);
      } else {
        throw new Error("Invalid output format.");
      }
    } catch (error) {
      console.error(error);
      setErrorMsg("Đã có lỗi xảy ra trong quá trình nâng cấp prompt. Vui lòng kiểm tra API Key hoặc thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  const generateRawText = () => {
    if (!optimizedBlocks) return "";
    return optimizedBlocks.map(b => `### ${b.title}\n${b.content}`).join('\n\n');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateRawText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyToBuilder = () => {
    if (!optimizedBlocks || !onApplyTemplate) return;
    const template: PromptTemplate = {
      id: `ai-enhanced-${Date.now()}`,
      title: "AI Enhanced Prompt",
      description: "Prompt đã được tối ưu hóa cấu trúc bởi AI.",
      blocks: optimizedBlocks
    };
    onApplyTemplate(template);
  };

  return (
    <div className="flex-1 p-6 flex flex-col overflow-y-auto w-full max-w-5xl mx-auto pb-safe">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-lg font-bold">AI Prompt Upgrader</h2>
          <p className="text-sm text-slate-500">Tối ưu hóa các ý tưởng cơ bản thành cấu trúc prompt chuyên nghiệp và sắc bén.</p>
        </div>
        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-full border border-emerald-100 flex items-center gap-1.5 shadow-sm">
          ⚡ Tốc độ tối đa (Mặc định Flash)
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[500px]">
        {/* Input */}
        <div className="flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
             <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ý tưởng ban đầu</h3>
          </div>
          <div className="flex-1 p-0 relative min-h-[220px]">
            <GhostTextArea
              className="w-full h-full min-h-[220px] p-6 resize-none focus:outline-none text-sm text-slate-700 leading-relaxed placeholder-slate-300"
              placeholder="Nhập prompt cơ bản của bạn tại đây...&#10;Ví dụ: Viết một bài đăng Facebook bán áo phông trẻ em mùa hè."
              value={inputPrompt}
              onValueChange={(next) => setInputPrompt(next)}
            />
          </div>

          {/* Advanced settings collapsible panel */}
          {showSettings && (
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex flex-col">
                  <span>🧠 Lập luận chuyên sâu (Deep Reasoning)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Sử dụng Gemini 2.5 Pro cho cấu trúc phức tạp</span>
                </label>
                <input
                  type="checkbox"
                  checked={useDeepReasoning}
                  onChange={(e) => setUseDeepReasoning(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-slate-600">Độ sáng tạo (Temperature): {customTemp}</span>
                </div>
                <input
                  type="range"
                  min="0" max="1" step="0.1"
                  value={customTemp}
                  onChange={(e) => setCustomTemp(Number(e.target.value))}
                  className="w-full accent-indigo-600 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-slate-600">Phạm vi từ vựng (Top-P): {customTopP}</span>
                </div>
                <input
                  type="range"
                  min="0.1" max="1" step="0.05"
                  value={customTopP}
                  onChange={(e) => setCustomTopP(Number(e.target.value))}
                  className="w-full accent-indigo-600 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          )}

          <div className="p-4 border-t border-slate-100 flex justify-between bg-slate-50/50">
             <button
              onClick={() => setShowSettings(!showSettings)}
              className={`px-3 py-2 border rounded-md text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 ${showSettings ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
             >
               <Settings size={14} />
               <span>{showSettings ? 'Ẩn cài đặt' : 'Cài đặt AI'}</span>
             </button>
             <button
              onClick={handleEnhance}
              disabled={!inputPrompt.trim() || isLoading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-xs font-semibold shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? <Loader2 size={14} className="animate-pulse" /> : <Sparkles size={14} />}
              <span>{isLoading ? 'Đang tối ưu...' : 'Tối ưu hóa Prompt'}</span>
            </button>
          </div>
        </div>

        {/* Output */}
        <div className="flex flex-col bg-slate-50 rounded-xl border border-indigo-200 shadow-sm overflow-hidden flex-1 p-4 h-full relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
             <h3 className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Cấu trúc Tối ưu</h3>
             {optimizedBlocks && optimizedBlocks.length > 0 && (
               <div className="flex items-center gap-2 w-full md:w-auto">
                 <button
                    onClick={handleCopy}
                    className="flex-1 md:flex-none justify-center px-3 py-2 bg-white border border-slate-200 rounded-md text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                    <span>{copied ? 'Đã Copy' : 'Copy'}</span>
                  </button>
                  {onApplyTemplate && (
                    <button
                      onClick={handleApplyToBuilder}
                      className="flex-[2] md:flex-none justify-center px-3 py-2 bg-indigo-600 border border-indigo-600 rounded-md text-xs font-semibold text-white hover:bg-indigo-700 flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <ExternalLink size={14} />
                      <span>Áp dụng vào Builder</span>
                    </button>
                  )}
               </div>
             )}
          </div>
          
          <div className="flex-1 bg-white border border-slate-200 rounded-lg p-4 overflow-y-auto custom-scrollbar">
             {isLoading ? (
               <div className="h-full flex items-center justify-center">
                 <StepNarrator flowKey="enhancer" isActive={isLoading} placement="overlay" className="w-72 max-w-[90%]" />
               </div>
             ) : errorMsg ? (
               <div className="text-sm text-rose-500 font-medium p-4 bg-rose-50 rounded text-center">
                 {errorMsg}
               </div>
             ) : optimizedBlocks && optimizedBlocks.length > 0 ? (
               <div className="flex flex-col gap-4">
                 {optimizedBlocks.map(block => (
                   <div key={block.id} className="border border-slate-100 rounded-lg p-3 bg-slate-50/50">
                     <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-widest mb-1.5">
                       [{block.title}]
                     </h4>
                     <p className="text-sm text-slate-700 leading-relaxed font-mono whitespace-pre-wrap">
                       {block.content}
                     </p>
                   </div>
                 ))}
               </div>
             ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center gap-2 py-10">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                     <ArrowRight size={16} className="text-slate-300" />
                  </div>
                  <p className="text-xs">Nhập prompt của bạn và nhấp nút tối ưu hóa<br/>để tự động cấu trúc hóa bằng mô hình siêu tốc.</p>
                </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
