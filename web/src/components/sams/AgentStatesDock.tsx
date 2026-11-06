import React from 'react';
import { clsx } from 'clsx';
import { AgentBot, PersonaId, SamsTheme, StationId, VisorState } from '../../types/sams';
import { AgentVisor } from './AgentVisor';
import { BlackDot } from '../ui/BlackDot';

interface AgentStatesDockProps {
  currentGlobalState: VisorState;
  overrideState: VisorState | null;
  onSelectOverrideState: (state: VisorState | null) => void;
  bots: AgentBot[];
  selectedPersona: PersonaId;
  onSelectBot: (bot: AgentBot) => void;
  onSelectStation: (station: StationId) => void;
  theme: SamsTheme;
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
  theme,
}) => {
  const effectiveState = overrideState || currentGlobalState;
  const visorFrameColor = theme === 'blueprint' ? '#3B6EA5' : '#8A6A58';
  const activeFrameColor = theme === 'blueprint' ? '#2563EB' : '#B85D3B';

  return (
    <section
      aria-label="Agent States and Roster"
      className="space-y-3"
    >
      {/* Top Card: The 6 SAMS Agent States Reference + Live Telemetry Indicator */}
      <div className="rounded-xl bg-surface/95 border border-line p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <BlackDot
              state={
                effectiveState === 'active' || effectiveState === 'researching'
                  ? 'executing'
                  : effectiveState === 'error'
                    ? 'error'
                    : 'idle'
              }
              size="sm"
            />
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink">
              Agent States
            </h2>
            <span className="text-[11px] font-mono text-ink-subtle">
              — Live telemetry state highlighted (click any visor to preview expression)
            </span>
          </div>

          {overrideState && (
            <button
              type="button"
              onClick={() => onSelectOverrideState(null)}
              className="px-2.5 py-1 rounded bg-canvas border border-line text-[11px] font-mono text-ink hover:bg-elevated cursor-pointer transition-colors"
            >
              Reset to Live Telemetry ({currentGlobalState.toUpperCase()})
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
          {ALL_STATES.map((item) => {
            const isCurrent = effectiveState === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={isCurrent}
                onClick={() =>
                  onSelectOverrideState(overrideState === item.id ? null : item.id)
                }
                className={clsx(
                  'group flex flex-col items-center justify-center p-2.5 rounded-lg border transition-all cursor-pointer text-center min-h-[88px]',
                  isCurrent
                    ? 'bg-elevated border-ink shadow-xs scale-[1.02]'
                    : 'bg-canvas/60 border-line/70 hover:bg-elevated/70 hover:border-line opacity-80 hover:opacity-100'
                )}
              >
                <AgentVisor
                  state={item.id}
                  size="sm"
                  frameColor={isCurrent ? activeFrameColor : visorFrameColor}
                  decorative={true}
                />
                <div className="mt-2 flex items-center gap-1.5">
                  {isCurrent && <BlackDot size="sm" />}
                  <span
                    className={clsx(
                      'text-xs font-sans tracking-tight',
                      isCurrent ? 'font-bold text-ink' : 'font-medium text-ink-muted'
                    )}
                  >
                    {item.label}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-ink-subtle mt-0.5 line-clamp-1">
                  {item.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Strip: Active Agent Roster (Matching the SAMS Footer Banner) */}
      <div className="rounded-xl bg-surface/95 border border-line px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AgentVisor
            state={effectiveState}
            size="xs"
            frameColor={activeFrameColor}
            decorative={true}
          />
          <div>
            <div className="text-xs font-sans font-bold text-ink tracking-tight">
              SAMS · Spatial Agentic Operations
            </div>
            <div className="text-[11px] font-mono text-ink-muted">
              8 GB M1 Serial Mutex (`concurrency = 1`) · Only 1 agent occupies Desk 01 at a time
            </div>
          </div>
        </div>

        {/* 4 Persona Agent Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {bots.map((bot) => {
            const isSelected = selectedPersona === bot.id;
            return (
              <button
                key={bot.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectBot(bot)}
                className={clsx(
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer',
                  isSelected
                    ? 'bg-elevated border-ink text-ink font-semibold shadow-2xs'
                    : 'bg-canvas border-line text-ink-muted hover:text-ink hover:bg-elevated/60'
                )}
              >
                <span
                  aria-hidden="true"
                  className="w-2.5 h-2.5 rounded-full border border-ink/40 shrink-0"
                  style={{ backgroundColor: bot.bodyColor }}
                />
                <span>{bot.name}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface border border-line text-ink-subtle uppercase">
                  {bot.station === 'desk01' ? 'Desk 01' : bot.station}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
