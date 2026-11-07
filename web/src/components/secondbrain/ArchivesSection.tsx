import React from 'react';
import { ArchivedProject } from '../../types/sams';

interface ArchivesSectionProps {
  archives: ArchivedProject[];
  onRestoreProject: (archived: ArchivedProject) => void;
  onDeleteArchive: (id: string) => void;
}

export const ArchivesSection: React.FC<ArchivesSectionProps> = ({
  archives,
  onRestoreProject,
  onDeleteArchive,
}) => {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-400 flex items-center justify-center font-bold text-sm">
            📦
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-ink tracking-tight">
                Project Archives & Retrospectives
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 font-semibold border border-slate-500/20">
                P.A.R.A. · Archives
              </span>
            </div>
            <p className="text-xs text-ink-muted">
              Completed or retired projects preserved for future reference and retrospective recall.
            </p>
          </div>
        </div>
      </div>

      {/* Archives List */}
      <div className="space-y-4">
        {archives.length === 0 ? (
          <div className="p-12 rounded-2xl border-2 border-dashed border-line text-center space-y-2">
            <span className="text-2xl block">📦</span>
            <h3 className="text-sm font-bold text-ink">Archive is empty</h3>
            <p className="text-xs text-ink-muted max-w-sm mx-auto">
              When a project is shipped, click "Archive" on its card to preserve its commit accomplishments and retrospective notes here.
            </p>
          </div>
        ) : (
          archives.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-line bg-canvas/60 p-4 space-y-3 hover:border-blue/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-ink">{item.name}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      ✓ Shipped
                    </span>
                    {item.githubRepo && (
                      <span className="text-[10px] font-mono text-ink-muted bg-surface px-1.5 py-0.2 rounded border border-line">
                        {item.githubRepo}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                    {item.summary}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onRestoreProject(item)}
                    className="px-2.5 py-1 rounded-lg border border-line bg-surface hover:bg-elevated text-xs font-semibold text-blue cursor-pointer shadow-2xs"
                    title="Restore back to active projects"
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Permanently remove archive for ${item.name}?`)) {
                        onDeleteArchive(item.id);
                      }
                    }}
                    className="w-7 h-7 rounded-lg border border-line bg-surface hover:bg-red-500/10 hover:border-red-500/30 text-ink-muted hover:text-red-500 text-xs cursor-pointer flex items-center justify-center"
                    title="Delete permanently"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Accomplishments */}
              {item.accomplishments.length > 0 && (
                <div className="rounded-lg bg-surface p-2.5 border border-line/60 space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted block">
                    Delivered Accomplishments ({item.totalTasksCompleted} tasks)
                  </span>
                  <div className="space-y-0.5 text-xs text-ink font-mono">
                    {item.accomplishments.map((acc, i) => (
                      <div key={i} className="flex items-center gap-1.5 truncate">
                        <span className="text-emerald-500 font-bold">✓</span>
                        <span className="truncate">{acc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] font-mono text-ink-muted pt-1">
                <span>Completed: {new Date(item.completedAt).toLocaleDateString()}</span>
                <span className="truncate max-w-xs">{item.workspacePath}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
