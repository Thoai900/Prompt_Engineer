import React, { useRef } from 'react';
import { useGhostText } from '../../hooks/useGhostText';
import { useWorkspace } from '../../context/WorkspaceContext';

interface GhostTextInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onValueChange: (next: string) => void;
  ghostMode: 'prose' | 'variable';
  ghostEnabled?: boolean;
  varName?: string;
  defaultGhostValue?: string;
  corpusValues?: string[];
}

export const GhostTextInput: React.FC<GhostTextInputProps> = ({
  value, onValueChange, ghostMode, ghostEnabled, varName,
  defaultGhostValue, corpusValues, className, style, ...rest
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { ghostTextEnabled } = useWorkspace();
  const effectiveEnabled = ghostEnabled !== false && ghostTextEnabled;

  const { ghost, onChange, onKeyDown, onCompositionStart, onCompositionEnd, clear } = useGhostText(
    value, onValueChange,
    { mode: ghostMode, enabled: effectiveEnabled, varName, defaultValue: defaultGhostValue, corpusValues },
  );

  return (
    <div className="relative w-full">
      {/* Mirror overlay */}
      <div
        aria-hidden
        className={`absolute inset-0 pointer-events-none overflow-hidden whitespace-pre-wrap break-words ${className || ''}`}
        style={{ ...style, color: 'transparent', borderColor: 'transparent', background: 'transparent' }}
      >
        <span>{value}</span>
        {ghost && <span style={{ color: 'var(--color-muted, #94a3b8)', opacity: 0.5 }}>{ghost}</span>}
      </div>
      <input
        {...rest}
        ref={inputRef}
        value={value}
        className={`relative bg-transparent ${className || ''}`}
        style={style}
        onChange={(e) => {
          onValueChange(e.target.value);
          onChange(e.target.value, e.target.selectionStart || 0, e.target.selectionEnd || 0);
        }}
        onKeyDown={(e) => { onKeyDown(e); rest.onKeyDown?.(e); }}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
        onBlur={(e) => { clear(); rest.onBlur?.(e); }}
      />
    </div>
  );
};
