import React, { useState } from 'react';
import { KanbanWorkItem } from '../../types/sams';
import { BlackDot } from '../ui/BlackDot';

interface KanbanWorkbenchProps {
  items: KanbanWorkItem[];
  onAddItem: (title: string, prompt: string, persona: 'architect' | 'data-engineer' | 'archivist', mode: 'auto' | 'plan') => void;
  onDispatchItem: (item: KanbanWorkItem) => void;
  onMoveItemColumn: (id: string, col: KanbanWorkItem['column']) => void;
  isBusy: boolean;
}

const COLUMNS: Array<{ id: KanbanWorkItem['column']; label: string; badgeColor: string }> = [
  { id: 'backlog', label: 'Backlog', badgeColor: 'border-ochre/60 bg-ochre/10 text-ink' },
  { id: 'in_progress', label: 'In Progress', badgeColor: 'border-terracotta/60 bg-terracotta/10 text-ink' },
  { id: 'review', label: 'Review (Staged)', badgeColor: 'border-olive/60 bg-olive/10 text-ink' },
  { id: 'done', label: 'Done (In Vault)', badgeColor: 'border-line bg-canvas text-ink-muted' },
];

export const KanbanWorkbench: React.FC<KanbanWorkbenchProps> = ({
  items,
  onAddItem,
  onDispatchItem,
  onMoveItemColumn,
  isBusy,
}) => {
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [persona, setPersona] = useState<'architect' | 'data-engineer' | 'archivist'>('architect');
  const [mode, setMode] = useState<'auto' | 'plan'>('auto');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !prompt.trim()) return;
    onAddItem(title.trim(), prompt.trim(), persona, mode);
    setTitle('');
    setPrompt('');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line">
        <div>
          <h2 className="text-lg font-serif font-medium text-ink tracking-tight">
            Kanban Wall · Work Items
          </h2>
          <p className="text-xs text-ink-muted">
            Assign cards to an agent persona to dispatch them to <span className="font-mono text-ink">Desk 01 (SerialQueue)</span>
          </p>
        </div>
        <BlackDot state={isBusy ? 'executing' : 'idle'} label={`${items.length} Total Cards`} />
      </div>

      {/* Add Work Item Form (Accessible Labels per modern-web-guidance) */}
      <form onSubmit={handleCreate} className="p-4 rounded-xl bg-surface border border-line space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="kanban-title" className="block text-[11px] font-mono uppercase text-ink-muted mb-1">
              Work Item Title
            </label>
            <input
              id="kanban-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Audit DuckDB Weekly Metrics"
              className="w-full bg-canvas border border-line rounded px-3 py-1.5 text-xs font-mono text-ink focus:outline-none focus:border-ink"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="kanban-persona" className="block text-[11px] font-mono uppercase text-ink-muted mb-1">
                Assigned Agent
              </label>
              <select
                id="kanban-persona"
                value={persona}
                onChange={(e) => setPersona(e.target.value as any)}
                className="w-full bg-canvas border border-line rounded px-2.5 py-1.5 text-xs font-mono text-ink focus:outline-none focus:border-ink"
              >
                <option value="architect">Architect (Pro)</option>
                <option value="data-engineer">Data Engineer (Pro)</option>
                <option value="archivist">Archivist (Flash)</option>
              </select>
            </div>

            <div>
              <label htmlFor="kanban-mode" className="block text-[11px] font-mono uppercase text-ink-muted mb-1">
                Execution Mode
              </label>
              <select
                id="kanban-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
                className="w-full bg-canvas border border-line rounded px-2.5 py-1.5 text-xs font-mono text-ink focus:outline-none focus:border-ink"
              >
                <option value="auto">Auto (Execute)</option>
                <option value="plan">Plan (Read-Only)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
          <div className="flex-1">
            <label htmlFor="kanban-prompt" className="block text-[11px] font-mono uppercase text-ink-muted mb-1">
              Agent Task Prompt
            </label>
            <input
              id="kanban-prompt"
              type="text"
              required
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe exact task instructions for the agent..."
              className="w-full bg-canvas border border-line rounded px-3 py-1.5 text-xs font-mono text-ink focus:outline-none focus:border-ink"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-1.5 rounded bg-ink text-canvas text-xs font-mono hover:opacity-90 cursor-pointer shrink-0 min-h-[32px]"
          >
            + Add to Backlog
          </button>
        </div>
      </form>

      {/* 4-Column Kanban Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {COLUMNS.map((col) => {
          const colItems = items.filter((i) => i.column === col.id);
          return (
            <div
              key={col.id}
              className="rounded-xl bg-surface/80 border border-line p-3 flex flex-col justify-between min-h-[300px]"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-line/70">
                  <span className="text-xs font-mono font-bold uppercase text-ink">
                    {col.label}
                  </span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${col.badgeColor}`}>
                    {col.id === 'in_progress' && colItems.length > 0 ? 'LIVE' : colItems.length}
                  </span>
                </div>

                {colItems.length === 0 ? (
                  <div className="py-8 text-center text-[11px] font-mono text-ink-subtle">
                    No cards in {col.label}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {colItems.map((card) => (
                      <div
                        key={card.id}
                        className="p-3 rounded-lg bg-elevated border border-line shadow-2xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="text-xs font-sans font-semibold text-ink leading-snug">
                            {card.title}
                          </span>
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-surface border border-line text-ink-muted shrink-0">
                            {card.persona}
                          </span>
                        </div>

                        <p className="text-[11px] font-mono text-ink-muted line-clamp-2">
                          {card.prompt}
                        </p>

                        {card.resultSnippet && (
                          <div className="p-1.5 rounded bg-canvas border border-line/60 text-[10px] font-mono text-ink-muted line-clamp-2">
                            {card.resultSnippet}
                          </div>
                        )}

                        <div className="pt-1 flex flex-wrap items-center justify-between gap-1">
                          {card.column === 'backlog' && (
                            <button
                              type="button"
                              onClick={() => onDispatchItem(card)}
                              className="w-full py-1 px-2 rounded bg-ink text-canvas text-[11px] font-mono hover:opacity-90 cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <span>Assign to Desk 01 →</span>
                            </button>
                          )}

                          {card.column === 'review' && (
                            <button
                              type="button"
                              onClick={() => onMoveItemColumn(card.id, 'done')}
                              className="w-full py-1 px-2 rounded bg-olive text-canvas text-[11px] font-mono hover:opacity-90 cursor-pointer"
                            >
                              Approve into Vault ✓
                            </button>
                          )}

                          {card.column === 'done' && (
                            <span className="text-[10px] font-mono text-olive font-semibold">
                              ● Committed to Vault
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
