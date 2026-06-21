const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'BuilderTab.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings to LF to avoid CRLF mismatch issues during replace
content = content.replace(/\r\n/g, '\n');

// 1. Sửa đoạn Available Blocks Sidebar bị cắt đứt
const target1 = `                      </div>\n                   >\n                     {AVAILABLE_BLOCKS.map((block, index) => (`;

const replacement1 = `                      </div>\n                    </div>\n                 </div>\n               </div>\n               \n               <div className="p-3 pb-1 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between bg-white/10 dark:bg-slate-900/20">\n                  <h3 className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Thành phần (Blocks)</h3>\n               </div>\n\n               <Droppable droppableId="available-blocks" isDropDisabled={true}>\n                 {(provided) => (\n                   <div \n                     ref={provided.innerRef} \n                     {...provided.droppableProps}\n                     className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-white/10 dark:bg-slate-900/10"\n                   >\n                     {AVAILABLE_BLOCKS.map((block, index) => (`;

if (content.includes(target1)) {
  content = content.replace(target1, replacement1);
  console.log('Successfully fixed Available Blocks Sidebar header!');
} else {
  console.log('Target 1 not found!');
}

// 2. Sửa đoạn block.des bị cắt đứt ở dòng 1147 và cấu trúc đóng ngoặc
const target2 = `                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">{block.des        {/* Split Workspace Area (Desktop side-by-side, Mobile toggled) */}\n        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden w-full h-full relative">`;

const replacement2 = `                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">{block.description}</p>\n                                  </div>\n                                  <button \n                                    onClick={(e) => {\n                                      e.stopPropagation();\n                                      addBlock(block.type);\n                                    }}\n                                    className="text-slate-550 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-violet-500/30 rounded-lg shadow-sm w-7 h-7 flex items-center justify-center p-0 active:scale-95"\n                                    aria-label="Thêm vào"\n                                  >\n                                    <Plus size={14} />\n                                  </button>\n                               </div>\n                             </div>\n                           </div>\n                         )}\n                       </Draggable>\n                     ))}\n                     {provided.placeholder}\n                     <button\n                       onClick={addCustomBlock}\n                       className="w-full mt-3 p-3 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-violet-500/50 rounded-xl text-slate-500 dark:text-slate-400 bg-white/40 dark:bg-slate-900/20 hover:bg-white/60 dark:hover:bg-slate-900/40 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-[0.98]"\n                     >\n                       <Plus size={18} className="text-violet-500 dark:text-violet-400" />\n                       <span className="text-[10px] font-bold uppercase tracking-wider">Tạo Khối Mới</span>\n                     </button>\n                   </div>\n                 )}\n               </Droppable>\n             </div>\n           )}\n         </div>\n\n        {/* Split Workspace Area (Desktop side-by-side, Mobile toggled) */}\n        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden w-full h-full relative">`;

if (content.includes(target2)) {
  content = content.replace(target2, replacement2);
  console.log('Successfully fixed Target 2 (block description and wrappers)!');
} else {
  // Let's try flexible search
  const index = content.indexOf('{block.des');
  if (index !== -1) {
    console.log('Found index of {block.des, but not target2. Length of substring:', content.substring(index, index + 250));
  } else {
    console.log('Target 2 and {block.des not found!');
  }
}

// Convert back to CRLF before writing on Windows (optional but clean)
const finalContent = content.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, finalContent, 'utf8');
console.log('Finished writing back file.');
