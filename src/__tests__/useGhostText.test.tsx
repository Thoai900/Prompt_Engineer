// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import { useGhostText } from '../hooks/useGhostText';
import { learnVariableValue, resetStoreForTest } from '../services/suggestionStore';

beforeEach(() => resetStoreForTest());

function keyEvent(key: string, ctrlKey = false) {
  let prevented = false;
  return {
    key, ctrlKey, metaKey: false,
    preventDefault: () => { prevented = true; },
    get prevented() { return prevented; },
  } as any;
}

describe('useGhostText', () => {
  it('computes a ghost for a variable when cursor is at end', () => {
    learnVariableValue('grade', '11');
    learnVariableValue('grade', '11');
    const { result } = renderHook(() => {
      const [v, setV] = useState('1');
      const api = useGhostText(v, setV, { mode: 'variable', varName: 'grade' });
      return { v, api };
    });
    act(() => result.current.api.onChange('1', 1, 1));
    expect(result.current.api.ghost).toBe('1');
  });

  it('Tab accepts the whole ghost and prevents default', () => {
    learnVariableValue('grade', '11');
    learnVariableValue('grade', '11');
    let current = '1';
    const { result } = renderHook(() =>
      useGhostText(current, (n) => { current = n; }, { mode: 'variable', varName: 'grade' }));
    act(() => result.current.onChange('1', 1, 1));
    const ev = keyEvent('Tab');
    act(() => result.current.onKeyDown(ev));
    expect(ev.prevented).toBe(true);
    expect(current).toBe('11');
  });

  it('does not suggest when disabled', () => {
    learnVariableValue('grade', '11');
    const { result } = renderHook(() =>
      useGhostText('1', () => {}, { mode: 'variable', varName: 'grade', enabled: false }));
    act(() => result.current.onChange('1', 1, 1));
    expect(result.current.ghost).toBe('');
  });
});
