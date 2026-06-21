import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { Layers, ChevronRight } from 'lucide-react';
import { PromptBlock } from '../../types';
import { PromptBlockCard } from './PromptBlockCard';
import { ExtractedVar } from '../../hooks/usePromptBlocks';

interface PromptBlockListProps {
  blocks: PromptBlock[];
  expandedBlocks: Record<string, boolean>;
  toggleBlockExpansion: (blockId: string, e: React.MouseEvent) => void;
  editingBlockId: string | null;
  setEditingBlockId: (id: string | null) => void;
  updateBlockTitle: (blockId: string, title: string) => void;
  updateBlockContent: (blockId: string, content: string) => void;
  deleteBlock: (blockId: string) => void;
  togglePinBlock: (blockId: string) => void;
  moveBlock: (index: number, direction: 'up' | 'down') => void;
  undoBlock: (blockId: string) => void;
  redoBlock: (blockId: string) => void;
  restoreBlockVersion: (blockId: string, content: string) => void;
  saveBlockVersion: (blockId: string, content: string, label: string) => void;
  blockHistoryList: Record<string, any[]>;
  blockRedoList: Record<string, any[]>;
  activeHistoryMenuId: string | null;
  setActiveHistoryMenuId: (id: string | null) => void;
  generatingBlocks: Record<string, boolean>;
  openAiMenuId: string | null;
  setOpenAiMenuId: (id: string | null) => void;
  customInstructions: Record<string, string>;
  setCustomInstructions: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleAiAssist: (block: PromptBlock, actionType: string) => void;
  variableValues: Record<string, string>;
  setVariableValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  getVariablesFromText: (text: string) => ExtractedVar[];
  isMobile: boolean;
  setShowMobilePanel: (panel: 'build' | 'preview') => void;
}

export const PromptBlockList: React.FC<PromptBlockListProps> = ({
  blocks,
  expandedBlocks,
  toggleBlockExpansion,
  editingBlockId,
  setEditingBlockId,
  updateBlockTitle,
  updateBlockContent,
  deleteBlock,
  togglePinBlock,
  moveBlock,
  undoBlock,
  redoBlock,
  restoreBlockVersion,
  saveBlockVersion,
  blockHistoryList,
  blockRedoList,
  activeHistoryMenuId,
  setActiveHistoryMenuId,
  generatingBlocks,
  openAiMenuId,
  setOpenAiMenuId,
  customInstructions,
  setCustomInstructions,
  handleAiAssist,
  variableValues,
  setVariableValues,
  getVariablesFromText,
  isMobile,
  setShowMobilePanel,
}) => {
  return (
    <div className="flex-1 overflow-y-auto px-4 lg:px-6 custom-scrollbar pb-32 lg:pb-8 relative pt-4 bg-transparent">
      {/* Mobile Top Navigation/Action Bar to jump to preview */}
      {isMobile && (
        <div className="flex justify-between items-center mb-4 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
          <span className="text-xs font-bold text-slate-400">Workshop ({blocks.length} khối)</span>
          <button 
            onClick={() => setShowMobilePanel('preview')} 
            className="flex items-center p-2 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white min-h-[40px] text-xs font-bold cursor-pointer"
          >
            <span>Xem trước</span>
            <ChevronRight size={14} className="ml-1" />
          </button>
        </div>
      )}

      <Droppable droppableId="builder-area">
        {(provided, snapshot) => (
          <div 
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 flex flex-col gap-4.5 transition-colors min-h-[300px] ${snapshot.isDraggingOver ? 'bg-slate-100/30 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800' : ''}`}
          >
            {blocks.length === 0 && (
              <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-550 py-16 mt-4">
                <Layers className="w-10 h-10 text-slate-350 dark:text-slate-700 mb-2 animate-pulse" />
                <span className="text-sm font-bold text-slate-650 dark:text-slate-400">Chưa có thành phần nào</span>
                <span className="text-xs text-slate-500 text-center max-w-xs hidden md:inline">
                  Chạm '+ Thêm khối' hoặc Kéo thả khối từ cột trái để bắt đầu thiết kế prompt.
                </span>
                <span className="text-xs text-slate-500 text-center max-w-xs inline md:hidden">
                  Chạm '+ Thêm khối' phía dưới để bắt đầu thiết kế prompt.
                </span>
              </div>
            )}
            
            {blocks.map((block, idx) => {
              const isGenerating = generatingBlocks[block.id];
              const isExpanded = expandedBlocks[block.id];

              return (
                <PromptBlockCard
                  key={block.id}
                  block={block}
                  index={idx}
                  isMobile={isMobile}
                  isExpanded={isExpanded}
                  toggleBlockExpansion={toggleBlockExpansion}
                  editingBlockId={editingBlockId}
                  setEditingBlockId={setEditingBlockId}
                  updateBlockTitle={updateBlockTitle}
                  updateBlockContent={updateBlockContent}
                  deleteBlock={deleteBlock}
                  togglePinBlock={togglePinBlock}
                  moveBlock={moveBlock}
                  undoBlock={undoBlock}
                  redoBlock={redoBlock}
                  restoreBlockVersion={restoreBlockVersion}
                  saveBlockVersion={saveBlockVersion}
                  blockHistoryList={blockHistoryList}
                  blockRedoList={blockRedoList}
                  activeHistoryMenuId={activeHistoryMenuId}
                  setActiveHistoryMenuId={setActiveHistoryMenuId}
                  isGenerating={isGenerating}
                  openAiMenuId={openAiMenuId}
                  setOpenAiMenuId={setOpenAiMenuId}
                  customInstructions={customInstructions}
                  setCustomInstructions={setCustomInstructions}
                  handleAiAssist={handleAiAssist}
                  variableValues={variableValues}
                  setVariableValues={setVariableValues}
                  getVariablesFromText={getVariablesFromText}
                />
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};
