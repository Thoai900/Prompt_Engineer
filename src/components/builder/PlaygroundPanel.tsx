import React from 'react';
import { Sparkles, Loader2, Send } from 'lucide-react';
import AIResponseRenderer from '../common/AIResponseRenderer';
import StepNarrator from '../common/StepNarrator';

// Trần token đầu ra hiển thị cho người dùng — khớp mặc định proxy (AI_MAX_OUTPUT_TOKENS ở api/ai.ts).
// Kẹp tại client để người dùng không đặt vượt trần rồi bị backend cắt cụt âm thầm.
const MAX_TOKENS_LIMIT = 16000;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface PlaygroundPanelProps {
  showPlaygroundConfig: boolean;
  setShowPlaygroundConfig: (show: boolean) => void;
  playgroundProvider: 'gemini' | 'openai';
  setPlaygroundProvider: (prov: 'gemini' | 'openai') => void;
  playgroundModel: string;
  setPlaygroundModel: (model: string) => void;
  useSystemGeminiKey: boolean;
  setUseSystemGeminiKey: (use: boolean) => void;
  geminiApiKey: string;
  setGeminiApiKey: (key: string) => void;
  openaiApiKey: string;
  setOpenaiApiKey: (key: string) => void;
  groqApiKey: string;
  setGroqApiKey: (key: string) => void;
  playgroundTemp: number;
  setPlaygroundTemp: (temp: number) => void;
  playgroundMaxTokens: number;
  setPlaygroundMaxTokens: (tokens: number) => void;
  playgroundMessages: ChatMessage[];
  handleStartPlaygroundSession: () => void;
  handleSendPlaygroundMessage: (e?: React.FormEvent) => void;
  isChatGenerating: boolean;
  chatInput: string;
  setChatInput: (input: string) => void;
  handleResetPlayground: () => void;
}

export const PlaygroundPanel: React.FC<PlaygroundPanelProps> = ({
  showPlaygroundConfig,
  setShowPlaygroundConfig,
  playgroundProvider,
  setPlaygroundProvider,
  playgroundModel,
  setPlaygroundModel,
  useSystemGeminiKey,
  setUseSystemGeminiKey,
  geminiApiKey,
  setGeminiApiKey,
  openaiApiKey,
  setOpenaiApiKey,
  groqApiKey,
  setGroqApiKey,
  playgroundTemp,
  setPlaygroundTemp,
  playgroundMaxTokens,
  setPlaygroundMaxTokens,
  playgroundMessages,
  handleStartPlaygroundSession,
  handleSendPlaygroundMessage,
  isChatGenerating,
  chatInput,
  setChatInput,
  handleResetPlayground,
}) => {
  return (
    <div className="flex-1 flex flex-col min-h-0 relative bg-slate-50/30 dark:bg-slate-955/10">
      {/* Playground API & Model Config Panel */}
      {showPlaygroundConfig && (
        <div className="absolute inset-x-0 top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 z-20 flex flex-col gap-3 shadow-xl animate-in slide-in-from-top-2 duration-150 text-slate-800 dark:text-slate-100">
          <div className="flex justify-between items-center pb-2 border-b border-slate-150 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cấu hình AI Playground</span>
            <button 
              type="button" 
              onClick={() => setShowPlaygroundConfig(false)} 
              className="text-xs font-semibold text-violet-400 hover:text-violet-300 cursor-pointer"
            >
              Đóng
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-405 uppercase mb-1">Nhà cung cấp</label>
              <select
                value={playgroundProvider}
                onChange={(e) => {
                  const val = e.target.value as 'gemini' | 'openai';
                  setPlaygroundProvider(val);
                  setPlaygroundModel(val === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini');
                }}
                className="text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-880 bg-slate-50 dark:bg-slate-955 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 font-semibold cursor-pointer"
              >
                <option value="gemini">Google Gemini</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-405 uppercase mb-1">Mô hình (Model)</label>
              <select
                value={playgroundModel}
                onChange={(e) => setPlaygroundModel(e.target.value)}
                className="text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-880 bg-slate-50 dark:bg-slate-955 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 font-semibold cursor-pointer"
              >
                {playgroundProvider === 'gemini' ? (
                  <>
                    <option value="gemini-2.5-flash">gemini-2.5-flash (Nhanh)</option>
                    <option value="gemini-2.5-pro">gemini-2.5-pro (Pro)</option>
                    <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                  </>
                ) : (
                  <>
                    <option value="gpt-4o-mini">gpt-4o-mini</option>
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="o1-mini">o1-mini (Lập luận)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {playgroundProvider === 'gemini' ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="useSystemKeyCheckbox" className="text-[10px] font-bold text-slate-600 dark:text-slate-350 cursor-pointer">Sử dụng API Key mặc định hệ thống</label>
                <input
                  type="checkbox"
                  id="useSystemKeyCheckbox"
                  checked={useSystemGeminiKey}
                  onChange={(e) => setUseSystemGeminiKey(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-800 text-violet-550 focus:ring-violet-500 cursor-pointer w-3.5 h-3.5 bg-white dark:bg-slate-950"
                />
              </div>
              {!useSystemGeminiKey && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-slate-600 dark:text-slate-500 font-medium">Gemini API Key cá nhân:</span>
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="Nhập AIzaSy..."
                    className="w-full text-xs px-2.5 py-1 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-955 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 placeholder-slate-400 dark:placeholder-slate-800"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 block">OpenAI API Key cá nhân:</label>
              <input
                type="password"
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                placeholder="Nhập sk-..."
                className="w-full text-xs px-2.5 py-1 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-955 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 placeholder-slate-400 dark:placeholder-slate-800"
              />
            </div>
          )}

          {/* Llama-3-8B (Groq) — mô hình hỗ trợ DÀNH RIÊNG cho việc tạo prompt,
              giúp tiết kiệm hạn mức Gemini. Áp dụng toàn cục, lưu cục bộ. */}
          <div className="flex flex-col gap-0.5 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800">
            <label className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block flex items-center gap-1">
              🦙 Llama-3-8B (Groq) — hỗ trợ tạo prompt
            </label>
            <span className="text-[9px] text-slate-500 dark:text-slate-500 leading-snug mb-0.5">
              Key mặc định của ứng dụng (Gemini + Llama) được giấu an toàn ở backend — chỉ cần đăng nhập là dùng được, việc tạo prompt ưu tiên Llama và tự chuyển sang Llama khi Gemini hết hạn mức. Nhập key Groq riêng vào đây để gọi thẳng bằng key của bạn (không qua backend).
            </span>
            <input
              type="password"
              value={groqApiKey}
              onChange={(e) => setGroqApiKey(e.target.value)}
              placeholder="Nhập gsk_..."
              className="w-full text-xs px-2.5 py-1 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-955 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-400 dark:placeholder-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mt-1">
            <div>
              <div className="flex justify-between text-[9px] font-bold text-slate-500 dark:text-slate-450 uppercase mb-0.5">
                <span>Sáng tạo (Temp):</span>
                <span className="text-violet-655 dark:text-violet-400">{playgroundTemp}</span>
              </div>
              <input
                type="range"
                min="0" max="1.5" step="0.1"
                value={playgroundTemp}
                onChange={(e) => setPlaygroundTemp(Number(e.target.value))}
                className="w-full accent-violet-550 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between text-[9px] font-bold text-slate-500 dark:text-slate-450 uppercase mb-0.5">
                <span>Max tokens (≤ {MAX_TOKENS_LIMIT}):</span>
                <span className="text-violet-655 dark:text-violet-400">{playgroundMaxTokens}</span>
              </div>
              <input
                type="number"
                min={256}
                max={MAX_TOKENS_LIMIT}
                step={256}
                value={playgroundMaxTokens}
                onChange={(e) => setPlaygroundMaxTokens(Math.min(MAX_TOKENS_LIMIT, Math.max(1, Number(e.target.value) || 1)))}
                onBlur={(e) => setPlaygroundMaxTokens(Math.min(MAX_TOKENS_LIMIT, Math.max(256, Number(e.target.value) || 256)))}
                className="w-full text-xs px-2 py-0.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {/* Chat Message History */}
      <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-3.5 scroll-smooth bg-slate-50/20 dark:bg-slate-955/10">
        {playgroundMessages.length === 0 ? (
          <div className="m-auto flex flex-col items-center justify-center text-center p-8 max-w-xs gap-3">
            <div className="w-14 h-14 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center">
              <Sparkles size={24} className="animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Phiên thử nghiệm trống</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Hãy khởi chạy phiên chat để đưa System Prompt hiện tại vào thử nghiệm trực tiếp.
              </p>
            </div>
            <button
              type="button"
              onClick={handleStartPlaygroundSession}
              className="py-2.5 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-violet-900/10 active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles size={12} /> Khởi chạy Chat
            </button>
          </div>
        ) : (
          playgroundMessages.map((m, idx) => {
            const isAi = m.role === 'assistant';
            return (
              <div key={idx} className={`flex flex-col gap-1 max-w-[85%] ${isAi ? 'self-start text-left' : 'self-end items-end text-right'}`}>
                <div className={`text-[8px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-550 ${isAi ? 'pl-2' : 'pr-2'}`}>
                  {isAi ? '🤖 AI' : '👤 Bạn'}
                </div>
                <div className={`p-3 rounded-2xl text-[11.5px] leading-relaxed shadow-sm border text-left
                  ${isAi 
                    ? 'bg-slate-100 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200 dark:border-slate-800 text-slate-850 dark:text-slate-200 rounded-tl-sm' 
                    : 'bg-gradient-to-r from-violet-600 to-indigo-600 border-violet-500/10 text-white rounded-tr-sm'}`}
                >
                  {m.content === '' ? (
                    <StepNarrator flowKey="playground-sim" isActive placement="inline" className="min-w-[180px]" />
                  ) : isAi ? (
                    <AIResponseRenderer content={m.content} className="dark:prose-invert text-slate-850 dark:text-slate-200" />
                  ) : (
                    <div className="whitespace-pre-wrap font-sans break-words">{m.content}</div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Chat Input Area */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/40 shrink-0 flex flex-col gap-2">
        <form onSubmit={handleSendPlaygroundMessage} className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            disabled={isChatGenerating || playgroundMessages.length === 0}
            placeholder={playgroundMessages.length === 0 ? "Bấm 'Khởi chạy Chat' để bắt đầu..." : "Nhập tin nhắn thử nghiệm..."}
            className="flex-1 text-xs px-3.5 py-2.5 border border-slate-200 dark:border-slate-880 bg-white dark:bg-slate-955 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-650 rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isChatGenerating || !chatInput.trim() || playgroundMessages.length === 0}
            className="w-10 h-10 shrink-0 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white rounded-xl flex items-center justify-center shadow-md shadow-violet-900/10 transition-colors disabled:text-slate-400 dark:disabled:text-slate-650 disabled:shadow-none cursor-pointer active:scale-95"
          >
            {isChatGenerating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
        {playgroundMessages.length > 0 && (
          <div className="flex justify-between items-center text-[9px] text-slate-500 px-1">
            <span>Phiên chat đã nạp System Prompt tự động.</span>
            <button 
              type="button"
              onClick={handleResetPlayground} 
              className="text-rose-450 hover:text-rose-350 font-bold uppercase transition-colors cursor-pointer"
            >
              Reset Chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
