import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Play, Columns, AlertTriangle, Sparkles, Wand2, Check, ArrowLeft, Shuffle } from 'lucide-react';
import { generateContentForExistingBlocks } from '../../services/aiService';

type LearningBlock = {
  id: string;
  type: string;
  content: string;
  isRequired?: boolean;
};

const initialAvailableBlocks: LearningBlock[] = [
  { id: 'role-block', type: 'Role', content: 'Bạn là chuyên gia Vật lý xuất sắc, đóng vai trò Mentor.' },
  { id: 'process-block', type: 'Process', content: '- B1: Phân tích hiện tượng.\n- B2: Gợi ý công thức.\n- B3: Đợi đáp án.' },
  { id: 'constraints-block', type: 'Constraints', content: '- KHÔNG ĐƯỢC cho đáp án ngay.\n- Luôn hỏi ngược lại.' },
  { id: 'thinking-block', type: 'Thinking', content: '- Mình cần nhắc lại định nghĩa hụt khối.\n- Sau đó nhắc công thức năng lượng.\n- Tuyệt đối không tính ra số 15.6 MeV.' },
  { id: 'prefill-block', type: 'Prefill', content: 'Chào bạn, hiện tượng này là: ' }
];

export default function Stage3({ onNext, onBack }: { onNext: () => void, onBack?: () => void }) {
  const [availableBlocks, setAvailableBlocks] = useState<LearningBlock[]>(initialAvailableBlocks);
  const [boardBlocks, setBoardBlocks] = useState<LearningBlock[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{bad: string, good: string} | null>(null);
  
  // Randomizer feature
  const [currentScenario, setCurrentScenario] = useState("Giải Vật lý: Học sinh hỏi bài hụt khối lượng.");
  const scenarios = [
    "Giải Vật lý: Dạy lại bằng cách giải thích cho học sinh lớp 3.",
    "Giải Vật lý: Học sinh bị trầm cảm, cần Mentor an ủi trước khi giải bài.",
    "Giải Vật lý: Trả lời theo phong cách kiếm hiệp Kim Dung."
  ];

  const triggerEvent = () => {
    const randomScenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    setCurrentScenario(randomScenario);
    
    // Add a specialized block
    if (!availableBlocks.find(b => b.id === 'special-role')) {
       setAvailableBlocks(prev => [...prev, {
         id: 'special-role', type: 'Role', content: 'Bạn là một vị Tôn giả giải Toán, dùng từ ngữ cổ trang.'
       }]);
    }
  };

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;

    if (source.droppableId === destination.droppableId) {
      if (source.droppableId === 'board') {
        const items = Array.from(boardBlocks);
        const [reorderedItem] = items.splice(source.index, 1);
        items.splice(destination.index, 0, reorderedItem);
        setBoardBlocks(items);
      }
      return;
    }

    if (source.droppableId === 'available' && destination.droppableId === 'board') {
      const sourceItems = Array.from(availableBlocks);
      const destItems = Array.from(boardBlocks);
      const [movedItem] = sourceItems.splice(source.index, 1);
      destItems.splice(destination.index, 0, movedItem);
      
      setAvailableBlocks(sourceItems);
      setBoardBlocks(destItems);
    } else if (source.droppableId === 'board' && destination.droppableId === 'available') {
      const sourceItems = Array.from(boardBlocks);
      const destItems = Array.from(availableBlocks);
      const [movedItem] = sourceItems.splice(source.index, 1);
      destItems.splice(destination.index, 0, movedItem);
      
      setBoardBlocks(sourceItems);
      setAvailableBlocks(destItems);
    }
  };

  const handleRunTest = async () => {
    setIsTesting(true);
    const hasConstraints = boardBlocks.some(b => b.type === 'Constraints');
    const hasRole = boardBlocks.some(b => b.type === 'Role');
    const hasThinking = boardBlocks.some(b => b.type === 'Thinking');
    
    setTimeout(() => {
       const badPromptResult = "Khối lượng hạt nhân suy giảm sinh ra năng lượng. Công thức E=mc^2. Đáp án: 15.6 MeV.";
       
       let goodPromptResult = "";
       if (!hasRole && !hasConstraints) {
           goodPromptResult = badPromptResult; 
       } else if (hasConstraints && currentScenario.includes("Kim Dung")) {
           goodPromptResult = (hasThinking ? "<Thinking>\nLão phu cần phải dùng từ ngữ kiếm hiệp. Không thể tuồn đáp án trực tiếp.\n</Thinking>\n\n" : "") + "Tại hạ xem qua đề bài, quả là một trận pháp hụt khối. Chư vị thiếu hiệp hãy nhớ kíp khẩu quyết E=mc^2. Xin hỏi thiếu hiệp, m là bao nhiêu?";
       } else if (hasConstraints) {
           goodPromptResult = (hasThinking ? "<Thinking>\nHọc sinh cần ôn lại lý thuyết phóng xạ và công thức. Tránh nói kết quả.\n</Thinking>\n\n" : "") + "Chào bạn, hiện tượng này là sự phóng xạ. Dựa vào đó, bạn hãy nhắc lại công thức tính độ hụt khối lượng là gì?\n\n(Mình đang chờ đáp án của bạn nhé!)";
       } else {
           goodPromptResult = (hasThinking ? "<Thinking>\nKhông có ràng buộc che giấu đáp án, cứ trả lời thẳng.\n</Thinking>\n\n" : "") + "Chào bạn, ở đây chúng ta có hiện tượng suy giảm khối lượng. Áp dụng E = mc^2, ta có 15.6 MeV. Cố lên nhé!";
       }

       setTestResult({
         bad: badPromptResult,
         good: goodPromptResult
       });
       setIsTesting(false);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <div className="p-4 md:p-6 border-b border-slate-200 bg-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
         <div className="flex items-center gap-4">
           {onBack && (
             <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
               <ArrowLeft size={20} />
             </button>
           )}
           <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                Bậc 3: Thử Thách Kéo-Thả & Biến Cố
              </h2>
              <div className="text-sm font-medium mt-1 bg-amber-100 text-amber-800 px-3 py-1 rounded inline-flex items-center gap-2">
                <AlertTriangle size={14} /> <strong>Nhiệm vụ:</strong> {currentScenario}
              </div>
           </div>
         </div>
         <div className="flex items-center gap-3">
           <button 
             onClick={triggerEvent}
             className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2 px-4 rounded-lg transition-all flex items-center gap-2 shadow-sm"
           >
             <Shuffle size={16} className="text-indigo-500" /> Tạo Biến Cố
           </button>
           <button 
             onClick={handleRunTest} 
             disabled={isTesting || boardBlocks.length === 0}
             className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded-lg transition-all flex items-center gap-2 shadow-md"
           >
             {isTesting ? "Đang chạy..." : <><Play size={16} /> Bắt đầu đánh giá</>}
           </button>
         </div>
      </div>

      {!testResult ? (
        <div className="p-4 md:p-6 flex-1 overflow-hidden flex flex-col md:flex-row gap-6 bg-slate-50">
           <DragDropContext onDragEnd={onDragEnd}>
              {/* Available Blocks */}
              <div className="w-full md:w-1/3 flex flex-col h-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                 <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 text-sm uppercase tracking-wider flex items-center justify-between">
                   <span>Khối chức năng</span>
                   <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs">{availableBlocks.length} khối</span>
                 </div>
                 <Droppable droppableId="available">
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[150px]">
                        {availableBlocks.map((block, index) => (
                          // @ts-ignore
                          <Draggable key={block.id} draggableId={block.id} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="bg-white border-2 border-slate-200 p-4 rounded-xl shadow-sm cursor-grab active:cursor-grabbing hover:border-indigo-400 hover:shadow-md transition-all group"
                              >
                                <div className="font-bold text-indigo-700 mb-2 text-xs uppercase inline-block bg-indigo-50 px-2 py-1 rounded group-hover:bg-indigo-100 transition-colors">&lt;{block.type}&gt;</div>
                                <div className="text-sm text-slate-600 font-mono">{block.content}</div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                 </Droppable>
              </div>

              {/* Canvas / Builder */}
              <div className="w-full md:w-2/3 flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                 <div className="p-4 bg-slate-800/80 border-b border-slate-700/50 font-bold text-slate-300 text-sm uppercase tracking-wider flex items-center gap-2">
                   <Wand2 size={16} className="text-indigo-400" /> Bản thiết kế Prompt (Canvas)
                 </div>
                 <Droppable droppableId="board">
                    {(provided, snapshot) => (
                      <div 
                        ref={provided.innerRef} 
                        {...provided.droppableProps} 
                        className={`flex-1 p-6 overflow-y-auto space-y-4 transition-colors ${snapshot.isDraggingOver ? 'bg-slate-800/50' : ''}`}
                      >
                        {boardBlocks.length === 0 && (
                           <div className="h-full flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-700 rounded-2xl p-8 text-center bg-slate-800/30">
                             <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                               <AlertTriangle size={32} className="text-slate-400" />
                             </div>
                             <p className="text-lg text-slate-300 font-medium">Khu vực trống</p>
                             <p className="text-sm mt-2 max-w-sm">Kéo thả các khối từ bên trái vào đây để xây dựng hệ thống AI Mentor.</p>
                           </div>
                        )}
                        {boardBlocks.map((block, index) => (
                          // @ts-ignore
                          <Draggable key={block.id} draggableId={block.id} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="bg-slate-800 border border-slate-600 p-5 rounded-xl shadow-lg relative overflow-hidden group"
                              >
                                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                                <div className="font-bold text-emerald-400 mb-3 text-xs uppercase tracking-wider flex items-center gap-2">
                                  <span>&lt;{block.type}&gt;</span>
                                </div>
                                <div className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{block.content}</div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                 </Droppable>
              </div>
           </DragDropContext>
        </div>
      ) : (
        <div className="p-6 md:p-8 flex-1 overflow-y-auto bg-slate-50">
           <div className="mb-8 flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div>
                <h3 className="text-2xl font-bold text-slate-800">Kết quả đối chứng</h3>
                <p className="text-slate-500 mt-1 text-sm">Cùng yêu cầu: <strong>"{currentScenario}"</strong></p>
              </div>
              <button onClick={() => setTestResult(null)} className="px-6 py-2.5 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-700 hover:border-slate-400 transition-all">
                Sửa lại Prompt
              </button>
           </div>
           
           <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* Bad Version */}
              <div className="bg-white border-2 flex flex-col border-rose-100 rounded-3xl overflow-hidden shadow-sm">
                <div className="bg-rose-50/50 p-5 border-b border-rose-100 flex items-center justify-between">
                  <span className="flex items-center gap-2 font-bold text-rose-800 text-lg"><Columns size={20}/> Prompt Mặc Định (Chưa tối ưu)</span>
                  <span className="bg-white border border-rose-200 text-rose-600 text-xs px-3 py-1 font-bold rounded-full uppercase tracking-wide">Thất bại</span>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                   <div className="bg-slate-50 p-4 rounded-xl text-slate-700 text-sm mb-6 border border-slate-100"><strong>User:</strong> Giải giúp bài tập hụt khối lượng Vật lý này nhé.</div>
                   
                   <div className="prose prose-sm prose-rose text-slate-800 bg-white border border-slate-100 p-5 rounded-xl flex-1 shadow-inner">
                     {testResult.bad}
                   </div>
                   <div className="mt-6 p-4 bg-rose-50 rounded-xl border border-rose-100">
                     <p className="text-sm text-rose-700 flex items-start gap-2 font-semibold">
                       <AlertTriangle size={18} className="shrink-0 mt-0.5" /> 
                       Nhận xét: AI nhổ toẹt đáp án ngay lập tức và không hề quan tâm đến bối cảnh/biến cố bạn đặt ra.
                     </p>
                   </div>
                </div>
              </div>

              {/* Good Version */}
              <div className="bg-white border-2 flex flex-col border-emerald-400 rounded-3xl overflow-hidden shadow-lg relative">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Sparkles size={100} />
                </div>
                <div className="bg-emerald-500 p-5 flex items-center justify-between text-white relative z-10">
                  <span className="flex items-center gap-2 font-bold text-lg"><Sparkles size={20}/> Thiết kế của bạn</span>
                  <span className="bg-emerald-600 text-white text-xs px-3 py-1 font-bold rounded-full uppercase tracking-wide shadow-inner">Thành công!</span>
                </div>
                <div className="p-6 flex-1 flex flex-col relative z-10">
                   <div className="bg-slate-50 p-4 rounded-xl text-slate-700 text-sm mb-6 border border-slate-100"><strong>User:</strong> Giải giúp bài tập hụt khối lượng Vật lý này nhé.</div>
                   
                   <div className="prose prose-sm text-slate-800 whitespace-pre-wrap bg-white border border-slate-100 p-5 rounded-xl flex-1 shadow-inner text-lg">
                     {testResult.good}
                   </div>
                   
                   {boardBlocks.some(b => b.type === 'Constraints') ? (
                     <div className="mt-6 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                      <p className="text-sm text-emerald-800 flex items-start gap-2 font-semibold">
                        <Check size={18} className="shrink-0 mt-0.5 text-emerald-600" /> 
                        Tuyệt vời! &lt;Constraints&gt; đã khóa chặt việc nhả đáp án. Tùy thuộc vào &lt;Role&gt; mà tông giọng được thay đổi chính xác.
                      </p>
                     </div>
                   ) : (
                     <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-sm font-semibold flex items-start gap-2">
                       <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                       Bạn quên kéo khối &lt;Constraints&gt; vào rồi! Khối lượng kiến trúc không đủ để ép AI tuân thủ.
                     </div>
                   )}
                </div>
              </div>
           </div>
           
           <div className="mt-8 flex justify-center">
              <button onClick={onNext} className="bg-slate-900 text-white font-bold px-8 py-3 rounded-xl hover:bg-slate-800 transition-all shadow-lg flex items-center gap-2">
                Trở về Dashboard <ArrowLeft size={18} />
              </button>
           </div>
        </div>
      )}
    </div>
  )
}
