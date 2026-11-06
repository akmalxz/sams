import React from 'react';
import { clsx } from 'clsx';
import { VisorState } from '../../types/sams';

interface AgentVisorProps {
  state: VisorState;
  frameColor?: string;
  eyeColor?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  decorative?: boolean;
  label?: string;
  className?: string;
}

const STATE_LABELS: Record<VisorState, string> = {
  idle: 'Agent Idle',
  researching: 'Agent Researching',
  active: 'Agent Active',
  error: 'Agent Error',
  offline: 'Agent Offline',
  success: 'Agent Success',
};

export const AgentVisor: React.FC<AgentVisorProps> = ({
  state,
  frameColor = '#B85D3B',
  eyeColor = '#F5F2EB',
  size = 'md',
  decorative = true,
  label,
  className,
}) => {
  const dimensions = {
    xs: 'w-8 h-5',
    sm: 'w-11 h-7',
    md: 'w-16 h-11',
    lg: 'w-20 h-14',
  };

  const resolvedEyeColor =
    state === 'error'
      ? '#E06D53'
      : state === 'offline'
        ? '#8C857B'
        : state === 'success'
          ? '#A3C995'
          : eyeColor;

  const accessibleTitle = label || STATE_LABELS[state];

  return (
    <svg
      viewBox="0 0 88 58"
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? 'true' : undefined}
      className={clsx(
        'inline-block shrink-0 select-none transition-transform duration-300',
        dimensions[size],
        state === 'active' && 'scale-[1.03]',
        className
      )}
    >
      {!decorative && <title>{accessibleTitle}</title>}

      {/* Outer Bot Head Casing */}
      <rect
        x="3"
        y="3"
        width="82"
        height="52"
        rx="20"
        fill={frameColor}
        stroke="#1C1917"
        strokeWidth="2.5"
      />

      {/* Subtle Top Bevel Highlight */}
      <path
        d="M 22 7 H 66"
        stroke="#FAF8F4"
        strokeWidth="2"
        strokeLinecap="round"
        strokeOpacity="0.45"
      />

      {/* Inner Dark Visor Screen */}
      <rect
        x="10"
        y="10"
        width="68"
        height="38"
        rx="14"
        fill="#161412"
        stroke="#292524"
        strokeWidth="1.5"
      />

      {/* 1. IDLE: Calm vertical capsule eyes */}
      {state === 'idle' && (
        <g fill={resolvedEyeColor} opacity="0.88">
          <rect x="24" y="21" width="9" height="16" rx="4.5" />
          <rect x="55" y="21" width="9" height="16" rx="4.5" />
        </g>
      )}

      {/* 2. RESEARCHING: Dual 3-bar horizontal scan lines (≡ ≡) */}
      {state === 'researching' && (
        <g fill={resolvedEyeColor} className="animate-pulse">
          {/* Left eye scan bars */}
          <rect x="22" y="20" width="13" height="3.2" rx="1.6" />
          <rect x="22" y="27.2" width="13" height="3.2" rx="1.6" />
          <rect x="22" y="34.4" width="13" height="3.2" rx="1.6" />
          {/* Right eye scan bars */}
          <rect x="53" y="20" width="13" height="3.2" rx="1.6" />
          <rect x="53" y="27.2" width="13" height="3.2" rx="1.6" />
          <rect x="53" y="34.4" width="13" height="3.2" rx="1.6" />
        </g>
      )}

      {/* 3. ACTIVE: Wide focused bright eyes with subtle inner pupil glint */}
      {state === 'active' && (
        <g>
          <rect
            x="22"
            y="18.5"
            width="12"
            height="20"
            rx="6"
            fill={resolvedEyeColor}
          />
          <rect
            x="54"
            y="18.5"
            width="12"
            height="20"
            rx="6"
            fill={resolvedEyeColor}
          />
          <circle cx="26" cy="24" r="2" fill="#FFFFFF" />
          <circle cx="58" cy="24" r="2" fill="#FFFFFF" />
        </g>
      )}

      {/* 4. ERROR: Crossed X eyes (✕ ✕) */}
      {state === 'error' && (
        <g
          stroke={resolvedEyeColor}
          strokeWidth="4"
          strokeLinecap="round"
        >
          {/* Left X */}
          <line x1="22" y1="22" x2="34" y2="35" />
          <line x1="34" y1="22" x2="22" y2="35" />
          {/* Right X */}
          <line x1="54" y1="22" x2="66" y2="35" />
          <line x1="66" y1="22" x2="54" y2="35" />
        </g>
      )}

      {/* 5. OFFLINE: Flat horizontal sleeping dashes (— —) */}
      {state === 'offline' && (
        <g fill={resolvedEyeColor} opacity="0.65">
          <rect x="21" y="27" width="14" height="4" rx="2" />
          <rect x="53" y="27" width="14" height="4" rx="2" />
        </g>
      )}

      {/* 6. SUCCESS: Happy upward curved arcs (◠ ◠) */}
      {state === 'success' && (
        <g
          fill="none"
          stroke={resolvedEyeColor}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M 21 33 C 24 21, 33 21, 36 33" />
          <path d="M 52 33 C 55 21, 64 21, 67 33" />
        </g>
      )}
    </svg>
  );
};
