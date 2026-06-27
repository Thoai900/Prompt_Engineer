import React, { useRef } from 'react';
import { useGhostText } from '../../hooks/useGhostText';
import { useWorkspace } from '../../context/WorkspaceContext';

interface GhostTextAreaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value: string;
  onValueChange: (next: string) => void;
  ghostEnabled?: boolean;
}

export const GhostTextArea: React.FC<GhostTextAreaProps> = ({
  value, onValueChange, ghostEnabled, className, style, ...rest
}) => {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const { ghostTextEnabled } = useWorkspace();
  const effectiveEnabled = ghostEnabled !== false && ghostTextEnabled;

  const { ghost, onChange, onKeyDown, onCompositionStart, onCompositionEnd, clear } = useGhostText(
    value, onValueChange, { mode: 'prose', enabled: effectiveEnabled },
  );

  const syncScroll = () => {
    if (taRef.current && mirrorRef.current) {
      mirrorRef.current.scrollTop = taRef.current.scrollTop;
      mirrorRef.current.scrollLeft = taRef.current.scrollLeft;
    }
  };

  return (
    <div className="relative w-full">
      <div
        ref={mirrorRef}
        aria-hidden
        className={`absolute inset-0 pointer-events-none overflow-hidden whitespace-pre-wrap break-words ${className || ''}`}
        style={{ ...style, color: 'transparent', borderColor: 'transparent', background: 'transparent' }}
      >
        <span>{value}</span>
        {ghost && <span style={{ color: 'var(--color-muted, #94a3b8)', opacity: 0.5 }}>{ghost}</span>}
      </div>
      <textarea
        {...rest}
        ref={taRef}
        value={value}
        className={`relative bg-transparent ${className || ''}`}
        style={style}
        onChange={(e) => {
          onValueChange(e.target.value);
          onChange(e.target.value, e.target.selectionStart || 0, e.target.selectionEnd || 0);
        }}
        onKeyDown={(e) => { onKeyDown(e); rest.onKeyDown?.(e); }}
        onScroll={(e) => { syncScroll(); rest.onScroll?.(e); }}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
        onBlur={(e) => { clear(); rest.onBlur?.(e); }}
      />
    </div>
  );
};
