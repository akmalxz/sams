import React from 'react';
import { clsx } from 'clsx';

export type BlackDotState = 'idle' | 'synced' | 'queued' | 'executing' | 'streaming' | 'completed' | 'error';

interface BlackDotProps {
  state?: BlackDotState;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export const BlackDot: React.FC<BlackDotProps> = ({
  state = 'idle',
  size = 'md',
  label,
  className,
}) => {
  const sizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-[7px] h-[7px]',
    lg: 'w-2.5 h-2.5',
  };

  const isQueued = state === 'queued';
  const isPulsing = state === 'executing' || state === 'streaming';

  return (
    <span className={clsx('inline-flex items-center gap-2 font-mono text-xs text-ink-muted select-none', className)}>
      <span
        aria-hidden="true"
        className={clsx(
          'rounded-full transition-all duration-300',
          sizeClasses[size],
          isQueued
            ? 'bg-transparent border-[1.5px] border-ink opacity-80'
            : 'bg-ink',
          isPulsing && 'animate-dot-pulse',
          state === 'error' && 'ring-2 ring-terracotta/40'
        )}
      />
      {label && <span className="text-[11px] uppercase tracking-wider">{label}</span>}
    </span>
  );
};
