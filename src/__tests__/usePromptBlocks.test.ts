// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePromptBlocks } from '../hooks/usePromptBlocks';

describe('usePromptBlocks hook', () => {
  it('should initialize with empty blocks when initialTemplate is null', () => {
    const { result } = renderHook(() => usePromptBlocks(null));
    expect(result.current.blocks).toEqual([]);
    expect(result.current.allVariables).toEqual([]);
  });

  it('should add, update, and delete blocks', () => {
    const { result } = renderHook(() => usePromptBlocks(null));

    let blockId = '';
    act(() => {
      blockId = result.current.addBlock('role', 'System Role', 'You are a tutor.');
    });

    expect(result.current.blocks).toHaveLength(1);
    expect(result.current.blocks[0]).toEqual({
      id: blockId,
      type: 'role',
      title: 'System Role',
      content: 'You are a tutor.',
      isPinned: false,
    });

    act(() => {
      result.current.updateBlockContent(blockId, 'New content.');
      result.current.updateBlockTitle(blockId, 'New Title');
    });

    expect(result.current.blocks[0].content).toBe('New content.');
    expect(result.current.blocks[0].title).toBe('New Title');

    act(() => {
      result.current.deleteBlock(blockId);
    });

    expect(result.current.blocks).toHaveLength(0);
  });

  it('should extract variables from blocks', () => {
    const { result } = renderHook(() => usePromptBlocks(null));

    act(() => {
      result.current.addBlock('task', 'Action', 'Explain {{subject:Math,Physics}} for grade {{grade}}.');
    });

    expect(result.current.allVariables).toEqual([
      { name: 'subject', options: ['Math', 'Physics'], raw: '{{subject:Math,Physics}}' },
      { name: 'grade', options: undefined, raw: '{{grade}}' }
    ]);
  });

  it('should inject variable values or fallbacks', () => {
    const { result } = renderHook(() => usePromptBlocks(null));

    act(() => {
      result.current.setVariableValues({ subject: 'Chemistry' });
    });

    const text = 'Subject is {{subject:Math,Physics}} and Grade is {{grade:10}} or {{topic}}';
    const injected = result.current.injectVariables(text);
    
    expect(injected).toBe('Subject is Chemistry and Grade is 10 or {{topic}}');
  });
});
