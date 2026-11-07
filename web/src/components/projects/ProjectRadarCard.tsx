import React, { useState } from 'react';
import { Project, ProjectStatus, ProjectTask } from '../../types/sams';

interface ProjectRadarCardProps {
  project: Project;
  onToggleTask: (projectId: string, task: ProjectTask) => void;
  onAddTask: (projectId: string, title: string) => void;
  onUpdateFocus: (projectId: string, focus: string) => void;
  onSyncPulse: (project: Project) => void;
  onUnlinkProject: (projectId: string) => void;
}

export const ProjectRadarCard: React.FC<ProjectRadarCardProps> = ({
  project,
  onToggleTask,
  onAddTask,
  onUpdateFocus,
  onSyncPulse,
  onUnlinkProject,
}) => {
  const [isEditingFocus, setIsEditingFocus] = useState(false);
  const [focusInput, setFocusInput] = useState(project.currentFocus || '');
  const [newTaskInput, setNewTaskInput] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);

  const isClean = (project.git?.uncommittedChanges ?? 0) === 0;
  const tasks = project.tasks || [];
  const openTasks = tasks.filter((t) => t.status !== 'done');
  const doneTasks = tasks.filter((t) => t.status === 'done');

  const handleSaveFocus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!focusInput.trim()) return;
    onUpdateFocus(project.id, focusInput.trim());
    setIsEditingFocus(false);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskInput.trim()) return;
    onAddTask(project.id, newTaskInput.trim());
    setNewTaskInput('');
    setIsAddingTask(false);
  };

  const getStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case 'on_track':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            ● On Track
          </span>
        );
      case 'at_risk':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            ▲ In Progress
          </span>
        );
      case 'blocked':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
            ✕ Blocked
          </span>
        );
      case 'completed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue/10 text-blue border border-blue/20">
            ✓ Done
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-xs transition-all hover:border-blue/40 flex flex-col gap-4">
      {/* 1. Header: Project Title & Quick Stats */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-bold text-ink tracking-tight truncate">
              {project.name}
            </h3>
            {getStatusBadge(project.status)}
          </div>
          <p className="text-[11px] font-mono text-ink-muted truncate mt-0.5" title={project.workspacePath}>
            {project.workspacePath}
          </p>
        </div>

        {/* Sync Pulse & Unlink Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onSyncPulse(project)}
            className="px-2.5 py-1 rounded-lg border border-line bg-elevated hover:bg-surface hover:border-blue/50 text-[11px] font-semibold text-ink-muted hover:text-blue transition-colors cursor-pointer flex items-center gap-1"
            title="Auto-analyze and refresh Git/codebase status"
          >
            <span className="text-blue font-bold">⚡</span> Pulse
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Unlink ${project.name} from SAMS? Your local files will not be deleted.`)) {
                onUnlinkProject(project.id);
              }
            }}
            className="w-7 h-7 rounded-lg border border-line bg-elevated hover:bg-red-500/10 hover:border-red-500/30 text-ink-muted hover:text-red-500 text-xs transition-colors cursor-pointer flex items-center justify-center"
            title="Unlink project"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 2. What We're Doing (Active Objective) */}
      <div className="rounded-xl bg-elevated/70 border border-line/70 p-3.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue" />
            What We Are Doing
          </span>
          {!isEditingFocus && (
            <button
              type="button"
              onClick={() => {
                setFocusInput(project.currentFocus || '');
                setIsEditingFocus(true);
              }}
              className="text-[10px] text-ink-muted hover:text-blue cursor-pointer"
            >
              ✎ Edit Focus
            </button>
          )}
        </div>

        {isEditingFocus ? (
          <form onSubmit={handleSaveFocus} className="flex gap-2 pt-1">
            <input
              type="text"
              autoFocus
              value={focusInput}
              onChange={(e) => setFocusInput(e.target.value)}
              placeholder="e.g. Implement user dashboard & modern analytics tab"
              className="flex-1 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-subtle focus:border-blue focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-blue px-3 py-1.5 text-xs font-semibold text-white hover:opacity-95 cursor-pointer"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsEditingFocus(false)}
              className="rounded-lg bg-elevated px-2 py-1.5 text-xs text-ink-muted hover:text-ink cursor-pointer"
            >
              Cancel
            </button>
          </form>
        ) : (
          <p className="text-xs text-ink font-medium leading-relaxed">
            {project.currentFocus || 'No active focus objective defined.'}
          </p>
        )}
      </div>

      {/* 3. How We're Doing (Git Status & Latest Accomplishment) */}
      <div className="rounded-xl bg-canvas border border-line p-3 space-y-2 text-xs font-mono">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isClean ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className="text-ink">git: <strong>{project.git?.branch || 'main'}</strong></span>
          </div>
          <span
            className={`text-[11px] font-semibold ${
              isClean ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {isClean ? '✓ Clean Tree' : `▲ ${project.git?.uncommittedChanges} uncommitted changes`}
          </span>
        </div>

        {project.git?.lastCommitMessage && (
          <div className="text-[11px] text-ink-muted truncate border-t border-line/60 pt-1.5">
            <span className="text-ink font-semibold">{project.git.lastCommitHash}</span> ·{' '}
            <span className="text-ink">{project.git.lastCommitMessage}</span>
          </div>
        )}
      </div>

      {/* 4. What's Next (Next Deliverables) */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
            Next Deliverables ({doneTasks.length}/{tasks.length})
          </span>
          {!isAddingTask && (
            <button
              type="button"
              onClick={() => setIsAddingTask(true)}
              className="text-[11px] font-medium text-blue hover:underline cursor-pointer flex items-center gap-0.5"
            >
              <span>+</span> Add Task
            </button>
          )}
        </div>

        {/* Task List */}
        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
          {tasks.length === 0 ? (
            <p className="text-xs text-ink-muted italic py-1">
              No tasks defined yet. Click "+ Add Task" or run "⚡ Pulse" to auto-import.
            </p>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => onToggleTask(project.id, task)}
                className={`flex items-start gap-2 p-2 rounded-lg border transition-colors cursor-pointer text-xs ${
                  task.status === 'done'
                    ? 'border-line/40 bg-elevated/40 opacity-60'
                    : 'border-line bg-surface hover:border-blue/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={task.status === 'done'}
                  onChange={() => {}}
                  className="mt-0.5 rounded text-blue cursor-pointer"
                />
                <span
                  className={`flex-1 min-w-0 truncate ${
                    task.status === 'done' ? 'line-through text-ink-muted' : 'text-ink font-medium'
                  }`}
                >
                  {task.title.replace(/\*\*/g, '')}
                </span>
                {task.priority === 'high' && task.status !== 'done' && (
                  <span className="text-[9px] font-mono font-bold uppercase text-amber-500 px-1 rounded bg-amber-500/10">
                    High
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Inline Add Task Form */}
        {isAddingTask && (
          <form onSubmit={handleCreateTask} className="flex gap-1.5 pt-1">
            <input
              type="text"
              autoFocus
              value={newTaskInput}
              onChange={(e) => setNewTaskInput(e.target.value)}
              placeholder="Enter next deliverable..."
              className="flex-1 rounded-lg border border-line bg-canvas px-2.5 py-1 text-xs text-ink placeholder:text-ink-subtle focus:border-blue focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-blue px-2.5 py-1 text-xs font-semibold text-white cursor-pointer"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setIsAddingTask(false)}
              className="rounded-lg bg-elevated px-2 py-1 text-xs text-ink-muted cursor-pointer"
            >
              ✕
            </button>
          </form>
        )}
      </div>

      {/* Progress Bar Footer */}
      <div className="pt-2 border-t border-line/60">
        <div className="flex items-center justify-between text-[10px] font-mono text-ink-muted mb-1">
          <span>Progress</span>
          <span className="font-semibold text-ink">
            {tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0}%
          </span>
        </div>
        <div className="w-full bg-elevated rounded-full h-1.5 overflow-hidden border border-line/40">
          <div
            className="bg-blue h-1.5 rounded-full transition-all duration-300"
            style={{
              width: `${tasks.length > 0 ? (doneTasks.length / tasks.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
};
