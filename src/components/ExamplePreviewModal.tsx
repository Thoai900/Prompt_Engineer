import React from 'react';
import { PromptTemplate } from '../types';
import { X, Layout, FileText, Code2, Video, GitMerge, GraduationCap, ArrowRight } from 'lucide-react';

interface ExamplePreviewModalProps {
  template: PromptTemplate;
  onClose: () => void;
}

export default function ExamplePreviewModal({ template, onClose }: ExamplePreviewModalProps) {
  const example = template.outputExample;

  if (!example) return null;

  const getTypeIcon = () => {
    switch (example.type) {
      case 'ui': return <Layout className="w-5 h-5 text-indigo-500" />;
      case 'text': return <FileText className="w-5 h-5 text-emerald-500" />;
      case 'code': return <Code2 className="w-5 h-5 text-blue-500" />;
      case 'video': return <Video className="w-5 h-5 text-rose-500" />;
      case 'mindmap': return <GitMerge className="w-5 h-5 text-amber-500" />;
      case 'tutor': return <GraduationCap className="w-5 h-5 text-blue-400" />;
      default: return <FileText className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 animate-fade-in" onClick={onClose}>
      <div 
        className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
              {getTypeIcon()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">Kết quả mẫu: {template.title}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{example.description || 'Minh họa đầu vào và đầu ra'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content (2 Columns) */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden bg-slate-50">
          
          {/* Left Column: Input */}
          <div className="w-full lg:w-2/5 p-6 border-b lg:border-b-0 lg:border-r border-slate-200 overflow-y-auto flex flex-col bg-white">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold">1</span>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Đầu vào (Input)</h3>
            </div>
            
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 font-mono text-sm text-slate-700 leading-relaxed whitespace-pre-wrap flex-1 shadow-inner">
              {example.input || 'Nhập yêu cầu ban đầu tại đây...'}
            </div>
          </div>

          {/* Transition Icon (Desktop only) */}
          <div className="hidden lg:flex absolute left-[40%] top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white border border-slate-200 rounded-full items-center justify-center shadow-md">
             <ArrowRight className="w-5 h-5 text-indigo-500" />
          </div>

          {/* Right Column: Output */}
          <div className="w-full lg:w-3/5 p-6 overflow-y-auto flex flex-col bg-slate-50/50">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">2</span>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Kết quả AI (Output)</h3>
            </div>

            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-1 flex items-center justify-center overflow-hidden relative">
              {/* Output Content Rendering based on type */}
              
              {example.type === 'ui' && (
                <div className="w-full h-full bg-slate-50 rounded-lg p-6 flex flex-col gap-4 overflow-y-auto">
                  <div className="h-12 w-full bg-white rounded-lg shadow-sm border border-slate-200 flex items-center px-4">
                     <div className="w-24 h-4 bg-slate-200 rounded"></div>
                     <div className="ml-auto w-8 h-8 bg-slate-100 rounded-full"></div>
                  </div>
                  <div className="flex gap-4 flex-1">
                    <div className="w-48 bg-white rounded-lg shadow-sm border border-slate-200 p-4 flex flex-col gap-3 hidden sm:flex">
                       <div className="w-full h-8 bg-slate-100 rounded"></div>
                       <div className="w-3/4 h-4 bg-slate-100 rounded"></div>
                       <div className="w-5/6 h-4 bg-slate-100 rounded"></div>
                    </div>
                    <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-200 p-6 flex flex-col gap-4">
                       <h3 className="text-lg font-bold text-slate-800 mb-2">Tổng quan Campaign</h3>
                       <div className="grid grid-cols-3 gap-4">
                         <div className="h-20 bg-emerald-50 rounded-lg border border-emerald-100 p-3">
                           <div className="text-xs text-emerald-600 font-bold uppercase mb-1">Click</div>
                           <div className="text-xl font-bold text-emerald-900">12,400</div>
                         </div>
                         <div className="h-20 bg-blue-50 rounded-lg border border-blue-100 p-3">
                           <div className="text-xs text-blue-600 font-bold uppercase mb-1">Reach</div>
                           <div className="text-xl font-bold text-blue-900">45,120</div>
                         </div>
                         <div className="h-20 bg-amber-50 rounded-lg border border-amber-100 p-3">
                           <div className="text-xs text-amber-600 font-bold uppercase mb-1">CTR</div>
                           <div className="text-xl font-bold text-amber-900">8.2%</div>
                         </div>
                       </div>
                    </div>
                  </div>
                </div>
              )}

              {example.type === 'code' && (
                <div className="w-full h-full bg-[#1e1e1e] rounded-lg p-4 flex flex-col overflow-hidden font-mono text-sm">
                  <div className="flex gap-2 mb-4 border-b border-slate-700/50 pb-3">
                    <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                    <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  </div>
                  <pre className="text-slate-300 overflow-y-auto custom-scrollbar p-2">
                    <code dangerouslySetInnerHTML={{ __html: example.content || `function optimizeArray(arr) {
  <span className="text-indigo-400">const</span> map = <span className="text-indigo-400">new</span> <span className="text-amber-300">Map</span>();
  <span className="text-rose-400">for</span> (<span className="text-indigo-400">let</span> i = <span className="text-emerald-300">0</span>; i &lt; arr.length; i++) {
    <span className="text-slate-500">// Time Complexity: O(N)</span>
    <span className="text-slate-500">// Space Complexity: O(N)</span>
    <span className="text-rose-400">if</span> (map.has(arr[i])) {
      <span className="text-rose-400">return</span> <span className="text-indigo-400">true</span>;
    }
    map.set(arr[i], <span className="text-indigo-400">true</span>);
  }
  <span className="text-rose-400">return</span> <span className="text-indigo-400">false</span>;
}` }}>
                    </code>
                  </pre>
                </div>
              )}

              {example.type === 'mindmap' && (
                <div className="w-full h-full bg-slate-50 rounded-lg flex items-center justify-center p-8 overflow-auto">
                   <div className="flex items-center gap-6 min-w-max">
                     <div className="px-5 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 text-sm">Lịch sử VN</div>
                     <div className="flex flex-col gap-6 relative">
                       <div className="absolute -left-6 top-1/2 bottom-1/2 w-6 border-t-2 border-slate-300"></div>
                       <div className="absolute -left-3 top-[30px] bottom-[30px] border-l-2 border-slate-300 rounded-l-md"></div>
                       
                       <div className="px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm relative before:absolute before:-left-3 before:top-1/2 before:w-3 before:border-t-2 before:border-slate-300 font-bold text-slate-700 text-sm">
                         Thời kỳ Bắc thuộc
                       </div>
                       <div className="px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm relative before:absolute before:-left-3 before:top-1/2 before:w-3 before:border-t-2 before:border-slate-300 font-bold text-slate-700 text-sm">
                         Triều đại phong kiến độc lập
                       </div>
                       <div className="px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm relative before:absolute before:-left-3 before:top-1/2 before:w-3 before:border-t-2 before:border-slate-300 font-bold text-slate-700 text-sm">
                         Thời kỳ cận - hiện đại
                       </div>
                     </div>
                   </div>
                </div>
              )}

              {example.type === 'video' && (
                <div className="w-full h-full bg-slate-900 rounded-lg p-4 flex items-center justify-center">
                  <div className="w-[300px] h-[600px] bg-black rounded-3xl border-[8px] border-slate-800 relative overflow-hidden flex flex-col justify-end p-4 shadow-2xl">
                     <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80"></div>
                     {/* Subtitles */}
                     <div className="relative z-10 w-full text-center mb-16">
                       <span className="bg-yellow-400 text-black font-black text-xl px-2 py-1 leading-relaxed rounded">
                         3 BÍ QUYẾT HỌC CODE
                       </span>
                       <br />
                       <span className="bg-black/80 text-white font-bold text-lg px-2 py-1 leading-relaxed inline-block mt-2 rounded">
                         KHÔNG BAO GIỜ NẢN!
                       </span>
                     </div>
                     {/* Sidebar Actions */}
                     <div className="absolute right-4 bottom-24 flex flex-col gap-4 text-white items-center z-10">
                       <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-white"></div>
                       <div className="w-8 h-8 rounded-full bg-slate-700"></div>
                       <div className="w-8 h-8 rounded-full bg-slate-700"></div>
                     </div>
                  </div>
                </div>
              )}

              {example.type === 'tutor' && (
                <div className="w-full h-full bg-[#fdfbf7] p-8 rounded-lg relative overflow-y-auto">
                   <div className="absolute inset-0 bg-[linear-gradient(transparent_27px,#e5e7eb_28px)] bg-[length:100%_28px] opacity-70"></div>
                   <div className="relative z-10 font-mono text-base text-slate-700 leading-[28px] mt-1 space-y-4">
                     <div>
                       <span className="font-serif font-bold text-indigo-700 italic">Bước 1: Phân tích đề</span><br/>
                       <span className="pl-4 inline-block text-slate-600">Ta có phương trình bậc hai: <span className="font-bold">x² - 4x + 4 = 0</span></span><br/>
                       <span className="pl-4 inline-block text-slate-600">Nhận thấy đây là dạng Hằng đẳng thức đáng nhớ.</span>
                     </div>
                     <div>
                       <span className="font-serif font-bold text-rose-700 italic">Bước 2: Áp dụng Hằng đẳng thức</span><br/>
                       <span className="pl-4 inline-block text-slate-600">$\Leftrightarrow (x - 2)² = 0$</span>
                     </div>
                     <div>
                       <span className="font-serif font-bold text-emerald-700 italic">Bước 3: Giải nghiệm</span><br/>
                       <span className="pl-4 inline-block text-slate-600">$\Leftrightarrow x - 2 = 0$</span><br/>
                       <span className="pl-4 inline-block text-slate-600">$\Leftrightarrow x = 2$</span>
                     </div>
                   </div>
                </div>
              )}

              {example.type === 'text' && (
                <div className="w-full h-full bg-white rounded-lg p-8 overflow-y-auto text-slate-700">
                  {example.content ? (
                    <div className="whitespace-pre-wrap">{example.content}</div>
                  ) : (
                    <div className="space-y-6">
                      <h1 className="text-3xl font-black text-slate-900 leading-tight">Tuyệt Chiêu Tăng Trưởng SEO (2024)</h1>
                      <p className="text-lg text-slate-600 leading-relaxed italic border-l-4 border-emerald-500 pl-4 bg-emerald-50 py-2 rounded-r-lg">
                        Hook: Hơn 90% bài viết bị bỏ qua trong 3 giây đầu tiên. Nếu bạn muốn giữ chân người đọc, đây là cách làm.
                      </p>
                      <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4 border-b border-slate-100 pb-2">1. Cấu Trúc Kim Tự Tháp Ngược</h2>
                      <p className="leading-relaxed">Đưa thông tin quan trọng nhất lên đầu tiên. Người dùng hiện đại có xu hướng lướt sóng chứ không đọc từng từ...</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
