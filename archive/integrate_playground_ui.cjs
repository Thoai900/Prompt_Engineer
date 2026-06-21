const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'BuilderTab.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings to LF
content = content.replace(/\r\n/g, '\n');

// 1. Target: Right panel wrapper start and header
const targetHeader = `          {/* Live Preview & Variables Column (40% width on Desktop) */}
          <div className={\`w-full lg:flex-[2] border-l border-slate-900 bg-slate-900 flex-col shrink-0 h-full lg:z-10 shadow-2xl absolute lg:relative inset-0 lg:inset-auto z-[45] \${showMobilePanel === 'preview' ? 'flex' : 'hidden lg:flex'}\`}>
            <div className="p-4 border-b border-slate-850 flex items-center justify-between min-h-[60px] shrink-0 bg-slate-900/40">
              <div className="flex items-center gap-1">
                <button onClick={() => setShowMobilePanel('build')} className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-white touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 rounded-full hover:bg-slate-850">
                   <ChevronRight size={20} className="rotate-180" />
                </button>
                <h3 className="text-xs lg:text-[10px] font-bold uppercase tracking-wider text-slate-300">Xem trước kết quả</h3>
              </div>
              <span className="px-2 py-0.5 bg-violet-500/10 text-violet-400 border border-violet-500/20 text-[10px] font-bold rounded-lg animate-pulse">LIVE</span>
            </div>`;

const replacementHeader = `          {/* Live Preview & Variables Column (40% width on Desktop) */}
          <div className={\`w-full lg:flex-[2] border-l border-slate-900 bg-slate-900 flex-col shrink-0 h-full lg:z-10 shadow-2xl absolute lg:relative inset-0 lg:inset-auto z-[45] \${showMobilePanel === 'preview' ? 'flex' : 'hidden lg:flex'}\`}>
            <div className="p-3 border-b border-slate-850 flex items-center justify-between min-h-[60px] shrink-0 bg-slate-900/40">
              <div className="flex items-center gap-2">
                <button onClick={() => setShowMobilePanel('build')} className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-white touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 rounded-full hover:bg-slate-850">
                   <ChevronRight size={20} className="rotate-180" />
                </button>
                
                {/* Tab Switcher */}
                <div className="flex bg-slate-955 p-0.5 rounded-lg border border-slate-800">
                  <button 
                    type="button"
                    onClick={() => setRightPanelTab('preview')}
                    className={\`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer \${rightPanelTab === 'preview' ? 'bg-slate-800 text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-300'}\`}
                  >
                    Xem trước
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setRightPanelTab('playground');
                      if (playgroundMessages.length === 0) {
                        handleStartPlaygroundSession();
                      }
                    }}
                    className={\`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer \${rightPanelTab === 'playground' ? 'bg-slate-800 text-violet-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}\`}
                  >
                    Thử nghiệm (AI)
                  </button>
                </div>
              </div>
              
              {rightPanelTab === 'preview' ? (
                <span className="px-2 py-0.5 bg-violet-500/10 text-violet-400 border border-violet-500/20 text-[10px] font-bold rounded-lg animate-pulse">LIVE</span>
              ) : (
                <button 
                  type="button"
                  onClick={() => setShowPlaygroundConfig(!showPlaygroundConfig)}
                  className={\`p-1.5 rounded-lg border transition-colors flex items-center justify-center text-slate-400 hover:text-slate-100 \${showPlaygroundConfig ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-transparent border-transparent'}\`}
                  title="Cấu hình API & Model"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"\n                  ></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                </button>
              )}
            </div>

            {rightPanelTab === 'preview' ? (
              <>`;

if (content.includes(targetHeader)) {
  content = content.replace(targetHeader, replacementHeader);
  console.log('Successfully replaced Right Panel header and opened conditional block!');
} else {
  console.log('Target Header not found!');
  // Let's print out what is there to debug
  const previewTextIdx = content.indexOf('Xem trước kết quả');
  if (previewTextIdx !== -1) {
    console.log('Context of Xem trước kết quả:', content.substring(previewTextIdx - 100, previewTextIdx + 150));
  }
}

// 2. Target: Close preview conditional check and add Playground panel before sheet
const targetFooter = `                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DragDropContext>

      {isBottomSheetOpen && (`;

const replacementFooter = `                  </div>
                </div>
              </div>
            </>
          ) : (
            /* --- Playground Chat Panel --- */
            <div className="flex-1 flex flex-col min-h-0 relative bg-slate-950/20">
              {/* Playground API & Model Config Panel */}
              {showPlaygroundConfig && (
                <div className="absolute inset-x-0 top-0 bg-slate-900 border-b border-slate-800 p-4 z-20 flex flex-col gap-3 shadow-xl animate-in slide-in-from-top-2 duration-150 text-slate-100">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cấu hình AI Playground</span>
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
                      <label className="text-[10px] font-bold text-slate-405 uppercase mb-1">Nhà cung cấp</label>
                      <select
                        value={playgroundProvider}
                        onChange={(e) => {
                          const val = e.target.value as 'gemini' | 'openai';
                          setPlaygroundProvider(val);
                          setPlaygroundModel(val === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini');
                        }}
                        className="text-xs px-2.5 py-1.5 border border-slate-800 bg-slate-950 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 font-semibold cursor-pointer"
                      >
                        <option value="gemini">Google Gemini</option>
                        <option value="openai">OpenAI</option>
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold text-slate-405 uppercase mb-1">Mô hình (Model)</label>
                      <select
                        value={playgroundModel}
                        onChange={(e) => setPlaygroundModel(e.target.value)}
                        className="text-xs px-2.5 py-1.5 border border-slate-800 bg-slate-950 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 font-semibold cursor-pointer"
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
                        <label htmlFor="useSystemKeyCheckbox" className="text-[10px] font-bold text-slate-350 cursor-pointer">Sử dụng API Key mặc định hệ thống</label>
                        <input
                          type="checkbox"
                          id="useSystemKeyCheckbox"
                          checked={useSystemGeminiKey}
                          onChange={(e) => setUseSystemGeminiKey(e.target.checked)}
                          className="rounded border-slate-800 text-violet-550 focus:ring-violet-500 cursor-pointer w-3.5 h-3.5"
                        />
                      </div>
                      {!useSystemGeminiKey && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] text-slate-500 font-medium">Gemini API Key cá nhân:</span>
                          <input
                            type="password"
                            value={geminiApiKey}
                            onChange={(e) => setGeminiApiKey(e.target.value)}
                            placeholder="Nhập AIzaSy..."
                            className="w-full text-xs px-2.5 py-1 border border-slate-800 bg-slate-950 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 placeholder-slate-800"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[10px] font-bold text-slate-300 block">OpenAI API Key cá nhân:</label>
                      <input
                        type="password"
                        value={openaiApiKey}
                        onChange={(e) => setOpenaiApiKey(e.target.value)}
                        placeholder="Nhập sk-..."
                        className="w-full text-xs px-2.5 py-1 border border-slate-800 bg-slate-950 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 placeholder-slate-800"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <div>
                      <div className="flex justify-between text-[9px] font-bold text-slate-450 uppercase mb-0.5">
                        <span>Sáng tạo (Temp):</span>
                        <span className="text-violet-400">{playgroundTemp}</span>
                      </div>
                      <input
                        type="range"
                        min="0" max="1.5" step="0.1"
                        value={playgroundTemp}
                        onChange={(e) => setPlaygroundTemp(Number(e.target.value))}
                        className="w-full accent-violet-550 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[9px] font-bold text-slate-450 uppercase mb-0.5">
                        <span>Max tokens:</span>
                        <span className="text-violet-400">{playgroundMaxTokens}</span>
                      </div>
                      <input
                        type="number"
                        value={playgroundMaxTokens}
                        onChange={(e) => setPlaygroundMaxTokens(Number(e.target.value))}
                        className="w-full text-xs px-2 py-0.5 border border-slate-800 bg-slate-950 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Chat Message History */}
              <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-3.5 scroll-smooth bg-slate-955/10">
                {playgroundMessages.length === 0 ? (
                  <div className="m-auto flex flex-col items-center justify-center text-center p-8 max-w-xs gap-3">
                    <div className="w-14 h-14 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center">
                      <Sparkles size={24} className="animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Phiên thử nghiệm trống</h4>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Hãy khởi chạy phiên chat để đưa System Prompt hiện tại vào thử nghiệm trực tiếp.</p>
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
                      <div key={idx} className={\`flex flex-col gap-1 max-w-[85%] \${isAi ? 'self-start' : 'self-end items-end'}\`}>
                        <div className={\`text-[8px] font-bold uppercase tracking-wider text-slate-500 \${isAi ? 'pl-2' : 'pr-2'}\`}>
                          {isAi ? '🎓 Mentor AI' : '👤 Học sinh'}
                        </div>
                        <div className={\`p-3 rounded-2xl text-[11.5px] leading-relaxed shadow-sm border
                          \${isAi 
                            ? 'bg-slate-900/80 backdrop-blur-sm border-slate-800 text-slate-200 rounded-tl-sm' 
                            : 'bg-gradient-to-r from-violet-600 to-indigo-600 border-violet-500/10 text-white rounded-tr-sm'}\`}
                        >
                          {m.content === '' ? (
                            <div className="flex items-center gap-1 py-1">
                              <Loader2 size={12} className="animate-spin text-violet-400" />
                              <span className="text-[10px] text-slate-400 italic">Đang suy nghĩ...</span>
                            </div>
                          ) : (
                            <div className="whitespace-pre-wrap font-sans break-words">\${m.content}</div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Input Area */}
              <div className="p-3 border-t border-slate-850 bg-slate-900/40 shrink-0 flex flex-col gap-2">
                <form onSubmit={handleSendPlaygroundMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={isChatGenerating || playgroundMessages.length === 0}
                    placeholder={playgroundMessages.length === 0 ? "Bấm 'Khởi chạy Chat' để bắt đầu..." : "Hỏi Mentor AI gì đó..."}
                    className="flex-1 text-xs px-3.5 py-2.5 border border-slate-800 bg-slate-950 text-slate-200 placeholder-slate-650 rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={isChatGenerating || !chatInput.trim() || playgroundMessages.length === 0}
                    className="w-10 h-10 shrink-0 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 text-white rounded-xl flex items-center justify-center shadow-md shadow-violet-900/10 transition-colors disabled:text-slate-600 disabled:shadow-none cursor-pointer active:scale-95"
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
                      className="text-rose-400 hover:text-rose-350 font-bold uppercase transition-colors cursor-pointer"
                    >
                      Reset Chat
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        </div>
      </DragDropContext>

      {isBottomSheetOpen && (`;

if (content.includes(targetFooter)) {
  content = content.replace(targetFooter, replacementFooter);
  console.log('Successfully replaced Right Panel footer and closed conditional block!');
} else {
  console.log('Target Footer not found!');
  // Debug output
  const bottomSheetIdx = content.indexOf('isBottomSheetOpen');
  if (bottomSheetIdx !== -1) {
    console.log('Context of isBottomSheetOpen:', content.substring(bottomSheetIdx - 200, bottomSheetIdx + 150));
  }
}

// Write back with CRLF
const finalContent = content.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, finalContent, 'utf8');
console.log('Done!');
