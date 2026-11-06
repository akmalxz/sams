import React, { useState } from 'react';
import { Project, ProjectStatus, ProjectTask } from '../../types/sams';

interface ProjectPortfolioMatrixProps {
  projects: Project[];
  onSelectProject: (projectId: string) => void;
  onOpenLinkDialog: () => void;
  onRefreshProjects: () => void;
  onToggleTask: (projectId: string, task: ProjectTask) => void;
}

export const ProjectPortfolioMatrix: React.FC<ProjectPortfolioMatrixProps> = ({
  projects,
  onSelectProject,
  onOpenLinkDialog,
  onRefreshProjects,
  onToggleTask,
}) => {
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleSync = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setSyncingId(projectId);
    try {
      await fetch(`/api/projects/${projectId}/sync`, { method: 'POST' });
      onRefreshProjects();
    } catch (err) {
      console.error('Failed to sync project:', err);
    } finally {
      setSyncingId(null);
    }
  };

  const getStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case 'on_track':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">● On Track</span>;
      case 'at_risk':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">▲ At Risk</span>;
      case 'blocked':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">✕ Blocked</span>;
      case 'completed':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue/10 text-blue border border-blue/20">✓ Completed</span>;
    }
  };

  const totalTasks = projects.reduce((acc, p) => acc + (p.taskCounts?.total || 0), 0);
  const doneTasks = projects.reduce((acc, p) => acc + (p.taskCounts?.done || 0), 0);
  const overallPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Portfolio Executive KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Linked Codebases</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-ink">{projects.length}</span>
            <span className="text-xs text-blue font-medium">Antigravity Ready</span>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Total Deliverables</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-ink">{totalTasks}</span>
            <span className="text-xs text-ink-muted">{doneTasks} Completed</span>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Portfolio Velocity</p>
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs font-mono font-medium mb-1 text-ink">
              <span>Overall Progress</span>
              <span className="text-blue font-bold">{overallPercent}%</span>
            </div>
            <div className="w-full bg-elevated rounded-full h-2 overflow-hidden border border-line/60">
              <div
                className="bg-blue h-2 rounded-full transition-all duration-500"
                style={{ width: `${overallPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-xs flex flex-col justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Quick Action</p>
          <button
            type="button"
            onClick={onOpenLinkDialog}
            className="mt-2 w-full py-2 px-3 rounded-lg bg-blue text-white text-xs font-semibold hover:opacity-95 transition-opacity cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
          >
            <span>+</span> Link New Project Folder
          </button>
        </div>
      </div>

      {/* Projects Matrix Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-ink tracking-tight">Active Projects Portfolio</h2>
            <p className="text-xs text-ink-muted">
              Live overview of what each project is doing, how it is performing, and what needs to happen next.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefreshProjects}
            className="px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-medium text-ink hover:border-blue hover:text-blue transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Refresh All
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project) => {
            const isClean = (project.git?.uncommittedChanges ?? 0) === 0;
            const topTasks = (project.tasks || []).slice(0, 3);

            return (
              <div
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                className="group rounded-2xl border border-line bg-surface p-5 shadow-xs hover:border-blue/50 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden"
              >
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-base text-ink group-hover:text-blue transition-colors truncate">
                        {project.name}
                      </h3>
                      <p className="text-[11px] font-mono text-ink-muted truncate mt-0.5">
                        {project.workspacePath}
                      </p>
                    </div>
                    {getStatusBadge(project.status)}
                  </div>

                  {/* 1. What We're Doing */}
                  <div className="mt-4 rounded-xl bg-elevated/70 p-3 border border-line/60">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue mb-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      What We Are Doing
                    </div>
                    <p className="text-xs text-ink font-medium leading-relaxed line-clamp-2">
                      {project.currentFocus || 'No active objective set.'}
                    </p>
                  </div>

                  {/* 2. How We're Doing (Git & Progress) */}
                  <div className="mt-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                        Completion Progress
                      </span>
                      <span className="font-mono font-bold text-ink">{project.progressPercent}%</span>
                    </div>
                    <div className="w-full bg-elevated rounded-full h-1.5 overflow-hidden border border-line/50">
                      <div
                        className="bg-blue h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${project.progressPercent}%` }}
                      />
                    </div>

                    {/* Git telemetry pill */}
                    <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-ink-muted">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${isClean ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <span>git: {project.git?.branch || 'main'}</span>
                        <span>·</span>
                        <span>{isClean ? 'Clean' : `${project.git?.uncommittedChanges} dirty`}</span>
                      </div>
                      {project.git?.lastCommitHash && (
                        <span className="text-ink-subtle">#{project.git.lastCommitHash}</span>
                      )}
                    </div>
                  </div>

                  {/* 3. What Needs To Be Done (Top Tasks) */}
                  <div className="mt-4 pt-3 border-t border-line">
                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-2">
                      <span>Next Deliverables</span>
                      <span className="font-mono text-[10px] text-ink-subtle">
                        {project.taskCounts?.done || 0}/{project.taskCounts?.total || 0} done
                      </span>
                    </div>

                    {topTasks.length === 0 ? (
                      <p className="text-xs text-ink-subtle italic py-1">No action items defined yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {topTasks.map((task) => (
                          <div
                            key={task.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleTask(project.id, task);
                            }}
                            className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-elevated transition-colors text-xs text-ink cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={task.status === 'done'}
                              readOnly
                              className="mt-0.5 rounded text-blue focus:ring-blue cursor-pointer"
                            />
                            <span className={`flex-1 line-clamp-1 leading-snug ${task.status === 'done' ? 'line-through text-ink-muted' : ''}`}>
                              {task.title.replace(/\*\*/g, '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="mt-5 pt-3 border-t border-line flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleSync(e, project.id)}
                    disabled={syncingId === project.id}
                    className="px-2.5 py-1.5 rounded-lg border border-line bg-elevated text-[11px] font-medium text-ink-muted hover:text-ink hover:border-blue transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    title="Sync with Git & Antigravity Brain"
                  >
                    <svg className={`w-3 h-3 ${syncingId === project.id ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                    {syncingId === project.id ? 'Syncing...' : 'Sync Brain'}
                  </button>

                  <div className="flex items-center gap-1.5 text-xs font-semibold text-blue group-hover:translate-x-0.5 transition-transform">
                    <span>Open Studio Room</span>
                    <span>→</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
