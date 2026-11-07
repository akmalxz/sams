import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { AgentBot, PersonaId, StationId, VisorState } from '../../types/sams';
import { AgentVisor } from './AgentVisor';
import { BlackDot } from '../ui/BlackDot';
import { IconChevronDown, IconClose } from '../ui/Icons';

interface AgentStatesDockProps {
  currentGlobalState: VisorState;
  overrideState: VisorState | null;
  onSelectOverrideState: (state: VisorState | null) => void;
  bots: AgentBot[];
  selectedPersona: PersonaId;
  onSelectBot: (bot: AgentBot) => void;
  onSelectStation: (station: StationId) => void;
}

const ALL_STATES: Array<{ id: VisorState; label: string; desc: string }> = [
  { id: 'idle', label: 'Idle', desc: 'Awaiting queue assignment' },
  { id: 'researching', label: 'Researching', desc: 'FTS5 search & thinking' },
  { id: 'active', label: 'Active', desc: 'Executing at Desk 01' },
  { id: 'error', label: 'Error', desc: 'Task error or sync lock' },
  { id: 'offline', label: 'Offline', desc: 'SSD unmounted / offline' },
  { id: 'success', label: 'Success', desc: 'Staged & committed to Vault' },
];

export const AgentStatesDock: React.FC<AgentStatesDockProps> = ({
  currentGlobalState,
  overrideState,
  onSelectOverrideState,
  bots,
  selectedPersona,
  onSelectBot,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const effectiveState = overrideState || currentGlobalState;

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  return (
    <div className="fixed bottom-4 left-4 z-40 select-none">
      {/* 1. Collapsed Floating Circle Button */}
      {!isExpanded ? (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          aria-expanded="false"
          aria-label="Open SAMS Agent Visor States and Bot Roster"
          className="group flex items-center gap-2 p-1.5 pr-3.5 rounded-full bg-surface/90 border border-line shadow-xl hover:border-blue/60 hover:shadow-2xl transition-all cursor-pointer backdrop-blur-md"
          title="Agent States (Click to expand 6-state visor dock)"
        >
          <div className="w-10 h-10 rounded-full bg-blue/10 flex items-center justify-center text-blue shrink-0 shadow-2xs">
            <AgentVisor state={effectiveState} size="sm" decorative frameColor="#2563EB" />
          </div>
          <div className="text-left text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-ink leading-tight capitalize">{effectiveState}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-blue animate-pulse" />
            </div>
            <span className="text-[10px] text-ink-muted flex items-center gap-0.5">
              Visor States <IconChevronDown className="w-3 h-3" />
            </span>
          </div>
        </button>
      ) : (
        /* 2. Expanded Floating Glass HUD Card */
        <div className="w-[360px] sm:w-[480px] rounded-2xl bg-surface/95 border border-line p-4 shadow-2xl backdrop-blur-md space-y-3.5 animate-in fade-in slide-in-from-bottom-3 duration-200">
          {/* Card Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-line">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue/10 flex items-center justify-center text-blue">
                <AgentVisor state={effectiveState} size="xs" decorative frameColor="#2563EB" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-ink tracking-tight">SAMS Agent States</h3>
                <p className="text-[10px] font-mono text-ink-muted">
                  Live state: <strong className="text-blue capitalize">{effectiveState}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {overrideState && (
                <button
                  type="button"
                  onClick={() => onSelectOverrideState(null)}
                  className="px-2 py-0.5 rounded text-[10px] font-mono text-blue bg-blue/10 hover:bg-blue/20 transition-colors cursor-pointer"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                aria-label="Collapse Agent States"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-muted hover:bg-elevated hover:text-ink transition-colors cursor-pointer"
              >
                <IconClose className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* The 6 Visor Expressions from the SAMS Poster */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {ALL_STATES.map((item) => {
              const isCurrent = effectiveState === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    onSelectOverrideState(overrideState === item.id ? null : item.id)
                  }
                  className={clsx(
                    'flex flex-col items-center justify-center p-2 rounded-xl border transition-all cursor-pointer text-center min-h-[76px]',
                    isCurrent
                      ? 'bg-blue/10 border-blue shadow-xs scale-[1.03]'
                      : 'bg-canvas/60 border-line/70 hover:bg-elevated hover:border-line'
                  )}
                  title={item.desc}
                >
                  <AgentVisor
                    state={item.id}
                    size="sm"
                    frameColor={isCurrent ? '#2563EB' : '#64748B'}
                    decorative={true}
                  />
                  <span
                    className={clsx(
                      'text-[11px] font-sans mt-1.5 tracking-tight',
                      isCurrent ? 'font-bold text-blue' : 'font-medium text-ink'
                    )}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Bots Roster */}
          <div className="pt-2 border-t border-line flex flex-wrap items-center justify-between gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-ink-muted">
              Active Bots (4)
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {bots.map((bot) => {
                const isSelected = selectedPersona === bot.id;
                return (
                  <button
                    key={bot.id}
                    type="button"
                    onClick={() => onSelectBot(bot)}
                    className={clsx(
                      'inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-mono transition-all cursor-pointer',
                      isSelected
                        ? 'bg-blue text-white border-blue font-semibold shadow-2xs'
                        : 'bg-elevated border-line text-ink hover:border-blue/50'
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: isSelected ? '#FFFFFF' : bot.bodyColor }}
                    />
                    <span>{bot.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
