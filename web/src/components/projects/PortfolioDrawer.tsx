import React from 'react';
import { Project, ProjectStatus, ProjectTask } from '../../types/sams';
import { IconAlertCircle, IconAlertTriangle, IconCheck, IconClose, IconPulse } from '../ui/Icons';

interface PortfolioDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onOpenLinkDialog: () => void;
  onReanalyzeProject?: (project: Project) => void;
  onToggleTask: (projectId: string, task: ProjectTask) => void;
}

export const PortfolioDrawer: React.FC<PortfolioDrawerProps> = ({
  isOpen,
  onClose,
  projects,
  selectedProjectId,
  onSelectProject,
  onOpenLinkDialog,
  onReanalyzeProject,
  onToggleTask,
}) => {
  if (!isOpen) return null;

  const getStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case 'on_track':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />On Track</span>;
      case 'at_risk':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1"><IconAlertTriangle className="w-3 h-3 text-amber-500" />At Risk</span>;
      case 'blocked':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center gap-1"><IconAlertCircle className="w-3 h-3 text-red-500" />Blocked</span>;
      case 'completed':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue/10 text-blue border border-blue/20 flex items-center gap-1"><IconCheck className="w-3 h-3 text-blue" />Completed</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label="Projects Portfolio">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-6 sm:pl-10 pointer-events-none">
        <div className="pointer-events-auto w-screen max-w-2xl bg-surface border-l border-line shadow-2xl flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-line flex items-center justify-between gap-3 bg-elevated/40">
            <div>
              <h2 className="text-base font-bold text-ink tracking-tight">Projects Portfolio</h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Overview across all linked codebases. Select a project to scope the 3D room.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLinkDialog();
                }}
                className="px-3 py-1.5 rounded-lg bg-blue text-white text-xs font-semibold hover:opacity-95 transition-opacity cursor-pointer flex items-center gap-1 shadow-sm"
              >
                <span>+</span> Link Project
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:bg-elevated hover:text-ink transition-colors cursor-pointer"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Project Cards List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {projects.map((project) => {
              const isSelected = selectedProjectId === project.id;
              const isClean = (project.git?.uncommittedChanges ?? 0) === 0;
              const topTasks = (project.tasks || []).slice(0, 3);

              return (
                <div
                  key={project.id}
                  onClick={() => {
                    onSelectProject(project.id);
                    onClose();
                  }}
                  className={`rounded-xl border p-4.5 transition-all cursor-pointer relative ${
                    isSelected
                      ? 'border-blue bg-blue/5 shadow-xs ring-1 ring-blue/20'
                      : 'border-line bg-surface hover:border-blue/40 hover:bg-elevated/50'
                  }`}
                >
                  {/* Title & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-ink truncate">{project.name}</h3>
                        {isSelected && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue text-white font-semibold">
                            ACTIVE IN ROOM
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-ink-muted truncate mt-0.5">
                        {project.workspacePath}
                      </p>
                    </div>
                    {getStatusBadge(project.status)}
                  </div>

                  {/* 1. What We're Doing */}
                  <div className="mt-3 rounded-lg bg-elevated/80 p-2.5 border border-line/60">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-blue block mb-0.5">
                      What We Are Doing
                    </span>
                    <p className="text-xs text-ink font-medium leading-relaxed line-clamp-2">
                      {project.currentFocus || 'No active objective defined.'}
                    </p>
                  </div>

                  {/* 2. How We're Doing */}
                  <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-ink-muted">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${isClean ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      <span>git: {project.git?.branch || 'main'} ({isClean ? 'Clean' : `${project.git?.uncommittedChanges} dirty`})</span>
                    </div>
                    <span className="font-bold text-ink">{project.progressPercent}% complete</span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-1.5 w-full bg-elevated rounded-full h-1.5 overflow-hidden border border-line/40">
                    <div
                      className="bg-blue h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${project.progressPercent}%` }}
                    />
                  </div>

                  {/* 3. Top Tasks */}
                  {topTasks.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-line/60 space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted block">
                        Next Deliverables
                      </span>
                      {topTasks.map((t) => (
                        <div
                          key={t.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleTask(project.id, t);
                          }}
                          className="flex items-center gap-2 text-xs text-ink hover:text-blue cursor-pointer py-0.5"
                        >
                          <input
                            type="checkbox"
                            checked={t.status === 'done'}
                            readOnly
                            className="rounded text-blue cursor-pointer"
                          />
                          <span className={`truncate ${t.status === 'done' ? 'line-through text-ink-muted' : ''}`}>
                            {t.title.replace(/\*\*/g, '')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 pt-2 flex items-center justify-between text-xs">
                    {onReanalyzeProject ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReanalyzeProject(project);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-elevated border border-line text-[11px] font-semibold text-ink-muted hover:text-blue hover:border-blue transition-colors cursor-pointer flex items-center gap-1.5"
                        title="Auto-analyze and refresh pulse for this codebase"
                      >
                        <IconPulse className="w-3.5 h-3.5 text-blue" />
                        <span>Re-Analyze</span>
                      </button>
                    ) : (
                      <div />
                    )}
                    <span className="font-semibold text-blue">{isSelected ? 'Currently Viewing →' : 'Switch Room to this Project →'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
