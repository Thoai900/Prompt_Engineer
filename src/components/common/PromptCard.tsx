import React, { useState } from 'react';
import { PromptTemplate } from '../../types';
import { Heart, Bookmark, Copy, Users, CheckCircle, Layout, FileText, Code2, Video, GitMerge, GraduationCap, FlaskConical } from 'lucide-react';

interface PromptCardProps {
  template: PromptTemplate;
  onSelect: (template: PromptTemplate) => void;
  onRemix?: (template: PromptTemplate) => void;
  onPreview?: (template: PromptTemplate) => void;
}

interface StepperStep {
  letter: string;
  name: string;
  color: string;
  hoverColor: string;
  description: string;
}

const detectFramework = (template: PromptTemplate): { name: string; steps: StepperStep[] } | null => {
  const titleLower = template.title.toLowerCase();
  const idLower = template.id.toLowerCase();
  
  if (idLower === 'formula-chain' || titleLower.includes('c.h.a.i.n') || titleLower.includes('chain')) {
    return {
      name: 'C.H.A.I.N Framework',
      steps: [
        { letter: 'C', name: 'Challenge', color: 'bg-rose-50 border-rose-200 text-rose-600', hoverColor: 'group-hover:bg-rose-500 group-hover:text-white', description: 'Challenge: Vấn đề/Thách thức bạn đang gặp phải cần AI tối ưu.' },
        { letter: 'H', name: 'Help needed', color: 'bg-amber-50 border-amber-200 text-amber-600', hoverColor: 'group-hover:bg-amber-500 group-hover:text-white', description: 'Help needed: Chỉ định hành động cụ thể để AI hỗ trợ.' },
        { letter: 'A', name: 'Approach', color: 'bg-emerald-50 border-emerald-200 text-emerald-600', hoverColor: 'group-hover:bg-emerald-500 group-hover:text-white', description: 'Approach: Thiết lập cách tiếp cận hoặc các bước giải quyết tuần tự.' },
        { letter: 'I', name: 'Input', color: 'bg-blue-50 border-blue-200 text-blue-600', hoverColor: 'group-hover:bg-blue-500 group-hover:text-white', description: 'Input: Đưa ra thông tin, ngữ cảnh hoặc dữ liệu sẵn có.' },
        { letter: 'N', name: 'Next steps', color: 'bg-indigo-50 border-indigo-200 text-indigo-600', hoverColor: 'group-hover:bg-indigo-500 group-hover:text-white', description: 'Next steps: Đề xuất bước tiếp nối hoặc yêu cầu sau cùng.' }
      ]
    };
  }

  const hasRoleBlock = template.blocks.some(b => b.type === 'role');
  const hasTaskBlock = template.blocks.some(b => b.type === 'task');
  const hasFormatOrToneBlock = template.blocks.some(b => b.type === 'format' || b.type === 'tone');
  const isRtfTitle = titleLower.includes('rtf') || titleLower.includes('r-t-f') || idLower.includes('rtf');
  
  if (isRtfTitle || (template.blocks.length === 3 && hasRoleBlock && hasTaskBlock && hasFormatOrToneBlock)) {
    return {
      name: 'R-T-F Framework',
      steps: [
        { letter: 'R', name: 'Role', color: 'bg-blue-50 border-blue-200 text-blue-600', hoverColor: 'group-hover:bg-blue-500 group-hover:text-white', description: 'Role: Đóng vai chuyên gia có năng lực giải quyết tốt bối cảnh.' },
        { letter: 'T', name: 'Task', color: 'bg-rose-50 border-rose-200 text-rose-600', hoverColor: 'group-hover:bg-rose-500 group-hover:text-white', description: 'Task: Mô tả cụ thể hành động bạn muốn AI thực thi.' },
        { letter: 'F', name: 'Format', color: 'bg-amber-50 border-amber-200 text-amber-600', hoverColor: 'group-hover:bg-amber-500 group-hover:text-white', description: 'Format: Quy chuẩn cấu trúc kết quả đầu ra như code, markdown, bảng số liệu.' }
      ]
    };
  }

  if (idLower === 'formula-role' || titleLower.includes('r.o.l.e') || titleLower.includes('role')) {
    return {
      name: 'R.O.L.E Framework',
      steps: [
        { letter: 'R', name: 'Role', color: 'bg-blue-50 border-blue-200 text-blue-600', hoverColor: 'group-hover:bg-blue-500 group-hover:text-white', description: 'Role: Đóng vai chuyên gia phù hợp.' },
        { letter: 'O', name: 'Objective', color: 'bg-rose-50 border-rose-200 text-rose-600', hoverColor: 'group-hover:bg-rose-500 group-hover:text-white', description: 'Objective: Đặt ra mục tiêu hành động cụ thể cần hoàn thành.' },
        { letter: 'L', name: 'Limits', color: 'bg-indigo-50 border-indigo-200 text-indigo-600', hoverColor: 'group-hover:bg-indigo-500 group-hover:text-white', description: 'Limits: Đặt ra các giới hạn, ràng buộc hoặc độ dài cho phản hồi.' },
        { letter: 'E', name: 'Expectation', color: 'bg-emerald-50 border-emerald-200 text-emerald-600', hoverColor: 'group-hover:bg-emerald-500 group-hover:text-white', description: 'Expectation: Quy chuẩn cấu trúc kết quả mong đợi.' }
      ]
    };
  }

  if (idLower === 'formula-task' || titleLower.includes('t.a.s.k') || titleLower.includes('task')) {
    return {
      name: 'T.A.S.K Framework',
      steps: [
        { letter: 'T', name: 'Task', color: 'bg-rose-50 border-rose-200 text-rose-600', hoverColor: 'group-hover:bg-rose-500 group-hover:text-white', description: 'Task: Gọi tên rõ việc cần làm.' },
        { letter: 'A', name: 'Audience', color: 'bg-blue-50 border-blue-200 text-blue-600', hoverColor: 'group-hover:bg-blue-500 group-hover:text-white', description: 'Audience: Xác định nhóm khán giả nhắm tới.' },
        { letter: 'S', name: 'Style', color: 'bg-amber-50 border-amber-200 text-amber-600', hoverColor: 'group-hover:bg-amber-500 group-hover:text-white', description: 'Style: Định hình phong cách và giọng văn.' },
        { letter: 'K', name: 'Key points', color: 'bg-purple-50 border-purple-200 text-purple-600', hoverColor: 'group-hover:bg-purple-500 group-hover:text-white', description: 'Key points: Đưa ra các mốc yêu cầu bắt buộc kèm theo.' }
      ]
    };
  }

  if (idLower === 'formula-create' || titleLower.includes('c.r.e.a.t.e') || titleLower.includes('create')) {
    return {
      name: 'C.R.E.A.T.E Framework',
      steps: [
        { letter: 'C', name: 'Context', color: 'bg-slate-50 border-slate-200 text-slate-600', hoverColor: 'group-hover:bg-slate-500 group-hover:text-white', description: 'Context: Bối cảnh, tình huống gặp phải.' },
        { letter: 'R', name: 'Role', color: 'bg-blue-50 border-blue-200 text-blue-600', hoverColor: 'group-hover:bg-blue-500 group-hover:text-white', description: 'Role: Đóng vai một chuyên gia hệ thống.' },
        { letter: 'E', name: 'Examples', color: 'bg-purple-50 border-purple-200 text-purple-600', hoverColor: 'group-hover:bg-purple-500 group-hover:text-white', description: 'Examples: Đưa ra ví dụ mẫu đối chiếu.' },
        { letter: 'A', name: 'Action', color: 'bg-rose-50 border-rose-200 text-rose-600', hoverColor: 'group-hover:bg-rose-500 group-hover:text-white', description: 'Action: Hành động tạo ra sản phẩm cụ thể.' },
        { letter: 'T', name: 'Type', color: 'bg-emerald-50 border-emerald-200 text-emerald-600', hoverColor: 'group-hover:bg-emerald-500 group-hover:text-white', description: 'Type: Kiểu dáng, định dạng mong muốn.' },
        { letter: 'E', name: 'Extras', color: 'bg-amber-50 border-amber-200 text-amber-600', hoverColor: 'group-hover:bg-amber-500 group-hover:text-white', description: 'Extras: Ràng buộc, quy chuẩn thêm.' }
      ]
    };
  }

  return null;
};

export default function PromptCard({ template, onSelect, onRemix, onPreview }: PromptCardProps) {
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const metrics = template.metrics || { usageCount: 0, upvotes: 0, likes: 0, saves: 0 };
  const getAvatarFallback = (name: string) => name ? name.charAt(0).toUpperCase() : '?';
  const fw = detectFramework(template);

  return (
    <div 
      className="group bg-white rounded-3xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-lg transition-all relative flex flex-col min-h-[400px] overflow-hidden"
    >
      {/* Visual Header - Output/Input Preview */}
      <div className="h-[160px] bg-slate-50 border-b border-slate-100 relative group/io overflow-hidden flex flex-col shrink-0 cursor-pointer">
        {template.outputExample ? (
          <>
            {/* Action Overlay */}
            <div 
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] z-20 flex items-center justify-center opacity-0 group-hover/io:opacity-100 transition-all duration-300"
              onClick={(e) => { e.stopPropagation(); onPreview?.(template); }}
            >
              <div className="bg-white px-5 py-2.5 rounded-full font-bold text-sm text-slate-800 shadow-xl flex items-center gap-2 transform translate-y-4 group-hover/io:translate-y-0 transition-all duration-300">
                <Layout className="w-4 h-4 text-indigo-500" />
                Xem kết quả mẫu
              </div>
            </div>

            <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-white/90 backdrop-blur px-2.5 py-1 rounded-full shadow-sm border border-slate-100">
               {template.outputExample.type === 'ui' && <Layout className="w-3 h-3 text-indigo-500" />}
               {template.outputExample.type === 'text' && <FileText className="w-3 h-3 text-emerald-500" />}
               {template.outputExample.type === 'code' && <Code2 className="w-3 h-3 text-blue-500" />}
               {template.outputExample.type === 'video' && <Video className="w-3 h-3 text-rose-500" />}
               {template.outputExample.type === 'mindmap' && <GitMerge className="w-3 h-3 text-amber-500" />}
               {template.outputExample.type === 'tutor' && <GraduationCap className="w-3 h-3 text-blue-400" />}
               <span className="text-[9px] font-bold text-slate-700 uppercase tracking-wider">{template.outputExample.title || 'Kết quả'}</span>
            </div>
            
            {template.outputExample.input && (
               <div className="absolute top-3 right-3 z-10">
                 <span className="text-[9px] bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full font-bold shadow-sm transition-colors border border-indigo-100">Hover xem Đầu vào</span>
               </div>
            )}

            <div className="w-full h-full relative">
              {/* OUTPUT VIEW (Default) */}
              <div className="absolute inset-0 p-4 pt-12 transition-all duration-300 group-hover/io:-translate-y-full opacity-100 group-hover/io:opacity-0 flex flex-col justify-center items-center bg-slate-50">
                 {/* UI Type */}
                 {template.outputExample.type === 'ui' && (
                   <div className="flex flex-col gap-2 w-full max-w-[240px]">
                     <div className="w-full h-3 bg-slate-200 rounded-md"></div>
                     <div className="flex gap-2 h-12">
                       <div className="w-1/4 h-full bg-slate-200 rounded-md shadow-sm"></div>
                       <div className="w-3/4 h-full bg-indigo-100 border border-indigo-200/50 rounded-md shadow-sm"></div>
                     </div>
                   </div>
                 )}
                 
                 {/* Text Type */}
                 {template.outputExample.type === 'text' && (
                   <div className="flex flex-col gap-2 w-full max-w-[240px] bg-white p-3 border border-slate-200 shadow-sm rounded-lg">
                     <div className="w-2/3 h-2.5 bg-slate-300 rounded mb-1"></div>
                     <div className="w-full h-1.5 bg-slate-200 rounded"></div>
                     <div className="w-5/6 h-1.5 bg-slate-200 rounded"></div>
                     <div className="w-full h-1.5 bg-slate-200 rounded"></div>
                   </div>
                 )}
                 
                 {/* Code Type */}
                 {template.outputExample.type === 'code' && (
                   <div className="flex flex-col w-full max-w-[240px] bg-slate-800 rounded-lg p-3 shadow-md">
                     <div className="flex gap-1.5 mb-2">
                       <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                       <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                       <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                     </div>
                     <div className="flex flex-col gap-1.5 ml-1">
                       <div className="w-1/2 h-1.5 bg-blue-400/70 rounded"></div>
                       <div className="w-3/4 h-1.5 bg-slate-600 rounded ml-3"></div>
                       <div className="w-2/3 h-1.5 bg-emerald-400/60 rounded ml-6"></div>
                     </div>
                   </div>
                 )}

                 {/* Video Type */}
                 {template.outputExample.type === 'video' && (
                   <div className="w-16 h-28 mx-auto bg-slate-800 rounded-lg overflow-hidden relative shadow-md border border-slate-700">
                     <div className="absolute top-1 right-1.5 w-4 h-5 bg-slate-600/50 rounded-sm"></div>
                     <div className="absolute bottom-2 left-1.5 right-1.5">
                       <div className="w-3/4 h-1.5 bg-white/90 rounded mb-1 outline outline-1 outline-black/20"></div>
                       <div className="w-1/2 h-1.5 bg-white/90 rounded outline outline-1 outline-black/20"></div>
                     </div>
                   </div>
                 )}

                 {/* Mindmap Type */}
                 {template.outputExample.type === 'mindmap' && (
                   <div className="flex items-center justify-center w-full h-full">
                     <div className="flex items-center gap-3">
                       <div className="px-3 py-1.5 bg-indigo-500 text-white rounded-md text-[10px] font-bold shadow-sm">Root</div>
                       <div className="flex flex-col gap-3 relative">
                         <div className="absolute -left-3 top-1/2 bottom-1/2 w-3 border-t-2 border-indigo-200"></div>
                         <div className="absolute -left-1.5 top-2.5 bottom-2.5 border-l-2 border-indigo-200 rounded-l"></div>
                         <div className="px-2 py-1 bg-white border border-indigo-200 rounded text-[9px] text-slate-600 font-bold flex items-center shadow-sm relative before:absolute before:-left-1.5 before:top-1/2 before:w-1.5 before:border-t-2 before:border-indigo-200">Node A</div>
                         <div className="px-2 py-1 bg-white border border-indigo-200 rounded text-[9px] text-slate-600 font-bold flex items-center shadow-sm relative before:absolute before:-left-1.5 before:top-1/2 before:w-1.5 before:border-t-2 before:border-indigo-200">Node B</div>
                       </div>
                     </div>
                   </div>
                 )}

                 {/* Tutor Type */}
                 {template.outputExample.type === 'tutor' && (
                   <div className="w-full max-w-[240px] bg-[#fdfbf7] p-3 rounded-lg border border-slate-200 shadow-sm relative overflow-hidden">
                     {/* Notebook lines */}
                     <div className="absolute inset-0 bg-[linear-gradient(transparent_14px,#e5e7eb_15px)] bg-[length:100%_15px] opacity-70"></div>
                     <div className="relative z-10 font-mono text-[10px] text-slate-600 leading-[15px] pt-1">
                       <div className="flex gap-1 mb-2 items-center text-blue-600 italic">
                         <span className="font-serif font-bold text-[11px]">Bước 1:</span> Phân tích đề
                       </div>
                       <div className="pl-2 border-l-2 border-blue-200 text-slate-500 mb-2 font-medium">
                         x² - 4x + 4 = 0
                       </div>
                       <div className="flex gap-1 items-center text-rose-600 italic">
                         <span className="font-serif font-bold text-[11px]">Bước 2:</span> Rút gọn
                       </div>
                       <div className="pl-2 border-l-2 border-rose-200 text-slate-500 font-medium">
                         (x - 2)² = 0
                       </div>
                     </div>
                   </div>
                 )}
              </div>

              {/* INPUT VIEW (Hover) */}
              {template.outputExample.input && (
                 <div className="absolute inset-0 p-4 pt-12 bg-indigo-50/90 backdrop-blur-sm transition-all duration-300 translate-y-full opacity-0 group-hover/io:translate-y-0 group-hover/io:opacity-100 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                      <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">Nhập vào (Input)</span>
                    </div>
                    <div className="bg-white border border-indigo-100 p-3 rounded-xl shadow-sm flex-1 overflow-hidden">
                      <p className="text-[11px] text-slate-700 font-mono leading-relaxed line-clamp-4">
                        "{template.outputExample.input}"
                      </p>
                    </div>
                 </div>
              )}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
             <div className="w-16 h-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                <FileText className="w-8 h-8 text-slate-300" />
             </div>
          </div>
        )}
      </div>

      {/* Content Area (60%) */}
      <div className="flex-1 flex flex-col p-5 bg-white">
        {/* Author Section */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            {template.authorAvatar ? (
              <img src={template.authorAvatar} alt={template.authorName || 'Author'} className="w-6 h-6 rounded-full object-cover border border-slate-100 shadow-sm" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shadow-sm">
                {getAvatarFallback(template.authorName || 'Anonymous')}
              </div>
            )}
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold text-slate-700">{template.authorName || 'Anonymous'}</span>
                {template.isVerified && <CheckCircle className="w-3 h-3 text-blue-500" />}
              </div>
            </div>
          </div>
          {template.category && (
             <span className="bg-slate-50 border border-slate-100 text-slate-500 text-[9px] font-bold px-2 py-1 rounded-lg whitespace-nowrap">
               {template.category.toUpperCase()}
             </span>
          )}
        </div>

        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-600">
          <FlaskConical className="h-3.5 w-3.5" />
          Interactive Few-Shot ready
        </div>

        <div onClick={() => onSelect(template)} className="cursor-pointer flex-1 flex flex-col min-h-0">
          <h3 className="text-lg font-bold text-slate-900 line-clamp-1 mb-1.5 group-hover:text-indigo-600 transition-colors shrink-0">{template.title}</h3>
          
          {fw ? (
            <div className="flex flex-col gap-2 shrink-0 my-1 font-sans" onClick={(e) => e.stopPropagation()}>
               {/* Mini-Stepper circles */}
               <div className="flex items-center gap-1.5 py-0.5 flex-wrap">
                  {fw.steps.map((step, idx) => (
                     <React.Fragment key={idx}>
                        {idx > 0 && <span className="text-slate-300 font-bold text-xs select-none">→</span>}
                        <button 
                           className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border cursor-help transition-all duration-200 ${step.color} ${activeStepIndex === idx ? 'ring-2 ring-indigo-500 scale-110 shadow-md bg-white' : 'hover:scale-105 hover:shadow-sm'}`}
                           onMouseEnter={() => setActiveStepIndex(idx)}
                           onMouseLeave={() => setActiveStepIndex(null)}
                           onClick={(e) => { e.stopPropagation(); onSelect(template); }}
                           title={step.name}
                        >
                           {step.letter}
                        </button>
                     </React.Fragment>
                  ))}
               </div>
               {/* Hover Explanation Box */}
               <div className="bg-slate-50 border border-slate-100/80 px-3 py-2 rounded-xl text-[10.5px] leading-normal text-slate-600 h-[42px] max-h-[42px] overflow-hidden flex items-center shadow-inner transition-all duration-300">
                  {activeStepIndex !== null ? (
                     <div className="flex gap-1 items-start w-full">
                        <span className="font-extrabold text-indigo-700 text-xs shrink-0">{fw.steps[activeStepIndex].letter}:</span>
                        <span className="line-clamp-2">{fw.steps[activeStepIndex].description.split(': ')[1]}</span>
                     </div>
                  ) : (
                     <span className="text-slate-400 italic line-clamp-2">Rê chuột qua từng bước để xem phân tích cấu trúc prompt</span>
                  )}
               </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 mb-3 line-clamp-2 leading-relaxed shrink-0">{template.description}</p>
          )}
          
          <div className="flex-1 min-h-0 overflow-hidden">
            {(template.tags && template.tags.length > 0) && (
              <div className="flex flex-wrap gap-1.5 content-start h-full pb-1">
                {template.tags.slice(0, fw ? 2 : 4).map(tag => (
                  <span key={tag} className="text-[10px] font-semibold px-2 py-1 bg-slate-50 text-slate-600 border border-slate-100 rounded-md">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between shrink-0">
           <div className="flex items-center gap-3 text-slate-400">
             <div className="flex items-center gap-1 cursor-pointer hover:text-rose-500 transition-colors" title="Likes">
               <Heart className="w-3.5 h-3.5" />
               <span className="text-xs font-semibold">{metrics.likes || metrics.upvotes || 0}</span>
             </div>
             <div className="flex items-center gap-1 cursor-pointer hover:text-indigo-500 transition-colors" title="Saves">
               <Bookmark className="w-3.5 h-3.5" />
               <span className="text-xs font-semibold">{metrics.saves || 0}</span>
             </div>
             <div className="flex items-center gap-1" title="Uses">
               <Users className="w-3.5 h-3.5" />
               <span className="text-xs font-semibold">{metrics.usageCount || 0}</span>
             </div>
           </div>

           <button 
             onClick={(e) => { e.stopPropagation(); if(onRemix) onRemix(template); else onSelect(template); }}
             className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl text-[11px] font-bold transition-all shadow-md shadow-indigo-600/20 hover:shadow-lg hover:shadow-indigo-600/30 active:scale-95"
           >
             <Copy className="w-3.5 h-3.5" />
             Remix
           </button>
        </div>
      </div>
    </div>
  );
}
