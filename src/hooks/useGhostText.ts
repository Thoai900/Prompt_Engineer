import { useCallback, useRef, useState } from 'react';
import { querySuggestion, learnPhrase, learnVariableValue } from '../services/suggestionStore';

export interface GhostTextOptions {
  mode: 'prose' | 'variable';
  enabled?: boolean;
  varName?: string;
  defaultValue?: string;
  corpusValues?: string[];
}

export interface GhostTextApi {
  ghost: string;
  onChange: (value: string, selectionStart: number, selectionEnd: number) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onCompositionStart: () => void;
  onCompositionEnd: () => void;
  acceptAll: () => void;
  clear: () => void;
}

export function useGhostText(
  value: string,
  setValue: (next: string) => void,
  opts: GhostTextOptions,
): GhostTextApi {
  const [ghost, setGhost] = useState('');
  const composing = useRef(false);
  const enabled = opts.enabled !== false;

  const compute = useCallback((val: string, selStart: number, selEnd: number) => {
    if (!enabled || composing.current || selStart !== selEnd || selStart !== val.length) {
      setGhost('');
      return;
    }
    const g = opts.mode === 'variable'
      ? querySuggestion({
          mode: 'variable',
          varName: opts.varName || '',
          textBeforeCursor: val,
          defaultValue: opts.defaultValue,
          corpusValues: opts.corpusValues,
        })
      : querySuggestion({ mode: 'prose', textBeforeCursor: val });
    setGhost(g);
  }, [enabled, opts.mode, opts.varName, opts.defaultValue, opts.corpusValues]);

  const onChange = useCallback((val: string, selStart: number, selEnd: number) => {
    compute(val, selStart, selEnd);
  }, [compute]);

  const learn = useCallback((finalValue: string) => {
    if (opts.mode === 'variable') learnVariableValue(opts.varName || '', finalValue);
    else learnPhrase(finalValue);
  }, [opts.mode, opts.varName]);

  const acceptAll = useCallback(() => {
    if (!ghost) return;
    const next = value + ghost;
    setValue(next);
    setGhost('');
    learn(next);
  }, [ghost, value, setValue, learn]);

  const acceptWord = useCallback(() => {
    if (!ghost) return;
    const m = ghost.match(/^\s*\S+/);
    const chunk = m ? m[0] : ghost;
    const next = value + chunk;
    setValue(next);
    setGhost(ghost.slice(chunk.length));
  }, [ghost, value, setValue]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!ghost) return;
    if (e.key === 'Tab') { e.preventDefault(); acceptAll(); }
    else if (e.key === 'ArrowRight' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); acceptWord(); }
    else if (e.key === 'Escape') { setGhost(''); }
  }, [ghost, acceptAll, acceptWord]);

  const onCompositionStart = useCallback(() => { composing.current = true; setGhost(''); }, []);
  const onCompositionEnd = useCallback(() => { composing.current = false; }, []);
  const clear = useCallback(() => setGhost(''), []);

  return { ghost, onChange, onKeyDown, onCompositionStart, onCompositionEnd, acceptAll, clear };
}
