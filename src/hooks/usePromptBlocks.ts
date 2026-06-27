import { useState, useMemo, useEffect, useRef } from 'react';
import { PromptBlock, PromptTemplate, BlockType } from '../types';

export interface ExtractedVar {
  name: string;
  options?: string[];
  raw: string;
}

export interface HistoryEntry {
  content: string;
  timestamp: string;
  label: string;
}

export const usePromptBlocks = (initialTemplate: PromptTemplate | null) => {
  const [blocks, setBlocks] = useState<PromptBlock[]>(() => {
    if (initialTemplate && initialTemplate.blocks) {
      return initialTemplate.blocks;
    }
    return [];
  });

  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [blockHistoryList, setBlockHistoryList] = useState<Record<string, HistoryEntry[]>>({});
  const [blockRedoList, setBlockRedoList] = useState<Record<string, HistoryEntry[]>>({});

  // BuilderTab luôn được mount sẵn (App dùng class `hidden` thay vì unmount), nên khi
  // người dùng mở một template mới từ Home/Library, prop `initialTemplate` đổi nhưng
  // state khởi tạo lazy ở trên không tự cập nhật. Effect này nạp lại blocks mỗi khi
  // template (theo id) thực sự thay đổi, dùng ref để không ghi đè bản nháp đang sửa.
  const loadedTemplateIdRef = useRef<string | null>(initialTemplate?.id ?? null);
  useEffect(() => {
    const incomingId = initialTemplate?.id ?? null;
    if (incomingId && incomingId !== loadedTemplateIdRef.current) {
      loadedTemplateIdRef.current = incomingId;
      setBlocks(initialTemplate?.blocks ?? []);
      setBlockHistoryList({});
      setBlockRedoList({});
      setVariableValues({});
    }
  }, [initialTemplate]);

  // Helper to extract variables from all blocks
  const getVariablesFromBlocks = (blocksArgs: PromptBlock[]): ExtractedVar[] => {
    const list: ExtractedVar[] = [];
    const seen = new Set<string>();
    
    blocksArgs.forEach(b => {
      const matches = b.content.match(/\{\{([^}]+)\}\}/g);
      if (matches) {
        matches.forEach(m => {
          const inner = m.slice(2, -2).trim();
          const parts = inner.split(':');
          const name = parts[0].trim();
          if (!seen.has(name)) {
            seen.add(name);
            const options = parts.length > 1 ? parts[1].split(',').map(o => o.trim()) : undefined;
            list.push({ name, options, raw: m });
          }
        });
      }
    });
    return list;
  };

  // Helper to extract variables from a single block's text
  const getVariablesFromText = (text: string): ExtractedVar[] => {
    const list: ExtractedVar[] = [];
    const seen = new Set<string>();
    const matches = text.match(/\{\{([^}]+)\}\}/g);
    if (matches) {
      matches.forEach(m => {
        const inner = m.slice(2, -2).trim();
        const parts = inner.split(':');
        const name = parts[0].trim();
        if (!seen.has(name)) {
          seen.add(name);
          const options = parts.length > 1 ? parts[1].split(',').map(o => o.trim()) : undefined;
          list.push({ name, options, raw: m });
        }
      });
    }
    return list;
  };

  const allVariables = useMemo(() => getVariablesFromBlocks(blocks), [blocks]);

  // Helper to replace variables with user values
  const injectVariables = (text: string) => {
    return text.replace(/\{\{([^}]+)\}\}/g, (match, varInner) => {
      const parts = varInner.trim().split(':');
      const name = parts[0].trim();
      return variableValues[name] || (parts.length > 1 ? parts[1].split(',')[0].trim() : match);
    });
  };

  const addBlock = (type: BlockType, title: string, content: string = '', atIndex?: number) => {
    const newBlock: PromptBlock = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type,
      title,
      content,
      isPinned: false
    };
    setBlocks(prev => {
      const newBlocks = [...prev];
      if (atIndex !== undefined) {
        newBlocks.splice(atIndex, 0, newBlock);
      } else {
        newBlocks.push(newBlock);
      }
      return newBlocks;
    });
    return newBlock.id;
  };

  const deleteBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    // Clean up history lists
    setBlockHistoryList(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    setBlockRedoList(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const updateBlockContent = (id: string, content: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, content } : b));
  };

  const updateBlockTitle = (id: string, title: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, title } : b));
  };

  const togglePinBlock = (id: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, isPinned: !b.isPinned } : b));
  };

  const reorderBlocks = (startIndex: number, endIndex: number) => {
    setBlocks(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result;
    });
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    setBlocks(prev => {
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const result = Array.from(prev);
      const [removed] = result.splice(index, 1);
      result.splice(nextIndex, 0, removed);
      return result;
    });
  };

  // Undo/Redo & Version History helpers
  const saveBlockVersion = (blockId: string, content: string, label: string) => {
    if (!content || !content.trim()) return;
    const timestamp = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entry = { content, timestamp, label };
    
    setBlockHistoryList(prev => {
      const list = prev[blockId] ? [...prev[blockId]] : [];
      if (list.length > 0 && list[list.length - 1].content === content) {
        return prev;
      }
      if (list.length >= 10) list.shift();
      return { ...prev, [blockId]: [...list, entry] };
    });
    setBlockRedoList(prev => ({ ...prev, [blockId]: [] }));
  };

  const undoBlock = (blockId: string) => {
    const history = blockHistoryList[blockId] || [];
    if (history.length === 0) return;
    
    const currentBlock = blocks.find(b => b.id === blockId);
    if (!currentBlock) return;
    
    const previous = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    
    const timestamp = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const redoEntry = { content: currentBlock.content, timestamp, label: 'Bản hiện tại (Hoàn tác)' };
    
    setBlockRedoList(prev => {
      const list = prev[blockId] ? [...prev[blockId]] : [];
      return { ...prev, [blockId]: [...list, redoEntry] };
    });
    
    setBlockHistoryList(prev => ({ ...prev, [blockId]: newHistory }));
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, content: previous.content } : b));
  };

  const redoBlock = (blockId: string) => {
    const redos = blockRedoList[blockId] || [];
    if (redos.length === 0) return;
    
    const currentBlock = blocks.find(b => b.id === blockId);
    if (!currentBlock) return;
    
    const next = redos[redos.length - 1];
    const newRedos = redos.slice(0, -1);
    
    const timestamp = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const historyEntry = { content: currentBlock.content, timestamp, label: 'Trước khi Phục hồi' };
    
    setBlockHistoryList(prev => {
      const list = prev[blockId] ? [...prev[blockId]] : [];
      return { ...prev, [blockId]: [...list, historyEntry] };
    });
    
    setBlockRedoList(prev => ({ ...prev, [blockId]: newRedos }));
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, content: next.content } : b));
  };

  const restoreBlockVersion = (blockId: string, content: string) => {
    const currentBlock = blocks.find(b => b.id === blockId);
    if (!currentBlock) return;
    
    saveBlockVersion(blockId, currentBlock.content, 'Trước khi chọn bản cũ');
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, content } : b));
  };

  const clearAllBlocks = () => {
    setBlocks([]);
    setBlockHistoryList({});
    setBlockRedoList({});
    setVariableValues({});
  };

  const loadBlocksFromTemplate = (template: PromptTemplate) => {
    if (template.blocks) {
      setBlocks(template.blocks);
    } else {
      setBlocks([]);
    }
    setBlockHistoryList({});
    setBlockRedoList({});
    setVariableValues({});
  };

  return {
    blocks,
    setBlocks,
    variableValues,
    setVariableValues,
    allVariables,
    addBlock,
    deleteBlock,
    updateBlockContent,
    updateBlockTitle,
    togglePinBlock,
    moveBlock,
    reorderBlocks,
    undoBlock,
    redoBlock,
    restoreBlockVersion,
    saveBlockVersion,
    blockHistoryList,
    blockRedoList,
    injectVariables,
    getVariablesFromText,
    getVariablesFromBlocks,
    clearAllBlocks,
    loadBlocksFromTemplate,
  };
};
