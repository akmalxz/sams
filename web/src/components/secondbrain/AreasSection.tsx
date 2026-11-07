import React, { useState } from 'react';
import { AreaOfResponsibility } from '../../types/sams';
import {
  IconBot,
  IconCheck,
  IconClose,
  IconCompass,
  IconDatabase,
  IconPalette,
  IconRocket,
  IconTrash,
} from '../ui/Icons';

interface AreasSectionProps {
  areas: AreaOfResponsibility[];
  onAddStandard: (areaId: string, standard: string) => void;
  onRemoveStandard: (areaId: string, index: number) => void;
}

const renderAreaIcon = (iconName: string) => {
  switch (iconName) {
    case 'rocket':
      return <IconRocket className="w-4 h-4 text-blue" />;
    case 'bot':
      return <IconBot className="w-4 h-4 text-purple-500" />;
    case 'palette':
      return <IconPalette className="w-4 h-4 text-emerald-500" />;
    case 'database':
      return <IconDatabase className="w-4 h-4 text-amber-500" />;
    default:
      return <IconCompass className="w-4 h-4 text-purple-500" />;
  }
};

export const AreasSection: React.FC<AreasSectionProps> = ({
  areas,
  onAddStandard,
  onRemoveStandard,
}) => {
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [newStandardInput, setNewStandardInput] = useState('');

  const handleAdd = (e: React.FormEvent, areaId: string) => {
    e.preventDefault();
    if (!newStandardInput.trim()) return;
    onAddStandard(areaId, newStandardInput.trim());
    setNewStandardInput('');
    setActiveAreaId(null);
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <IconCompass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-ink tracking-tight">
                Areas of Responsibility
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold border border-purple-500/20">
                P.A.R.A. · Areas
              </span>
            </div>
            <p className="text-xs text-ink-muted">
              Ongoing engineering domains and architectural standards that have no deadline.
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {areas.map((area) => (
          <div
            key={area.id}
            className="rounded-xl border border-line bg-canvas/50 p-4 space-y-3 hover:border-purple-500/40 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
                  style={{
                    backgroundColor: `${area.color}15`,
                    borderColor: `${area.color}30`,
                  }}
                >
                  {renderAreaIcon(area.icon)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">{area.name}</h3>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    {area.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Standards Checklist */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-muted">
                <span>Operating Standards ({area.standards.length})</span>
                {activeAreaId !== area.id && (
                  <button
                    type="button"
                    onClick={() => setActiveAreaId(area.id)}
                    className="text-blue hover:underline cursor-pointer"
                  >
                    + Add Standard
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                {area.standards.map((standard, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-xs text-ink p-2 rounded-lg bg-surface border border-line/60 group"
                  >
                    <IconCheck className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
                    <span className="flex-1 min-w-0 font-medium leading-relaxed">
                      {standard}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveStandard(area.id, idx)}
                      className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded hover:bg-red-500/10 text-ink-muted hover:text-red-500 cursor-pointer flex items-center justify-center shrink-0"
                      aria-label="Remove standard"
                    >
                      <IconTrash className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {activeAreaId === area.id && (
                <form
                  onSubmit={(e) => handleAdd(e, area.id)}
                  className="flex gap-1.5 pt-1.5"
                >
                  <input
                    type="text"
                    autoFocus
                    value={newStandardInput}
                    onChange={(e) => setNewStandardInput(e.target.value)}
                    placeholder="New standard (e.g. Always test with 8GB RAM budget)..."
                    className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-subtle focus:border-blue focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1.5 rounded-lg bg-blue text-xs font-semibold text-white shadow-2xs cursor-pointer"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveAreaId(null)}
                    className="px-2 py-1.5 rounded-lg bg-elevated text-xs text-ink-muted cursor-pointer"
                    aria-label="Cancel"
                  >
                    <IconClose className="w-3 h-3" />
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
