import React, { useState } from 'react';
import { Project, ProjectStatus, ProjectTask } from '../../types/sams';
import { parseGitHubRepo, fetchGitHubRepoPulse, GitHubPulseResult } from '../../utils/githubSync';

interface ProjectRadarCardProps {
  project: Project;
  onToggleTask: (projectId: string, task: ProjectTask) => void;
  onAddTask: (projectId: string, title: string) => void;
  onUpdateFocus: (projectId: string, focus: string) => void;
  onSyncPulse: (project: Project) => void;
  onUnlinkProject: (projectId: string) => void;
  onUpdateProject?: (projectId: string, updates: Partial<Project>) => void;
}

export const ProjectRadarCard: React.FC<ProjectRadarCardProps> = ({
  project,
  onToggleTask,
  onAddTask,
  onUpdateFocus,
  onSyncPulse,
  onUnlinkProject,
  onUpdateProject,
}) => {
  const [isEditingFocus, setIsEditingFocus] = useState(false);
  const [focusInput, setFocusInput] = useState(project.currentFocus || '');
  const [newTaskInput, setNewTaskInput] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);

  // GitHub Sync State
  const [isSyncingGitHub, setIsSyncingGitHub] = useState(false);
  const [gitHubSyncMsg, setGitHubSyncMsg] = useState<string | null>(null);
  const [isEditingGitHubRepo, setIsEditingGitHubRepo] = useState(false);
  const [gitHubInput, setGitHubInput] = useState(
    project.githubRepo ||
      (project.git?.remoteUrl ? parseGitHubRepo(project.git.remoteUrl)?.owner + '/' + parseGitHubRepo(project.git.remoteUrl)?.repo : '')
  );

  const isClean = (project.git?.uncommittedChanges ?? 0) === 0;
  const tasks = project.tasks || [];
  const openTasks = tasks.filter((t) => t.status !== 'done');
  const doneTasks = tasks.filter((t) => t.status === 'done');

  // Resolved GitHub Repo info
  const resolvedRepo =
    project.githubRepo
      ? parseGitHubRepo(project.githubRepo)
      : project.git?.remoteUrl
        ? parseGitHubRepo(project.git.remoteUrl)
        : null;

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

  // Direct GitHub API Sync (100% Serverless)
  const handleGitHubPulse = async () => {
    const target = resolvedRepo || parseGitHubRepo(gitHubInput);
    if (!target) {
      setIsEditingGitHubRepo(true);
      return;
    }

    setIsSyncingGitHub(true);
    setGitHubSyncMsg(null);

    try {
      const pulse: GitHubPulseResult = await fetchGitHubRepoPulse(target.owner, target.repo);

      if (onUpdateProject) {
        onUpdateProject(project.id, {
          githubRepo: `${target.owner}/${target.repo}`,
          git: {
            isGitRepo: true,
            branch: pulse.defaultBranch,
            uncommittedChanges: 0,
            lastCommitHash: pulse.lastCommitHash,
            lastCommitMessage: pulse.lastCommitMessage,
            lastCommitDate: pulse.lastCommitDate,
            remoteUrl: `https://github.com/${target.owner}/${target.repo}.git`,
          },
        });
      }

      setGitHubSyncMsg(`Synced commit ${pulse.lastCommitHash} from GitHub!`);
      setTimeout(() => setGitHubSyncMsg(null), 4000);
    } catch (err: any) {
      setGitHubSyncMsg(`GitHub error: ${err.message}`);
    } finally {
      setIsSyncingGitHub(false);
    }
  };

  const handleSaveGitHubRepo = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseGitHubRepo(gitHubInput);
    if (parsed && onUpdateProject) {
      const slug = `${parsed.owner}/${parsed.repo}`;
      onUpdateProject(project.id, {
        githubRepo: slug,
      });
      setIsEditingGitHubRepo(false);
      handleGitHubPulse();
    }
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
          {resolvedRepo && (
            <button
              type="button"
              disabled={isSyncingGitHub}
              onClick={handleGitHubPulse}
              className="px-2.5 py-1 rounded-lg border border-line bg-elevated hover:bg-surface hover:border-blue/50 text-[11px] font-semibold text-ink-muted hover:text-blue transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
              title="Sync latest commits directly from GitHub API"
            >
              {isSyncingGitHub ? (
                <span className="animate-spin text-xs">⟳</span>
              ) : (
                <span className="text-blue font-bold">☁</span>
              )}
              <span className="hidden sm:inline">GitHub Sync</span>
            </button>
          )}

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

      {/* GitHub Sync Status Notification */}
      {gitHubSyncMsg && (
        <div className="text-[11px] font-mono px-3 py-1.5 rounded-lg bg-blue/10 border border-blue/20 text-blue flex items-center justify-between">
          <span>{gitHubSyncMsg}</span>
          <button
            type="button"
            onClick={() => setGitHubSyncMsg(null)}
            className="text-xs text-blue hover:opacity-75 cursor-pointer ml-2"
          >
            ✕
          </button>
        </div>
      )}

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

          {/* GitHub Repo Link / Connect Pill */}
          {resolvedRepo ? (
            <a
              href={`https://github.com/${resolvedRepo.owner}/${resolvedRepo.repo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-blue hover:underline flex items-center gap-1 shrink-0"
              title="Open repository on GitHub"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>{resolvedRepo.owner}/{resolvedRepo.repo}</span>
            </a>
          ) : isEditingGitHubRepo ? (
            <form onSubmit={handleSaveGitHubRepo} className="flex items-center gap-1">
              <input
                type="text"
                autoFocus
                placeholder="owner/repo"
                value={gitHubInput}
                onChange={(e) => setGitHubInput(e.target.value)}
                className="w-28 px-1.5 py-0.5 text-[10px] rounded border border-line bg-surface text-ink"
              />
              <button
                type="submit"
                className="px-1.5 py-0.5 rounded bg-blue text-white text-[10px] font-bold"
              >
                ✓
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingGitHubRepo(true)}
              className="text-[10px] text-ink-muted hover:text-blue flex items-center gap-1 cursor-pointer"
            >
              <span>+ Link GitHub</span>
            </button>
          )}
        </div>

        {/* Commit Hash and Message */}
        {project.git?.lastCommitMessage ? (
          <div className="text-[11px] text-ink-muted truncate border-t border-line/60 pt-1.5 flex items-center gap-1.5">
            <span className="text-emerald-500 font-bold">✓</span>
            <span className="text-ink font-semibold">{project.git.lastCommitHash}</span>
            <span>·</span>
            <span className="text-ink truncate">{project.git.lastCommitMessage}</span>
          </div>
        ) : (
          <div className="text-[11px] text-ink-muted border-t border-line/60 pt-1.5">
            No commits recorded yet. Click "☁ GitHub Sync" or "⚡ Pulse" to fetch.
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
